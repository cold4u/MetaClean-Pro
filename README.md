# MetaClean Pro v2.0 — Private Image & Video Metadata Cleaner

A 100% client-side, zero-dependency web application that deep-scans and strips sensitive metadata from **images** and **videos** directly inside the browser.

---

## 🚀 Key Improvements in v2.0

| Feature | MetaClean Pro v1.0 | MetaClean Pro v2.0 |
| :--- | :--- | :--- |
| **Video Metadata Removal** | ❌ None | ✅ **Full MP4, MOV, and WebM scrubbing** |
| **Video Scrubbing Method** | N/A | ✅ **Lossless zero-copy box rewriting (no transcoding)** |
| **WebP Handling** | ❌ Converted to JPEG (lost transparency) | ✅ **Native WebP export with alpha transparency** |
| **EXIF Orientation** | ❌ Smartphone photos flipped sideways | ✅ **Auto-orient normalized with `createImageBitmap`** |
| **Metadata Tag Values** | ❌ Vague regex "Marker detected" | ✅ **Real values: Camera make/model, GPS lat/lng, lens, dates** |
| **PNG Deep Scanning** | ❌ 256 KB cutoff missed trailer chunks | ✅ **Scans full file for `eXIf`, `tEXt`, `zTXt`, `iTXt`** |
| **Color Profiles** | ❌ Clamped wide-gamut colors | ✅ **Display P3 / sRGB color space preservation** |
| **Memory Leaks** | ❌ `URL.createObjectURL` never revoked | ✅ **Strict lifecycle management (`revokeObjectURL`)** |
| **Batch Processing** | ❌ Single file only | ✅ **Multi-file queue with bulk `.zip` download** |

---

## 🎬 How Video Sanitization Works

MetaClean Pro v2.0 uses **Lossless ISOBMFF In-Place Box Rewriting**:
1. It locates the `moov` presentation header in the MP4/MOV container.
2. It replaces user data and metadata atoms (`udta`, `meta`) with standard `free` padding boxes of equivalent size.
3. It zeroes out creation and modification timestamps in `mvhd` (Movie Header) and `tkhd` (Track Header).
4. **Result**: Zero video transcoding, 100% original stream quality preserved, and instant scrubbing (even for 1GB+ files) in milliseconds!

---

## 🏃 Local Run Instructions

No Node.js, npm, or build steps required. Simply serve the directory with any static HTTP server:

```bash
# Using Python
python3 -m http.server 8080
```

Then open your browser to `http://localhost:8080`.

---

## 📦 Deploying to GitHub Pages

To replace or update your hosted site at `https://cold4u.github.io/MetaClean-Pro`:
1. Copy all files from `metaclean-pro-v2/` into your `MetaClean-Pro` git repository clone.
2. Commit and push:
   ```bash
   git add .
   git commit -m "Upgrade to MetaClean Pro v2.0: bug fixes & video scrubbing"
   git push origin main
   ```
3. GitHub Pages will automatically deploy the updated site within 1–2 minutes.
