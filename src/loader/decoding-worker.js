/**
 * Web Worker for H.265 decoding
 * ES5 compatible - no ES6+ syntax allowed in Worker
 */

// Import decoding modules using importScripts
// This will be handled by Webpack when bundling
// For now, we'll define the Decode class inline or import it properly

var decode;

self.addEventListener('message', function(event) {
  var eventData = event.data;
  var cmd = eventData.cmd;
  var data = eventData.data;

  if (cmd === 'init') {
    // Initialize WASM decoder
    if (typeof decode === 'undefined') {
      // Decode class will be available from the main bundle
      return;
    }
    decode.loadWASM(event);
  } else if (cmd === 'decode') {
    if (typeof decode !== 'undefined') {
      decode.push(data);
    }
  } else if (cmd === 'reset') {
    if (typeof decode !== 'undefined') {
      decode.reset();
    }
  } else if (cmd === 'flush') {
    if (typeof decode !== 'undefined') {
      decode.flush();
    }
  } else if (cmd === 'close') {
    if (typeof decode !== 'undefined') {
      decode.closeDecode();
    }
    self.close();
  }
});

// Export for webpack
if (typeof module !== 'undefined' && module.exports) {
  module.exports = function() {
    return {
      setDecode: function(d) {
        decode = d;
      }
    };
  };
}
