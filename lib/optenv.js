var extend = require('extend');
var traverse = require('traverse');

var options = {
  prefix: ''
};

/**
 * Map an option object against existing environment variables.
 * Environment variable's values takes precedent over existing value
 * in the resulting object.
 * @param {object}  obj   Option object.
 * @return {object}.
 */
function parse(obj) {
  traverse(obj).forEach(function(val) {
    if (this.path && this.path.length > 0 && 'object' !== typeof val) {
      var key = options.prefix;
      var len = this.path.length;
      
      for(var i = 0; i < len; i++) {
        key += key !== '' ? '_' + this.path[i] : this.path[i];
      }

      // overridden by environment variable if exists.
      if (process.env.hasOwnProperty(key) && 
        process.env[key].trim() !== '') {
        this.update(parseValue(process.env[key]));
      }
    }
  });

  return obj;
}

/**
 * Try to parse a string value to its type.
 * @param {string}  val   String value.
 * @param {any}
 */
function parseValue(val) {
  if (val === undefined || val === null || val === '') return null;

  // Try to parse as boolean
  if (!isNaN(val)) {
    // Try to parse as number
    var pattern = /\d+\.\d+/;
    var matches = val.match(pattern);

    if (matches) {
      return parseFloat(val);
    } else {
      return parseInt(val);
    }
  }

  // Try to parse as boolean
  switch (val.toLowerCase()) {
    case 'true': return true;
    case 'false': return false;
  }

  // Try to parse as JSON.
  // These works also for arrays.
  try {
    return JSON.parse(val);
  } catch(err) {
    return val;
  }

  // Don't know. Return as string.
  return val;
}

module.exports = function(obj, opts) {
  if (opts) extend(options, opts);
  return parse(obj);
}