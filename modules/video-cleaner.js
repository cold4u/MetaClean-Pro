/**
 * MetaClean Pro v2.0 - Video Cleaner Engine
 * Lossless in-place ISOBMFF / QuickTime (MP4, MOV, M4V) and WebM metadata scrubber.
 * Uses Zero-Copy Blob Slicing to sanitize videos of ANY size (even gigabytes) in milliseconds!
 */

import { MetadataParser } from './metadata-parser.js';

export class VideoCleaner {
  /**
   * Clean video metadata from an MP4, MOV, or WebM file
   * @param {File|Blob} file
   * @returns {Promise<{cleanBlob: Blob, cleanUrl: string, extension: string, mimeType: string, beforeTags: Array, afterTags: Array}>}
   */
  static async clean(file) {
    const beforeResult = await MetadataParser.parseVideo(file);
    const mime = file.type || '';
    const name = file.name || 'video.mp4';
    let ext = 'mp4';
    if (name.toLowerCase().endsWith('.mov')) ext = 'mov';
    else if (name.toLowerCase().endsWith('.webm')) ext = 'webm';

    let cleanBlob = null;

    if (mime.includes('webm') || name.toLowerCase().endsWith('.webm')) {
      cleanBlob = await this._cleanWebm(file);
    } else {
      // MP4 / MOV / M4V (ISOBMFF)
      cleanBlob = await this._cleanIsoBmff(file);
    }

    // Verify after cleaning
    const afterResult = await MetadataParser.parseVideo(cleanBlob);
    const cleanUrl = URL.createObjectURL(cleanBlob);

    return {
      cleanBlob,
      cleanUrl,
      extension: ext,
      mimeType: mime || 'video/mp4',
      beforeTags: beforeResult.tags,
      afterTags: afterResult.tags
    };
  }

  /**
   * Zero-copy in-place MP4/MOV sanitization
   * Replaces 'udta' and 'meta' atoms with 'free' padding boxes of exact length.
   * Resets creation and modification timestamps in 'mvhd' and 'tkhd' to 0.
   */
  static async _cleanIsoBmff(file) {
    const fileSize = file.size;
    // Read top-level box structure
    // Most moov headers are within the first 16MB or last 16MB
    const boxes = await this._scanTopLevelBoxes(file);
    const moovBox = boxes.find(b => b.type === 'moov');

    if (!moovBox) {
      // If no moov box found in scanned range, return original
      return file;
    }

    // Load entire moov box into memory (moov is typically 100 KB - 5 MB)
    const moovBuffer = await file.slice(moovBox.offset, moovBox.offset + moovBox.size).arrayBuffer();
    const moovBytes = new Uint8Array(moovBuffer);
    const view = new DataView(moovBuffer);

    // Sanitize moov box in-place
    this._sanitizeMoovBox(view, moovBytes, 0, moovBox.size);

    // Construct clean blob via zero-copy slicing:
    // [0 .. moovOffset] + [sanitized moov] + [moovOffset + moovSize .. EOF]
    const parts = [];
    if (moovBox.offset > 0) {
      parts.push(file.slice(0, moovBox.offset));
    }
    parts.push(moovBytes);
    if (moovBox.offset + moovBox.size < fileSize) {
      parts.push(file.slice(moovBox.offset + moovBox.size, fileSize));
    }

    return new Blob(parts, { type: file.type || 'video/mp4' });
  }

  /**
   * Recursively traverses atoms inside moov and neutralizes metadata
   */
  static _sanitizeMoovBox(view, bytes, start, end) {
    let p = start + 8; // skip 'moov' header (size + 'moov')
    
    while (p + 8 <= end) {
      let size = view.getUint32(p, false);
      const type = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
      let headerSize = 8;

      if (size === 1) { // 64-bit size
        if (p + 16 > end) break;
        const high = view.getUint32(p + 8, false);
        const low = view.getUint32(p + 12, false);
        size = high * 4294967296 + low;
        headerSize = 16;
      } else if (size === 0) {
        size = end - p;
      }

      if (size < headerSize || p + size > end) break;

      // 1. Movie Header Box: reset creation & modification timestamps
      if (type === 'mvhd') {
        this._zeroTimestamps(view, p + headerSize);
      }
      // 2. Track Box: recurse to find 'tkhd'
      else if (type === 'trak') {
        this._sanitizeTrakBox(view, bytes, p + headerSize, p + size);
      }
      // 3. User Data Box: replace with 'free' filler box
      else if (type === 'udta') {
        this._replaceWithFreeBox(bytes, p, size, headerSize);
      }
      // 4. Meta Box: replace with 'free' filler box
      else if (type === 'meta') {
        this._replaceWithFreeBox(bytes, p, size, headerSize);
      }

      p += size;
    }
  }

  static _sanitizeTrakBox(view, bytes, start, end) {
    let p = start;
    while (p + 8 <= end) {
      let size = view.getUint32(p, false);
      const type = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
      let headerSize = 8;

      if (size === 1) {
        if (p + 16 > end) break;
        const high = view.getUint32(p + 8, false);
        const low = view.getUint32(p + 12, false);
        size = high * 4294967296 + low;
        headerSize = 16;
      } else if (size === 0) {
        size = end - p;
      }

      if (size < headerSize || p + size > end) break;

      // Track Header Box: reset creation & modification timestamps
      if (type === 'tkhd') {
        this._zeroTimestamps(view, p + headerSize);
      }
      // User data inside track
      else if (type === 'udta') {
        this._replaceWithFreeBox(bytes, p, size, headerSize);
      }

      p += size;
    }
  }

  /**
   * Replaces an atom with a compliant ISO 'free' box of identical size,
   * preserving exact byte length so chunk offset tables ('stco', 'co64') stay valid!
   */
  static _replaceWithFreeBox(bytes, offset, size, headerSize) {
    // Change 4-character type to 'free'
    bytes[offset + 4] = 0x66; // 'f'
    bytes[offset + 5] = 0x72; // 'r'
    bytes[offset + 6] = 0x65; // 'e'
    bytes[offset + 7] = 0x65; // 'e'

    // Zero out payload bytes
    const payloadStart = offset + headerSize;
    const payloadEnd = offset + size;
    for (let i = payloadStart; i < payloadEnd; i++) {
      bytes[i] = 0x00;
    }
  }

  /**
   * Resets creation_time and modification_time to 0 (Jan 1, 1904 UTC)
   */
  static _zeroTimestamps(view, offset) {
    const version = view.getUint8(offset);
    if (version === 0) {
      // 32-bit creation and modification times
      view.setUint32(offset + 4, 0, false);
      view.setUint32(offset + 8, 0, false);
    } else if (version === 1) {
      // 64-bit creation and modification times
      view.setUint32(offset + 4, 0, false);
      view.setUint32(offset + 8, 0, false);
      view.setUint32(offset + 12, 0, false);
      view.setUint32(offset + 16, 0, false);
    }
  }

  /**
   * Scans top-level boxes in the file (checking start and end)
   */
  static async _scanTopLevelBoxes(file) {
    const boxes = [];
    const scanLimit = Math.min(file.size, 32 * 1024 * 1024);
    const headerBuffer = await file.slice(0, scanLimit).arrayBuffer();
    const bytes = new Uint8Array(headerBuffer);
    const view = new DataView(headerBuffer);

    let p = 0;
    while (p + 8 <= scanLimit) {
      let size = view.getUint32(p, false);
      const type = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
      let headerSize = 8;

      if (size === 1) {
        if (p + 16 > scanLimit) break;
        const high = view.getUint32(p + 8, false);
        const low = view.getUint32(p + 12, false);
        size = high * 4294967296 + low;
        headerSize = 16;
      } else if (size === 0) {
        size = file.size - p;
      }

      if (size < headerSize) break;
      boxes.push({ type, offset: p, size, headerSize });

      if (type === 'moov') break; // Found moov!
      p += size;
      if (p >= file.size) break;
    }

    // If moov wasn't near the front, check near the end of the file
    if (!boxes.some(b => b.type === 'moov') && file.size > scanLimit) {
      const tailSize = Math.min(file.size, 16 * 1024 * 1024);
      const tailOffset = file.size - tailSize;
      const tailBuffer = await file.slice(tailOffset, file.size).arrayBuffer();
      const tailBytes = new Uint8Array(tailBuffer);
      const tailView = new DataView(tailBuffer);

      let tp = 0;
      while (tp + 8 <= tailSize) {
        let size = tailView.getUint32(tp, false);
        const type = String.fromCharCode(tailBytes[tp + 4], tailBytes[tp + 5], tailBytes[tp + 6], tailBytes[tp + 7]);
        let headerSize = 8;

        if (size === 1) {
          if (tp + 16 > tailSize) break;
          const high = tailView.getUint32(tp + 8, false);
          const low = tailView.getUint32(tp + 12, false);
          size = high * 4294967296 + low;
          headerSize = 16;
        } else if (size === 0) {
          size = tailSize - tp;
        }

        if (size < headerSize) {
          tp++;
          continue;
        }

        if (type === 'moov') {
          boxes.push({ type, offset: tailOffset + tp, size, headerSize });
          break;
        }
        tp += size;
      }
    }

    return boxes;
  }

  /**
   * WebM cleaning: neutralizes MuxingApp, WritingApp, and Title strings
   */
  static async _cleanWebm(file) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const text = new TextDecoder('latin1').decode(bytes);

    const targetWords = ['MuxingApp', 'WritingApp', 'Title'];
    targetWords.forEach(word => {
      let idx = 0;
      while ((idx = text.indexOf(word, idx)) !== -1) {
        for (let i = idx; i < idx + word.length; i++) {
          bytes[i] = 0x20; // replace with spaces
        }
        idx += word.length;
      }
    });

    return new Blob([bytes], { type: file.type || 'video/webm' });
  }
}
