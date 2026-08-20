/* ============================================================
   api.js - VidLibrary Lite
   Data layer: 2embed catalog, TMDB, Wikidata search, and the
   VidVault direct-MP4 source. All network via XHR, all code ES5.
   Every function returns a VL.Promise.
   ============================================================ */
(function () {
  'use strict';
  var VL = window.VL;

  var EMBED2 = 'https://api.2embed.cc';
  var TMDB = 'https://api.themoviedb.org/3';
  // Same fallback key the main app / VidRock bundle uses.
  var TMDB_KEY = '54e00466a09676df57ba51c4ca30b1a6';

  // VidVault direct-MP4 API (CORS-open, verified).
  var VV_TOKEN = 'https://vidvault.ru/api/get-token';
  var VV_PROXY = 'https://vidvault.ru/api/download-proxy';
  var STREAM_PROXY = 'https://vlaq11.site';

  var vvToken = null;
  var mediaCache = {};   // key: type:id  -> media object
  var epCache = {};      // key: id:season -> episodes array
  var tmdbIdCache = {};  // key: imdbId -> numeric tmdb id (or null)

  /* ---------------- low-level JSON helpers ---------------- */
  function getJSON(url, timeoutMs) {
    var opts = { url: url };
    if (timeoutMs) opts.timeout = timeoutMs;
    return VL.xhr(opts).then(function (text) { return JSON.parse(text); });
  }

  function postJSON(url, body, headers) {
    var opts = { url: url, method: 'POST', body: JSON.stringify(body) };
    if (headers) opts.headers = headers;
    return VL.xhr(opts).then(function (text) { return JSON.parse(text); });
  }

  /* ---------------- 2embed catalog ---------------- */
  function mapTrendingItem(it, type) {
    if (!it.imdb_id || it.imdb_id.indexOf('tt') !== 0) return null;
    return {
      id: it.imdb_id,
      title: it.title || 'Untitled',
      year: it.year || '',
      poster: it.poster || '',
      type: type
    };
  }

  function trending2embed(type) {
    var url = EMBED2 + (type === 'movie' ? '/trending?page=1' : '/trendingtv?page=1');
    return getJSON(url, 8000).then(function (data) {
      var out = [];
      var results = (data && data.results) || [];
      for (var i = 0; i < results.length; i++) {
        var it = mapTrendingItem(results[i], type);
        if (it) out.push(it);
      }
      return out;
    }).catch(function () { return []; });
  }

  function trendingTmdb(type) {
    var url = TMDB + '/trending/' + type + '/week?api_key=' + TMDB_KEY;
    return getJSON(url, 8000).then(function (data) {
      var out = [];
      var results = (data && data.results) || [];
      for (var i = 0; i < results.length && i < 20; i++) {
        var it = results[i];
        out.push({
          id: String(it.id),
          title: it.title || it.name || 'Untitled',
          year: (it.release_date || it.first_air_date || '').substring(0, 4),
          poster: it.poster_path ? ('https://image.tmdb.org/t/p/w342' + it.poster_path) : '',
          type: type
        });
      }
      return out;
    }).catch(function () { return []; });
  }

  function trending(type) {
    return trending2embed(type).then(function (list) {
      if (list.length > 0) return list;
      return trendingTmdb(type);
    });
  }

  /* ---------------- TMDB helpers ---------------- */
  function tmdbFind(imdbId) {
    if (tmdbIdCache[imdbId] !== undefined) {
      var cached = tmdbIdCache[imdbId];
      return cached ? VL.Promise.resolve(cached) : VL.Promise.resolve(null);
    }
    var url = TMDB + '/find/' + imdbId + '?api_key=' + TMDB_KEY + '&external_source=imdb_id';
    return getJSON(url, 10000).then(function (data) {
      var m = null, t = 'movie';
      if (data && data.movie_results && data.movie_results.length) {
        m = data.movie_results[0]; t = 'movie';
      } else if (data && data.tv_results && data.tv_results.length) {
        m = data.tv_results[0]; t = 'tv';
      }
      if (!m) { tmdbIdCache[imdbId] = null; return null; }
      var result = { id: String(m.id), type: t };
      tmdbIdCache[imdbId] = result;
      return result;
    }).catch(function () { return null; });
  }

  function tmdbDetail(tmdbId, type) {
    var url = TMDB + '/' + type + '/' + tmdbId + '?api_key=' + TMDB_KEY;
    return getJSON(url, 10000).then(function (data) {
      if (!data || data.id === undefined || data.id === null) return null;
      return {
        id: data.imdb_id || ('tmdb' + data.id),
        tmdbId: String(data.id),
        title: data.title || data.name || 'Untitled',
        year: (data.release_date || data.first_air_date || '').substring(0, 4),
        poster: data.poster_path ? ('https://image.tmdb.org/t/p/w342' + data.poster_path) : '',
        rating: data.vote_average ? Number(data.vote_average).toFixed(1) : '',
        genre: (data.genres || []).map(function (g) { return g.name; }).join(', '),
        plot: data.overview || '',
        seasonsCount: data.number_of_seasons || 0
      };
    }).catch(function () { return null; });
  }

  /* ---------------- Combined detail resolution ---------------- */
  // Returns a media object keyed by the ORIGINAL id (imdb or numeric).
  function _getMedia(id, type) {
    if (VL.isNumeric(id)) {
      return tmdbDetail(id, type).then(function (td) {
        if (!td) return null;
        td.id = id;
        td.type = type;
        return td;
      });
    }
    // IMDb id: try 2embed first (rich, no key), then TMDB.
    return detail2embed(id, type).then(function (d) {
      if (d && d.title && d.title !== id) return d;
      return tmdbFind(id).then(function (found) {
        if (!found) return null;
        return tmdbDetail(found.id, found.type).then(function (td) {
          if (!td) return null;
          td.id = id; // keep the imdb id for embed URLs
          td.type = found.type;
          return td;
        });
      });
    });
  }

  function getMedia(id, type) {
    var key = type + ':' + id;
    if (mediaCache[key]) return VL.Promise.resolve(mediaCache[key]);
    return _getMedia(id, type).then(function (m) {
      if (m && m.title) mediaCache[key] = m;
      return m;
    });
  }

  function detail2embed(id, type) {
    var url = EMBED2 + (type === 'movie' ? '/movie?imdb_id=' : '/tv?imdb_id=') + id;
    return getJSON(url, 8000).then(function (data) {
      var d = data && data[type === 'movie' ? 'movie' : 'tv'];
      if (!d) return null;
      return {
        id: id,
        title: d.title || id,
        year: d.year || '',
        poster: d.poster || '',
        rating: d.rating || '',
        genre: d.genre || '',
        plot: d.plot || '',
        seasonsCount: d.seasons || 0,
        type: type
      };
    }).catch(function () { return null; });
  }

  /* ---------------- Episodes ---------------- */
  function season2embed(imdbId, season) {
    var url = EMBED2 + '/season?imdb_id=' + imdbId + '&season=' + season;
    return getJSON(url, 8000).then(function (data) {
      var out = [];
      var eps = (data && data.episodes) || [];
      for (var i = 0; i < eps.length; i++) {
        var ep = eps[i];
        out.push({
          season: ep.season !== undefined && ep.season !== null ? ep.season : season,
          episode: ep.episode !== undefined && ep.episode !== null ? ep.episode : (i + 1),
          title: ep.title || ('Episode ' + (ep.episode || (i + 1))),
          overview: ep.overview || ''
        });
      }
      return out;
    }).catch(function () { return []; });
  }

  function tmdbSeason(imdbId, tmdbId, season) {
    var url = TMDB + '/tv/' + tmdbId + '/season/' + season + '?api_key=' + TMDB_KEY;
    return getJSON(url, 10000).then(function (data) {
      var out = [];
      var eps = (data && data.episodes) || [];
      for (var i = 0; i < eps.length; i++) {
        var ep = eps[i];
        out.push({
          season: season,
          episode: ep.episode_number,
          title: ep.name || ('Episode ' + ep.episode_number),
          overview: ep.overview || ''
        });
      }
      return out;
    }).catch(function () { return []; });
  }

  function _getEpisodes(id, type, season) {
    if (VL.isNumeric(id)) {
      return tmdbSeason(id, id, season);
    }
    return season2embed(id, season).then(function (eps) {
      if (eps.length > 0) return eps;
      return tmdbFind(id).then(function (found) {
        if (!found) return generatePlaceholders(id, season);
        return tmdbSeason(id, found.id, season).then(function (eps2) {
          return eps2.length > 0 ? eps2 : generatePlaceholders(id, season);
        });
      });
    });
  }

  function getEpisodes(id, type, season) {
    var key = id + ':' + season;
    if (epCache[key]) return VL.Promise.resolve(epCache[key]);
    return _getEpisodes(id, type, season).then(function (eps) {
      if (eps && eps.length) epCache[key] = eps;
      return eps;
    });
  }

  // Fallback so the TV page is never empty when both APIs fail.
  function generatePlaceholders(id, season) {
    var out = [];
    var count = 12;
    for (var i = 1; i <= count; i++) {
      out.push({
        season: season,
        episode: i,
        title: 'Episode ' + i,
        overview: ''
      });
    }
    return out;
  }

  /* ---------------- Search (TMDB -> Wikidata) ---------------- */
  function search(query) {
    var q = String(query || '').replace(/^\s+|\s+$/g, '');
    if (q.length < 2) return VL.Promise.resolve([]);
    return searchTmdb(q).then(function (r) {
      if (r.length > 0) return r;
      return searchWikidata(q);
    });
  }

  function tmdbExternalId(type, tmdbId) {
    var url = TMDB + '/' + type + '/' + tmdbId + '/external_ids?api_key=' + TMDB_KEY;
    return getJSON(url, 8000).then(function (data) {
      return (data && data.imdb_id) || null;
    }).catch(function () { return null; });
  }

  function searchTmdb(q) {
    var url = TMDB + '/search/multi?api_key=' + TMDB_KEY + '&query=' + encodeURIComponent(q) + '&page=1';
    return getJSON(url, 10000).then(function (data) {
      var items = (data && data.results) || [];
      var out = [];
      var pending = [];
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it.media_type !== 'movie' && it.media_type !== 'tv') continue;
        if (out.length >= 8) break;
        (function (item) {
          pending.push(tmdbExternalId(item.media_type, item.id).then(function (imdbId) {
            if (!imdbId) return;
            out.push({
              id: imdbId,
              title: item.title || item.name || 'Untitled',
              year: (item.release_date || item.first_air_date || '').substring(0, 4),
              type: item.media_type,
              poster: item.poster_path ? ('https://image.tmdb.org/t/p/w92' + item.poster_path) : ''
            });
          }));
        })(it);
      }
      return VL.Promise.all(pending).then(function () { return out; });
    }).catch(function () { return []; });
  }

  function searchWikidata(q) {
    var searchUrl = 'https://www.wikidata.org/w/api.php?action=wbsearchentities&search=' +
      encodeURIComponent(q) + '&language=en&limit=15&format=json&origin=*';
    return getJSON(searchUrl, 10000).then(function (searchData) {
      var entities = (searchData && searchData.search) || [];
      if (!entities.length) return [];
      var ids = [];
      for (var i = 0; i < entities.length; i++) ids.push(entities[i].id);
      var claimsUrl = 'https://www.wikidata.org/w/api.php?action=wbgetentities&ids=' +
        ids.join('|') + '&props=claims&format=json&origin=*';
      return getJSON(claimsUrl, 10000).then(function (claimsData) {
        var entityData = (claimsData && claimsData.entities) || {};
        var out = [];
        for (var j = 0; j < entities.length; j++) {
          var entity = entities[j];
          var claims = entityData[entity.id] && entityData[entity.id].claims;
          if (!claims) continue;
          var imdbClaim = claims.P345;
          if (!imdbClaim || !imdbClaim.length) continue;
          var imdbId = imdbClaim[0].mainsnak && imdbClaim[0].mainsnak.datavalue &&
            imdbClaim[0].mainsnak.datavalue.value;
          if (!imdbId || String(imdbId).indexOf('tt') !== 0) continue;
          var type = 'movie';
          var instanceOf = claims.P31 || [];
          for (var k = 0; k < instanceOf.length; k++) {
            var qid = instanceOf[k].mainsnak && instanceOf[k].mainsnak.datavalue &&
              instanceOf[k].mainsnak.datavalue.value &&
              instanceOf[k].mainsnak.datavalue.value.id;
            if (qid === 'Q5398426' || qid === 'Q15416') { type = 'tv'; break; }
          }
          var year = '';
          var pubClaim = claims.P577;
          if (pubClaim && pubClaim.length) {
            var rawTime = pubClaim[0].mainsnak && pubClaim[0].mainsnak.datavalue &&
              pubClaim[0].mainsnak.datavalue.value &&
              pubClaim[0].mainsnak.datavalue.value.time;
            if (rawTime) {
              var m = String(rawTime).match(/^\+?(\d{4})/);
              if (m) year = m[1];
            }
          }
          out.push({
            id: String(imdbId),
            title: entity.label || entity.title || 'Untitled',
            year: year,
            type: type,
            poster: ''
          });
        }
        return out;
      });
    }).catch(function () { return []; });
  }

  /* ---------------- Similar titles ---------------- */
  function similar(media, type) {
    if (VL.isNumeric(media.id)) {
      var sUrl = TMDB + '/' + type + '/' + media.id + '/similar?api_key=' + TMDB_KEY + '&page=1';
      return getJSON(sUrl, 8000).then(function (data) {
        var out = [];
        var results = (data && data.results) || [];
        for (var i = 0; i < results.length && i < 20; i++) {
          var it = results[i];
          out.push({
            id: String(it.id),
            title: it.title || it.name || 'Untitled',
            year: (it.release_date || it.first_air_date || '').substring(0, 4),
            poster: it.poster_path ? ('https://image.tmdb.org/t/p/w342' + it.poster_path) : '',
            type: type
          });
        }
        return out;
      }).catch(function () { return []; });
    }
    var url = EMBED2 + (type === 'movie' ? '/similar?imdb_id=' : '/similartv?imdb_id=') + media.id + '&page=1';
    return getJSON(url, 8000).then(function (data) {
      var out = [];
      var results = (data && data.results) || [];
      for (var i = 0; i < results.length; i++) {
        var it = mapTrendingItem(results[i], type);
        if (it) out.push(it);
      }
      return out;
    }).catch(function () { return []; });
  }

  /* ---------------- VidVault direct MP4 ---------------- */
  function vvGetToken() {
    if (vvToken && Date.now() < vvToken.e) return VL.Promise.resolve(vvToken.t);
    return VL.xhr({ url: VV_TOKEN, timeout: 10000 }).then(function (text) {
      var data = JSON.parse(text);
      if (!data || !data.t) throw new Error('VidVault: no token');
      vvToken = data;
      return data.t;
    });
  }

  // opts: { id, type, season, episode, title }
  function getDirectSources(opts) {
    var tmdbPromise;
    if (VL.isNumeric(opts.id)) {
      tmdbPromise = VL.Promise.resolve(opts.id);
    } else {
      tmdbPromise = tmdbFind(opts.id).then(function (f) { return f ? f.id : null; });
    }
    return tmdbPromise.then(function (tmdbId) {
      if (!tmdbId) return { sources: [], subtitles: [], error: 'No TMDB id for direct playback.' };
      return vvGetToken().then(function (token) {
        var body = { type: opts.type, tmdbId: String(tmdbId) };
        if (opts.type === 'tv') { body.season = opts.season; body.episode = opts.episode; }
        return postJSON(VV_PROXY, body, {
          'Content-Type': 'application/json',
          'x-request-token': token
        }).then(function (data) {
          var mp4 = (data.mp4Data && data.mp4Data.downloadInfo && data.mp4Data.downloadInfo.data) ||
            (data.mp4Data && data.mp4Data.data);
          var downloads = (mp4 && mp4.downloads) || [];
          var captions = (mp4 && mp4.captions) || [];
          var sources = [];
          for (var i = 0; i < downloads.length; i++) {
            var d = downloads[i];
            if (!d.url || d.vipLocked) continue;
            sources.push({
              url: STREAM_PROXY + '/' + encodeURIComponent(d.url) + '?n=' + encodeURIComponent(opts.title || 'video'),
              quality: d.resolution ? String(d.resolution) + 'p' : '',
              size: d.size || ''
            });
          }
          sources.sort(function (a, b) {
            return (parseInt(b.quality, 10) || 0) - (parseInt(a.quality, 10) || 0);
          });
          var subs = [];
          for (var j = 0; j < captions.length; j++) {
            var c = captions[j];
            if (!c.url) continue;
            subs.push({ label: c.lanName || c.lan || 'Subtitle', file: c.url, lan: c.lan || '' });
          }
          return { sources: sources, subtitles: subs };
        });
      });
    }).catch(function (err) {
      return { sources: [], subtitles: [], error: (err && err.message) || 'Direct source unavailable.' };
    });
  }

  /* ---------------- Subtitles (SRT -> VTT as same-origin blob) ---------------- */
  function srtToVtt(url) {
    return VL.xhr({ url: url, timeout: 10000 }).then(function (text) {
      var vtt = convertSrt(text);
      return VL.blobUrlFromText(vtt, 'text/vtt');
    });
  }

  function toBlobUrl(url) {
    return VL.xhr({ url: url, timeout: 10000 }).then(function (text) {
      return VL.blobUrlFromText(text, 'text/vtt');
    });
  }

  function convertSrt(text) {
    if (typeof text !== 'string') return 'WEBVTT\n\n';
    var out = ['WEBVTT', ''];
    var blocks = String(text).split(/\r?\n\r?\n/);
    for (var i = 0; i < blocks.length; i++) {
      var block = String(blocks[i]).replace(/\r/g, '');
      if (!block || !block.trim()) continue;
      var lines = block.split('\n');
      var timeIdx = -1;
      for (var j = 0; j < lines.length; j++) {
        if (/\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}/.test(lines[j])) {
          timeIdx = j;
          break;
        }
      }
      if (timeIdx === -1) continue;
      var cueText = lines.slice(timeIdx + 1).join('\n').trim();
      if (!cueText) continue;
      var timing = lines[timeIdx].replace(/,/g, '.');
      out.push(timing);
      out.push(cueText);
      out.push('');
    }
    return out.join('\n');
  }

  /* ---------------- public API ---------------- */
  VL.API = {
    trending: trending,
    getMedia: getMedia,
    getEpisodes: getEpisodes,
    search: search,
    similar: similar,
    getDirectSources: getDirectSources,
    tmdbFind: tmdbFind,
    srtToVtt: srtToVtt,
    toBlobUrl: toBlobUrl
  };
})();
