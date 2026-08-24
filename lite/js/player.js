/* ============================================================
   player.js - VidLibrary Lite
   Video player: iframe embed servers only (VidRock / VidAPI /
   Videoasy / Peachify / VidSrc / VidCore / VidZee). The direct-MP4
   path was removed (never reliable on old TVs). Saves watch progress
   via embed postMessage events. Features matching the main app:
   server status dots, end-of-content overlay, fullscreen button/key,
   remembered-first fallback ordering, server health recording.
   All ES5.
   ============================================================ */
(function () {
  'use strict';
  var VL = window.VL;

  var PROVIDER_NAMES = {
    vidrock:  { id: 'vidrock',  name: 'Server 1', sub: 'VidRock' },
    vidapi:   { id: 'vidapi',   name: 'Server 2', sub: 'VidAPI' },
    videasy:  { id: 'videasy',  name: 'Server 3', sub: 'Videoasy' },
    peachify: { id: 'peachify', name: 'Server 4', sub: 'Peachify' },
    vidsrc:   { id: 'vidsrc',   name: 'Server 5', sub: 'VidSrc' },
    vidcore:  { id: 'vidcore',  name: 'Server 6', sub: 'VidCore' },
    vidzee:   { id: 'vidzee',   name: 'Server 7', sub: 'VidZee' }
  };

  // All providers share the same capability set as the main app:
  // subtitles=true, progress=true, autoplay=false (all currently false).
  var PROVIDER_CAPS = {
    supportsSubtitles: true,
    supportsProgress: true,
    supportsAutoplayNext: false
  };

  function getServer(id) {
    return PROVIDER_NAMES[id] || PROVIDER_NAMES.vidrock;
  }

  function getServerStatusClass(provider) {
    var status = VL.Store.getServerStatus(provider);
    if (status === 'ok') return 'dot-ok';
    if (status === 'bad') return 'dot-bad';
    return 'dot-unknown';
  }

  function buildEmbedUrl(srv, media, season, episode, resumeAt) {
    var id = media.id;
    var base, p = [];

    // Identify providers that require numeric TMDB IDs
    var tmdbRequiredProviders = ['peachify', 'videasy', 'vidzee'];

    if (tmdbRequiredProviders.indexOf(srv.id) >= 0) {
      // These need a numeric TMDB id. If the id is already numeric we can return it directly.
      if (VL.isNumeric(id)) {
        return buildEmbedUrlResolved(srv, id, media.type, season, episode, resumeAt);
      }
      // Try to resolve the IMDB ID to a numeric TMDB ID via the API.
      // If resolution fails, fall back to vidrock which accepts IMDB IDs directly.
      return VL.API.tmdbFind(id).then(function (found) {
        var tmdbId = found ? found.id : null;
        if (tmdbId) {
          return buildEmbedUrlResolved(srv, tmdbId, media.type, season, episode, resumeAt);
        }
        // TMDB resolution failed - fall back to vidrock which accepts IMDB IDs
        // This prevents "PDF file not found" errors when passing IMDB IDs (tt1234567)
        // to servers that expect numeric TMDB IDs.
        if (srv.id === 'vidrock') {
          base = media.type === 'movie'
            ? ('https://vidrock.ru/embed/movie/' + id)
            : ('https://vidrock.ru/embed/tv/' + id + '/' + season + '/' + episode);
          if (resumeAt) p.push('resumeAt=' + resumeAt);
        } else {
          // For other providers (vidapi, vidsrc, vidcore, vidzee), fall back to vidrock
          base = media.type === 'movie'
            ? ('https://vidrock.ru/embed/movie/' + id)
            : ('https://vidrock.ru/embed/tv/' + id + '/' + season + '/' + episode);
          if (resumeAt) p.push('resumeAt=' + resumeAt);
        }
        return VL.Promise.resolve(base + (p.length ? ('?' + p.join('&')) : ''));
      });
    }

    // vidrock, vidapi, vidsrc, vidcore
    if (srv.id === 'vidrock') {
      base = media.type === 'movie'
        ? ('https://vidrock.ru/embed/movie/' + id)
        : ('https://vidrock.ru/embed/tv/' + id + '/' + season + '/' + episode);
      if (resumeAt) p.push('resumeAt=' + resumeAt);
    } else if (srv.id === 'vidapi') {
      base = media.type === 'movie'
        ? ('https://vaplayer.ru/embed/movie/' + id)
        : ('https://vaplayer.ru/embed/tv/' + id + '/' + season + '/' + episode);
      if (resumeAt) p.push('resumeAt=' + resumeAt);
    } else if (srv.id === 'vidsrc') {
      base = media.type === 'movie'
        ? ('https://vidsrc.to/embed/movie/' + id)
        : ('https://vidsrc.to/embed/tv/' + id + '/' + season + '/' + episode);
      if (resumeAt) p.push('resumeAt=' + resumeAt);
    } else if (srv.id === 'vidcore') {
      base = media.type === 'movie'
        ? ('https://vidcore.io/movie/' + id + '?autoPlay=true')
        : ('https://vidcore.io/tv/' + id + '/' + season + '/' + episode + '?autoPlay=true');
    } else {
      // Fallback to vidrock
      base = media.type === 'movie'
        ? ('https://vidrock.ru/embed/movie/' + id)
        : ('https://vidrock.ru/embed/tv/' + id + '/' + season + '/' + episode);
      if (resumeAt) p.push('resumeAt=' + resumeAt);
    }
    return VL.Promise.resolve(base + (p.length ? ('?' + p.join('&')) : ''));
  }

  function buildEmbedUrlResolved(srv, tmdbId, type, season, episode, resumeAt) {
    var base, p = [];
    if (srv.id === 'peachify') {
      base = type === 'movie'
        ? ('https://peachify.top/embed/movie/' + tmdbId)
        : ('https://peachify.top/embed/tv/' + tmdbId + '/' + season + '/' + episode);
      if (resumeAt) p.push('startAt=' + resumeAt);
      p.push('autoPlay=false');
    } else if (srv.id === 'videasy') {
      base = type === 'movie'
        ? ('https://player.videasy.to/movie/' + tmdbId)
        : ('https://player.videasy.to/tv/' + tmdbId + '/' + season + '/' + episode);
      if (resumeAt) p.push('progress=' + resumeAt);
    } else { // vidzee
      base = type === 'movie'
        ? ('https://player.vidzee.wtf/embed/movie/' + tmdbId)
        : ('https://player.vidzee.wtf/embed/tv/' + tmdbId + '/' + season + '/' + episode);
      if (resumeAt) p.push('startTime=' + resumeAt);
    }
    return base + (p.length ? ('?' + p.join('&')) : '');
  }

  var state = null; // { container, media, season, episode, serverId, iframe, onAutoNext, nextSeason, nextEpisode, manualOverride, ended, isFullscreen, autoFallbackCount }

  /* ---------------- public render ---------------- */
  function render(container, media, season, episode, onAutoNext, nextSeason, nextEpisode) {
    state = {
      container: container,
      media: media,
      season: season || 1,
      episode: episode || 1,
      serverId: null,
      iframe: null,
      onAutoNext: typeof onAutoNext === 'function' ? onAutoNext : null,
      nextSeason: nextSeason !== null && nextSeason !== undefined ? nextSeason : null,
      nextEpisode: nextEpisode !== null && nextEpisode !== undefined ? nextEpisode : null,
      manualOverride: false,
      ended: false,
      isFullscreen: false,
      autoFallbackCount: 0
    };
    container.innerHTML = '';

    var settings = VL.Store.getSettings();
    // Default server: settings default, then remembered provider, then Server 1.
    var defaultServer = settings.defaultProvider;
    var remembered = VL.Store.getRememberedProvider(media.id);
    if (remembered && !state.manualOverride) defaultServer = remembered;
    state.serverId = defaultServer;

    renderHeader();
    renderServerBar();

    var frameWrap = VL.el('div', { class: 'video-frame' });
    container.appendChild(frameWrap);
    state.frameWrap = frameWrap;

    renderEmbed(frameWrap, getServer(state.serverId));
  }

  function renderHeader() {
    var header = VL.el('div', { class: 'player-header' });

    // Title + meta
    var titleBox = VL.el('div', { class: 'player-title-box' });
    titleBox.appendChild(VL.el('span', { class: 'player-title', text: state.media.title || '' }));

    var metaParts = [];
    if (state.media.year) metaParts.push(state.media.year);
    if (state.media.duration) metaParts.push(formatDuration(state.media.duration));
    if (state.media.rating) metaParts.push('\u2605 ' + state.media.rating);
    titleBox.appendChild(VL.el('span', { class: 'player-meta', text: metaParts.join(' \u00b7 ') }));
    header.appendChild(titleBox);



    state.container.appendChild(header);
  }

  function formatDuration(duration) {
    if (!duration) return '';
    var mins = parseInt(duration, 10);
    if (!mins) return duration;
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    return h ? (h + 'h ' + m + 'm') : (m + 'm');
  }

  function renderServerBar() {
    var order = VL.Store.getProviderFallbackOrder();
    var bar = VL.el('div', { class: 'server-bar', role: 'group' });
    bar.setAttribute('aria-label', 'Choose video server');

    for (var i = 0; i < order.length; i++) {
      (function (srv) {
        var active = srv.id === state.serverId;
        var btn = VL.el('button', {
          class: 'server-btn focusable' + (active ? ' active' : ''),
          'data-server': srv.id
        });
        btn.setAttribute('role', 'button');

        var nameSpan = VL.el('span', { class: 'server-btn-name', text: srv.name });
        btn.appendChild(nameSpan);

        var subSpan = VL.el('span', { class: 'server-btn-sub', text: srv.sub });
        btn.appendChild(subSpan);

        var dot = VL.el('span', { class: 'status-dot ' + getServerStatusClass(srv.id) });
        dot.setAttribute('aria-label', VL.Store.getServerStatus(srv.id));
        btn.appendChild(dot);

        btn.addEventListener('click', function () { selectServer(srv.id); });
        bar.appendChild(btn);
      })(getServer(order[i]));
}
 
// Player controls (fullscreen button)
     var fsBtn = VL.el('button', {
       class: 'server-btn focusable',
       'data-action': 'fullscreen',
       title: 'Toggle fullscreen (F)',
       role: 'button'
     });
     var nameSpan = VL.el('span', { class: 'server-btn-name', text: '' });
     var subSpan = VL.el('span', { class: 'server-btn-sub', text: '' });
     var dotSpan = VL.el('span', { class: 'status-dot', text: '\u26f6' });
     fsBtn.appendChild(nameSpan);
     fsBtn.appendChild(subSpan);
     fsBtn.appendChild(dotSpan);
fsBtn.addEventListener('click', toggleFullscreen);
 
     // "Try another server" button (manual fallback, remembered-first order)
    var tryBtn = VL.el('button', {
      class: 'server-btn focusable',
      role: 'button',
      style: { 'margin-left': 'auto' }
    });
    var nameSpan = VL.el('span', { class: 'server-btn-name', text: 'Try another server' });
    var subSpan = VL.el('span', { class: 'server-btn-sub', text: '' });
    var dotSpan = VL.el('span', { class: 'status-dot', text: '' });
    tryBtn.appendChild(nameSpan);
    tryBtn.appendChild(subSpan);
    tryBtn.appendChild(dotSpan);
    tryBtn.addEventListener('click', function () {
      var order = VL.Store.getProviderFallbackOrder();
      var idx = 0;
      for (var i = 0; i < order.length; i++) {
        if (order[i] === state.serverId) { idx = i; break; }
      }
      var next = order[(idx + 1) % order.length];
      selectServer(next);
    });
    bar.appendChild(tryBtn);

    // Fullscreen button (same visuals as server buttons, placed at end of row)
    bar.appendChild(fsBtn);

    state.container.appendChild(bar);
  }

  /* ---------------- server selection ---------------- */
  function selectServer(serverId) {
    if (!state) return;
    state.manualOverride = true;
    state.serverId = serverId;
    state.ended = false;
    state.autoFallbackCount = 0;
    // Rebuild the bar + frame
    var header = VL.qs('.player-header', state.container);
    var bar = VL.qs('.server-bar', state.container);
    var frameWrap = state.frameWrap;

    state.container.innerHTML = '';
    renderHeader();
    renderServerBar();

    var newFrameWrap = VL.el('div', { class: 'video-frame' });
    state.container.appendChild(newFrameWrap);
    state.frameWrap = newFrameWrap;
    state.iframe = null;

    renderEmbed(newFrameWrap, getServer(serverId));
    VL.Store.setProviderPref(serverId);
    if (typeof VL.Views.refreshProgress === 'function') VL.Views.refreshProgress();
  }

  /* ---------------- embed iframe ---------------- */
  function renderEmbed(frame, srv) {
    var loader = VL.el('div', { class: 'video-loading', text: 'Loading ' + srv.sub + '...' });
    frame.appendChild(loader);
    state.iframe = frame;
    state.currentServer = srv;

    var resume = VL.Store.getProgress(state.media.id, state.season, state.episode);
    var resumeAt = (resume && resume.progress > 5) ? Math.floor(resume.progress) : 0;

    var urlPromise = buildEmbedUrl(srv, state.media, state.season, state.episode, resumeAt);

    function attach(url) {
      frame.innerHTML = '';
      var iframe = VL.el('iframe', {
        src: url,
        class: 'embed-frame',
        allow: 'autoplay; fullscreen; encrypted-media',
        scrolling: 'no'
      });
      iframe.setAttribute('allowfullscreen', '');
      iframe.setAttribute('allowFullScreen', '');
      // Legacy boolean attribute for old players (VidZee needs it).
      frame.appendChild(iframe);
      state.iframeEl = iframe;
      state.currentServer = srv;

      // Hide loader on load, or after timeout fallback.
      var loadTimer = setTimeout(function () {
        var l = VL.qs('.video-loading', frame);
        if (l && l.parentNode) l.parentNode.removeChild(l);
      }, 6000);

      iframe.addEventListener('load', function () {
        clearTimeout(loadTimer);
        VL.Store.rememberProvider(state.media.id, srv.id);
        VL.Store.recordServerSuccess(srv.id);
        var l = VL.qs('.video-loading', frame);
        if (l && l.parentNode) l.parentNode.removeChild(l);
      });
      iframe.addEventListener('error', function () {
        clearTimeout(loadTimer);
        VL.Store.recordServerFailure(srv.id);
        handleServerError(frame, srv);
      });

      // Double-click to toggle fullscreen (mirrors main app).
      frame.addEventListener('dblclick', toggleFullscreen);
      // Also listen on the iframe's parent for dblclick (iframe captures prevent
      // the event from bubbling, so attach to the frame wrapper).
    }

    function fail() {
      clearTimeout(loader);
      handleServerError(frame, srv, 'Could not load ' + srv.sub + '. Try another server.');
    }

    if (urlPromise && typeof urlPromise.then === 'function') {
      urlPromise.then(attach, fail);
    } else {
      attach(urlPromise);
    }
  }

  function handleServerError(frame, srv, message) {
    frame.innerHTML = '';
    var box = VL.el('div', { class: 'video-error' });
    box.appendChild(VL.el('p', { text: message || 'Video unavailable.' }));

    var buttonContainer = VL.el('div', { class: 'video-error-buttons' });

    var retry = VL.el('button', { class: 'btn primary focusable', text: 'Retry' });
    retry.addEventListener('click', function () {
      // Retry the same server
      renderEmbed(frame, srv);
    });
    buttonContainer.appendChild(retry);

    var tryAnother = VL.el('button', { class: 'btn ghost focusable', text: 'Try another server' });
    tryAnother.addEventListener('click', function () {
      var order = VL.Store.getProviderFallbackOrder();
      var idx = 0;
      for (var i = 0; i < order.length; i++) {
        if (order[i] === srv.id) { idx = i; break; }
      }
      var next = order[(idx + 1) % order.length];
      selectServer(next);
    });
    buttonContainer.appendChild(tryAnother);

    box.appendChild(buttonContainer);
    frame.appendChild(box);
  }

  /* ---------------- end-of-content overlay ---------------- */
  function showEndOverlay() {
    if (!state || !state.iframeEl) return;
    state.ended = true;

    // Remove any existing overlay
    var existing = VL.qs('.end-overlay', state.iframeEl.parentNode);
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

    var overlay = VL.el('div', { class: 'end-overlay' });

    var title = VL.el('h3', { class: 'end-title', text: 'You\'ve finished watching' });
    overlay.appendChild(title);
    overlay.appendChild(VL.el('p', { class: 'end-subtitle', text: 'What would you like to do next?' }));

    var btns = VL.el('div', { class: 'end-buttons' });

    var replay = VL.el('button', { class: 'btn ghost focusable', text: 'Replay' });
    replay.addEventListener('click', function () {
      var iframe = state.iframeEl;
      if (iframe && iframe.parentNode) {
        var src = iframe.src;
        iframe.src = '';
        iframe.src = src;
      }
      hideEndOverlay();
    });
    btns.appendChild(replay);

    // Next Episode button — only shown for TV when a next exists.
    if (state.media.type === 'tv' && state.nextSeason !== null && state.nextEpisode !== null) {
      var next = VL.el('button', { class: 'btn primary focusable', text: 'Next Episode' });
      next.addEventListener('click', function () {
        if (state.onAutoNext) state.onAutoNext();
      });
      btns.appendChild(next);
    }

    var back = VL.el('a', { href: '#/', class: 'btn ghost focusable', text: 'Back to Browse' });
    btns.appendChild(back);

    overlay.appendChild(btns);
    state.iframeEl.parentNode.appendChild(overlay);

    // Auto-next after delay if settings allow and provider supports it.
    var settings = VL.Store.getSettings();
    if (settings.autoplayNext && PROVIDER_CAPS.supportsAutoplayNext && state.onAutoNext) {
      state.autoNextTimer = setTimeout(function () {
        if (state.onAutoNext) state.onAutoNext();
      }, 1500);
    }
  }

  function hideEndOverlay() {
    if (!state) return;
    state.ended = false;
    if (state.autoNextTimer) {
      clearTimeout(state.autoNextTimer);
      state.autoNextTimer = null;
    }
    var overlay = VL.qs('.end-overlay', state.iframeEl && state.iframeEl.parentNode);
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  /* ---------------- fullscreen ---------------- */
  function toggleFullscreen() {
    if (!state || !state.frameWrap) return;
    var el = state.frameWrap;
    if (!el) return;

    // Cross-browser fullscreen request
    if (typeof el.requestFullscreen === 'function') {
      el.requestFullscreen().catch(function () {});
    } else if (typeof el.webkitRequestFullscreen === 'function') {
      el.webkitRequestFullscreen();
    } else if (typeof el.mozRequestFullScreen === 'function') {
      el.mozRequestFullScreen();
    } else if (typeof el.msRequestFullscreen === 'function') {
      el.msRequestFullscreen();
    } else if (typeof el.oRequestFullscreen === 'function') {
      el.oRequestFullscreen();
    }
  }

  /* ---------------- embed postMessage progress ---------------- */
  function saveEmbedProgress(progress, duration) {
    if (!state || !(progress > 0)) return;
    VL.Store.saveProgress({
      id: state.media.id,
      title: state.media.title,
      type: state.media.type,
      posterUrl: state.media.poster || '',
      seasonNumber: state.media.type === 'tv' ? state.season : undefined,
      episodeNumber: state.media.type === 'tv' ? state.episode : undefined,
      progress: progress,
      duration: duration,
      completed: false,
      updatedAt: Date.now()
    });
    if (typeof VL.Views.refreshProgress === 'function') VL.Views.refreshProgress();
  }

  function init() {
    if (!window.addEventListener) return;

    // Keyboard: F key toggles fullscreen (mirrors main app)
    window.addEventListener('keydown', function (e) {
      if (!state) return;
      var key = e.key || '';
      if (key === 'f' || key === 'F') {
        var active = document.activeElement;
        var tag = active && active.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        toggleFullscreen();
      }
    });

    // Fullscreen change tracking
    var fsChange = function () {
      if (state) state.isFullscreen = !!document.fullscreenElement;
    };
    if (document.addEventListener) {
      document.addEventListener('fullscreenchange', fsChange);
      document.addEventListener('webkitbeginfullscreen', fsChange);
      document.addEventListener('webkitendfullscreen', fsChange);
    }

    // postMessage handling from embed iframes
    window.addEventListener('message', function (event) {
      var data = event.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) { return; }
      }
      if (!data || !state) return;

      // Videoasy posts a JSON message with { timestamp, duration }.
      if (typeof data.timestamp === 'number' || typeof data.progress === 'number') {
        saveEmbedProgress(data.timestamp || 0, data.duration || 0);
        return;
      }

      // PLAYER_EVENT format (VidAPI-style embeds).
      var isPlayerEvent = data.type === 'PLAYER_EVENT' || data.event === 'playing';
      if (!isPlayerEvent) return;
      var payload = data.data || data;
      saveEmbedProgress(
        payload.player_progress || payload.currentTime || 0,
        payload.player_duration || payload.duration || 0
      );

      if ((payload.player_status === 'completed' || payload.ended) && !state.ended) {
        // Record completion: mark episode watched.
        if (payload.player_duration > 0) {
          VL.Store.markEpisodeWatched({
            id: state.media.id,
            title: state.media.title,
            type: state.media.type,
            posterUrl: state.media.poster || '',
            seasonNumber: state.media.type === 'tv' ? state.season : undefined,
            episodeNumber: state.media.type === 'tv' ? state.episode : undefined,
            progress: payload.player_duration,
            duration: payload.player_duration
          });
        }
        // Show end-of-content overlay (autoplay is gated by provider capability,
        // which is currently false for all providers).
        showEndOverlay();
      }

      // Handle server errors from embed (e.g., Content Not Found)
      if (
        payload.error === 'Content Not Found' ||
        payload.status === 404 ||
        (typeof payload.message === 'string' && payload.message.includes('Content Not Found'))
      ) {
        VL.Store.recordServerFailure(state.serverId);
        var fallbackOrder = VL.Store.getProviderFallbackOrder();
        if (state.autoFallbackCount < fallbackOrder.length) {
          state.autoFallbackCount += 1;
          var current = fallbackOrder.indexOf(state.serverId);
          var next = fallbackOrder[(current + 1) % fallbackOrder.length];
          if (next !== state.serverId) {
            selectServer(next);
            return;
          }
        }
        // If we've exhausted fallback order or next is same as current, show error.
        showEmbedError(state.iframeEl, VL.Store.getServer(state.serverId), 'Content not found on this server. Try another server.');
      }
    });
  }

  VL.Player = {
    render: render,
    init: init,
    getServer: getServer,
    buildEmbedUrl: buildEmbedUrl
  };

  // Capabilities accessor for views.js
  VL.Player.getCapabilities = function () { return PROVIDER_CAPS; };

  // Run init once when the script loads.
  init();
})();