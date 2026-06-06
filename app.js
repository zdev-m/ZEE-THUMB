/**
 * ZEE THUMB — YouTube Thumbnail Downloader
 * Vanilla JS · No dependencies · Production-ready
 */

/* ─────────────────────────────────────────────────────────
   CONFIGURATION
   ───────────────────────────────────────────────────────── */

/** Thumbnail quality definitions */
const QUALITIES = [
  { key: 'maxresdefault', label: 'Max Resolution', tag: 'MAX',  width: 1280, height: 720 },
  { key: 'sddefault',     label: 'HD Quality',     tag: 'HD',   width: 640,  height: 480 },
  { key: 'hqdefault',     label: 'High Quality',   tag: 'HQ',   width: 480,  height: 360 },
  { key: 'mqdefault',     label: 'Medium Quality', tag: 'MQ',   width: 320,  height: 180 },
  { key: 'default',       label: 'Default',        tag: 'STD',  width: 120,  height: 90  },
];

/** YouTube thumbnail CDN base URL */
const CDN = 'https://img.youtube.com/vi';

/* ─────────────────────────────────────────────────────────
   DOM REFERENCES
   ───────────────────────────────────────────────────────── */
const $  = id => document.getElementById(id);
const urlInput      = $('urlInput');
const analyzeBtn    = $('analyzeBtn');
const clearBtn      = $('clearBtn');
const pasteBtn      = $('pasteBtn');
const toastContainer = $('toastContainer');
const skeletonWrap  = $('skeletonWrap');
const resultsWrap   = $('resultsWrap');
const previewImg    = $('previewImg');
const previewBadge  = $('previewBadge');
const metaVideoId   = $('metaVideoId');
const metaResolution = $('metaResolution');
const metaSizes     = $('metaSizes');
const qualityGrid   = $('qualityGrid');
const downloadAllBtn = $('downloadAllBtn');
const resetBtn      = $('resetBtn');

/* ─────────────────────────────────────────────────────────
   URL PARSING
   ───────────────────────────────────────────────────────── */

/**
 * Extract YouTube video ID from any known URL format.
 * Handles: watch, short links, shorts, embed, live, nocookie.
 * @param {string} url
 * @returns {string|null}
 */
function extractVideoId(url) {
  if (!url || typeof url !== 'string') return null;

  const str = url.trim();

  // Patterns to match
  const patterns = [
    // Standard watch URL: youtube.com/watch?v=ID
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    // Shorts: youtube.com/shorts/ID
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    // Live: youtube.com/live/ID
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
    // Bare ID (exactly 11 alphanumeric/dash/underscore chars)
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = str.match(pattern);
    if (match && match[1]) return match[1];
  }

  return null;
}

/**
 * Generate the img.youtube.com URL for a given video ID + quality key.
 * @param {string} videoId
 * @param {string} qualityKey
 * @returns {string}
 */
function getThumbnailUrl(videoId, qualityKey) {
  return `${CDN}/${videoId}/${qualityKey}.jpg`;
}

/* ─────────────────────────────────────────────────────────
   IMAGE AVAILABILITY CHECK
   ───────────────────────────────────────────────────────── */

/**
 * Check whether a thumbnail URL resolves to a real image
 * (not YouTube's 120×90 grey placeholder for unavailable sizes).
 * @param {string} url
 * @returns {Promise<{available: boolean, width: number, height: number}>}
 */
function checkImage(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      // YouTube serves a 120×90 grey placeholder for missing thumbnails
      const available = !(img.naturalWidth === 120 && img.naturalHeight === 90);
      resolve({ available, width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => resolve({ available: false, width: 0, height: 0 });
    img.src = url;
  });
}

/**
 * Find the best available thumbnail quality and check all others in parallel.
 * @param {string} videoId
 * @returns {Promise<Array<{quality, url, available, width, height}>>}
 */
async function fetchAvailableQualities(videoId) {
  const checks = QUALITIES.map(async quality => {
    const url = getThumbnailUrl(videoId, quality.key);
    const result = await checkImage(url);
    return { quality, url, ...result };
  });
  return Promise.all(checks);
}

/* ─────────────────────────────────────────────────────────
   DOWNLOAD HELPERS
   ───────────────────────────────────────────────────────── */

/**
 * Trigger a download of a remote image by fetching it as a blob.
 * Falls back to opening in a new tab if fetch/CORS fails.
 * @param {string} url
 * @param {string} filename
 */
async function downloadImage(url, filename) {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error('Fetch failed');
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    showToast('Download started!', 'success');
  } catch {
    // CORS fallback: open in new tab
    window.open(url, '_blank', 'noopener,noreferrer');
    showToast('Opened in new tab (download manually)', 'info');
  }
}

/**
 * Copy text to clipboard with graceful fallback.
 * @param {string} text
 */
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      // Legacy fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:-999px;left:-999px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    showToast('URL copied to clipboard!', 'success');
  } catch {
    showToast('Could not copy — please copy manually', 'error');
  }
}

/* ─────────────────────────────────────────────────────────
   TOAST NOTIFICATIONS
   ───────────────────────────────────────────────────────── */

const ICONS = {
  success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  error:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  info:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
};

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 * @param {number} duration ms
 */
function showToast(message, type = 'info', duration = 3200) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${ICONS[type] || ICONS.info}</span>
    <span class="toast-msg">${message}</span>
  `;
  toastContainer.appendChild(toast);

  const remove = () => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };

  const timer = setTimeout(remove, duration);
  toast.addEventListener('click', () => { clearTimeout(timer); remove(); });
}

/* ─────────────────────────────────────────────────────────
   UI STATE MANAGEMENT
   ───────────────────────────────────────────────────────── */

/** Show skeleton loaders */
function showSkeleton() {
  skeletonWrap.hidden = false;
  resultsWrap.hidden  = true;
  skeletonWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Hide skeleton loaders */
function hideSkeleton() {
  skeletonWrap.hidden = true;
}

/** Show results section */
function showResults() {
  resultsWrap.hidden = false;
  resultsWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Hide all results */
function hideResults() {
  skeletonWrap.hidden = true;
  resultsWrap.hidden  = true;
}

/** Set the analyze button into loading state */
function setLoading(loading) {
  analyzeBtn.disabled = loading;
  analyzeBtn.classList.toggle('loading', loading);
}

/* ─────────────────────────────────────────────────────────
   QUALITY CARD RENDERER
   ───────────────────────────────────────────────────────── */

/**
 * Build a single quality card element.
 * @param {{quality, url, available, width, height}} item
 * @param {number} index  card order index for animation delay
 * @returns {HTMLElement}
 */
function createQualityCard(item, index) {
  const { quality, url, available, width, height } = item;

  const card = document.createElement('div');
  card.className = `quality-card glass-card${available ? '' : ' unavailable'}`;
  card.style.setProperty('--card-delay', `${index * 60}ms`);

  const resLabel = available && width
    ? `${width} × ${height} px`
    : 'Not available';

  const filename = `thumbnail-${quality.key}.jpg`;

  card.innerHTML = `
    <div class="qc-thumb">
      <img
        src="${available ? url : ''}"
        alt="${quality.label} thumbnail"
        loading="lazy"
        ${available ? '' : 'style="opacity:0"'}
      />
      <span class="qc-tag">${quality.tag}</span>
    </div>
    <div class="qc-body">
      <div>
        <div class="qc-name">${quality.label}</div>
        <div class="qc-res">${resLabel}</div>
      </div>
      <div class="qc-actions">
        <button class="qc-btn qc-btn-dl" title="Download" ${available ? '' : 'disabled'}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Save
        </button>
        <button class="qc-btn qc-btn-copy" title="Copy URL" ${available ? '' : 'disabled'}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Copy
        </button>
      </div>
      <button class="qc-btn qc-btn-open" title="Open in new tab" ${available ? '' : 'disabled'}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/>
          <line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
        Open in tab
      </button>
    </div>
  `;

  if (available) {
    // Download
    card.querySelector('.qc-btn-dl').addEventListener('click', () => {
      downloadImage(url, filename);
    });
    // Copy URL
    card.querySelector('.qc-btn-copy').addEventListener('click', () => {
      copyToClipboard(url);
    });
    // Open in tab
    card.querySelector('.qc-btn-open').addEventListener('click', () => {
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  }

  return card;
}

/* ─────────────────────────────────────────────────────────
   CORE FETCH & RENDER
   ───────────────────────────────────────────────────────── */

/** Currently loaded video ID */
let currentVideoId = null;
/** All available quality results */
let currentResults = [];

/**
 * Main entry point: validate URL, fetch thumbnails, render results.
 */
async function handleAnalyze() {
  const raw = urlInput.value.trim();

  if (!raw) {
    showToast('Please paste a YouTube URL first', 'error');
    urlInput.focus();
    return;
  }

  const videoId = extractVideoId(raw);
  if (!videoId) {
    showToast('Could not find a valid YouTube video ID in that URL', 'error');
    urlInput.focus();
    return;
  }

  // Update state
  currentVideoId = videoId;
  setLoading(true);
  showSkeleton();

  try {
    const results = await fetchAvailableQualities(videoId);
    currentResults = results;

    const available = results.filter(r => r.available);

    if (available.length === 0) {
      hideSkeleton();
      showToast('No thumbnails found for this video. It may be private or deleted.', 'error');
      setLoading(false);
      return;
    }

    // Best available (first in QUALITIES order that is available)
    const best = available[0];

    // Update main preview
    previewImg.src = best.url;
    previewBadge.textContent = best.quality.tag;
    metaVideoId.textContent = videoId;
    metaResolution.textContent = best.available && best.width
      ? `${best.width} × ${best.height} px`
      : '—';
    metaSizes.textContent = `${available.length} of ${QUALITIES.length}`;

    // Render quality cards
    qualityGrid.innerHTML = '';
    results.forEach((item, index) => {
      qualityGrid.appendChild(createQualityCard(item, index));
    });

    // Download All handler
    downloadAllBtn.onclick = async () => {
      const avail = currentResults.filter(r => r.available);
      if (!avail.length) return;
      showToast(`Downloading ${avail.length} thumbnails…`, 'info');
      for (const item of avail) {
        await downloadImage(item.url, `thumbnail-${item.quality.key}.jpg`);
        await new Promise(r => setTimeout(r, 400)); // stagger
      }
    };

    hideSkeleton();
    showResults();
    showToast(`Found ${available.length} thumbnail${available.length > 1 ? 's' : ''}!`, 'success');
  } catch (err) {
    hideSkeleton();
    showToast('Something went wrong. Please try again.', 'error');
    console.error('[ZEE THUMB]', err);
  } finally {
    setLoading(false);
  }
}

/* ─────────────────────────────────────────────────────────
   INPUT & CLEAR BEHAVIOUR
   ───────────────────────────────────────────────────────── */

function updateClearBtn() {
  const hasValue = urlInput.value.length > 0;
  clearBtn.classList.toggle('visible', hasValue);
  if (pasteBtn) pasteBtn.classList.toggle('hidden', hasValue);
}

urlInput.addEventListener('input', updateClearBtn);

clearBtn.addEventListener('click', () => {
  urlInput.value = '';
  urlInput.focus();
  updateClearBtn();
});

/* Paste button — reads clipboard and fills input */
if (pasteBtn) {
  pasteBtn.addEventListener('click', async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        const text = await navigator.clipboard.readText();
        if (text) {
          urlInput.value = text.trim();
          updateClearBtn();
          // Auto-analyze if valid YouTube URL
          if (extractVideoId(urlInput.value)) {
            handleAnalyze();
          } else {
            urlInput.focus();
            showToast('Pasted! Now click Fetch Thumbnails.', 'info');
          }
        }
      } else {
        // Fallback: focus input so user can paste manually
        urlInput.focus();
        showToast('Press Ctrl+V / ⌘+V to paste', 'info');
      }
    } catch {
      urlInput.focus();
      showToast('Allow clipboard access to use Paste button', 'info');
    }
  });
}

/** Allow pressing Enter in input to trigger analyze */
urlInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleAnalyze();
});

analyzeBtn.addEventListener('click', handleAnalyze);

/* ─────────────────────────────────────────────────────────
   RESET
   ───────────────────────────────────────────────────────── */

resetBtn.addEventListener('click', () => {
  hideResults();
  urlInput.value = '';
  updateClearBtn();
  currentVideoId = null;
  currentResults = [];
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => urlInput.focus(), 400);
});

/* ─────────────────────────────────────────────────────────
   PASTE DETECTION
   ───────────────────────────────────────────────────────── */

/**
 * Auto-trigger analysis when a YouTube URL is pasted
 * (gives a snappier feeling without needing to click the button).
 */
urlInput.addEventListener('paste', e => {
  // Use a brief timeout so the value is available after paste
  setTimeout(() => {
    const pasted = urlInput.value.trim();
    if (pasted && extractVideoId(pasted)) {
      handleAnalyze();
    }
  }, 80);
});

/* ─────────────────────────────────────────────────────────
   DRAG & DROP URL SUPPORT
   ───────────────────────────────────────────────────────── */

document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => {
  e.preventDefault();
  const text = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list');
  if (text && extractVideoId(text)) {
    urlInput.value = text;
    updateClearBtn();
    handleAnalyze();
  }
});

/* ─────────────────────────────────────────────────────────
   KEYBOARD SHORTCUT — ⌘/Ctrl + K to focus input
   ───────────────────────────────────────────────────────── */
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    urlInput.focus();
    urlInput.select();
  }
});

/* ─────────────────────────────────────────────────────────
   SCROLL REVEAL
   ───────────────────────────────────────────────────────── */
(function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target); // fire once
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal, .reveal-stagger').forEach(el => {
    observer.observe(el);
  });
})();

/* ─────────────────────────────────────────────────────────
   INIT
   ───────────────────────────────────────────────────────── */
(function init() {
  updateClearBtn();
  // Slight delay so the browser renders the page first
  setTimeout(() => urlInput.focus(), 300);
})();
