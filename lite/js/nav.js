/* ============================================================
   nav.js - VidLibrary Lite
   Hash router + D-pad / arrow-key spatial navigation tuned for
   TV remotes. All ES5.
   ============================================================ */
(function () {
  'use strict';
  var VL = window.VL;

  /* ---------------- routing ---------------- */
  function parseHash() {
    var h = (location.hash || '#/').replace(/^#/, '');
    if (h === '' || h === '/') return { name: 'home' };

    var tvFull = h.match(/^\/tv\/([^\/]+)\/season\/(\d+)\/episode\/(\d+)$/);
    if (tvFull) {
      return {
        name: 'tv',
        id: tvFull[1],
        season: parseInt(tvFull[2], 10) || 1,
        episode: parseInt(tvFull[3], 10) || 1
      };
    }
    var tvShort = h.match(/^\/tv\/([^\/]+)$/);
    if (tvShort) return { name: 'tv', id: tvShort[1], season: 1, episode: 1 };

    var movie = h.match(/^\/movie\/([^\/]+)$/);
    if (movie) return { name: 'movie', id: movie[1] };

    return { name: 'notfound' };
  }

  function render() {
    var route = parseHash();
    var root = document.getElementById('app');
    if (!root) return;
    try { window.scrollTo(0, 0); } catch (e) {}
    if (route.name === 'home') VL.Views.home(root);
    else if (route.name === 'movie') VL.Views.movie(root, route.id);
    else if (route.name === 'tv') VL.Views.tv(root, route.id, route.season, route.episode);
    else VL.Views.notfound(root);
  }

  function go(path) {
    location.hash = path;
  }

  function back() {
    var route = parseHash();
    if (route.name === 'home') return;
    go('#/');
  }

  /* ---------------- spatial navigation ---------------- */
  function focusables() {
    var els = VL.qsa('a[href], button, input, select, textarea, [tabindex]', document);
    var out = [];
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.disabled) continue;
      var rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      out.push(el);
    }
    return out;
  }

  function directionalScore(a, b, dir) {
    var acx = a.left + a.width / 2, acy = a.top + a.height / 2;
    var bcx = b.left + b.width / 2, bcy = b.top + b.height / 2;
    var dx = bcx - acx, dy = bcy - acy;
    var inDir = false;
    if (dir === 'left') inDir = dx < -5;
    else if (dir === 'right') inDir = dx > 5;
    else if (dir === 'up') inDir = dy < -5;
    else if (dir === 'down') inDir = dy > 5;
    if (!inDir) return -1;
    var overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    var overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    var dist = Math.sqrt(dx * dx + dy * dy);
    var pen = 0;
    if (dir === 'left' || dir === 'right') {
      if (Math.abs(dy) > (a.height + b.height) / 2) pen = 1;
      else if (overlapY <= 0) pen = 0.5;
    } else {
      if (Math.abs(dx) > (a.width + b.width) / 2) pen = 1;
      else if (overlapX <= 0) pen = 0.5;
    }
    return dist * (1 + pen);
  }

  function move(dir) {
    var els = focusables();
    if (!els.length) return;
    var current = document.activeElement;
    var cur = (current && current.nodeType === 1 && current !== document.body) ? current : els[0];
    var cRect = cur.getBoundingClientRect();
    var best = null, bestScore = Infinity;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el === cur) continue;
      var r = el.getBoundingClientRect();
      var score = directionalScore(cRect, r, dir);
      if (score >= 0 && score < bestScore) { bestScore = score; best = el; }
    }
    if (best) {
      best.focus();
      VL.scrollRowTo(best);
    }
  }

  function enter() {
    var el = document.activeElement;
    if (!el || el.nodeType !== 1) return;
    var tag = el.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (typeof el.click === 'function') {
      try { el.click(); } catch (e) {}
    }
  }

  function onKey(e) {
    var active = document.activeElement;
    var tag = (active && active.tagName) || '';
    var typing = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
    var key = e.key || '';
    var kc = e.keyCode || e.which || 0;

    if (!key) {
      if (kc === 37) key = 'ArrowLeft';
      else if (kc === 38) key = 'ArrowUp';
      else if (kc === 39) key = 'ArrowRight';
      else if (kc === 40) key = 'ArrowDown';
      else if (kc === 13) key = 'Enter';
      else if (kc === 27) key = 'Escape';
    }

    if (typing) return;

    if (key === 'ArrowUp') { e.preventDefault(); move('up'); }
    else if (key === 'ArrowDown') { e.preventDefault(); move('down'); }
    else if (key === 'ArrowLeft') { e.preventDefault(); move('left'); }
    else if (key === 'ArrowRight') { e.preventDefault(); move('right'); }
    else if (key === 'Enter') { e.preventDefault(); enter(); }
    else if (key === 'Escape') { e.preventDefault(); back(); }
  }

  function init() {
    window.addEventListener('hashchange', render);
    document.addEventListener('keydown', onKey);
    render();
  }

  VL.Nav = { go: go, back: back, init: init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
