#!/usr/bin/env node
var exec = require('child_process').exec;
var fs = require('fs');
var q = require('q');
var wrench = require('wrench');
var colors = require('chalk');
var log = require('fancy-log');

function Main() {
  var config = require('./config.json');
  
  var backupDir = process.env.rms_minecraft_backupDir || config.minecraft.backupDir;
  var levelName = process.env.rms_minecraft_levelName || config.minecraft.levelName;
  var worldDir = './' + levelName;
  var version = process.env.rms_minecfraft_version || config.minecraft.version;
  var memoryStart = process.env.rms_minecraft_minMemory || config.minecraft.minMemory;
  var memoryMax = process.env.rms_minecraft_maxMemory || config.minecraft.maxMemory;
  var useCache = process.env.rms_cache_active || config.cache.active;
  var cacheMinSize = process.env.rms_cache_minSize || config.cache.minSize;
  var syncEvery = process.env.rms_cache_syncEvery || config.cache.syncEvery;
  var quotaAlert = process.env.rms_cache_quota_alert || config.cache.quota.alert;
  var quotaPercent = process.env.rms_cache_quota_percentage || config.cache.quota.percentage;
  var restartOnQuota = process.env_rms_cache_quota_auto || config.cache.quota.auto;

  var restarting = false;

  var RamDisk = require('./lib/ramdisk');
  var McServer = require('./lib/mcserver');
  var MemSize = require('./lib/memsize');

  var ramdisk;
  var mcServer;

  var service = {
    init: init
  };

  return service;
  ///////////////

  function init() {
    log(colors.green('Initialization started.'));
    create(backupDir).then(function() {
      create(worldDir).then(function() {
        backupWorld().then(function() {
          run();
        });
      });
    });
  }

  function run() {
    log(colors.green('Run started.'));

    mcServer = new McServer(version, memoryStart, memoryMax, {
      worldDir: worldDir,
      backupDir: backupDir + '/' + levelName,
      useCache: useCache,
      syncEvery: syncEvery,
      alert: quotaAlert,
      quotaPercent: quotaPercent,
      auto: restartOnQuota
    });

    if (useCache) {
      log('Using cache.');
      ramdisk = new RamDisk(levelName, worldDir, {
        backupDir: backupDir,
        minDiskSize: new MemSize(cacheMinSize)
      });
      ramdisk.mount().then(function() {
        startServer();
      });
    } else {
      log('Cache disabled.');
      startServer();
    }
  }

  /**
   * Backup world to `backupDir` when world exists and `backupDir` is empty.
   * This is usually usefull on first run in order to avoid deletion of
   * an existing world directory.
   *
   * @return {Promise}
   */
  function backupWorld() {
    var deferred = q.defer();
    var emptyDir = require('empty-dir');
    var isEmpty = emptyDir.sync(backupDir);
    fs.exists(worldDir, function(worldExists) {
      var worldIsEmpty = emptyDir.sync(worldDir);
      if (isEmpty && worldExists && !worldIsEmpty) {
        log('Backup ' + colors.cyan(worldDir) + ' to ' + colors.cyan(backupDir));
        wrench.copyDirSyncRecursive(worldDir, backupDir + '/' + levelName, {
          forceDelete: false,
          exclude: '.fseventsd'});
      }
      deferred.resolve();
    });
    return deferred.promise;
  }

  /**
   * Start server. Unmount ramdisk when cache enabled upon termination.
   */
  function startServer() {
    handleServerEvents();

    mcServer.start(function () {
      log('Cleaning.');
      if (ramdisk) {
        ramdisk.unmount().then(function() {
          exit();
        });
      } else {
        exit();
      }
    });
  }

  function handleServerEvents() {
    mcServer.on('cache.critical', function() {
      if (!restarting) {
        log(colors.red('Cache is critical. Scheduling restart in 1 minute.'));
        restarting = true;
        mcServer.sendCommand('\/say Cache size critical. Your server will be restarted in 1 minute.');
        setTimeout(function() {
          mcServer.stop(restarting).then(function() {
            ramdisk.unmount().then(function() {
              run();
              restarting = false;
            });
          });
        }, 60 * 1000);
      }
    });
  }

  /**
   * Exit from script.
   */
  function exit() {
    log('Exit.');
    process.exit();
  }

  /**
   * Create directory if not exists.
   * @param {string}  path  Directory path.
   * @return {promise}
   */
  function create(path) {
    var deferred = q.defer();
    fs.exists(path, function(exists) {
      if (!exists) {
        log('Creating ' + colors.cyan(path));
        fs.mkdirSync(path);
      } else {
        log(colors.cyan(path) + ' found.')
      }
      deferred.resolve();
    });
    return deferred.promise;
  }
}

Main().init();



