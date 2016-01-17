var exec = require('child_process').exec;
var q = require('q');
var colors = require('chalk');
var log = require('fancy-log');
var getSize = require('get-folder-size');
var extend = require('extend');
var MemSize = require('./memsize');

var options = {
  backupDir: './backup',
  minDiskSize: new MemSize('256M')
};

/**
 * Represents a ramdisk that can be mounted and unmounted.
 * @param {string}  name        Volumne label.
 * @param {string}  mountPoint  Target path;
 */
function RamDisk(name, mountPoint) {
  this.name = name;
  this.mountPoint = mountPoint;
}

/**
 * Get ramdisk target size in sectors
 * @return {number} DiskSize of disk in sectors
 */
RamDisk.prototype.getDiskSize = function () {
  var deferred = q.defer();
  getSize(options.backupDir, function(err, size) {
    if (err) {
      log.error(err);
      return -1;
    }
    var targetSize = new MemSize(size + (size / 2));
    targetSize = targetSize.lt(options.minDiskSize) ? options.minDiskSize : targetSize;
    deferred.resolve(targetSize);
  });
  return deferred.promise;
}

/**
 * Mount a ramdisk on ramdisk's mountPoint
 */
RamDisk.prototype.mount = function() {
  var self = this;
  var deferred = q.defer();

  self.getDiskSize().then(function (size) {
    log('Creating ramdisk of size ' + colors.cyan(size.megabytes() + 'MB'));
    exec('hdid -nomount ram://' + size.sectors(), function(error, data, stderr) {
      if (error !== null) {
        log.error(error);
        deferred.reject();
        return -1;
      }

      self._diskDevice = data.trim();

      log('Formatting ' + colors.cyan(self._diskDevice));
      exec('newfs_hfs -v "' + self.name +'" ' + self._diskDevice, function(error, data, stderr) {
        if (error !== null) {
          log.error(stderr);
          deferred.reject();
          return -1;
        }

        log('Mounting ' + colors.cyan(self._diskDevice) + ' at path ' +colors.cyan(self.mountPoint));
        exec('mkdir ' + self.mountPoint + '; mount -o noatime -t hfs ' + self._diskDevice + ' ' + self.mountPoint,
          function(error, data, stderr) {
            if (error !== null) {
              log.error(stderr);
              deferred.reject();
              return -1;
            }

            deferred.resolve();
          });
      });
    });
  });

  return deferred.promise;
}

RamDisk.prototype.unmount = function() {
  var self = this;
  var deferred = q.defer();
  // unmount Volume
  log('Unmounting ' + colors.cyan(self.mountPoint));
  exec('umount ' + self.mountPoint, function(error, data, stderr) {
    if (error !== null) {
      log.error(stderr);
      deferred.reject();
      return -1;
    }
    // eject ram disk
    if (self._diskDevice) {
      log('Ejecting ' + colors.cyan(self._diskDevice));
      exec('diskutil eject ' + self._diskDevice, function(error, data, stderr) {
        if (error !== null) {
          log.error(stderr);
          deferred.reject();
        }
        deferred.resolve();
      });
    } else {
      deferred.resolve();
    }
    
  });
  return deferred.promise;
}

module.exports = function(name, mountPoint, opts) {
  if (opts) {
    extend(options, opts);
  }
  return new RamDisk(name, mountPoint);
}