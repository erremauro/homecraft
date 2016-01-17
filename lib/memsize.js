function MemSize(size) {
  var self = this;

  var sizeType = typeof size;
  switch (sizeType) {
    case 'string':
      self._size = parseSize(size);
      break;
    case 'number':
      self._size = size;
      break;
    default:
      throw 'Error: Invalid size type. Size should be either a string or number. ' +
        sizeType + ' received instead.';
      break;
  }

  function parseSize(sizeString) {
    var pattern = /(\d+)(g|m|k|b|s)/i
    var matches = sizeString.match(pattern);

    if (matches === null) {
      throw "Error: invalide memory size format";
    }

    var sizeValue = parseInt(matches[1]);
    var sizeUnit = matches[2].toLowerCase();

    switch (sizeUnit) {
      case 'g':
        return sizeValue * 1024 * 1024 * 1024;
      case 'm':
        return sizeValue * 1024 * 1024;
      case 'k':
        return sizeValue * 1024;
      case 's':
        return sizeValue * 512;
      default:
        return sizeValue;
    }
  }
}

MemSize.prototype.get = function() {
  return this._size;
}

MemSize.prototype.bytes = function() {
  return this._size;
}

MemSize.prototype.sectors = function() {
  return this._size / 512;
}

MemSize.prototype.kilobytes = function() {
  return this._size / 1024;
}

MemSize.prototype.megabytes = function() {
  return this._size / 1024 / 1024;
}

MemSize.prototype.gigabytes = function() {
  return this._size / 1024 / 1024 / 1024;
}

MemSize.prototype.eq = function(size) {
  return this._size === size.get();
}

MemSize.prototype.gt = function(size) {
  return this._size > size.get();
}

MemSize.prototype.lt = function(size) {
  return this._size < size.get();
}

MemSize.prototype.gte = function(size) {
  return this._size >= size.get();
}

MemSize.prototype.lte = function(size) {
  return this._size <= size.get();
}

module.exports = MemSize