// LD Habits Tracker — background service worker (MV3)
// Tracks focused+visible time per domain, per day. Writes to chrome.storage.local.
// Dashboard reads via bridge.html (postMessage).
const KEY = "ldWatchSeconds";
const HEARTBEAT_MS = 10000;
const MAX_DELTA_MS = 120000; // ignore gaps > 2 min (sleep/resume)

let lastTs = Date.now();
let lastDomain = null;

function todayKey() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function read() {
  return new Promise(resolve => {
    chrome.storage.local.get([KEY], res => resolve(res[KEY] || {}));
  });
}
function write(map) {
  return new Promise(resolve => {
    chrome.storage.local.set({ [KEY]: map }, resolve);
  });
}
function addSecs(domain, secs) {
  if (secs <= 0) return;
  read().then(map => {
    const k = todayKey();
    const day = map[k] || {};
    day[domain] = (day[domain] || 0) + secs;
    map[k] = day;
    return write(map);
  });
}

function extractDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function onActiveTabChanged(tab) {
  if (!tab || !tab.url) return;
  const domain = extractDomain(tab.url);
  if (!domain) return;
  lastDomain = domain;
  lastTs = Date.now();
}

async function onVisibilityChange() {
  // when any tab's visibility changes, re-evaluate the active one
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  await onActiveTabChanged(tabs[0]);
}

function heartbeat() {
  const now = Date.now();
  const delta = now - lastTs;
  lastTs = now;
  if (delta > 0 && delta <= MAX_DELTA_MS && lastDomain) {
    addSecs(lastDomain, Math.round(delta / 1000));
  }
}

chrome.tabs.onActivated.addListener(async info => {
  const tab = await chrome.tabs.get(info.tabId);
  await onActiveTabChanged(tab);
});
chrome.windows.onFocusChanged.addListener(async windowId => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    lastDomain = null;
    return;
  }
  const tabs = await chrome.tabs.query({ active: true, windowId });
  await onActiveTabChanged(tabs[0]);
});
chrome.tabs.onUpdated.addListener((id, change, tab) => {
  if (change.status === "complete" && tab.active) onActiveTabChanged(tab);
});
chrome.tabs.onRemoved.addListener(() => {
  lastDomain = null;
});

setInterval(heartbeat, HEARTBEAT_MS);

// Initialize on load
chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(tabs => onActiveTabChanged(tabs[0]));