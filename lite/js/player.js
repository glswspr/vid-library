/* ============================================================
   player.js - VidLibrary Lite
   Video player: iframe embed servers only (VidRock / VidAPI /
   Videoasy / Peachify / VidSrc / VidCore / VidZee). The native
   direct player was removed (it never worked reliably). Saves
   watch progress via embed postMessage events. All ES5.
   ============================================================ */
(function () {
  'use strict';
  var VL = window.VL;

  var SERVERS = [
    { id: 'vidrock',  name: 'Server 1', sub: 'VidRock',   direct: false },
    { id: 'vidapi',   name: 'Server 2', sub: 'VidAPI',    direct: false },
    { id: 'videasy',  name: 'Server 3', sub: 'Videoasy',  direct: false },
    { id: 'peachify', name: 'Server 4', sub: 'Peachify',  direct: false },
    { id: 'vidsrc',   name: 'Server 5', sub: 'VidSrc',    direct: false },
    { id: 'vidcore',  name: 'Server 6', sub: 'VidCore',   direct: false },
    { id: 'vidzee',   name: 'Server 7', sub: 'VidZee',    direct: false }
  ];

  // Fallback order for "Try another server": primary embeds first, vidsrc —
  // the most ad-heavy embed — last.
  var SERVER_ORDER = ['vidrock', 'vidapi', 'videasy', 'peachify', 'vidsrc', 'vidcore', 'vidzee'];

  function nextServerId(srv) {
    var order = SERVER_ORDER;
    var next = order[0];
    for (var i = 0; i < order.length; i++) {
      if (order[i] === srv.id) { next = order[(i + 1) % order.length]; break; }
    }
    return next;
  }

  var state = null; // { container, media, season, episode, serverId, frame }

  function getServer(id) {
    for (var i = 0; i < SERVERS.length; i++) {
      if (SERVERS[i].id === id) return SERVERS[i];
    }
    return SERVERS[0];
  }

  /* ---------------- public render ---------------- */
  function render(container, media, season, episode) {
    state = {
      container: container,
      media: media,
      season: season || 1,
      episode: episode || 1,
      serverId: null,
      frame: null
    };
    container.innerHTML = '';

    var bar = VL.el('div', { class: 'server-bar', role: 'group' });
    bar.setAttribute('aria-label', 'Choose video server');
    for (var i = 0; i < SERVERS.length; i++) {
      (function (srv) {
        var btn = VL.el('button', { class: 'server-btn focusable', 'data-server': srv.id });
        btn.setAttribute('role', 'button');
        btn.appendChild(VL.el('span', { class: 'server-btn-name', text: srv.name }));
        btn.appendChild(VL.el('span', { class: 'server-btn-sub', text: srv.sub }));
        btn.addEventListener('click', function () { selectServer(srv.id); });
        bar.appendChild(btn);
      })(SERVERS[i]);
    }
    container.appendChild(bar);

    var frame = VL.el('div', { class: 'video-frame' });
    container.appendChild(frame);
    state.frame = frame;

    // Default server: Server 1 (VidRock) on the player page.
    selectServer('vidrock');
  }

  /* ---------------- server selection ---------------- */
  function selectServer(serverId) {
    if (!state) return;
    state.serverId = serverId;
    state.container.innerHTML = '';
    renderBar();
    var frame = VL.el('div', { class: 'video-frame' });
    state.container.appendChild(frame);
    state.frame = frame;

    var srv = getServer(serverId);
    renderEmbed(frame, srv);
    VL.Store.setProviderPref(serverId);
    // Trigger episode-grid progress refresh (no-op outside TV page)
    if (typeof VL.Views.refreshProgress === 'function') VL.Views.refreshProgress();
  }

  function renderBar() {
    var bar = VL.el('div', { class: 'server-bar', role: 'group' });
    bar.setAttribute('aria-label', 'Choose video server');
    for (var i = 0; i < SERVERS.length; i++) {
      (function (srv) {
        var active = srv.id === state.serverId;
        var btn = VL.el('button', {
          class: 'server-btn focusable' + (active ? ' active' : ''),
          'data-server': srv.id
        });
        btn.appendChild(VL.el('span', { class: 'server-btn-name', text: srv.name }));
        btn.appendChild(VL.el('span', { class: 'server-btn-sub', text: srv.sub }));
        btn.addEventListener('click', function () { selectServer(srv.id); });
        bar.appendChild(btn);
      })(SERVERS[i]);
    }
    state.container.appendChild(bar);
  }

  /* ---------------- embed iframe ---------------- */
  function renderEmbed(frame, srv) {
    var loader = VL.el('div', { class: 'video-loading', text: 'Loading ' + srv.sub + '...' });
    frame.appendChild(loader);

    var urlOrPromise = buildEmbedUrl(srv, state.media, state.season, state.episode);

    function attach(url) {
      frame.innerHTML = '';
      var iframe = VL.el('iframe', {
        src: url,
        class: 'embed-frame',
        allow: 'autoplay; fullscreen; encrypted-media; picture-in-picture',
        scrolling: 'no'
      });
      iframe.setAttribute('allowfullscreen', '');
      frame.appendChild(iframe);
      // Hide loader if it never fired onLoad (some embeds don't bubble it).
      setTimeout(function () {
        var l = VL.qs('.video-loading', frame);
        if (l && l.parentNode) l.parentNode.removeChild(l);
      }, 6000);
      iframe.addEventListener('load', function () {
        VL.Store.rememberProvider(state.media.id, srv.id);
        var l = VL.qs('.video-loading', frame);
        if (l && l.parentNode) l.parentNode.removeChild(l);
      });
    }

    function fail() {
      showEmbedError(frame, srv, 'Could not load ' + srv.sub + '. Try another server.');
    }

    if (urlOrPromise && typeof urlOrPromise.then === 'function') {
      urlOrPromise.then(attach, fail);
    } else {
      attach(urlOrPromise);
    }
  }

  function showEmbedError(frame, srv, message) {
    frame.innerHTML = '';
    var box = VL.el('div', { class: 'video-error' });
    box.appendChild(VL.el('p', { text: message || 'Video unavailable.' }));
    var retry = VL.el('button', { class: 'btn primary focusable', text: 'Try another server' });
    retry.addEventListener('click', function () {
      selectServer(srv ? nextServerId(srv) : SERVER_ORDER[0]);
    });
    box.appendChild(retry);
    frame.appendChild(box);
  }

  /* ---------------- embed URL builder ---------------- */
  function buildEmbedUrl(srv, media, season, episode) {
    var id = media.id;
    var resume = VL.Store.getProgress(media.id, season, episode);
    var resumeAt = (resume && resume.progress > 5) ? Math.floor(resume.progress) : 0;

    // Peachify / Videoasy / VidZee need a numeric TMDB id.
    if (srv.id === 'peachify' || srv.id === 'videasy' || srv.id === 'vidzee') {
      var tmdbPromise = VL.isNumeric(id)
        ? VL.Promise.resolve(id)
        : VL.API.tmdbFind(id).then(function (f) { return f ? f.id : id; });
      return tmdbPromise.then(function (tmdbId) {
        var base;
        if (srv.id === 'peachify') {
          base = media.type === 'movie'
            ? ('https://peachify.top/embed/movie/' + tmdbId)
            : ('https://peachify.top/embed/tv/' + tmdbId + '/' + season + '/' + episode);
        } else if (srv.id === 'videasy') {
          base = media.type === 'movie'
            ? ('https://player.videasy.to/movie/' + tmdbId)
            : ('https://player.videasy.to/tv/' + tmdbId + '/' + season + '/' + episode);
        } else { // vidzee
          base = media.type === 'movie'
            ? ('https://player.vidzee.wtf/embed/movie/' + tmdbId)
            : ('https://player.vidzee.wtf/embed/tv/' + tmdbId + '/' + season + '/' + episode);
        }
        var p = [];
        if (resumeAt) {
          if (srv.id === 'peachify') p.push('startAt=' + resumeAt);
          else if (srv.id === 'videasy') p.push('progress=' + resumeAt);
          else p.push('startTime=' + resumeAt);
        }
        if (srv.id === 'peachify') p.push('autoPlay=false');
        return base + (p.length ? ('?' + p.join('&')) : '');
      });
    }

    var params = [];
    var base;
    if (srv.id === 'vidrock') {
      base = media.type === 'movie'
        ? ('https://vidrock.ru/embed/movie/' + id)
        : ('https://vidrock.ru/embed/tv/' + id + '/' + season + '/' + episode);
      if (resumeAt) params.push('resumeAt=' + resumeAt);
    } else if (srv.id === 'vidapi') {
      base = media.type === 'movie'
        ? ('https://vaplayer.ru/embed/movie/' + id)
        : ('https://vaplayer.ru/embed/tv/' + id + '/' + season + '/' + episode);
      if (resumeAt) params.push('resumeAt=' + resumeAt);
    } else if (srv.id === 'vidsrc') {
      base = media.type === 'movie'
        ? ('https://vidsrc.to/embed/movie/' + id)
        : ('https://vidsrc.to/embed/tv/' + id + '/' + season + '/' + episode);
      if (resumeAt) params.push('resumeAt=' + resumeAt);
    } else if (srv.id === 'vidcore') {
      base = media.type === 'movie'
        ? ('https://vidcore.io/movie/' + id + '?autoPlay=true')
        : ('https://vidcore.io/tv/' + id + '/' + season + '/' + episode + '?autoPlay=true');
    } else {
      base = media.type === 'movie'
        ? ('https://vidrock.ru/embed/movie/' + id)
        : ('https://vidrock.ru/embed/tv/' + id + '/' + season + '/' + episode);
    }
    return base + (params.length ? ('?' + params.join('&')) : '');
  }

  /* ---------------- embed postMessage progress ---------------- */
  function saveEmbedProgress(progress, duration) {
    if (!state || !(progress > 0)) return;
    VL.Store.saveProgress({
      id: state.media.id,
      title: state.media.title,
      type: state.media.type,
      posterUrl: state.media.posterUrl || '',
      seasonNumber: state.media.type === 'tv' ? state.season : undefined,
      episodeNumber: state.media.type === 'tv' ? state.episode : undefined,
      progress: progress,
      duration: duration,
      updatedAt: Date.now()
    });
    if (typeof VL.Views.refreshProgress === 'function') VL.Views.refreshProgress();
  }

  function init() {
    if (!window.addEventListener) return;
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
    });
  }

  VL.Player = {
    render: render,
    init: init
  };

  // Run init once when the script loads (message listeners are global).
  init();
})();
