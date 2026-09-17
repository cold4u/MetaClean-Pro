/**
 * MetaClean Pro v2.0 - Main Application Controller
 * Handles UI interactions, memory management, batch queues, and sanitization flows.
 */

import { MetadataParser } from './modules/metadata-parser.js';
import { ImageCleaner } from './modules/image-cleaner.js';
import { VideoCleaner } from './modules/video-cleaner.js';
import { ZipWriter } from './modules/zip-writer.js';

// DOM Element Selectors
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const dropZone = $('#dropZone');
const fileInput = $('#fileInput');
const workspace = $('#workspace');
const srAnnounce = $('#srAnnounce');

// Header Info Elements
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

// Inspector & Verification Elements
const detectedCount = $('#detectedCount');
const tagsList = $('#tagsList');
const statBefore = $('#statBefore');
const statAfter = $('#statAfter');
const verificationBadge = $('#verificationBadge');
const previewPlaceholder = $('#previewPlaceholder');
const cleanImagePreview = $('#cleanImagePreview');
const cleanVideoPreview = $('#cleanVideoPreview');

// Action Buttons
const cleanCurrentBtn = $('#cleanCurrentBtn');
const downloadBtn = $('#downloadBtn');
const resetBtn = $('#resetBtn');

// State Management
let fileQueue = [];
let currentIndex = -1;
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

/**
 * Human-readable byte formatting
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Announce status messages to assistive screen readers
 */
function announce(msg) {
  if (srAnnounce) srAnnounce.textContent = msg;
}

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

/**
 * Handle new batch or single file load
 */
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
    afterTags: []
  }));

  workspace.classList.remove('hidden');
  workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (fileQueue.length > 1) {
    batchQueueCard.classList.remove('hidden');
    batchCount.textContent = fileQueue.length;
    renderBatchQueue();
    downloadZipBtn.classList.add('hidden');
  } else {
    batchQueueCard.classList.add('hidden');
  }

  await selectFile(0);
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
   File Selection & Inspection
   ========================================================================== */

async function selectFile(index) {
  if (index < 0 || index >= fileQueue.length) return;
  currentIndex = index;
  const item = fileQueue[index];

  // Update Header details
  fileName.textContent = item.name;
  fileSize.textContent = formatBytes(item.size);
  fileTypeBadge.textContent = item.isVideo ? 'VIDEO' : 'IMAGE';
  fileTypeBadge.className = `file-badge ${item.isVideo ? 'badge-video' : ''}`;
  
  qualitySettingGroup.style.display = item.isVideo ? 'none' : 'flex';

  scanStatus.textContent = 'Scanning metadata…';
  scanStatus.className = 'status-scanning';
  announce(`Scanning metadata for ${item.name}`);

  // Setup thumbnail
  const initialUrl = createManagedUrl(item.file);
  if (item.isVideo) {
    imageThumb.classList.add('hidden');
    videoThumb.classList.remove('hidden');
    videoThumb.src = initialUrl;
  } else {
    videoThumb.classList.add('hidden');
    imageThumb.classList.remove('hidden');
    imageThumb.src = initialUrl;
  }

  // Clear previous output views
  resetOutputPreview();

  // Parse Metadata
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

    // If file was already cleaned previously, restore state
    if (item.cleanedBlob) {
      displayCleanedResult(item);
    }
  } catch (err) {
    console.error(err);
    scanStatus.textContent = 'Scan error';
    renderTags([]);
  }

  // Get image/video dimensions
  fetchDimensions(item, initialUrl);
  updateBatchActiveItem();
}

function fetchDimensions(item, url) {
  if (item.isVideo) {
    const v = document.createElement('video');
    v.src = url;
    v.onloadedmetadata = () => {
      fileDimensions.textContent = `${v.videoWidth} × ${v.videoHeight} • ${Math.round(v.duration)}s`;
    };
  } else {
    const img = new Image();
    img.src = url;
    img.onload = () => {
      fileDimensions.textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
    };
  }
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

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ==========================================================================
   Media Sanitization Flow
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

  // Display Output Preview
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

resetBtn.addEventListener('click', () => {
  revokeAllUrls();
  fileQueue = [];
  currentIndex = -1;
  fileInput.value = '';
  workspace.classList.add('hidden');
  resetOutputPreview();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
