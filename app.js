/* ==========================================================================
   MetaClean Pro — Application Logic
   1. Privacy Image Cleaner (Deep scan, canvas rebuild, verification)
   2. EXIF Photo Editor (Raw tag inspector, metadata editor, in-place binary injection)
   ========================================================================== */

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtSize = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB';
const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
const cleanStr = v => typeof v === 'string' ? v.replace(/\u0000/g, '').trim() : (v ?? '');

// Prevent accidental browser navigation when dropping files anywhere on window
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => e.preventDefault());

// Toast Notification System
function toast(msg, type = 'ok') {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast ' + type;
  el.style.display = 'block';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.display = 'none'; }, 3400);
}

// ============================================================================
// Navigation: Mode Switcher (Quick Cleaner <-> EXIF Editor)
// ============================================================================
const tabCleaner  = $('#tabCleaner');
const tabEditor   = $('#tabEditor');
const cleanerView = $('#cleanerView');
const editorView  = $('#editorView');

function switchMode(mode) {
  if (mode === 'editor') {
    tabCleaner.classList.remove('active');
    tabEditor.classList.add('active');
    cleanerView.classList.add('hidden');
    editorView.classList.remove('hidden');
  } else {
    tabCleaner.classList.add('active');
    tabEditor.classList.remove('active');
    cleanerView.classList.remove('hidden');
    editorView.classList.add('hidden');
  }
}

if (tabCleaner) tabCleaner.onclick = () => switchMode('cleaner');
if (tabEditor)  tabEditor.onclick  = () => switchMode('editor');

// ============================================================================
// PART 1: QUICK CLEANER LOGIC
// ============================================================================
const cleanerInput = $('#file');
const cleanerDrop  = $('#drop');
const cleanerApp   = $('#app');
let cleanerOriginal  = null;
let cleanerCleanBlob = null;

if (cleanerInput) {
  cleanerInput.onclick = () => { cleanerInput.value = ''; };
  cleanerInput.onchange = () => cleanerInput.files[0] && loadCleaner(cleanerInput.files[0]);
}

if (cleanerDrop) {
  ['dragenter', 'dragover'].forEach(e => cleanerDrop.addEventListener(e, x => {
    x.preventDefault();
    cleanerDrop.classList.add('drag');
  }));
  ['dragleave', 'drop'].forEach(e => cleanerDrop.addEventListener(e, x => {
    x.preventDefault();
    cleanerDrop.classList.remove('drag');
  }));
  cleanerDrop.ondrop = e => {
    e.preventDefault();
    cleanerDrop.classList.remove('drag');
    const f = e.dataTransfer.files[0];
    if (f && (/^image\/(jpe?g|png|webp|pjpeg)$/i.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name))) {
      loadCleaner(f);
    } else if (f) {
      toast('Please drop a JPEG, PNG, or WebP image', 'err');
    }
  };
}

async function loadCleaner(file) {
  cleanerOriginal = file;
  cleanerApp.classList.remove('hidden');
  $('#thumb').src = URL.createObjectURL(file);
  $('#fname').textContent = file.name;
  $('#finfo').textContent = `${file.type || 'image'} • ${fmtSize(file.size)}`;

  // Offer shortcut to EXIF Editor if JPEG
  const editBtn = $('#btnOpenInEditor');
  if (editBtn) {
    if (/jpe?g|pjpeg/i.test(file.type) || /\.jpe?g$/i.test(file.name)) {
      editBtn.style.display = 'inline-block';
      editBtn.onclick = () => {
        switchMode('editor');
        loadExifFile(file);
      };
    } else {
      editBtn.style.display = 'none';
    }
  }

  $('#result').classList.add('hidden');
  $('#meter').style.width = '15%';
  $('#scanState').textContent = 'Scanning…';
  const m = await scanCleaner(file);
  $('#meter').style.width = '100%';
  $('#scanState').textContent = 'Scan complete';
  renderCleanerList($('#before'), m);
  $('#count').textContent = m.length;
}

function addCleanerItem(m, label, value) {
  m.push({ label, value });
}

async function scanCleaner(file) {
  const m = [];
  const buf = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
  const text = new TextDecoder('latin1').decode(buf);

  if (/jpe?g|pjpeg/i.test(file.type) || /\.jpe?g$/i.test(file.name || '')) {
    let p = 2;
    while (p + 4 < buf.length && buf[p] === 255) {
      let marker = buf[p + 1];
      if (marker === 218) break; // SOS (Start of Scan) - entropy coded data starts
      let len = (buf[p + 2] << 8) | buf[p + 3];
      if (len < 2 || p + 2 + len > buf.length) break;
      let seg = text.slice(p + 4, p + 2 + len);
      if (marker === 225 && seg.startsWith('Exif')) {
        addCleanerItem(m, 'EXIF', 'Embedded EXIF metadata segment');
      } else if (marker === 225 && /xmp/i.test(seg)) {
        addCleanerItem(m, 'XMP', 'Embedded XMP metadata block');
      } else if (marker === 237) {
        addCleanerItem(m, 'IPTC / APP13', 'JPEG application segment (IPTC/Photoshop)');
      } else if (marker >= 224 && marker <= 239) {
        addCleanerItem(m, `JPEG APP${marker - 224}`, 'Application segment');
      }
      p += 2 + len;
    }
  }

  if (/png/i.test(file.type) || /\.png$/i.test(file.name || '')) {
    let dv = new DataView(buf.buffer);
    let p = 8;
    while (p + 12 <= buf.length) {
      let len = dv.getUint32(p);
      if (p + 12 + len > buf.length) break;
      let typ = text.slice(p + 4, p + 8);
      if (['tEXt', 'zTXt', 'iTXt'].includes(typ)) {
        addCleanerItem(m, `PNG ${typ}`, 'Embedded text chunk');
      }
      p += 12 + len;
      if (typ === 'IEND') break;
    }
  }

  [
    ['GPS', 'GPSLatitude|GPSLongitude|GPSPosition|GPSAltitude'],
    ['Camera', 'Make|Model|LensModel|LensMake'],
    ['Date', 'DateTimeOriginal|CreateDate|DateTimeDigitized'],
    ['Software', 'Software|CreatorTool|ProcessingSoftware'],
    ['Author', 'Artist|Author|Creator'],
    ['Copyright', 'Copyright'],
    ['C2PA / Provenance', 'c2pa|content\.credentials|jumbf']
  ].forEach(([lbl, pat]) => {
    if (new RegExp(pat, 'i').test(text)) {
      addCleanerItem(m, lbl, 'Metadata marker detected');
    }
  });

  return [...new Map(m.map(x => [x.label + '|' + x.value, x])).values()];
}

function renderCleanerList(el, m) {
  if (!el) return;
  el.innerHTML = m.length
    ? m.map(x => `<div class="row"><span>${esc(x.label)}</span><span>${esc(x.value)}</span></div>`).join('')
    : `<div class="empty">No common metadata detected.</div>`;
}

const cleanBtn = $('#clean');
if (cleanBtn) {
  cleanBtn.onclick = async () => {
    if (!cleanerOriginal) return;
    cleanBtn.disabled = true;
    cleanBtn.textContent = 'Rebuilding…';
    try {
      const img = new Image();
      const objUrl = URL.createObjectURL(cleanerOriginal);
      img.src = objUrl;

      await new Promise((resolve, reject) => {
        if (img.decode) {
          img.decode().then(resolve).catch(() => {
            img.onload = resolve;
            img.onerror = reject;
          });
        } else {
          img.onload = resolve;
          img.onerror = reject;
        }
      });

      const c = document.createElement('canvas');
      c.width = img.naturalWidth || img.width;
      c.height = img.naturalHeight || img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const isPng = /png/i.test(cleanerOriginal.type) || /\.png$/i.test(cleanerOriginal.name);
      const mime = isPng ? 'image/png' : 'image/jpeg';
      cleanerCleanBlob = await new Promise(r => c.toBlob(r, mime, isPng ? undefined : 0.95));

      cleanerCleanBlob.name = 'clean.' + (isPng ? 'png' : 'jpg');
      const after = await scanCleaner(cleanerCleanBlob);

      renderCleanerList($('#after'), after);
      $('#removed').textContent = $('#count').textContent;
      $('#remaining').textContent = after.length;
      $('#resultBadge').textContent = after.length ? 'Review remaining fields' : 'Clean';
      $('#resultBadge').style.color = after.length ? '#f2b84b' : '#49d39b';
      $('#result').classList.remove('hidden');
      $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast('✅ Cleaned raster image generated', 'ok');
    } catch (e) {
      console.error(e);
      toast('Could not process this image. Try standard JPEG or PNG.', 'err');
    } finally {
      cleanBtn.disabled = false;
      cleanBtn.textContent = 'Clean image';
    }
  };
}

const dlCleanBtn = $('#download');
if (dlCleanBtn) {
  dlCleanBtn.onclick = () => {
    if (!cleanerCleanBlob || !cleanerOriginal) return;
    const isPng = /png/i.test(cleanerOriginal.type) || /\.png$/i.test(cleanerOriginal.name);
    const base = cleanerOriginal.name.replace(/\.[^.]+$/, '');
    const ext = isPng ? 'png' : 'jpg';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(cleanerCleanBlob);
    a.download = base + '-clean.' + ext;
    a.click();
    toast('💾 Cleaned image downloaded', 'ok');
  };
}

const resetCleaner = () => {
  cleanerApp.classList.add('hidden');
  $('#result').classList.add('hidden');
  if (cleanerInput) cleanerInput.value = '';
  cleanerOriginal = null;
  cleanerCleanBlob = null;
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
if ($('#reset')) $('#reset').onclick = resetCleaner;
if ($('#again')) $('#again').onclick = resetCleaner;

// ============================================================================
// PART 2: EXIF PHOTO EDITOR ENGINE
// ============================================================================
let _bin = '';
let _name = '';
let _exif = null;

// Date Conversions
function exifToHTML(s) {
  if (!s || typeof s !== 'string') return '';
  try {
    const clean = s.replace(/\u0000/g, '').trim();
    const [d, t = '00:00:00'] = clean.split(' ');
    return d.replace(/:/g, '-') + 'T' + t.slice(0, 5);
  } catch { return ''; }
}

function htmlToExif(s) {
  if (!s) return '';
  const clean = s.trim();
  const [d, t = '00:00'] = clean.split('T');
  return d.replace(/-/g, ':') + ' ' + t.slice(0, 5) + ':00';
}

// GPS Conversions
function dmsToDec(dms, ref) {
  if (!Array.isArray(dms) || dms.length < 3) return '';
  try {
    const r = a => (Array.isArray(a) && a[1]) ? a[0] / a[1] : (Number(a) || 0);
    let v = r(dms[0]) + r(dms[1]) / 60 + r(dms[2]) / 3600;
    const refStr = String(ref || '').replace(/\u0000/g, '').trim().toUpperCase();
    if (refStr.startsWith('S') || refStr.startsWith('W')) v = -v;
    return v.toFixed(6);
  } catch { return ''; }
}

function decToDMS(deg) {
  const abs = Math.abs(deg);
  let d = Math.floor(abs);
  let mf = (abs - d) * 60;
  let m = Math.floor(mf);
  let s = Math.round((mf - m) * 60 * 100);
  if (s >= 6000) {
    s -= 6000;
    m += 1;
  }
  if (m >= 60) {
    m -= 60;
    d += 1;
  }
  return [[d, 1], [m, 1], [s, 100]];
}

function rat(val, denom = 1000) {
  return [Math.round(val * denom), denom];
}

// File Loading & Drag-and-Drop for EXIF Editor
const exifDropZone = $('#exifDropZone');
const exifFileIn   = $('#exifFileIn');

if (exifFileIn) {
  exifFileIn.onclick = () => { exifFileIn.value = ''; };
  exifFileIn.onchange = () => {
    if (exifFileIn.files && exifFileIn.files[0]) {
      loadExifFile(exifFileIn.files[0]);
    }
  };
}

if (exifDropZone) {
  exifDropZone.addEventListener('dragover', e => {
    e.preventDefault();
    exifDropZone.classList.add('on');
  });
  exifDropZone.addEventListener('dragleave', () => exifDropZone.classList.remove('on'));
  exifDropZone.addEventListener('drop', e => {
    e.preventDefault();
    exifDropZone.classList.remove('on');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      loadExifFile(e.dataTransfer.files[0]);
    }
  });
}

function loadExifFile(file) {
  const isJpeg = /jpe?g|pjpeg/i.test(file.type) || /\.jpe?g$/i.test(file.name);
  if (!isJpeg) {
    toast('⚠ Only JPEG / JPG photos are supported in the EXIF Editor', 'err');
    return;
  }
  _name = file.name || 'photo.jpg';

  const reader = new FileReader();
  reader.onload = ev => {
    const dataURL = ev.target.result;
    
    // Set previews
    const previewEl = $('#previewImg');
    if (previewEl) previewEl.src = dataURL;
    const thumbEl = $('#exifThumb');
    if (thumbEl) thumbEl.src = dataURL;

    $('#exifFname').textContent = _name;
    $('#exifFinfo').textContent = `${file.type || 'image/jpeg'} • ${fmtSize(file.size)}`;
    $('#fileInfo').textContent = `${_name} · ${fmtSize(file.size)}`;

    try {
      _bin = atob(dataURL.split(',')[1]);
    } catch (e) {
      toast('Could not decode photo data', 'err');
      return;
    }

    try {
      if (typeof piexif === 'undefined') {
        throw new Error('piexif library not ready');
      }
      _exif = piexif.load(_bin);
    } catch (err) {
      _exif = { '0th': {}, 'Exif': {}, 'GPS': {}, '1st': {} };
      toast('No existing EXIF tags found — ready to add new metadata', 'inf');
    }

    fillExifForm();
    renderRawExif();

    exifDropZone.classList.add('hidden');
    $('#exifWorkspace').classList.remove('hidden');
    window.scrollTo({ top: $('#exifWorkspace').offsetTop - 20, behavior: 'smooth' });
  };
  reader.readAsDataURL(file);
}

// Populate Form from _exif
function fillExifForm() {
  if (typeof piexif === 'undefined' || !_exif) return;
  const I = piexif.ImageIFD;
  const E = piexif.ExifIFD;
  const G = piexif.GPSIFD;

  const z0 = _exif['0th'] || {};
  const ze = _exif['Exif'] || {};
  const gp = _exif['GPS'] || {};

  setVal('f_dto', exifToHTML(ze[E.DateTimeOriginal]));
  setVal('f_dt',  exifToHTML(z0[I.DateTime]));
  setVal('f_dtd', exifToHTML(ze[E.DateTimeDigitized]));

  setVal('f_make',  cleanStr(z0[I.Make]));
  setVal('f_model', cleanStr(z0[I.Model]));
  setVal('f_soft',  cleanStr(z0[I.Software]));

  const isoRaw = ze[E.ISOSpeedRatings];
  const isoVal = Array.isArray(isoRaw) ? isoRaw[0] : isoRaw;
  setVal('f_iso', isoVal ?? '');

  setVal('f_lat', gp[G.GPSLatitude]  ? dmsToDec(gp[G.GPSLatitude],  gp[G.GPSLatitudeRef])  : '');
  setVal('f_lng', gp[G.GPSLongitude] ? dmsToDec(gp[G.GPSLongitude], gp[G.GPSLongitudeRef]) : '');

  let altVal = '';
  if (gp[G.GPSAltitude] && Array.isArray(gp[G.GPSAltitude]) && gp[G.GPSAltitude][1]) {
    let a = gp[G.GPSAltitude][0] / gp[G.GPSAltitude][1];
    if (gp[G.GPSAltitudeRef] === 1) a = -a;
    altVal = a.toFixed(1);
  }
  setVal('f_alt', altVal);

  setVal('f_desc',   cleanStr(z0[I.ImageDescription]));
  setVal('f_artist', cleanStr(z0[I.Artist]));
  setVal('f_copy',   cleanStr(z0[I.Copyright]));
}

// Render Raw EXIF Tags Inspector
function renderRawExif() {
  if (typeof piexif === 'undefined' || !_exif) return;
  const I = piexif.ImageIFD;
  const E = piexif.ExifIFD;

  const N0 = {
    [I.Make]: 'Make',
    [I.Model]: 'Model',
    [I.DateTime]: 'DateTime',
    [I.Software]: 'Software',
    [I.Artist]: 'Artist',
    [I.Copyright]: 'Copyright',
    [I.ImageDescription]: 'Description',
    [I.Orientation]: 'Orientation',
    [I.XResolution]: 'XResolution',
    [I.YResolution]: 'YResolution',
    [I.ResolutionUnit]: 'ResolutionUnit'
  };

  const NE = {
    [E.DateTimeOriginal]: 'DateTimeOriginal',
    [E.DateTimeDigitized]: 'DateTimeDigitized',
    [E.ISOSpeedRatings]: 'ISO',
    [E.FNumber]: 'FNumber',
    [E.ExposureTime]: 'ExposureTime',
    [E.FocalLength]: 'FocalLength',
    [E.Flash]: 'Flash',
    [E.LensModel]: 'LensModel',
    [E.LensMake]: 'LensMake',
    [E.PixelXDimension]: 'Width',
    [E.PixelYDimension]: 'Height',
    [E.ColorSpace]: 'ColorSpace',
    [E.WhiteBalance]: 'WhiteBalance',
    [E.ExposureMode]: 'ExposureMode',
    [E.SceneCaptureType]: 'SceneType'
  };

  const fmt = v => typeof v === 'string'
    ? v.replace(/\u0000/g, '').trim()
    : JSON.stringify(v);

  const rows = [];
  let tagCount = 0;

  for (const [k, v] of Object.entries(_exif['0th'] || {})) {
    tagCount++;
    const lbl = N0[k] ?? `IFD0[${k}]`;
    rows.push(`<div><span class="t0">${esc(lbl)}</span>: <span class="tv">${esc(fmt(v))}</span></div>`);
  }
  for (const [k, v] of Object.entries(_exif['Exif'] || {})) {
    tagCount++;
    const lbl = NE[k] ?? `Exif[${k}]`;
    rows.push(`<div><span class="te">${esc(lbl)}</span>: <span class="tv">${esc(fmt(v))}</span></div>`);
  }
  const gKeys = Object.keys(_exif['GPS'] || {});
  if (gKeys.length) {
    tagCount += gKeys.length;
    rows.push(`<div><span class="tg">GPS</span>: <span class="tv">${gKeys.length} field(s) present</span></div>`);
  }

  const rawEl = $('#rawExif');
  if (rawEl) {
    rawEl.innerHTML = rows.length
      ? rows.join('')
      : '<span style="color:var(--muted)">No EXIF tags present in this image</span>';
  }
  const badgeEl = $('#rawExifBadge');
  if (badgeEl) badgeEl.textContent = `${tagCount} tag${tagCount === 1 ? '' : 's'}`;
}

// Synchronize Form Values -> _exif Object
function applyExifForm() {
  if (typeof piexif === 'undefined' || !_exif) return;
  const I = piexif.ImageIFD;
  const E = piexif.ExifIFD;
  const G = piexif.GPSIFD;

  ['0th', 'Exif', 'GPS', '1st'].forEach(k => { if (!_exif[k]) _exif[k] = {}; });

  const put = (ifd, tag, val) => {
    if (val !== null && val !== '' && val !== undefined) _exif[ifd][tag] = val;
    else delete _exif[ifd][tag];
  };

  // Dates
  put('Exif', E.DateTimeOriginal,  htmlToExif($('#f_dto').value));
  put('0th',  I.DateTime,          htmlToExif($('#f_dt').value));
  put('Exif', E.DateTimeDigitized, htmlToExif($('#f_dtd').value));

  // Camera
  put('0th', I.Make,     $('#f_make').value.trim()  || null);
  put('0th', I.Model,    $('#f_model').value.trim() || null);
  put('0th', I.Software, $('#f_soft').value.trim()  || null);
  const iso = parseInt($('#f_iso').value);
  if (!isNaN(iso) && iso > 0) _exif['Exif'][E.ISOSpeedRatings] = iso;
  else delete _exif['Exif'][E.ISOSpeedRatings];

  // GPS
  const latRaw = $('#f_lat').value.trim();
  const lngRaw = $('#f_lng').value.trim();
  const altRaw = $('#f_alt').value.trim();

  if (latRaw !== '' && lngRaw !== '') {
    const lat = parseFloat(latRaw);
    const lng = parseFloat(lngRaw);
    if (!isNaN(lat) && !isNaN(lng)) {
      _exif['GPS'][G.GPSLatitude]     = decToDMS(lat);
      _exif['GPS'][G.GPSLatitudeRef]  = lat >= 0 ? 'N' : 'S';
      _exif['GPS'][G.GPSLongitude]    = decToDMS(lng);
      _exif['GPS'][G.GPSLongitudeRef] = lng >= 0 ? 'E' : 'W';
    }
  } else {
    [G.GPSLatitude, G.GPSLatitudeRef, G.GPSLongitude, G.GPSLongitudeRef].forEach(t => delete _exif['GPS'][t]);
  }

  if (altRaw !== '') {
    const alt = parseFloat(altRaw);
    if (!isNaN(alt)) {
      _exif['GPS'][G.GPSAltitude]    = rat(Math.abs(alt));
      _exif['GPS'][G.GPSAltitudeRef] = alt < 0 ? 1 : 0;
    }
  } else {
    [G.GPSAltitude, G.GPSAltitudeRef].forEach(t => delete _exif['GPS'][t]);
  }

  // Attribution
  put('0th', I.ImageDescription, $('#f_desc').value.trim()   || null);
  put('0th', I.Artist,           $('#f_artist').value.trim() || null);
  put('0th', I.Copyright,        $('#f_copy').value.trim()   || null);
}

// Download Helper via Blob URL
function downloadBin(bin, suffix) {
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'image/jpeg' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const downloadName = /\.[^.]+$/.test(_name)
    ? _name.replace(/(\.[^.]+)$/, `${suffix}$1`)
    : `${_name}${suffix}.jpg`;
  a.download = downloadName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// EXIF Actions
function saveExif() {
  try {
    if (typeof piexif === 'undefined') throw new Error('piexif library not ready');
    applyExifForm();
    const exifBytes = piexif.dump(_exif);
    const newBin = piexif.insert(exifBytes, _bin);
    downloadBin(newBin, '_edited');
    _bin = newBin;
    renderRawExif();
    toast('✅ Downloaded with updated EXIF tags', 'ok');
  } catch (err) {
    console.error(err);
    toast('Error saving EXIF: ' + err.message, 'err');
  }
}

function stripExif() {
  try {
    if (typeof piexif === 'undefined') throw new Error('piexif library not ready');
    _exif = { '0th': {}, 'Exif': {}, 'GPS': {}, '1st': {} };
    const exifBytes = piexif.dump(_exif);
    const newBin = piexif.insert(exifBytes, _bin);
    downloadBin(newBin, '_stripped');
    _bin = newBin;
    fillExifForm();
    renderRawExif();
    toast('🗑️ All EXIF stripped — file downloaded', 'ok');
  } catch (err) {
    console.error(err);
    toast('Error stripping EXIF: ' + err.message, 'err');
  }
}

function resetExifTool() {
  _bin = '';
  _name = '';
  _exif = null;
  if (exifFileIn) exifFileIn.value = '';
  $('#exifWorkspace').classList.add('hidden');
  exifDropZone.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Wire EXIF Action Buttons
if ($('#btnSaveExif'))     $('#btnSaveExif').onclick     = saveExif;
if ($('#btnStripExif'))    $('#btnStripExif').onclick    = stripExif;
if ($('#btnResetExif'))    $('#btnResetExif').onclick    = resetExifTool;
if ($('#btnTopResetExif')) $('#btnTopResetExif').onclick = resetExifTool;
