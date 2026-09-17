/**
 * MetaClean Pro v2.0 - Image Cleaner Engine
 * Handles robust client-side rasterization, format preservation, orientation normalization,
 * and lossless PNG / native WebP export with alpha transparency.
 */

import { MetadataParser } from './metadata-parser.js';

export class ImageCleaner {
  /**
   * Cleans an image file (JPEG, PNG, WebP)
   * @param {File|Blob} file
   * @param {object} options
   * @param {number} [options.quality=0.95] - Compression quality for JPEG/WebP
   * @param {boolean} [options.preserveFormat=true] - Keep WebP/PNG/JPEG as original
   * @returns {Promise<{cleanBlob: Blob, cleanUrl: string, extension: string, beforeTags: Array, afterTags: Array, mimeType: string}>}
   */
  static async clean(file, options = {}) {
    const quality = options.quality !== undefined ? options.quality : 0.95;
    const initialMime = file.type || '';

    // 1. Scan before cleaning
    const beforeResult = await MetadataParser.parseImage(file);

    // 2. Decode bitmap with orientation normalization
    let bitmap = null;
    let width = 0;
    let height = 0;

    try {
      // Modern browsers natively auto-orient image bits with 'from-image'
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      width = bitmap.width;
      height = bitmap.height;
    } catch (e) {
      // Fallback for environments lacking createImageBitmap options
      const img = await this._loadHtmlImage(file);
      width = img.naturalWidth || img.width;
      height = img.naturalHeight || img.height;
      bitmap = img;
    }

    if (!width || !height) {
      throw new Error('Invalid image dimensions or corrupt image stream.');
    }

    // 3. Determine output format (Preserve WebP as WebP! Preserve PNG as PNG!)
    let outMime = 'image/jpeg';
    let ext = 'jpg';

    if (initialMime.includes('png') || file.name?.toLowerCase().endsWith('.png')) {
      outMime = 'image/png';
      ext = 'png';
    } else if (initialMime.includes('webp') || file.name?.toLowerCase().endsWith('.webp')) {
      outMime = 'image/webp';
      ext = 'webp';
    } else {
      outMime = 'image/jpeg';
      ext = 'jpg';
    }

    // 4. Create offscreen or standard canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    // Check wide-gamut Display P3 support
    let ctx = null;
    try {
      ctx = canvas.getContext('2d', { colorSpace: 'display-p3', willReadFrequently: false });
    } catch (e) {
      ctx = canvas.getContext('2d');
    }

    if (!ctx) {
      throw new Error('Failed to create HTML5 2D Canvas rendering context.');
    }

    // If exporting to JPEG, fill white background to avoid transparent artifacts turning black
    if (outMime === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.clearRect(0, 0, width, height);
    }

    // Draw pure raster image
    ctx.drawImage(bitmap, 0, 0, width, height);

    // Close ImageBitmap to free GPU memory immediately
    if (bitmap && typeof bitmap.close === 'function') {
      bitmap.close();
    }

    // 5. Export clean blob
    const cleanBlob = await new Promise((resolve, reject) => {
      const q = outMime === 'image/png' ? undefined : quality;
      canvas.toBlob(
        blob => (blob ? resolve(blob) : reject(new Error('Canvas export returned null'))),
        outMime,
        q
      );
    });

    // 6. Rescan the generated blob to verify sanitization
    const afterResult = await MetadataParser.parseImage(cleanBlob);

    // 7. Create Object URL
    const cleanUrl = URL.createObjectURL(cleanBlob);

    return {
      cleanBlob,
      cleanUrl,
      extension: ext,
      mimeType: outMime,
      beforeTags: beforeResult.tags,
      afterTags: afterResult.tags,
      width,
      height
    };
  }

  static _loadHtmlImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to decode image with HTMLImageElement.'));
      };
      img.src = url;
    });
  }
}
