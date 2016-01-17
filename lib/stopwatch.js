function StopWatch() {
  this.startTime = null;
  this.endTime = null;

  this.elapsed = {
    milliseconds: 0,
    seconds: 0,
    minutes: 0,
    hours: 0
  }
}

StopWatch.prototype.start = function() {
  this.startTime = new Date();
}

StopWatch.prototype.stop = function() {
  this.endTime = new Date();
  this._updateElapsed();
}

StopWatch.prototype.reset = function() {
  this.elapsed = {
    milliseconds: 0,
    seconds: 0,
    minutes: 0,
    hours: 0
  }
}

StopWatch.prototype._updateElapsed = function() {
  var ms = this.endTime.getTime() - this.startTime.getTime();
  this.elapsed = {
    milliseconds: ms,
    seconds: Math.abs(ms / 1000),
    minutes: Math.abs((ms / 1000) / 60),
    hours: Math.abs((ms / 1000) / 60 / 60)
  }
}

module.exports = new StopWatch();
