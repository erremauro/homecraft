var fs = require('fs');
var EventEmitter = require('events');
var util = require('util');
var glob = require('glob');
var exec = require('child_process').exec;
var colors = require('chalk')
var log = require('fancy-log');
var q = require('q');
var wrench = require('wrench');
var extend = require('extend');
var chokidar = require('chokidar');
var diskspace = require('diskspace');
var stopwatch = require('./stopwatch');

var options = {
  backupDir: './backup/world',
  worldDir: './world',
  syncEvery: '5m',
  useCache: true,
  alert: true,
  quotaPercent: 80,
  auto: true
};

/**
 * A minecraft server controller
 * @param {string}  ver   Minecraft version.
 * @param {number}  min   Minimum allocated memory.
 * @param {number}  max   Max allocated memory.
 */
function MinecraftServer(ver, min, max) {
  EventEmitter.call(this);
  var self = this;

  self._server = null;
  self.worldDir = options.worldDir;
  self.backupDir = options.backupDir;

  self._serverFile = 'minecraft_server.' + ver + '.jar';
  glob('./minecraft_server*.jar', function(error, files) {
    if (error) {
      log.error(error);
    }

    if (files.length === 0) {
      log.error('Minecraft server jar file not found. Downlaod now from: ' +
        colors.cyan('https://minecraft.net/download'));
      process.exit();
    }

    if (files.length === 1) {
      self._serverFile = files[0];
    }
  });

  self.syncFrequency = self._getSyncFrequency(options.syncEvery);

  // define java command that launch minecraft jar file.
  self._cmd = 'java -Xms' + min + ' -Xmx' + max +
    ' -jar ' + self._serverFile + ' nogui';
}
util.inherits(MinecraftServer, EventEmitter);

MinecraftServer.prototype._getSyncFrequency = function(frequencyString) {
  function s2ms(s) { return s * 1000; }
  function m2ms(m) { return m * 60 * 1000; }
  function h2ms(h) { return h * 60 * 60 * 1000; }

  // match 1m, 10s, 300MS, 5H ...
  var pattern = /(\d+)(ms|m|s|h)/i;
  var matches = frequencyString.match(pattern);

  if (matches === null) {
    log.error('Invalid cache frequency options. "' + frequencyString + '" is not a valid format.' +
      'Use a number followed by a unit measurment of time. Valid values are: m (minutes), s(seconds), ' +
      'ms (milliseconds), h (hours). Reverting to a default value of 5m');
    return m2ms(5);
  } else {
    var unit = matches[2];
    var value = parseInt(matches[1]);
    switch (unit.toLowerCase()) {
      case 's':
        return s2ms(value);
      case 'm':
        return m2ms(value);
      case 'h':
        return h2ms(value);
      default:
        return value;
    }
  }
}

MinecraftServer.prototype.start = function(cb) {
  var self = this;
  self._restarting = false;

  // Copy data from backup to world directory
  log('Restoring world data.');
  wrench.copyDirSyncRecursive(self.backupDir, self.worldDir, {forceDelete:true});
  
  // start server process
  log('Starting Server.');
  self._server = exec(self._cmd);
  
  // log minecraft server output to console.
  self._server.stdout.on('data', function(data) {
    // remove timestamp from minecraft server stdout
    var pattern = /^\[\d+:\d+:\d+\]\s/;
    var msg = data.replace(pattern, '').trim();
    log(colors.yellow(msg));
  });

  // log minecraft server error to console.
  self._server.stderr.on('data', function (data) {
    log.error(data);
  });

  // exit from this script when minecraft server close.
  self._server.on('close', function() {
    if (!self._restarting) {
      if (typeof cb === 'function') {
        cb.apply(function() {
          process.exit();
        });
      } else {
        process.exit();
      }
    }
  });

  self._setupListeners();
  
}

MinecraftServer.prototype._setupListeners = function() {
  var self = this;
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', function(data) {
    self._handleUserInput(self, data);
  });
  process.on('SIGINT', function() {
    log(colors.green('Unexpected shutdown by user. Write \'stop\' to stop the server gracefully.'));
    self.stop();
  });

  self._watchWorldData();
  self._startAutomatedSync();
}

MinecraftServer.prototype._clearListeners = function() {
  var self = this;
  self._clearListener(process.stdin, 'data');
  self._clearListener(process, 'SIGINT');
}

MinecraftServer.prototype._clearListener = function(emitter, eventName) {
  var listeners = emitter.listeners(eventName);
  var len = listeners.length;
  for (var i = 0; i < len; i++) {
    var func = listeners[i];
    emitter.removeListener(eventName, func);
  }
}

MinecraftServer.prototype._watchWorldData = function() {
  var self = this;
  if (options.useCache) {
    self.watcher = chokidar.watch(options.worldDir);
    stopwatch.start();

    self.watcher.on('change', function(path, stats) {
      fs.stat(options.worldDir, function(err, stats) {
        if (stats) {
          diskspace.check(options.worldDir, function(err, total, free, status) {
            if (!err) {
              var occupied = total - free;
              var maxQuota = (options.quotaPercent / 100) * total;
              var currentPercent = Math.floor((occupied * 100) / total);

              stopwatch.stop();

              if (occupied >= maxQuota && options.auto) {
                self.emit('cache.critical');
              }

              if (occupied >= maxQuota && stopwatch.elapsed.seconds > 60) {
                var alertMessage = 'Your world size have reached ' + options.quotaPercent +
                  '% capacity of total allocated cache. Currently Occupied: ' + currentPercent + '%';
                
                log(colors.red(alertMessage));

                if (options.alert && self._server) {
                  try {
                    self._server.stdin.write('\/say ' + alertMessage + '\n');
                  } catch(err) {
                    log.error(err);
                  }
                }

                stopwatch.reset();
                stopwatch.start();
              }
            }
          });
        }
      });
    });
  }
}

MinecraftServer.prototype._startAutomatedSync = function() {
  setInterval(function() {
    log('Syncing. Next sync in about ' + colors.cyan(options.syncEvery));
    self.save();
  }, self.syncFrequency);
}

MinecraftServer.prototype._handleUserInput = function(self, data) {
  switch (data.toString().trim()) {
    case 'stop':
      self.stop();
      break;
    case 'save':
      self.save();
      break;
    case 'rs':
    case 'restart':
      self.restart();
      break;
    default:
      self._server.stdin.write(data);
      break;
  }
}

MinecraftServer.prototype.sendCommand = function(command) {
  var self = this;
  if (self._server) {
    self._server.stdin.write(command + '\n');
  }
}

MinecraftServer.prototype.stop = function(restart) {
  var self = this;
  var deferred = q.defer();

  if (self._server === null) {
    var errorMessage = 'Error: Minecraft Server is not running.';
    log.error(errorMessage);
    deferred.reject(errorMessage);
    return -1;
  };

  log('Stopping Server.');
  self.save().then(function() {
    self.watcher.close();
    self._restarting = restart;

    self._server.on('close', function() {
      self._clearListeners();
      deferred.resolve();
    });

    self._server.kill();
  });

  return deferred.promise;
}

MinecraftServer.prototype.save = function() {
  var deferred = q.defer();
  var self = this;

  log('Saving World.');
  self._server.stdin.write('/save-all\n');
  setTimeout(function() {
    log('Syncing data.');
    wrench.copyDirSyncRecursive(self.worldDir, self.backupDir, {
      forceDelete:true,
      exclude: '.fseventsd'
    });
    deferred.resolve();
  }, 2000);
  return deferred.promise;
}

MinecraftServer.prototype.restart = function() {
  var self = this;
  log(colors.green('Server restart requested by user.'))
  self.stop(true).then(function() {
    self.start();
  });
}

module.exports = function(ver, min, max, opts) {
  extend(options, opts);
  return new MinecraftServer(ver, min, max);
}