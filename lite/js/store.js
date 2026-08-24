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
    PROVIDER_MEMORY: 'vid_library_provider_memory_v1',
    SETTINGS: 'vid_library_settings',
    HEALTH: 'vid_library_server_health'
  };

  var VALID_PROVIDERS = ['vidrock', 'vidapi', 'videasy', 'peachify', 'vidsrc', 'vidcore', 'vidzee'];

  // Mirror the main app's defaults.
  var DEFAULT_SETTINGS = {
    defaultProvider: 'vidrock',
    autoplayNext: true,
    accentColor: '#06b6d4'
  };

  // Matches WATCHED_THRESHOLD in src/constants.ts.
  var WATCHED_THRESHOLD = 0.85;

  // Cap the provider memory map (same as PROVIDER_MEMORY_MAX_ENTRIES in main).
  var PROVIDER_MEMORY_MAX_ENTRIES = 500;

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

  function dispatchChange() {
    try { window.dispatchEvent(new CustomEvent('storage-changed')); } catch (e) {}
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

  /* ---- server health ---- */
  function readServerHealth() {
    return readJson(KEYS.HEALTH, {});
  }

  VL.Store = {
    /* ---- settings ---- */
    getSettings: function () {
      var raw = readRaw(KEYS.SETTINGS);
      if (!raw) return {
        defaultProvider: DEFAULT_SETTINGS.defaultProvider,
        autoplayNext: DEFAULT_SETTINGS.autoplayNext,
        accentColor: DEFAULT_SETTINGS.accentColor
      };
      var parsed;
      try { parsed = JSON.parse(raw); } catch (e) { parsed = {}; }
      var out = {};
      out.defaultProvider = isValidProvider(parsed.defaultProvider)
        ? parsed.defaultProvider : DEFAULT_SETTINGS.defaultProvider;
      out.autoplayNext = typeof parsed.autoplayNext === 'boolean'
        ? parsed.autoplayNext : DEFAULT_SETTINGS.autoplayNext;
      out.accentColor = typeof parsed.accentColor === 'string' && parsed.accentColor
        ? parsed.accentColor : DEFAULT_SETTINGS.accentColor;
      return out;
    },

    saveSettings: function (partial) {
      var current = VL.Store.getSettings();
      var merged = {};
      merged.defaultProvider = partial.defaultProvider != null
        ? (isValidProvider(partial.defaultProvider) ? partial.defaultProvider : current.defaultProvider)
        : current.defaultProvider;
      merged.autoplayNext = partial.autoplayNext != null
        ? partial.autoplayNext : current.autoplayNext;
      merged.accentColor = partial.accentColor != null
        ? partial.accentColor : current.accentColor;
      writeJson(KEYS.SETTINGS, merged);
      dispatchChange();
      return merged;
    },

    /* ---- provider preference (shared with main app) ---- */
    getProviderPref: function () {
      return VL.Store.getSettings().defaultProvider;
    },
    setProviderPref: function (p) {
      VL.Store.saveSettings({ defaultProvider: p });
    },

    getRememberedProvider: function (mediaId) {
      var mem = readJson(KEYS.PROVIDER_MEMORY, {});
      return isValidProvider(mem[mediaId]) ? mem[mediaId] : null;
    },
    rememberProvider: function (mediaId, provider) {
      var mem = readJson(KEYS.PROVIDER_MEMORY, {});
      mem[mediaId] = provider;
      // Cap the map so it can't grow unboundedly (matches main app).
      var keys = [];
      for (var k in mem) {
        if (mem.hasOwnProperty(k)) keys.push(k);
      }
      if (keys.length > PROVIDER_MEMORY_MAX_ENTRIES) {
        // Drop oldest entries (insertion order in JS object is roughly insertion
        // order for string keys, so shift off the front).
        var excess = keys.length - PROVIDER_MEMORY_MAX_ENTRIES;
        for (var i = 0; i < excess; i++) {
          delete mem[keys[i]];
        }
      }
      writeJson(KEYS.PROVIDER_MEMORY, mem);
    },

    /** Best-guess server order: remembered-good first, then the rest. */
    getProviderFallbackOrder: function () {
      var mem = readJson(KEYS.PROVIDER_MEMORY, {});
      var ordered = [];
      var seen = {};
      for (var k in mem) {
        if (mem.hasOwnProperty(k) && isValidProvider(mem[k]) && !seen[mem[k]]) {
          ordered.push(mem[k]);
          seen[mem[k]] = true;
        }
      }
      for (var i = 0; i < VALID_PROVIDERS.length; i++) {
        if (!seen[VALID_PROVIDERS[i]]) ordered.push(VALID_PROVIDERS[i]);
      }
      return ordered;
    },

    /* ---- server health ---- */
    recordServerSuccess: function (provider) {
      if (!isValidProvider(provider)) return;
      var map = readServerHealth();
      var prev = map[provider];
      map[provider] = {
        success: (prev ? prev.success : 0) + 1,
        failure: prev ? prev.failure : 0,
        lastResult: 'success',
        lastUpdated: Date.now()
      };
      writeJson(KEYS.HEALTH, map);
    },

    recordServerFailure: function (provider) {
      if (!isValidProvider(provider)) return;
      var map = readServerHealth();
      var prev = map[provider];
      map[provider] = {
        success: prev ? prev.success : 0,
        failure: (prev ? prev.failure : 0) + 1,
        lastResult: 'failure',
        lastUpdated: Date.now()
      };
      writeJson(KEYS.HEALTH, map);
    },

    getServerHealth: function (provider) {
      var map = readServerHealth();
      return map[provider] || null;
    },

    getServerStatus: function (provider) {
      var h = VL.Store.getServerHealth(provider);
      if (!h) return 'unknown';
      return h.success > h.failure ? 'ok' : 'bad';
    },

    /* ---- watch progress ---- */
    getProgress: function (id, season, episode) {
      var all = readJson(KEYS.PROGRESS, {});
      return all[progressKey(id, season, episode)] || null;
    },
    saveProgress: function (p) {
      var all = readJson(KEYS.PROGRESS, {});
      var key = progressKey(p.id, p.seasonNumber, p.episodeNumber);
      var existing = all[key] || {};
      all[key] = {
        id: p.id,
        title: p.title,
        type: p.type,
        posterUrl: p.posterUrl || existing.posterUrl || '',
        seasonNumber: p.seasonNumber,
        episodeNumber: p.episodeNumber,
        progress: p.progress,
        duration: p.duration,
        completed: p.completed != null ? p.completed : (existing.completed || false),
        rating: p.rating || existing.rating || '',
        updatedAt: p.updatedAt || Date.now()
      };
      writeJson(KEYS.PROGRESS, all);
    },

    /** Return latest progress entry per media id (for Continue Watching). */
    getProgressList: function () {
      var all = readJson(KEYS.PROGRESS, {});
      var byId = {};
      for (var k in all) {
        if (all.hasOwnProperty(k)) {
          var item = all[k];
          var existing = byId[item.id];
          if (!existing || (item.updatedAt || 0) > (existing.updatedAt || 0)) {
            byId[item.id] = item;
          }
        }
      }
      return sortedValues(byId);
    },

    /** Remove a single watch progress entry. */
    removeWatchProgress: function (id, season, episode) {
      var all = readJson(KEYS.PROGRESS, {});
      var key = progressKey(id, season, episode);
      delete all[key];
      writeJson(KEYS.PROGRESS, all);
    },

    /** Mark an episode as fully watched. */
    markEpisodeWatched: function (p) {
      var all = readJson(KEYS.PROGRESS, {});
      var key = progressKey(p.id, p.seasonNumber, p.episodeNumber);
      all[key] = {
        id: p.id,
        title: p.title,
        type: p.type,
        posterUrl: p.posterUrl || '',
        seasonNumber: p.seasonNumber,
        episodeNumber: p.episodeNumber,
        progress: p.duration || 0,
        duration: p.duration || 0,
        completed: true,
        rating: p.rating || '',
        updatedAt: Date.now()
      };
      writeJson(KEYS.PROGRESS, all);
    },

    /** Mark an episode as unwatched (remove progress entry). */
    markEpisodeUnwatched: function (id, season, episode) {
      VL.Store.removeWatchProgress(id, season, episode);
    },

    /** Whether an episode is considered watched (>= threshold or completed). */
    isEpisodeWatched: function (progress) {
      if (!progress) return false;
      if (progress.completed) return true;
      if (progress.duration > 0) {
        return (progress.progress / progress.duration) > WATCHED_THRESHOLD;
      }
      return false;
    },

    /** Clear watch history + provider memory (keeps watchlist). */
    clearWatchHistory: function () {
      writeJson(KEYS.PROGRESS, {});
      writeJson(KEYS.PROVIDER_MEMORY, {});
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
        rating: item.rating || '',
        updatedAt: Date.now()
      };
      writeJson(KEYS.WATCHLIST, all);
      return true;
    }
  };
})();
