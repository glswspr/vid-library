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

  /* ============================================================
     OFFLINE BANNER
     ============================================================ */
  var _offlineBanner = null;
  function setupOfflineBanner() {
    var banner = VL.el('div', { id: 'offline-banner', class: 'offline-banner' });
    banner.appendChild(VL.el('span', { text: 'You are offline. Some features may not work.' }));
    var btn = VL.el('button', { class: 'btn ghost focusable', text: 'Dismiss' });
    btn.addEventListener('click', function () { banner.style.display = 'none'; });
    banner.appendChild(btn);
    document.body.appendChild(banner);
    _offlineBanner = banner;

    function updateOnlineStatus() {
      if (navigator.onLine) {
        banner.style.display = 'none';
      } else {
        banner.style.display = 'flex';
      }
    }
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();
  }

  /* ============================================================
     SMALL BUILDING BLOCKS
     ============================================================ */
  function header() {
    var h = VL.el('header', { class: 'site-header' });
    var inner = VL.el('div', { class: 'wrap header-inner' });
    var brand = VL.el('a', { href: '#/', class: 'brand focusable' });
    brand.appendChild(VL.el('span', { text: 'VidLibrary' }));
    brand.appendChild(VL.el('span', { class: 'brand-lite', text: 'LITE' }));
    inner.appendChild(brand);

    // Settings button (placed on the right)
    var settingsBtn = VL.el('button', {
      id: 'settings-button',
      class: 'btn-icon focusable',
      title: 'Settings',
      'aria-label': 'Settings'
    });
    settingsBtn.appendChild(VL.el('span', { class: 'settings-icon', text: '\u2699' }));
    settingsBtn.addEventListener('click', function () {
      location.hash = '#/settings';
    });
    inner.appendChild(settingsBtn);

    var home = VL.el('a', { href: '#/', class: 'btn ghost focusable', text: 'Home' });
    inner.appendChild(home);
    h.appendChild(inner);
    return h;
  }

  function footer() {
    var f = VL.el('footer', { class: 'site-footer' });
    // AdGuard hint moved to settings menu; footer now only has copyright or nothing.
    f.appendChild(VL.el('div', {
      class: 'wrap',
      html: 'VidLibrary Lite &copy; ' + new Date().getFullYear()
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
    if (item.duration && !opts.continue) {
      meta += meta ? ' \u00b7 ' : '';
      meta += formatDuration(item.duration);
    }
    if (item.rating) {
      meta += meta ? ' \u00b7 ' : '';
      meta += '\u2605 ' + item.rating;
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

    // Remove from Continue Watching button (only in continue mode)
    if (opts.continue) {
      var removeBtn = VL.el('button', {
        class: 'btn-remove focusable',
        title: 'Remove from Continue Watching',
        'aria-label': 'Remove from Continue Watching'
      });
      removeBtn.appendChild(VL.el('span', { text: '\u2716' }));
      removeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        VL.Store.removeWatchProgress(item.id, item.seasonNumber, item.episodeNumber);
        // Remove the card from the DOM
        a.parentNode.removeChild(a);
      });
      body.appendChild(removeBtn);
    }

    a.appendChild(body);
    return a;
  }

  function formatDuration(duration) {
    if (!duration) return '';
    var mins = parseInt(duration, 10);
    if (!mins) return duration;
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    return h ? (h + 'h ' + m + 'm') : (m + 'm');
  }

  function buildScroller(items, opts) {
    opts = opts || {};
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
    // Add scroll buttons
    var leftBtn = VL.el('button', {
      class: 'scroll-button focusable',
      'aria-label': 'Scroll left',
      innerHTML: '\u25C0'
    });
    leftBtn.addEventListener('click', function () {
      scroller.scrollLeft -= 200;
    });
    var rightBtn = VL.el('button', {
      class: 'scroll-button focusable',
      'aria-label': 'Scroll right',
      innerHTML: '\u25B6'
    });
    rightBtn.addEventListener('click', function () {
      scroller.scrollLeft += 200;
    });
    scroller.appendChild(leftBtn);
    scroller.appendChild(rightBtn);
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

    // Continue Watching
    var cont = VL.Store.getProgressList();
    if (cont.length) {
      // Backfill missing posters and ratings
      var backfillPromises = cont.map(function (item) {
        if (!item.poster || !item.rating) {
          return VL.API.getMedia(item.id, item.type).then(function (media) {
            if (media.poster) item.poster = media.poster;
            if (media.rating) item.rating = media.rating;
            return item;
          });
        } else {
          return Promise.resolve(item);
        }
      });
      Promise.all(backfillPromises).then(function (filledItems) {
        // Update the progress list with backfilled data (optional, but we can store it)
        // We'll just use the filledItems for rendering.
        var contItems = filledItems.map(function (p) {
          return {
            id: p.id, title: p.title, type: p.type, poster: p.posterUrl || p.poster, year: '',
            progress: p.progress, duration: p.duration,
            seasonNumber: p.seasonNumber, episodeNumber: p.episodeNumber
          };
        });
        var contSection = mediaRow('Continue Watching', contItems, { continue: true });
        main.appendChild(contSection);
      });
    } else {
      // Hide Continue Watching when empty (already not adding the section)
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
    if (media.duration) metaParts.push(formatDuration(media.duration));
    if (media.genre) metaParts.push(media.genre);
    if (metaParts.length) info.appendChild(VL.el('div', { class: 'detail-meta', text: metaParts.join(' \u00b7 ') }));
if (media.plot) {
	var plotContainer = VL.el('div', { class: 'detail-plot-container' });
	var plotText = VL.el('p', { class: 'detail-plot', text: media.plot });
	plotContainer.appendChild(plotText);
	// Expandable text: show first 4 lines, then show more/less removed
	info.appendChild(plotContainer);
    }
    hero.appendChild(info);
    main.appendChild(hero);

    // Player
    var playerBox = VL.el('div', { class: 'player-box' });
    main.appendChild(playerBox);
    // For movies, we don't have next season/episode, so pass null
    VL.Player.render(playerBox, media, season || 1, episode || 1, null, null);

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
    console.log('TV id:', id, 'isNumeric:', VL.isNumeric(id));
    root.innerHTML = '';
    root.appendChild(header());
    var main = VL.el('main', { class: 'wrap' });
    root.appendChild(main);
    root.appendChild(footer());

    main.appendChild(loadingBox('Loading...'));

    VL.API.getMedia(id, 'tv').then(function (media) {
      console.log('TV media result:', media);
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
    }).catch(function (e) {
       console.error('Failed to load TV show:', e);
       console.error('Error stack:', e.stack);
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
    if (media.duration) metaParts.push(formatDuration(media.duration));
    if (media.rating) metaParts.push('\u2605 ' + media.rating);
    if (metaParts.length) info.appendChild(VL.el('div', { class: 'detail-meta', text: metaParts.join(' \u00b7 ') }));
if (media.plot) {
       var plotContainer = VL.el('div', { class: 'detail-plot-container' });
       var plotText = VL.el('p', { class: 'detail-plot', text: media.plot });
       plotContainer.appendChild(plotText);
       info.appendChild(plotContainer);
     }
    hero.appendChild(info);
    main.appendChild(hero);

    // Player
    var playerBox = VL.el('div', { class: 'player-box' });
    main.appendChild(playerBox);
    // We need to compute next season and episode for the end overlay.
    // We'll fetch the episodes for the current season to know the count,
    // and also get the seasons list to know the next season.
    // We'll do this after rendering the player, but we can pass null for now and update later?
    // Instead, we'll fetch the necessary data and then call render.
    // We'll change the approach: we'll fetch the episodes and seasons data first.
    // However, to avoid delaying the player, we'll render the player with null next info,
    // and then update the player's state when we have the data? But the player's render
    // function doesn't have a way to update next info after render.
    // We'll change the player's render function to accept nextSeason and nextEpisode.
    // We'll compute them now.
    VL.API.getEpisodes(media.id, 'tv', season).then(function (eps) {
      var nextEpisode = null;
      var nextSeason = season;
      if (eps.length) {
        var currentEpIdx = -1;
        for (var i = 0; i < eps.length; i++) {
          if (eps[i].episode === episode) { currentEpIdx = i; break; }
        }
        if (currentEpIdx !== -1 && currentEpIdx < eps.length - 1) {
          nextEpisode = eps[currentEpIdx + 1].episode;
        } else {
          // End of season, check if there is a next season
VL.API.getShowSeasons(media.id).then(function (seasonsList) {
             var seasons = seasonsList.map(function (s) { return s.seasonNumber; });
             var currentSeasonIdx = -1;
             for (var i = 0; i < seasons.length; i++) {
               if (seasons[i] === parseInt(season, 10)) { currentSeasonIdx = i; break; }
             }
             if (currentSeasonIdx !== -1 && currentSeasonIdx < seasons.length - 1) {
               nextSeason = seasons[currentSeasonIdx + 1];
               // Get first episode of next season
               VL.API.getEpisodes(media.id, 'tv', nextSeason).then(function (nextEps) {
                 if (nextEps.length) {
                   nextEpisode = nextEps[0].episode;
                 } else {
                   nextEpisode = 1;
                 }
                 // Now render the player with the correct next info
                 VL.Player.render(playerBox, media, season, episode, null, nextSeason, nextEpisode);
               });
             } else {
               // No next season
               nextSeason = null;
               nextEpisode = null;
               VL.Player.render(playerBox, media, season, episode, null, nextSeason, nextEpisode);
             }
           });
          return; // Wait for the async calls above
        }
      } else {
        // No episodes in this season? Try to get next season
VL.API.getShowSeasons(media.id).then(function (seasonsList) {
           var seasons = seasonsList.map(function (s) { return s.seasonNumber; });
           var currentSeasonIdx = -1;
           for (var i = 0; i < seasons.length; i++) {
             if (seasons[i] === parseInt(season, 10)) { currentSeasonIdx = i; break; }
           }
           if (currentSeasonIdx !== -1 && currentSeasonIdx < seasons.length - 1) {
             nextSeason = seasons[currentSeasonIdx + 1];
           VL.API.getEpisodes(media.id, 'tv', nextSeason).then(function (nextEps) {
             if (nextEps.length) {
               nextEpisode = nextEps[0].episode;
             } else {
               nextEpisode = 1;
             }
             VL.Player.render(playerBox, media, season, episode, null, nextSeason, nextEpisode);
           });
           } else {
             nextSeason = null;
             nextEpisode = null;
             VL.Player.render(playerBox, media, season, episode, null, nextSeason, nextEpisode);
           }
         });
        return;
      }
      // If we have nextEpisode in the same season
      VL.Player.render(playerBox, media, season, episode, null, nextSeason, nextEpisode);
    });

    // Episode header + prev/next (with cross-season navigation)
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
VL.API.getShowSeasons(media.id).then(function (seasonsList) {
       var seasons = seasonsList.map(function (s) { return s.seasonNumber; });
       for (var s = 0; s < seasons.length; s++) {
         (function (sn) {
           var chip = VL.el('button', {
             class: 'chip focusable' + (sn === season ? ' active' : ''),
             text: 'S' + sn
           });
           chip.addEventListener('click', function () {
             location.hash = '#/tv/' + media.id + '/season/' + sn + '/episode/1';
           });
           chips.appendChild(chip);
         })(seasons[s]);
       }
       main.appendChild(chips);
     });

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
        var targetIdx = idx + delta;
        var targetSeason = season;
        var targetEpisode = null;

        if (targetIdx < 0) {
          // Go to previous season
VL.API.getShowSeasons(media.id).then(function (seasonsList) {
             var seasons = seasonsList.map(function (s) { return s.seasonNumber; });
             var currentSeasonIdx = -1;
             for (var i = 0; i < seasons.length; i++) {
               if (seasons[i] === parseInt(season, 10)) { currentSeasonIdx = i; break; }
             }
             if (currentSeasonIdx > 0) {
               targetSeason = seasons[currentSeasonIdx - 1];
               VL.API.getEpisodes(media.id, 'tv', targetSeason).then(function (prevEps) {
                 if (prevEps.length) {
                   targetEpisode = prevEps[prevEps.length - 1].episode;
                   location.hash = '#/tv/' + media.id + '/season/' + targetSeason + '/episode/' + targetEpisode;
                 }
               });
             }
           });
        } else if (targetIdx >= eps.length) {
          // Go to next season
VL.API.getShowSeasons(media.id).then(function (seasonsList) {
             var seasons = seasonsList.map(function (s) { return s.seasonNumber; });
             var currentSeasonIdx = -1;
             for (var i = 0; i < seasons.length; i++) {
               if (seasons[i] === parseInt(season, 10)) { currentSeasonIdx = i; break; }
             }
             if (currentSeasonIdx < seasons.length - 1) {
               targetSeason = seasons[currentSeasonIdx + 1];
               VL.API.getEpisodes(media.id, 'tv', targetSeason).then(function (nextEps) {
                 if (nextEps.length) {
                   targetEpisode = nextEps[0].episode;
                   location.hash = '#/tv/' + media.id + '/season/' + targetSeason + '/episode/' + targetEpisode;
                 }
               });
             }
           });
        } else {
          // Same season
          targetEpisode = eps[targetIdx].episode;
          location.hash = '#/tv/' + media.id + '/season/' + season + '/episode/' + targetEpisode;
        }
      });
    }

    // Render episode grid with watched toggle
    function renderGrid() {
      if (!tvState || !tvState.grid) return;
      var grid = tvState.grid;
      var media = tvState.media;
      var season = tvState.season;
      grid.innerHTML = '';

      VL.API.getEpisodes(media.id, 'tv', season).then(function (list) {
        if (!list.length) {
          grid.appendChild(VL.el('div', { class: 'row-empty', text: 'No episode data available.' }));
          return;
        }
        for (var i = 0; i < list.length; i++) {
          grid.appendChild(episodeBtn(list[i]));
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
      // Watched toggle button (only if not active, to avoid interference with play)
      if (!active) {
        var toggleBtn = VL.el('button', {
          class: 'ep-toggle-watched focusable',
          title: watched ? 'Mark as unwatched' : 'Mark as watched',
          'aria-label': watched ? 'Mark as unwatched' : 'Mark as watched'
        });
        toggleBtn.appendChild(VL.el('span', { text: watched ? '\u2606' : '\u2605' }));
        toggleBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          if (watched) {
            VL.Store.markEpisodeUnwatched(tvState.media.id, tvState.season, ep.episode);
          } else {
            VL.Store.markEpisodeWatched({
              id: tvState.media.id,
              title: tvState.media.title,
              type: tvState.media.type,
              posterUrl: tvState.media.posterUrl || '',
              seasonNumber: tvState.season,
              episodeNumber: ep.episode,
              progress: prog ? prog.duration : 0,
              duration: prog ? prog.duration : 0
            });
          }
          // Update the button icon
          var icon = toggleBtn.firstChild;
          icon.textContent = watched ? '\u2606' : '\u2605';
          toggleBtn.title = watched ? 'Mark as unwatched' : 'Mark as watched';
          toggleBtn.setAttribute('aria-label', toggleBtn.title);
          // Refresh progress bars in case the grid is visible
          if (tvState.grid) {
            VL.Views.refreshProgress();
          }
        });
        btn.appendChild(toggleBtn);
      }
      btn.addEventListener('click', function () {
        location.hash = '#/tv/' + tvState.media.id + '/season/' + tvState.season + '/episode/' + ep.episode;
      });
      return btn;
    }

    renderGrid();

    // Initial focus: first server button.
    var firstServer = VL.qs('.server-btn', playerBox);
    if (firstServer) firstServer.focus();
  }

  /* ============================================================
     SETTINGS PAGE
     ============================================================ */
  function settings(root) {
    root.innerHTML = '';
    root.appendChild(header());
    var main = VL.el('main', { class: 'wrap' });
    root.appendChild(main);
    root.appendChild(footer());

    var settings = VL.Store.getSettings();

    var form = VL.el('form', { class: 'settings-form' });
    form.appendChild(VL.el('h2', { class: 'settings-title', text: 'Settings' }));

    // Default provider
    var providerLabel = VL.el('label', { class: 'settings-label', for: 'provider-select', text: 'Default server' });
    var providerSelect = VL.el('select', { id: 'provider-select', class: 'settings-input focusable' });
    var providers = [
      { id: 'vidrock', name: 'Server 1', sub: 'VidRock' },
      { id: 'vidapi', name: 'Server 2', sub: 'VidAPI' },
      { id: 'videasy', name: 'Server 3', sub: 'Videoasy' },
      { id: 'peachify', name: 'Server 4', sub: 'Peachify' },
      { id: 'vidsrc', name: 'Server 5', sub: 'VidSrc' },
      { id: 'vidcore', name: 'Server 6', sub: 'VidCore' },
      { id: 'vidzee', name: 'Server 7', sub: 'VidZee' }
    ];
    providers.forEach(function (p) {
      var option = VL.el('option', { value: p.id, text: p.name + ' (' + p.sub + ')' });
      if (p.id === settings.defaultProvider) option.selected = true;
      providerSelect.appendChild(option);
    });
    form.appendChild(providerLabel);
    form.appendChild(providerSelect);

    // Autoplay next
    var autoplayLabel = VL.el('label', { class: 'settings-label', for: 'autoplay-checkbox', text: 'Autoplay next episode' });
    var autoplayCheckbox = VL.el('input', { type: 'checkbox', id: 'autoplay-checkbox', class: 'settings-input focusable' });
    autoplayCheckbox.checked = settings.autoplayNext;
    form.appendChild(autoplayLabel);
    form.appendChild(autoplayCheckbox);

    // Accent color (we can't change it in lite, but we show the current value)
    var accentLabel = VL.el('label', { class: 'settings-label', for: 'accent-color', text: 'Accent color' });
    var accentInput = VL.el('input', { type: 'text', id: 'accent-color', class: 'settings-input focusable', placeholder: '#06b6d4' });
    accentInput.value = settings.accentColor;
    accentInput.readOnly = true;
    form.appendChild(accentLabel);
    form.appendChild(accentInput);

    // Save button
    var saveBtn = VL.el('button', { class: 'btn primary focusable', text: 'Save' });
    saveBtn.addEventListener('click', function () {
      var partial = {
        defaultProvider: providerSelect.value,
        autoplayNext: autoplayCheckbox.checked
        // accentColor is read-only, so we don't save it
      };
      VL.Store.saveSettings(partial);
      // Show saved feedback
      saveBtn.textContent = 'Saved!';
      setTimeout(function () { saveBtn.textContent = 'Save'; }, 1500);
    });
    form.appendChild(saveBtn);

    // AdGuard hint (moved from footer)
    var adguardBox = VL.el('div', { class: 'settings-adguard' });
    adguardBox.appendChild(VL.el('p', { text: 'Tip: use ' }));
    var adguardLink = VL.el('a', { href: 'https://adguard.com', target: '_blank', rel: 'noopener', text: 'AdGuard' });
    adguardBox.appendChild(adguardLink);
    adguardBox.appendChild(VL.el('span', { text: ' to block popups and ads.' }));
    form.appendChild(adguardBox);

    main.appendChild(form);

    document.title = 'Settings - VidLibrary Lite';
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

  /* Refresh progress bars live during playback (called by the player). */
  function refreshProgress() {
    if (!tvState || !tvState.grid) return;
    // Re-render only the grid; do not disturb the focused video/server.
    var focus = document.activeElement;
    var inGrid = focus && tvState.grid === focus.parentNode;
    renderGrid();
    if (inGrid && focus) try { focus.focus(); } catch (e) {}
  }

  // Initialize offline banner
  setupOfflineBanner();

  VL.Views = {
    home: home,
    movie: movie,
    tv: tv,
    settings: settings,
    notfound: notfound,
    refreshProgress: refreshProgress
  };
})();