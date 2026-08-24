/* ============================================================
   core.js - VidLibrary Lite
   Shared helpers: minimal Promise polyfill, XHR wrapper, DOM &
   formatting utilities. Strict ES5 - runs on old Android TVs
   (Chrome 30+, Android 4.4+). No ES6+ syntax, no fetch, no
   template literals, no arrow functions, no optional chaining.
   ============================================================ */
(function (global) {
  'use strict';

  var VL = global.VL || (global.VL = {});

  /* ---------------- Minimal Promise (works on Chrome 30+, IE) ---------------- */
  // Promises/A+-style: handles thenable assimilation (nested promises),
  // used heavily by the fallback chains in the data layer.
  function P(executor) {
    this._state = 0; // 0 pending, 1 fulfilled, 2 rejected
    this._value = null;
    this._handlers = [];
    var self = this;
    try {
      executor(
        function (value) { resolveP(self, value); },
        function (reason) { rejectP(self, reason); }
      );
    } catch (e) {
      rejectP(self, e);
    }
  }

  function resolveP(promise, value) {
    if (promise._state !== 0) return;
    if (value === promise) { rejectP(promise, new Error('Promise cannot resolve to itself')); return; }
    if (value && (typeof value === 'object' || typeof value === 'function')) {
      var then;
      try { then = value.then; } catch (e) { rejectP(promise, e); return; }
      if (typeof then === 'function') {
        var called = false;
        try {
          then.call(value,
            function (v) { if (called) return; called = true; resolveP(promise, v); },
            function (r) { if (called) return; called = true; rejectP(promise, r); });
        } catch (e) { if (!called) { called = true; rejectP(promise, e); } }
        return;
      }
    }
    fulfillP(promise, value);
  }

  function fulfillP(promise, value) {
    if (promise._state !== 0) return;
    promise._state = 1;
    promise._value = value;
    flushP(promise);
  }

  function rejectP(promise, reason) {
    if (promise._state !== 0) return;
    promise._state = 2;
    promise._value = reason;
    flushP(promise);
  }

  // Schedule processing of handlers that were registered while pending.
  function flushP(promise) {
    var handlers = promise._handlers;
    promise._handlers = [];
    setTimeout(function () {
      for (var i = 0; i < handlers.length; i++) {
        handleP(promise, handlers[i]);
      }
    }, 0);
  }

  function handleP(promise, h) {
    var isFulfilled = promise._state === 1;
    var cb = isFulfilled ? h.onFulfilled : h.onRejected;
    if (typeof cb !== 'function') {
      if (isFulfilled) h.resolve(promise._value);
      else h.reject(promise._value);
      return;
    }
    var result;
    try {
      result = cb(promise._value);
    } catch (e) {
      h.reject(e);
      return;
    }
    h.resolve(result);
  }

  P.prototype.then = function (onFulfilled, onRejected) {
    var self = this;
    return new P(function (resolve, reject) {
      if (self._state === 0) {
        self._handlers.push({
          onFulfilled: onFulfilled,
          onRejected: onRejected,
          resolve: resolve,
          reject: reject
        });
      } else {
        setTimeout(function () {
          handleP(self, {
            onFulfilled: onFulfilled,
            onRejected: onRejected,
            resolve: resolve,
            reject: reject
          });
        }, 0);
      }
    });
  };
  P.prototype['catch'] = function (onRejected) { return this.then(null, onRejected); };

  P.resolve = function (v) { return new P(function (r) { r(v); }); };
  P.reject = function (e) { return new P(function (_, r) { r(e); }); };
  P.all = function (arr) {
    return new P(function (resolve, reject) {
      var results = new Array(arr.length), done = 0;
      if (arr.length === 0) { resolve(results); return; }
      for (var i = 0; i < arr.length; i++) {
        (function (idx) {
          arr[idx].then(function (v) {
            results[idx] = v;
            done++;
            if (done === arr.length) resolve(results);
          }, function (e) { reject(e); });
        })(i);
      }
    });
  };
  VL.Promise = P;

  /* ---------------- XHR helper (fetch not available on old TVs) ---------------- */
VL.xhr = function (opts) {
     console.log('VL.xhr opts:', opts);
     return new P(function (resolve, reject) {
       var xhr = new XMLHttpRequest();
       xhr.open(opts.method || 'GET', opts.url, true);
       // Set a default User-Agent to avoid being blocked by some APIs
       if (!opts.headers || !opts.headers['User-Agent']) {
         xhr.setRequestHeader('User-Agent', 'VidLibrary Lite (https://github.com/behro/vid-library)');
         console.log('Set default User-Agent');
       } else {
         console.log('User-Agent already set:', opts.headers['User-Agent']);
       }
       if (opts.headers) {
         for (var k in opts.headers) {
           if (opts.headers.hasOwnProperty(k)) xhr.setRequestHeader(k, opts.headers[k]);
         }
       }
       if (opts.timeout) xhr.timeout = opts.timeout;
       xhr.onreadystatechange = function () {
         if (xhr.readyState !== 4) return;
         if (xhr.status >= 200 && xhr.status < 300) {
           resolve(xhr.responseText);
         } else {
           console.error('XHR error:', xhr.status, xhr.statusText, xhr.responseURL);
           if (xhr.status === 0) {
             reject(new Error('Network error'));
           } else {
             reject(new Error('HTTP ' + xhr.status));
           }
         }
       };
       xhr.onerror = function () {
         console.error('XHR network error');
         reject(new Error('Network error'));
       };
       xhr.ontimeout = function () {
         console.error('XHR timeout');
         reject(new Error('Timeout'));
       };
       xhr.send(opts.body || null);
     });
   };

  /* ---------------- DOM helpers ---------------- */
  VL.qs = function (sel, root) { return (root || document).querySelector(sel); };
  VL.qsa = function (sel, root) { return (root || document).querySelectorAll(sel); };

  VL.el = function (tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var key in attrs) {
        if (!attrs.hasOwnProperty(key)) continue;
        var val = attrs[key];
        if (val === undefined || val === null || val === false) continue;
        if (key === 'class') {
          node.className = val;
        } else if (key === 'text') {
          node.textContent = val;
        } else if (key === 'html') {
          node.innerHTML = val;
        } else if (key === 'style' && typeof val === 'object') {
          for (var s in val) { if (val.hasOwnProperty(s)) node.style[s] = val[s]; }
        } else if (key.indexOf('on') === 0 && typeof val === 'function') {
          node.addEventListener(key.substring(2).toLowerCase(), val);
        } else if (key === 'value') {
          node.value = val;
        } else if (key === 'checked') {
          node.checked = val;
        } else if (key === 'disabled') {
          node.disabled = val;
        } else {
          node.setAttribute(key, val);
        }
      }
    }
    if (children !== undefined && children !== null) {
      if (Object.prototype.toString.call(children) === '[object Array]') {
        for (var i = 0; i < children.length; i++) {
          var c = children[i];
          if (c === undefined || c === null || c === false) continue;
          if (typeof c === 'string' || typeof c === 'number') {
            node.appendChild(document.createTextNode(String(c)));
          } else if (c.nodeType) {
            node.appendChild(c);
          }
        }
      } else if (typeof children === 'string' || typeof children === 'number') {
        node.appendChild(document.createTextNode(String(children)));
      } else if (children.nodeType) {
        node.appendChild(children);
      }
    }
    return node;
  };

  /* ---------------- String / format helpers ---------------- */
  VL.escapeHtml = function (s) {
    if (s === undefined || s === null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  VL.isImdbId = function (s) { return /^tt\d{5,}$/i.test(String(s).trim()); };
  VL.extractImdbId = function (s) {
    if (!s) return null;
    var m = String(s).match(/tt\d{5,}/i);
    return m ? m[0].toLowerCase() : null;
  };
  VL.isNumeric = function (s) { return /^\d+$/.test(String(s)); };

  VL.formatTime = function (sec) {
    sec = Math.floor(sec || 0);
    if (isNaN(sec) || sec < 0) sec = 0;
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    var mm = m < 10 ? '0' + m : '' + m;
    var ss = s < 10 ? '0' + s : '' + s;
    return h > 0 ? (h + ':' + mm + ':' + ss) : (mm + ':' + ss);
  };

  VL.formatBytes = function (n) {
    n = Number(n) || 0;
    if (n <= 0) return '';
    var units = ['B', 'KB', 'MB', 'GB'];
    var i = 0;
    while (n >= 1024 && i < units.length - 1) { n = n / 1024; i++; }
    return (n >= 100 ? Math.round(n) : Math.round(n * 10) / 10) + ' ' + units[i];
  };

  VL.merge = function (target, source) {
    for (var k in source) { if (source.hasOwnProperty(k)) target[k] = source[k]; }
    return target;
  };

  VL.debounce = function (fn, ms) {
    var t = null;
    return function () {
      var args = arguments, self = this;
      if (t) clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  };

  /* ---------------- Blob URL (with webkit fallback) ---------------- */
  VL.blobUrlFromText = function (text, mime) {
    var urlFn = global.URL || global.webkitURL;
    var blob = new Blob([text], { type: mime || 'text/plain' });
    return urlFn.createObjectURL(blob);
  };

  /* ---------------- TV detection (same heuristic as main app) ---------------- */
  VL.isTvDevice = function () {
    if (!global.navigator) return false;
    var ua = (global.navigator.userAgent || '').toLowerCase();
    if (/android tv|bravia|smart-tv|smarttv|tizen|webos|hbbtv|kylo|roku|fire ?tv|appletv|vid_aa|viera|netcast|hisensetv|stb|tv browser/i.test(ua)) {
      return true;
    }
    var coarse = false;
    if (global.matchMedia) {
      coarse = global.matchMedia('(hover: none) and (pointer: coarse)').matches;
    }
    var wide = !!(global.screen && global.screen.width >= 1280 && global.screen.height >= 720);
    var phoneLike = /android.*mobile|iphone|ipad|ipod|windows phone/i.test(ua);
    return !!coarse && !!wide && !phoneLike;
  };

  /* ---------------- Scroll a horizontally scrollable row to reveal an element ---------------- */
  VL.scrollRowTo = function (el) {
    var container = el.parentNode;
    while (container && container !== document.body && container !== document.documentElement) {
      if (container.scrollWidth > container.clientWidth + 2) break;
      container = container.parentNode;
    }
    if (!container || container === document.body || container === document.documentElement) {
      try { el.scrollIntoView(true); } catch (e) {}
      return;
    }
    var target = el.offsetLeft - (container.clientWidth / 2) + (el.offsetWidth / 2);
    target = Math.max(0, Math.min(target, container.scrollWidth - container.clientWidth));
    container.scrollLeft = target;
  };

  global.VL = VL;
})(window);
