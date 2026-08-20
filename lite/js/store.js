/* ============================================================
   store.js - VidLibrary Lite
   localStorage persistence. Uses the SAME keys as the main app
   (vid-library) so Continue Watching / My List / provider prefs
   carry over between the full site and the Lite version.
   ============================================================ */
(function () {
  'use strict';
  var VL = window.VL;

  var KEYS = {
    PROVIDER: 'vid_library_provider',
    PROGRESS: 'vid_library_progress_v2',
    WATCHLIST: 'vid_library_watchlist_v1',
    PROVIDER_MEMORY: 'vid_library_provider_memory_v1'
  };

  var VALID_PROVIDERS = ['vidrock', 'vidapi', 'videasy', 'peachify', 'vidsrc', 'vidcore', 'vidzee'];

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* storage full / disabled - degrade gracefully */
    }
  }

  function readRaw(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function isValidProvider(v) {
    for (var i = 0; i < VALID_PROVIDERS.length; i++) {
      if (VALID_PROVIDERS[i] === v) return true;
    }
    return false;
  }

  function progressKey(id, season, episode) {
    return (season && episode) ? (id + '_s' + season + 'e' + episode) : id;
  }

  function sortedValues(map) {
    var out = [];
    for (var k in map) {
      if (map.hasOwnProperty(k)) out.push(map[k]);
    }
    out.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    return out;
  }

  VL.Store = {
    /* ---- provider preference (shared with main app) ---- */
    getProviderPref: function () {
      var saved = readRaw(KEYS.PROVIDER);
      return isValidProvider(saved) ? saved : 'vidrock';
    },
    setProviderPref: function (p) { writeJson(KEYS.PROVIDER, p); },

    getRememberedProvider: function (mediaId) {
      var mem = readJson(KEYS.PROVIDER_MEMORY, {});
      return isValidProvider(mem[mediaId]) ? mem[mediaId] : null;
    },
    rememberProvider: function (mediaId, provider) {
      var mem = readJson(KEYS.PROVIDER_MEMORY, {});
      mem[mediaId] = provider;
      writeJson(KEYS.PROVIDER_MEMORY, mem);
    },

    /* ---- watch progress ---- */
    getProgress: function (id, season, episode) {
      var all = readJson(KEYS.PROGRESS, {});
      return all[progressKey(id, season, episode)] || null;
    },
    saveProgress: function (p) {
      var all = readJson(KEYS.PROGRESS, {});
      all[progressKey(p.id, p.seasonNumber, p.episodeNumber)] = {
        id: p.id,
        title: p.title,
        type: p.type,
        posterUrl: p.posterUrl || '',
        seasonNumber: p.seasonNumber,
        episodeNumber: p.episodeNumber,
        progress: p.progress,
        duration: p.duration,
        updatedAt: p.updatedAt || Date.now()
      };
      writeJson(KEYS.PROGRESS, all);
    },
    getProgressList: function () {
      return sortedValues(readJson(KEYS.PROGRESS, {}));
    },

    /* ---- watchlist (My List) ---- */
    getWatchlist: function () {
      return sortedValues(readJson(KEYS.WATCHLIST, {}));
    },
    isInWatchlist: function (id) {
      var all = readJson(KEYS.WATCHLIST, {});
      return !!all[id];
    },
    toggleWatchlist: function (item) {
      var all = readJson(KEYS.WATCHLIST, {});
      if (all[item.id]) {
        delete all[item.id];
        writeJson(KEYS.WATCHLIST, all);
        return false;
      }
      all[item.id] = {
        id: item.id,
        title: item.title,
        type: item.type,
        posterUrl: item.posterUrl || '',
        year: item.year || '',
        updatedAt: Date.now()
      };
      writeJson(KEYS.WATCHLIST, all);
      return true;
    }
  };
})();
