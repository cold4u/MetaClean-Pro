/**
 * MetaClean Pro v2.0 - Controller with Cyber Extraction Mode & PhotoMeta Integration
 * Seamlessly manages Dual Mode (Sanitizer vs Cyber Extractor), file queues, and memory lifecycle.
 */

import { MetadataParser } from './modules/metadata-parser.js';
import { ImageCleaner } from './modules/image-cleaner.js';
import { VideoCleaner } from './modules/video-cleaner.js';
import { ZipWriter } from './modules/zip-writer.js';

// DOM Selectors
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// Mode Toggle Elements
const modeToggleBtn = $('#modeToggleBtn');
const modeIndicator = $('#modeIndicator');
const appBrandBadge = $('#appBrandBadge');
const heroPill = $('#heroPill');
const heroTitle = $('#heroTitle');
const heroSubtext = $('#heroSubtext');
const dropTitle = $('#dropTitle');
const dropHint = $('#dropHint');

// Global Drop & Input
const dropZone = $('#dropZone');
const fileInput = $('#fileInput');
const srAnnounce = $('#srAnnounce');

// Workspaces
const cleanerWorkspace = $('#cleanerWorkspace');
const extractionWorkspace = $('#extractionWorkspace');
const capabilitiesSection = $('#capabilitiesSection');

// Cleaner Mode Elements
const imageThumb = $('#imageThumb');
const videoThumb = $('#videoThumb');
const fileName = $('#fileName');
const fileTypeBadge = $('#fileTypeBadge');
const fileSize = $('#fileSize');
const fileDimensions = $('#fileDimensions');
const scanStatus = $('#scanStatus');
const qualitySelect = $('#qualitySelect');
const qualitySettingGroup = $('#qualitySettingGroup');

// Batch Queue Elements
const batchQueueCard = $('#batchQueueCard');
const batchCount = $('#batchCount');
const batchItemsList = $('#batchItemsList');
const cleanAllBtn = $('#cleanAllBtn');
const downloadZipBtn = $('#downloadZipBtn');

// Cleaner Inspector Elements
const detectedCount = $('#detectedCount');
const tagsList = $('#tagsList');
const statBefore = $('#statBefore');
const statAfter = $('#statAfter');
const verificationBadge = $('#verificationBadge');
const previewPlaceholder = $('#previewPlaceholder');
const cleanImagePreview = $('#cleanImagePreview');
const cleanVideoPreview = $('#cleanVideoPreview');
const cleanCurrentBtn = $('#cleanCurrentBtn');
const downloadBtn = $('#downloadBtn');
const resetBtn = $('#resetBtn');

// Cyber Extraction Mode Elements
const extractFileName = $('#extractFileName');
const extractImageThumb = $('#extractImageThumb');
const extractVideoThumb = $('#extractVideoThumb');
const extractTargetName = $('#extractTargetName');
const extractTargetInfo = $('#extractTargetInfo');
const extractStatusText = $('#extractStatusText');
const extractCleanBtn = $('#extractCleanBtn');
const copyJsonBtn = $('#copyJsonBtn');
const extractResetBtn = $('#extractResetBtn');
const extractNoExifMsg = $('#extractNoExifMsg');

// Cyber Cards & Tables
const gpsSection = $('#gpsSection');
const gpsLatVal = $('#gpsLatVal');
const gpsLonVal = $('#gpsLonVal');
const gpsAltItem = $('#gpsAltItem');
const gpsAltVal = $('#gpsAltVal');
const googleMapsLink = $('#googleMapsLink');
const googleMapsSub = $('#googleMapsSub');
const deviceSection = $('#deviceSection');
const deviceChipsGrid = $('#deviceChipsGrid');
const cameraOpticsSection = $('#cameraOpticsSection');
const cameraChipsGrid = $('#cameraChipsGrid');
const rawTagCount = $('#rawTagCount');
const rawSearchInput = $('#rawSearchInput');
const rawTableBody = $('#rawTableBody');

// Application State
let currentMode = localStorage.getItem('metaclean_mode') || 'cleaner'; // 'cleaner' | 'extraction'
let fileQueue = [];
let currentIndex = -1;
let currentRawTags = [];
const objectUrls = new Set();

/**
 * Register and track Object URLs for reliable memory cleanup
 */
function createManagedUrl(blob) {
  const url = URL.createObjectURL(blob);
  objectUrls.add(url);
  return url;
}

function revokeAllUrls() {
  objectUrls.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch (e) {}
  });
  objectUrls.clear();
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function announce(msg) {
  if (srAnnounce) srAnnounce.textContent = msg;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ==========================================================================
   MODE SWITCHING LOGIC (Cleaner vs Cyber Extractor)
   ========================================================================== */

function setMode(mode) {
  currentMode = mode;
  localStorage.setItem('metaclean_mode', mode);

  const isExtraction = currentMode === 'extraction';
  document.body.classList.toggle('extraction-mode', isExtraction);
  modeToggleBtn.setAttribute('aria-pressed', isExtraction ? 'true' : 'false');
  modeIndicator.textContent = isExtraction ? 'ON' : 'OFF';

  if (isExtraction) {
    appBrandBadge.textContent = 'OSINT v2.0';
    heroPill.textContent = '[ SYSTEM://CYBER_EXTRACTION_ENGINE ]';
    heroTitle.innerHTML = `Extract Hidden Intelligence.<br><span class="gradient-text">Uncover Every Byte.</span>`;
    heroSubtext.textContent = `Instant GPS satellite coordinates, device hardware identifiers, camera optics exposure, and raw EXIF telemetry dumped locally.`;
    dropTitle.textContent = `DROP TARGET PHOTO OR VIDEO`;
    dropHint.innerHTML = `or <span class="browse-link">select target</span> to extract embedded telemetry`;
    announce('Extraction Mode activated: Cyber theme enabled');
  } else {
    appBrandBadge.textContent = 'PRO v2.0';
    heroPill.textContent = 'PRIVACY-FIRST MEDIA SANITIZER';
    heroTitle.innerHTML = `Scrub private metadata.<br><span class="gradient-text">Protect your media.</span>`;
    heroSubtext.textContent = `Deep-scan and strip EXIF, GPS, camera models, dates, and QuickTime/MP4 tags. Zero data ever leaves your browser.`;
    dropTitle.textContent = `Drop images or videos here`;
    dropHint.innerHTML = `or <span class="browse-link">browse files</span> from your device`;
    announce('Cleaner Mode activated: Privacy sanitizer active');
  }

  // If a file is already loaded, re-render appropriate workspace
  if (currentIndex !== -1 && fileQueue[currentIndex]) {
    switchWorkspaceView();
  }
}

modeToggleBtn.addEventListener('click', () => {
  setMode(currentMode === 'cleaner' ? 'extraction' : 'cleaner');
});

// Keyboard shortcut: Ctrl + E or Cmd + E toggles Extraction Mode
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
    e.preventDefault();
    setMode(currentMode === 'cleaner' ? 'extraction' : 'cleaner');
  }
});

/* ==========================================================================
   File Drop & Selection Handlers
   ========================================================================== */

['dragenter', 'dragover'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
  });
});

dropZone.addEventListener('drop', (e) => {
  const files = Array.from(e.dataTransfer.files).filter(isValidMedia);
  if (files.length > 0) handleFiles(files);
});

fileInput.addEventListener('change', () => {
  const files = Array.from(fileInput.files).filter(isValidMedia);
  if (files.length > 0) handleFiles(files);
});

function isValidMedia(file) {
  const t = file.type.toLowerCase();
  const n = file.name.toLowerCase();
  return (
    t.startsWith('image/') ||
    t.startsWith('video/') ||
    n.endsWith('.jpg') ||
    n.endsWith('.jpeg') ||
    n.endsWith('.png') ||
    n.endsWith('.webp') ||
    n.endsWith('.mp4') ||
    n.endsWith('.mov') ||
    n.endsWith('.webm')
  );
}

async function handleFiles(files) {
  revokeAllUrls();
  fileQueue = files.map((file) => ({
    file,
    name: file.name,
    size: file.size,
    type: file.type || getFallbackMime(file.name),
    isVideo: isVideoFile(file),
    cleanedBlob: null,
    cleanedUrl: null,
    extension: null,
    tags: [],
    afterTags: [],
    exifTags: null,
    gps: null
  }));

  switchWorkspaceView();

  if (fileQueue.length > 1 && currentMode === 'cleaner') {
    batchQueueCard.classList.remove('hidden');
    batchCount.textContent = fileQueue.length;
    renderBatchQueue();
    downloadZipBtn.classList.add('hidden');
  } else {
    batchQueueCard.classList.add('hidden');
  }

  await selectFile(0);
}

function switchWorkspaceView() {
  if (fileQueue.length === 0) {
    cleanerWorkspace.classList.add('hidden');
    extractionWorkspace.classList.add('hidden');
    return;
  }

  if (currentMode === 'extraction') {
    cleanerWorkspace.classList.add('hidden');
    extractionWorkspace.classList.remove('hidden');
    extractionWorkspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    extractionWorkspace.classList.add('hidden');
    cleanerWorkspace.classList.remove('hidden');
    cleanerWorkspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function isVideoFile(file) {
  const t = (file.type || '').toLowerCase();
  const n = file.name.toLowerCase();
  return t.startsWith('video/') || n.endsWith('.mp4') || n.endsWith('.mov') || n.endsWith('.webm');
}

function getFallbackMime(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const mimes = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm'
  };
  return mimes[ext] || 'application/octet-stream';
}

/* ==========================================================================
   File Selection & Unified Pipeline
   ========================================================================== */

async function selectFile(index) {
  if (index < 0 || index >= fileQueue.length) return;
  currentIndex = index;
  const item = fileQueue[index];
  const initialUrl = createManagedUrl(item.file);

  // 1. Update Cleaner UI elements
  fileName.textContent = item.name;
  fileSize.textContent = formatBytes(item.size);
  fileTypeBadge.textContent = item.isVideo ? 'VIDEO' : 'IMAGE';
  qualitySettingGroup.style.display = item.isVideo ? 'none' : 'flex';
  scanStatus.textContent = 'Scanning…';
  scanStatus.className = 'status-scanning';

  if (item.isVideo) {
    imageThumb.classList.add('hidden');
    videoThumb.classList.remove('hidden');
    videoThumb.src = initialUrl;
  } else {
    videoThumb.classList.add('hidden');
    imageThumb.classList.remove('hidden');
    imageThumb.src = initialUrl;
  }

  resetOutputPreview();

  // 2. Update Extraction UI elements
  extractFileName.textContent = item.name;
  extractTargetName.textContent = item.name;
  extractTargetInfo.textContent = `${(item.type || 'MEDIA').toUpperCase()} • ${formatBytes(item.size)}`;
  extractStatusText.textContent = 'ANALYZING FILE BINARY HEADERS…';

  if (item.isVideo) {
    extractImageThumb.classList.add('hidden');
    extractVideoThumb.classList.remove('hidden');
    extractVideoThumb.src = initialUrl;
  } else {
    extractVideoThumb.classList.add('hidden');
    extractImageThumb.classList.remove('hidden');
    extractImageThumb.src = initialUrl;
  }

  // 3. Run Native Deep Metadata Parser
  try {
    const parseResult = item.isVideo
      ? await MetadataParser.parseVideo(item.file)
      : await MetadataParser.parseImage(item.file);

    item.tags = parseResult.tags;
    detectedCount.textContent = item.tags.length;
    statBefore.textContent = item.tags.length;
    scanStatus.textContent = 'Scan Complete';
    scanStatus.className = 'status-done';
    renderTags(item.tags);

    if (item.cleanedBlob) displayCleanedResult(item);
  } catch (e) {
    console.error(e);
  }

  // 4. Run PhotoMeta Deep Extractor (EXIF.js + GPS coordinate calculation)
  await runPhotoMetaExtraction(item, initialUrl);

  // 5. Dimensions calculation
  fetchDimensions(item, initialUrl);
  updateBatchActiveItem();
}

function fetchDimensions(item, url) {
  if (item.isVideo) {
    const v = document.createElement('video');
    v.src = url;
    v.onloadedmetadata = () => {
      const dim = `${v.videoWidth} × ${v.videoHeight} • ${Math.round(v.duration)}s`;
      fileDimensions.textContent = dim;
      extractTargetInfo.textContent = `${(item.type || 'VIDEO').toUpperCase()} • ${formatBytes(item.size)} • ${dim}`;
    };
  } else {
    const img = new Image();
    img.src = url;
    img.onload = () => {
      const dim = `${img.naturalWidth} × ${img.naturalHeight}`;
      fileDimensions.textContent = dim;
      extractTargetInfo.textContent = `${(item.type || 'IMAGE').toUpperCase()} • ${formatBytes(item.size)} • ${dim}`;
    };
  }
}

/* ==========================================================================
   PhotoMeta Deep Extraction & Cyber Dossier Rendering
   ========================================================================== */

async function runPhotoMetaExtraction(item, url) {
  currentRawTags = [];
  deviceChipsGrid.innerHTML = '';
  cameraChipsGrid.innerHTML = '';
  rawTableBody.innerHTML = '';

  // Copy parsed tags from MetadataParser into raw table items
  item.tags.forEach((t) => {
    currentRawTags.push({ tag: `${t.category} // ${t.label}`, value: t.value });
    if (t.raw && t.raw.lat && t.raw.lon) {
      item.gps = { lat: parseFloat(t.raw.lat), lon: parseFloat(t.raw.lon), alt: null };
    }
  });

  // If image and EXIF.js is available, extract detailed photography tags
  if (!item.isVideo && window.EXIF) {
    await new Promise((resolve) => {
      window.EXIF.getData(item.file, function () {
        const tags = window.EXIF.getAllTags(this);
        if (tags) {
          item.exifTags = tags;
          // Extract GPS if not already extracted
          const lat = window.EXIF.getTag(this, 'GPSLatitude');
          const lon = window.EXIF.getTag(this, 'GPSLongitude');
          const latRef = window.EXIF.getTag(this, 'GPSLatitudeRef') || 'N';
          const lonRef = window.EXIF.getTag(this, 'GPSLongitudeRef') || 'E';
          if (lat && lon && !item.gps) {
            const latD = toDecimalDeg(lat, latRef);
            const lonD = toDecimalDeg(lon, lonRef);
            const alt = window.EXIF.getTag(this, 'GPSAltitude');
            item.gps = { lat: latD, lon: lonD, alt: alt ? dmsToNum(alt) : null };
          }

          // Add EXIF.js tags to raw list
          Object.keys(tags).forEach((k) => {
            if (typeof tags[k] !== 'function') {
              currentRawTags.push({ tag: `EXIF // ${k}`, value: valToStr(tags[k]) });
            }
          });
        }
        resolve();
      });
    });
  }

  // Render Cyber Extraction Sections
  renderCyberDossier(item);
}

function renderCyberDossier(item) {
  const hasGps = !!item.gps;
  const tags = item.exifTags || {};

  // GPS Telemetry
  if (hasGps) {
    gpsSection.classList.remove('hidden');
    gpsLatVal.textContent = `${item.gps.lat.toFixed(6)}°`;
    gpsLonVal.textContent = `${item.gps.lon.toFixed(6)}°`;
    if (item.gps.alt) {
      gpsAltItem.classList.remove('hidden');
      gpsAltVal.textContent = `${item.gps.alt.toFixed(1)} m`;
    } else {
      gpsAltItem.classList.add('hidden');
    }
    const mapUrl = `https://www.google.com/maps?q=${item.gps.lat},${item.gps.lon}`;
    googleMapsLink.href = mapUrl;
    googleMapsSub.textContent = `Coordinates: ${item.gps.lat.toFixed(5)}, ${item.gps.lon.toFixed(5)}`;
  } else {
    gpsSection.classList.add('hidden');
  }

  // Device Dossier Chips
  const deviceChips = [];
  const make = (tags.Make || '').trim();
  const model = (tags.Model || '').trim();
  if (make || model) deviceChips.push({ label: 'Camera Device', value: [make, model].filter(Boolean).join(' ') });
  if (tags.LensModel) deviceChips.push({ label: 'Lens Model', value: String(tags.LensModel) });
  if (tags.Software) deviceChips.push({ label: 'Software / OS', value: String(tags.Software) });
  const dt = tags.DateTimeOriginal || tags.DateTime;
  if (dt) deviceChips.push({ label: 'Timestamp Taken', value: String(dt) });

  if (deviceChips.length > 0) {
    deviceSection.classList.remove('hidden');
    deviceChipsGrid.innerHTML = deviceChips
      .map(
        (c) => `
      <div class="cyber-chip">
        <span class="chip-label">${escapeHtml(c.label)}</span>
        <span class="chip-val">${escapeHtml(c.value)}</span>
      </div>`
      )
      .join('');
  } else {
    deviceSection.classList.add('hidden');
  }

  // Camera Optics Chips
  const cameraChips = [];
  if (tags.FNumber) cameraChips.push({ label: 'Aperture', value: `f/${dmsToNum(tags.FNumber).toFixed(1)}` });
  if (tags.ExposureTime) cameraChips.push({ label: 'Shutter Speed', value: `${fmtRational(tags.ExposureTime)} s` });
  if (tags.ISOSpeedRatings) cameraChips.push({ label: 'ISO Sensitivity', value: `ISO ${tags.ISOSpeedRatings}` });
  if (tags.FocalLength) cameraChips.push({ label: 'Focal Length', value: `${dmsToNum(tags.FocalLength).toFixed(0)} mm` });
  if (tags.XResolution && tags.YResolution) {
    cameraChips.push({ label: 'Resolution', value: `${dmsToNum(tags.XResolution).toFixed(0)} × ${dmsToNum(tags.YResolution).toFixed(0)} DPI` });
  }

  if (cameraChips.length > 0) {
    cameraOpticsSection.classList.remove('hidden');
    cameraChipsGrid.innerHTML = cameraChips
      .map(
        (c) => `
      <div class="cyber-chip">
        <span class="chip-label">${escapeHtml(c.label)}</span>
        <span class="chip-val">${escapeHtml(c.value)}</span>
      </div>`
      )
      .join('');
  } else {
    cameraOpticsSection.classList.add('hidden');
  }

  // Alert if no metadata found
  const totalTags = currentRawTags.length;
  extractStatusText.textContent = `METADATA DUMP COMPLETE // ${totalTags} TAGS PARSED`;
  extractNoExifMsg.classList.toggle('hidden', totalTags > 0);

  // Render Raw Terminal Table
  renderRawTable(currentRawTags);
}

function renderRawTable(list) {
  rawTagCount.textContent = list.length;
  if (list.length === 0) {
    rawTableBody.innerHTML = `<tr><td colspan="2" class="terminal-empty">No metadata tags identified in this file.</td></tr>`;
    return;
  }

  // Deduplicate and sort
  const map = new Map();
  list.forEach((item) => {
    if (!map.has(item.tag)) map.set(item.tag, item.value);
  });
  const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  rawTableBody.innerHTML = sorted
    .map(
      ([tag, val]) => `
    <tr>
      <td>${escapeHtml(tag)}</td>
      <td>${escapeHtml(val)}</td>
    </tr>`
    )
    .join('');
}

// Live Search Filter for Raw Terminal Table
rawSearchInput.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase().trim();
  const rows = rawTableBody.querySelectorAll('tr');
  rows.forEach((row) => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(query) ? '' : 'none';
  });
});

// Quick Action: Scrub This File (from extraction mode)
extractCleanBtn.addEventListener('click', async () => {
  if (currentIndex === -1) return;
  setMode('cleaner');
  await cleanItem(fileQueue[currentIndex]);
});

// Quick Action: Copy Extracted Metadata as JSON
copyJsonBtn.addEventListener('click', () => {
  if (currentRawTags.length === 0) return;
  const jsonReport = {};
  currentRawTags.forEach(({ tag, value }) => {
    jsonReport[tag] = value;
  });
  navigator.clipboard.writeText(JSON.stringify(jsonReport, null, 2)).then(() => {
    copyJsonBtn.textContent = 'COPIED!';
    setTimeout(() => {
      copyJsonBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        COPY JSON`;
    }, 2000);
  });
});

extractResetBtn.addEventListener('click', () => {
  resetAll();
});

/* ==========================================================================
   Cleaner Sanitization Flow & Output
   ========================================================================== */

cleanCurrentBtn.addEventListener('click', async () => {
  if (currentIndex === -1) return;
  await cleanItem(fileQueue[currentIndex]);
});

async function cleanItem(item) {
  cleanCurrentBtn.disabled = true;
  cleanCurrentBtn.innerHTML = `
    <svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
    Sanitizing…`;

  try {
    let result;
    if (item.isVideo) {
      result = await VideoCleaner.clean(item.file);
    } else {
      const quality = parseFloat(qualitySelect.value) || 0.95;
      result = await ImageCleaner.clean(item.file, { quality });
    }

    item.cleanedBlob = result.cleanBlob;
    item.cleanedUrl = result.cleanUrl;
    item.extension = result.extension;
    item.afterTags = result.afterTags;
    objectUrls.add(result.cleanUrl);

    displayCleanedResult(item);
    renderBatchQueue();

    announce(`File sanitized successfully. ${item.tags.length} tags removed.`);
  } catch (err) {
    console.error(err);
    alert('Could not sanitize this file: ' + err.message);
  } finally {
    cleanCurrentBtn.disabled = false;
    cleanCurrentBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
      Clean This File`;
  }
}

function displayCleanedResult(item) {
  statBefore.textContent = item.tags.length;
  statAfter.textContent = item.afterTags.length;

  if (item.afterTags.length === 0) {
    verificationBadge.textContent = '100% Clean';
    verificationBadge.className = 'count-pill success';
  } else {
    verificationBadge.textContent = `${item.afterTags.length} tags remaining`;
    verificationBadge.className = 'count-pill neutral';
  }

  previewPlaceholder.classList.add('hidden');
  if (item.isVideo) {
    cleanImagePreview.classList.add('hidden');
    cleanVideoPreview.classList.remove('hidden');
    cleanVideoPreview.src = item.cleanedUrl;
  } else {
    cleanVideoPreview.classList.add('hidden');
    cleanImagePreview.classList.remove('hidden');
    cleanImagePreview.src = item.cleanedUrl;
  }

  downloadBtn.disabled = false;
}

function resetOutputPreview() {
  previewPlaceholder.classList.remove('hidden');
  cleanImagePreview.classList.add('hidden');
  cleanVideoPreview.classList.add('hidden');
  cleanVideoPreview.src = '';
  cleanImagePreview.src = '';
  statAfter.textContent = '—';
  verificationBadge.textContent = 'Ready';
  verificationBadge.className = 'count-pill neutral';
  downloadBtn.disabled = true;
}

function renderTags(tags) {
  if (!tags || tags.length === 0) {
    tagsList.innerHTML = `<div class="empty-state">No sensitive metadata discovered in this file.</div>`;
    return;
  }

  tagsList.innerHTML = tags
    .map(
      (t) => `
    <div class="tag-row">
      <div class="tag-meta">
        <span class="tag-category">${escapeHtml(t.category)}</span>
        <span class="tag-label">${escapeHtml(t.label)}</span>
      </div>
      <div class="tag-value" title="${escapeHtml(t.value)}">${escapeHtml(t.value)}</div>
    </div>`
    )
    .join('');
}

/* ==========================================================================
   Download Handlers
   ========================================================================== */

downloadBtn.addEventListener('click', () => {
  if (currentIndex === -1) return;
  const item = fileQueue[currentIndex];
  if (!item.cleanedBlob) return;

  const baseName = item.name.replace(/\.[^/.]+$/, '');
  const cleanFilename = `${baseName}-clean.${item.extension}`;

  const a = document.createElement('a');
  a.href = item.cleanedUrl;
  a.download = cleanFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
});

/* ==========================================================================
   Batch Queue Operations
   ========================================================================== */

function renderBatchQueue() {
  batchItemsList.innerHTML = fileQueue
    .map(
      (item, idx) => `
    <div class="batch-item ${idx === currentIndex ? 'active' : ''}" data-idx="${idx}">
      <span class="batch-item-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
      <span class="batch-item-status ${item.cleanedBlob ? 'cleaned' : 'pending'}">
        ${item.cleanedBlob ? 'Cleaned' : 'Pending'}
      </span>
    </div>`
    )
    .join('');

  $$('.batch-item').forEach((el) => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.idx, 10);
      selectFile(idx);
    });
  });

  const allCleaned = fileQueue.every((i) => i.cleanedBlob !== null);
  if (allCleaned && fileQueue.length > 1) {
    downloadZipBtn.classList.remove('hidden');
  }
}

function updateBatchActiveItem() {
  $$('.batch-item').forEach((el, idx) => {
    el.classList.toggle('active', idx === currentIndex);
  });
}

cleanAllBtn.addEventListener('click', async () => {
  cleanAllBtn.disabled = true;
  cleanAllBtn.textContent = 'Cleaning all…';

  for (let i = 0; i < fileQueue.length; i++) {
    await selectFile(i);
    if (!fileQueue[i].cleanedBlob) {
      await cleanItem(fileQueue[i]);
    }
  }

  cleanAllBtn.disabled = false;
  cleanAllBtn.textContent = 'Clean All';
  downloadZipBtn.classList.remove('hidden');
});

downloadZipBtn.addEventListener('click', async () => {
  downloadZipBtn.disabled = true;
  downloadZipBtn.textContent = 'Zipping…';

  try {
    const zip = new ZipWriter();
    for (const item of fileQueue) {
      if (item.cleanedBlob) {
        const baseName = item.name.replace(/\.[^/.]+$/, '');
        const filename = `${baseName}-clean.${item.extension}`;
        await zip.addFile(filename, item.cleanedBlob);
      }
    }

    const zipBlob = zip.generate();
    const zipUrl = createManagedUrl(zipBlob);

    const a = document.createElement('a');
    a.href = zipUrl;
    a.download = `MetaClean-Batch-${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    console.error(err);
    alert('Failed to generate ZIP archive: ' + err.message);
  } finally {
    downloadZipBtn.disabled = false;
    downloadZipBtn.textContent = 'Download ZIP';
  }
});

/* ==========================================================================
   Reset Handler
   ========================================================================== */

function resetAll() {
  revokeAllUrls();
  fileQueue = [];
  currentIndex = -1;
  fileInput.value = '';
  cleanerWorkspace.classList.add('hidden');
  extractionWorkspace.classList.add('hidden');
  resetOutputPreview();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

resetBtn.addEventListener('click', resetAll);

/* ==========================================================================
   EXIF DMS & Formatting Helpers
   ========================================================================== */

function toDecimalDeg(dms, ref) {
  const d = dmsToNum(dms[0]);
  const m = dmsToNum(dms[1]);
  const s = dmsToNum(dms[2]);
  let dec = d + m / 60 + s / 3600;
  if (ref === 'S' || ref === 'W') dec = -dec;
  return dec;
}

function dmsToNum(v) {
  return typeof v === 'object' && v !== null && 'numerator' in v
    ? v.numerator / v.denominator
    : Number(v);
}

function fmtRational(v) {
  if (typeof v === 'object' && v !== null && 'numerator' in v) {
    return `${v.numerator}/${v.denominator}`;
  }
  return String(v);
}

function valToStr(v) {
  if (v == null) return '';
  if (typeof v === 'object' && 'numerator' in v) return fmtRational(v);
  if (Array.isArray(v)) return v.map(valToStr).join(', ');
  return String(v);
}

// Initialize Mode on startup
setMode(currentMode);
