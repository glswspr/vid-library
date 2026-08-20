/* ============================================================
   views.js - VidLibrary Lite
   Page renderers: home, movie, tv, not-found. Pure DOM building,
   all ES5. Exposes VL.Views.refreshProgress for the player to
   keep episode progress bars in sync during playback.
   ============================================================ */
(function () {
  'use strict';
  var VL = window.VL;

  var tvState = null; // { main, media, season, episode, grid }

  /* ---------------- small building blocks ---------------- */
  function header() {
    var h = VL.el('header', { class: 'site-header' });
    var inner = VL.el('div', { class: 'wrap header-inner' });
    var brand = VL.el('a', { href: '#/', class: 'brand focusable' });
    brand.appendChild(VL.el('span', { text: 'VidLibrary' }));
    brand.appendChild(VL.el('span', { class: 'brand-lite', text: 'LITE' }));
    inner.appendChild(brand);
    var home = VL.el('a', { href: '#/', class: 'btn ghost focusable', text: 'Home' });
    inner.appendChild(home);
    h.appendChild(inner);
    return h;
  }

  function footer() {
    var f = VL.el('footer', { class: 'site-footer' });
    f.appendChild(VL.el('div', {
      class: 'wrap',
      html: 'Tip: use <a href="https://adguard.com" target="_blank" rel="noopener">AdGuard</a> to block popups and ads.'
    }));
    return f;
  }

  function loadingBox(text) {
    return VL.el('div', { class: 'loading-box', text: text || 'Loading...' });
  }

  function notFoundBox(text, showBack) {
    var box = VL.el('div', { class: 'loading-box' });
    box.appendChild(VL.el('p', { text: text || 'Not found.' }));
    if (showBack) {
      box.appendChild(VL.el('a', { href: '#/', class: 'btn primary focusable', text: '\u2190 Back to Home' }));
    }
    return box;
  }

  function cardHref(item) {
    if (item.type === 'tv') {
      if (item.seasonNumber && item.episodeNumber) {
        return '#/tv/' + item.id + '/season/' + item.seasonNumber + '/episode/' + item.episodeNumber;
      }
      return '#/tv/' + item.id;
    }
    return '#/movie/' + item.id;
  }

  function mediaCard(item, opts) {
    opts = opts || {};
    var a = VL.el('a', { href: cardHref(item), class: 'card focusable' });
    a.setAttribute('aria-label', item.title || 'Title');

    var p = VL.el('div', { class: 'card-poster' });
    if (item.poster) {
      p.appendChild(VL.el('img', { src: item.poster, alt: '' }));
    } else {
      var letter = ((item.title || '?').trim().charAt(0) || '?').toUpperCase();
      p.appendChild(VL.el('div', { class: 'card-poster-fallback', text: letter }));
    }
    a.appendChild(p);

    var body = VL.el('div', { class: 'card-body' });
    body.appendChild(VL.el('div', { class: 'card-title', text: item.title }));
    var meta = '';
    if (item.year) meta += item.year;
    if (opts.continue && item.duration > 0) {
      var pct = Math.min(100, Math.round((item.progress / item.duration) * 100));
      meta += meta ? ' \u00b7 ' : '';
      meta += pct + '%';
    }
    if (meta) body.appendChild(VL.el('div', { class: 'card-meta', text: meta }));
    if (opts.continue && item.duration > 0) {
      var bar = VL.el('div', { class: 'progress-track' });
      bar.appendChild(VL.el('div', {
        class: 'progress-fill',
        style: { width: Math.min(100, (item.progress / item.duration) * 100) + '%' }
      }));
      body.appendChild(bar);
    }
    a.appendChild(body);
    return a;
  }

  function buildScroller(items, opts) {
    var scroller = VL.el('div', { class: 'row-scroller' });
    if (!items || !items.length) {
      scroller.appendChild(VL.el('div', {
        class: 'row-empty',
        text: (opts && opts.empty) || 'Nothing here yet.'
      }));
    } else {
      for (var i = 0; i < items.length; i++) {
        scroller.appendChild(mediaCard(items[i], opts));
      }
    }
    return scroller;
  }

  function mediaRow(title, items, opts) {
    var sec = VL.el('section', { class: 'row-section' });
    sec.appendChild(VL.el('h2', { class: 'row-title', text: title }));
    sec.appendChild(buildScroller(items, opts));
    return sec;
  }

  /* ============================================================
     HOME
     ============================================================ */
  function home(root) {
    root.innerHTML = '';
    root.appendChild(header());
    var main = VL.el('main', { class: 'wrap' });
    root.appendChild(main);
    root.appendChild(footer());

    // Search
    main.appendChild(searchSection());

    // IMDb / direct ID open
    main.appendChild(imdbSection());

    // Continue Watching
    var cont = VL.Store.getProgressList();
    if (cont.length) {
      var contItems = cont.map(function (p) {
        return {
          id: p.id, title: p.title, type: p.type, poster: p.posterUrl, year: '',
          progress: p.progress, duration: p.duration,
          seasonNumber: p.seasonNumber, episodeNumber: p.episodeNumber
        };
      });
      main.appendChild(mediaRow('Continue Watching', contItems, { continue: true }));
    }

    // My List
    var list = VL.Store.getWatchlist();
    if (list.length) {
      main.appendChild(mediaRow('My List', list.map(function (it) {
        return { id: it.id, title: it.title, type: it.type, poster: it.posterUrl, year: it.year };
      })));
    }

    // Trending
    var tMovies = VL.el('section', { class: 'row-section' });
    tMovies.appendChild(VL.el('h2', { class: 'row-title', text: 'Trending Movies' }));
    tMovies.appendChild(loadingBox('Loading...'));
    main.appendChild(tMovies);

    var tTv = VL.el('section', { class: 'row-section' });
    tTv.appendChild(VL.el('h2', { class: 'row-title', text: 'Trending TV Shows' }));
    tTv.appendChild(loadingBox('Loading...'));
    main.appendChild(tTv);

    VL.API.trending('movie').then(function (items) {
      tMovies.innerHTML = '';
      tMovies.appendChild(buildScroller(items, {}));
    });
    VL.API.trending('tv').then(function (items) {
      tTv.innerHTML = '';
      tTv.appendChild(buildScroller(items, {}));
    });

    document.title = 'VidLibrary Lite';

    // Initial focus for the D-pad.
    var firstCard = VL.qs('.card', main);
    if (VL.isTvDevice() && firstCard) {
      firstCard.focus();
    } else {
      var si = VL.qs('#search-input', main);
      if (si) si.focus();
    }
  }

  function searchSection() {
    var sec = VL.el('section', { class: 'search-section' });
    var input = VL.el('input', {
      id: 'search-input',
      type: 'text',
      class: 'search-input focusable',
      placeholder: 'Search movies & TV shows...'
    });
    input.setAttribute('aria-label', 'Search movies and TV shows');
    var results = VL.el('div', { id: 'search-results', class: 'search-results' });
    sec.appendChild(input);
    sec.appendChild(results);

    var doSearch = VL.debounce(function () {
      var q = input.value;
      if (!q || q.replace(/^\s+|\s+$/g, '').length < 2) {
        results.innerHTML = '';
        return;
      }
      results.innerHTML = '';
      results.appendChild(loadingBox('Searching...'));
      VL.API.search(q).then(function (list) {
        results.innerHTML = '';
        if (!list.length) {
          results.appendChild(VL.el('div', { class: 'row-empty', text: 'No results.' }));
          return;
        }
        for (var i = 0; i < list.length; i++) {
          var item = list[i];
          var href = '#' + (item.type === 'tv' ? '/tv/' : '/movie/') + item.id;
          var a = VL.el('a', { href: href, class: 'search-result focusable' });
          if (item.poster) {
            a.appendChild(VL.el('img', { src: item.poster, alt: '', class: 'search-result-poster' }));
          }
          var info = VL.el('div', { class: 'search-result-info' });
          info.appendChild(VL.el('div', { class: 'search-result-title', text: item.title }));
          if (item.year) {
            info.appendChild(VL.el('div', {
              class: 'search-result-meta',
              text: item.year + ' \u00b7 ' + (item.type === 'tv' ? 'TV' : 'Movie')
            }));
          }
          a.appendChild(info);
          results.appendChild(a);
        }
      });
    }, 350);

    input.addEventListener('input', doSearch);
    input.addEventListener('keydown', function (e) {
      if ((e.key || '') === 'Enter' || e.keyCode === 13) {
        e.preventDefault();
        var first = VL.qs('.search-result', results);
        if (first) first.click();
      }
    });
    return sec;
  }

  function imdbSection() {
    var sec = VL.el('section', { class: 'imdb-section' });
    var flex = VL.el('div', { class: 'imdb-flex' });
    var input = VL.el('input', {
      type: 'text',
      class: 'imdb-input focusable',
      placeholder: 'IMDb ID or URL (e.g. tt0120737)'
    });
    input.setAttribute('aria-label', 'Open by IMDb ID');
    var btn = VL.el('button', { class: 'btn primary focusable', text: 'Open' });
    var msg = VL.el('div', { class: 'form-msg' });
    flex.appendChild(input);
    flex.appendChild(btn);
    sec.appendChild(flex);
    sec.appendChild(msg);

    function openIt() {
      var id = VL.extractImdbId(input.value);
      if (!id) {
        msg.textContent = 'Enter a valid IMDb ID like tt0120737';
        return;
      }
      msg.textContent = '';
      location.hash = '#/movie/' + id;
    }
    btn.addEventListener('click', openIt);
    input.addEventListener('keydown', function (e) {
      if ((e.key || '') === 'Enter' || e.keyCode === 13) { e.preventDefault(); openIt(); }
    });
    return sec;
  }

  /* ============================================================
     MOVIE
     ============================================================ */
  function movie(root, id) {
    root.innerHTML = '';
    root.appendChild(header());
    var main = VL.el('main', { class: 'wrap' });
    root.appendChild(main);
    root.appendChild(footer());

    main.appendChild(loadingBox('Loading...'));

    VL.API.getMedia(id, 'movie').then(function (media) {
      main.innerHTML = '';
      if (!media) {
        main.appendChild(notFoundBox('Movie not found.', true));
        return;
      }
      if (media.type === 'tv') {
        // User opened an IMDb ID that is actually a TV show.
        location.hash = '#/tv/' + id;
        return;
      }
      renderDetail(main, media, null, null);
    }).catch(function () {
      main.innerHTML = '';
      main.appendChild(notFoundBox('Could not load this title.', true));
    });
  }

  function renderDetail(main, media, season, episode) {
    document.title = media.title + (media.year ? ' (' + media.year + ')' : '') + ' - VidLibrary Lite';

    // Top bar: back + my list
    var bar = VL.el('div', { class: 'detail-top' });
    bar.appendChild(VL.el('a', { href: '#/', class: 'btn ghost focusable', text: '\u2190 Back' }));

    var inList = VL.Store.isInWatchlist(media.id);
    var listBtn = VL.el('button', {
      class: 'btn ghost focusable',
      text: inList ? '\u2605 In My List' : '\u2606 My List'
    });
    listBtn.addEventListener('click', function () {
      var now = VL.Store.toggleWatchlist({
        id: media.id,
        title: media.title,
        type: media.type,
        posterUrl: media.posterUrl || '',
        year: media.year || ''
      });
      listBtn.textContent = now ? '\u2605 In My List' : '\u2606 My List';
    });
    bar.appendChild(listBtn);
    main.appendChild(bar);

    // Hero
    var hero = VL.el('div', { class: 'detail-hero' });
    if (media.poster) {
      hero.appendChild(VL.el('img', { src: media.poster, alt: '', class: 'detail-poster' }));
    }
    var info = VL.el('div', { class: 'detail-info' });
    info.appendChild(VL.el('h1', { class: 'detail-title', text: media.title }));
    var metaParts = [];
    if (media.year) metaParts.push(media.year);
    if (media.rating) metaParts.push('\u2605 ' + media.rating);
    if (media.genre) metaParts.push(media.genre);
    if (metaParts.length) info.appendChild(VL.el('div', { class: 'detail-meta', text: metaParts.join(' \u00b7 ') }));
    if (media.plot) info.appendChild(VL.el('p', { class: 'detail-plot', text: media.plot }));
    hero.appendChild(info);
    main.appendChild(hero);

    // Player
    var playerBox = VL.el('div', { class: 'player-box' });
    main.appendChild(playerBox);
    VL.Player.render(playerBox, media, season || 1, episode || 1);

    // Similar
    addSimilarRow(main, media);

    // Initial focus: first server button.
    var firstServer = VL.qs('.server-btn', playerBox);
    if (firstServer) firstServer.focus();
  }

  function addSimilarRow(main, media) {
    var sec = VL.el('section', { class: 'row-section' });
    sec.appendChild(VL.el('h2', { class: 'row-title', text: 'More Like This' }));
    sec.appendChild(loadingBox('Loading...'));
    main.appendChild(sec);
    VL.API.similar(media, media.type).then(function (items) {
      if (!items.length) {
        if (sec.parentNode) sec.parentNode.removeChild(sec);
        return;
      }
      sec.innerHTML = '';
      sec.appendChild(buildScroller(items, {}));
    });
  }

  /* ============================================================
     TV SHOW
     ============================================================ */
  function tv(root, id, season, episode) {
    root.innerHTML = '';
    root.appendChild(header());
    var main = VL.el('main', { class: 'wrap' });
    root.appendChild(main);
    root.appendChild(footer());

    main.appendChild(loadingBox('Loading...'));

    VL.API.getMedia(id, 'tv').then(function (media) {
      main.innerHTML = '';
      if (!media) {
        main.appendChild(notFoundBox('TV show not found.', true));
        return;
      }
      if (media.type === 'movie') {
        location.hash = '#/movie/' + id;
        return;
      }
      renderTv(main, media, season || 1, episode || 1);
    }).catch(function () {
      main.innerHTML = '';
      main.appendChild(notFoundBox('Could not load this show.', true));
    });
  }

  function renderTv(main, media, season, episode) {
    tvState = { main: main, media: media, season: season, episode: episode, grid: null };
    document.title = media.title + ' - S' + season + 'E' + episode + ' - VidLibrary Lite';

    // Top bar
    var bar = VL.el('div', { class: 'detail-top' });
    bar.appendChild(VL.el('a', { href: '#/', class: 'btn ghost focusable', text: '\u2190 Back' }));
    var inList = VL.Store.isInWatchlist(media.id);
    var listBtn = VL.el('button', {
      class: 'btn ghost focusable',
      text: inList ? '\u2605 In My List' : '\u2606 My List'
    });
    listBtn.addEventListener('click', function () {
      var now = VL.Store.toggleWatchlist({
        id: media.id,
        title: media.title,
        type: media.type,
        posterUrl: media.posterUrl || '',
        year: media.year || ''
      });
      listBtn.textContent = now ? '\u2605 In My List' : '\u2606 My List';
    });
    bar.appendChild(listBtn);
    main.appendChild(bar);

    // Hero
    var hero = VL.el('div', { class: 'detail-hero' });
    if (media.poster) {
      hero.appendChild(VL.el('img', { src: media.poster, alt: '', class: 'detail-poster' }));
    }
    var info = VL.el('div', { class: 'detail-info' });
    info.appendChild(VL.el('h1', { class: 'detail-title', text: media.title }));
    var metaParts = [];
    if (media.year) metaParts.push(media.year);
    var seasonsCount = media.seasonsCount || 1;
    metaParts.push(seasonsCount + (seasonsCount === 1 ? ' season' : ' seasons'));
    info.appendChild(VL.el('div', { class: 'detail-meta', text: metaParts.join(' \u00b7 ') }));
    if (media.plot) info.appendChild(VL.el('p', { class: 'detail-plot', text: media.plot }));
    hero.appendChild(info);
    main.appendChild(hero);

    // Player
    var playerBox = VL.el('div', { class: 'player-box' });
    main.appendChild(playerBox);
    VL.Player.render(playerBox, media, season, episode);

    // Episode header + prev/next
    var epHeader = VL.el('div', { class: 'ep-header' });
    epHeader.appendChild(VL.el('div', { class: 'ep-label', text: 'Season ' + season + ' \u00b7 Episode ' + episode }));
    var navBtns = VL.el('div', { class: 'ep-nav' });
    var prevBtn = VL.el('button', { class: 'btn ghost focusable', text: '\u2190 Prev' });
    prevBtn.addEventListener('click', function () { goEpisode(-1); });
    navBtns.appendChild(prevBtn);
    var nextBtn = VL.el('button', { class: 'btn primary focusable', text: 'Next \u2192' });
    nextBtn.addEventListener('click', function () { goEpisode(1); });
    navBtns.appendChild(nextBtn);
    epHeader.appendChild(navBtns);
    main.appendChild(epHeader);

    // Season chips
    var chips = VL.el('div', { class: 'season-chips' });
    chips.setAttribute('aria-label', 'Select season');
    for (var s = 1; s <= seasonsCount; s++) {
      (function (sn) {
        var chip = VL.el('button', {
          class: 'chip focusable' + (sn === season ? ' active' : ''),
          text: 'S' + sn
        });
        chip.addEventListener('click', function () {
          location.hash = '#/tv/' + media.id + '/season/' + sn + '/episode/1';
        });
        chips.appendChild(chip);
      })(s);
    }
    main.appendChild(chips);

    // Episode grid
    var grid = VL.el('div', { class: 'ep-grid' });
    main.appendChild(grid);
    tvState.grid = grid;

    function goEpisode(delta) {
      VL.API.getEpisodes(media.id, 'tv', season).then(function (eps) {
        if (!eps.length) return;
        var idx = -1;
        for (var i = 0; i < eps.length; i++) {
          if (eps[i].episode === episode) { idx = i; break; }
        }
        var target = idx === -1 ? 1 : (eps[idx + delta] && eps[idx + delta].episode);
        if (target) location.hash = '#/tv/' + media.id + '/season/' + season + '/episode/' + target;
      });
    }

    grid.appendChild(loadingBox('Loading episodes...'));
    VL.API.getEpisodes(media.id, 'tv', season).then(function () {
      renderGrid();
    });

    // Initial focus: first server button.
    var firstServer = VL.qs('.server-btn', playerBox);
    if (firstServer) firstServer.focus();
  }

  function renderGrid() {
    if (!tvState || !tvState.grid) return;
    var grid = tvState.grid;
    var media = tvState.media;
    var season = tvState.season;
    grid.innerHTML = '';

    var eps = [];
    VL.API.getEpisodes(media.id, 'tv', season).then(function (list) {
      eps = list;
      grid.innerHTML = '';
      if (!eps.length) {
        grid.appendChild(VL.el('div', { class: 'row-empty', text: 'No episode data available.' }));
        return;
      }
      for (var i = 0; i < eps.length; i++) {
        grid.appendChild(episodeBtn(eps[i]));
      }
    });
  }

  function episodeBtn(ep) {
    var active = ep.episode === tvState.episode;
    var prog = VL.Store.getProgress(tvState.media.id, tvState.season, ep.episode);
    var watched = prog && prog.duration > 0 && (prog.progress / prog.duration) > 0.85;

    var btn = VL.el('button', {
      class: 'ep-btn focusable' + (active ? ' active' : ''),
      'data-ep': ep.episode
    });
    var topRow = VL.el('div', { class: 'ep-btn-top' });
    topRow.appendChild(VL.el('span', { class: 'ep-num', text: 'Episode ' + ep.episode }));
    if (watched) topRow.appendChild(VL.el('span', { class: 'ep-watched', text: '\u2713' }));
    btn.appendChild(topRow);
    if (ep.title && ep.title !== ('Episode ' + ep.episode)) {
      btn.appendChild(VL.el('div', { class: 'ep-title', text: ep.title }));
    }
    if (prog && prog.duration > 0) {
      var tr = VL.el('div', { class: 'progress-track' });
      tr.appendChild(VL.el('div', {
        class: 'progress-fill',
        style: { width: Math.min(100, (prog.progress / prog.duration) * 100) + '%' }
      }));
      btn.appendChild(tr);
    }
    btn.addEventListener('click', function () {
      location.hash = '#/tv/' + tvState.media.id + '/season/' + tvState.season + '/episode/' + ep.episode;
    });
    return btn;
  }

  /* Refresh progress bars live during playback (called by the player). */
  function refreshProgress() {
    if (!tvState || !tvState.grid) return;
    // Re-render only the grid; do not disturb the focused video/server.
    var focus = document.activeElement;
    var inGrid = focus && tvState.grid === focus.parentNode;
    renderGrid();
    if (inGrid && focus) try { focus.focus(); } catch (e) {}
  }

  /* ============================================================
     NOT FOUND
     ============================================================ */
  function notfound(root) {
    root.innerHTML = '';
    root.appendChild(header());
    var main = VL.el('main', { class: 'wrap' });
    main.appendChild(notFoundBox('Page not found.', true));
    root.appendChild(main);
    root.appendChild(footer());
  }

  VL.Views = {
    home: home,
    movie: movie,
    tv: tv,
    notfound: notfound,
    refreshProgress: refreshProgress
  };
})();
