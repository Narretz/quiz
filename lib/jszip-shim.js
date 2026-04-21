(function () {
  var enc = new TextEncoder();
  var fflatePromise = null;

  function loadFflate() {
    if (!fflatePromise) {
      fflatePromise = import("https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js");
    }
    return fflatePromise;
  }

  function JSZipShim() {
    this._files = {};
  }

  JSZipShim.prototype.file = function (name, data, opts) {
    if (data == null) return this;
    var bytes;
    if (opts && opts.base64) {
      var bin = atob(data);
      bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } else if (data instanceof Uint8Array) {
      bytes = data;
    } else if (data instanceof ArrayBuffer) {
      bytes = new Uint8Array(data);
    } else {
      bytes = enc.encode(String(data));
    }
    this._files[name] = bytes;
    return this;
  };

  JSZipShim.prototype.folder = function () {
    return this;
  };

  JSZipShim.prototype.generateAsync = function (opts) {
    var files = this._files;
    return loadFflate().then(function (fflate) {
      var zipped = fflate.zipSync(files, { level: 0 });
      var type = opts && opts.type;
      if (type === "arraybuffer") {
        return zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength);
      }
      if (type === "uint8array" || type === "nodebuffer") {
        return zipped;
      }
      if (type === "base64") {
        var bin = "";
        for (var i = 0; i < zipped.length; i++) bin += String.fromCharCode(zipped[i]);
        return btoa(bin);
      }
      return new Blob([zipped], {
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      });
    });
  };

  window.JSZip = JSZipShim;
})();
