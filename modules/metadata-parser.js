/**
 * MetaClean Pro v2.0 - Metadata Parser Engine
 * 100% Client-Side binary parser for Images (JPEG, PNG, WebP) and Videos (MP4, MOV, WebM)
 */

export class MetadataParser {
  /**
   * Parse image metadata from a File or Blob
   * @param {Blob} file
   * @returns {Promise<{format: string, tags: Array<{category: string, label: string, value: string, raw?: any}>, hasMetadata: boolean}>}
   */
  static async parseImage(file) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const tags = [];
    const mime = file.type || '';

    if (mime.includes('jpeg') || (bytes[0] === 0xff && bytes[1] === 0xd8)) {
      this._parseJpeg(bytes, tags);
    } else if (mime.includes('png') || this._checkSignature(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
      this._parsePng(bytes, tags);
    } else if (mime.includes('webp') || this._checkString(bytes, 0, 'RIFF') && this._checkString(bytes, 8, 'WEBP')) {
      this._parseWebP(bytes, tags);
    }

    return {
      format: mime || 'image',
      tags: this._deduplicateTags(tags),
      hasMetadata: tags.length > 0
    };
  }

  /**
   * Parse video metadata from a File or Blob
   * @param {Blob} file
   * @returns {Promise<{format: string, duration?: number, width?: number, height?: number, tags: Array<{category: string, label: string, value: string}>, hasMetadata: boolean}>}
   */
  static async parseVideo(file) {
    const buffer = await file.slice(0, Math.min(file.size, 16 * 1024 * 1024)).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const tags = [];

    // Check for MP4 / QuickTime (ISOBMFF)
    if (this._isIsoBmff(bytes)) {
      this._parseIsoBmff(bytes, tags);
    } else if (this._isWebm(bytes)) {
      this._parseWebm(bytes, tags);
    }

    return {
      format: file.type || 'video',
      tags: this._deduplicateTags(tags),
      hasMetadata: tags.length > 0
    };
  }

  /* -------------------------------------------------------------
     JPEG PARSING
  ------------------------------------------------------------- */
  static _parseJpeg(bytes, tags) {
    let p = 2; // skip 0xFF 0xD8 (SOI)
    const len = bytes.length;

    while (p + 4 < len) {
      if (bytes[p] !== 0xff) {
        p++;
        continue;
      }
      // Handle fill bytes (0xFF)
      while (p < len && bytes[p] === 0xff) p++;
      if (p >= len) break;

      const marker = bytes[p++];
      // Standalone markers without length
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x00) {
        continue;
      }

      if (p + 2 > len) break;
      const segLength = (bytes[p] << 8) | bytes[p + 1];
      if (segLength < 2 || p + segLength > len) break;

      const segData = bytes.subarray(p + 2, p + segLength);

      // APP1: EXIF or XMP
      if (marker === 0xe1) {
        if (this._checkString(segData, 0, 'Exif\0\0')) {
          tags.push({ category: 'Container', label: 'EXIF Segment', value: 'APP1 Exif metadata container' });
          this._parseTiffHeader(segData.subarray(6), tags);
        } else if (this._checkString(segData, 0, 'http://ns.adobe.com/xap/1.0/')) {
          tags.push({ category: 'Container', label: 'XMP Segment', value: 'Adobe Extensible Metadata Platform packet' });
          this._parseXmpString(segData, tags);
        }
      }
      // APP2: ICC Profile
      else if (marker === 0xe2 && this._checkString(segData, 0, 'ICC_PROFILE\0')) {
        tags.push({ category: 'Color Profile', label: 'ICC Profile', value: 'Embedded color space profile' });
      }
      // APP13: IPTC PhotoShop
      else if (marker === 0xed && this._checkString(segData, 0, 'Photoshop 3.0')) {
        tags.push({ category: 'Container', label: 'IPTC / Photoshop', value: 'Embedded APP13 IPTC editorial record' });
        this._parseIptc(segData, tags);
      }
      // APP0: JFIF
      else if (marker === 0xe0 && this._checkString(segData, 0, 'JFIF\0')) {
        tags.push({ category: 'Header', label: 'JFIF Marker', value: 'Baseline JPEG file interchange format' });
      }
      // Other APP markers
      else if (marker >= 0xe3 && marker <= 0xef) {
        tags.push({ category: 'Container', label: `JPEG APP${marker - 0xe0}`, value: `Application marker segment (${segLength} bytes)` });
      }
      // COM: Comment
      else if (marker === 0xfe) {
        const comment = new TextDecoder('latin1').decode(segData);
        tags.push({ category: 'Text', label: 'JPEG Comment', value: comment.slice(0, 100) });
      }

      p += segLength;
    }
  }

  /* -------------------------------------------------------------
     TIFF / EXIF TAG PARSER
  ------------------------------------------------------------- */
  static _parseTiffHeader(bytes, tags) {
    if (bytes.length < 8) return;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    const isLittleEndian = bytes[0] === 0x49 && bytes[1] === 0x49; // 'II'
    const isBigEndian = bytes[0] === 0x4d && bytes[1] === 0x4d;    // 'MM'
    if (!isLittleEndian && !isBigEndian) return;

    const align42 = view.getUint16(2, isLittleEndian);
    if (align42 !== 42) return;

    const ifd0Offset = view.getUint32(4, isLittleEndian);
    if (ifd0Offset >= bytes.length) return;

    const subIfds = { exif: null, gps: null };
    this._readIfd(view, bytes, ifd0Offset, isLittleEndian, tags, subIfds, 'Image');

    if (subIfds.exif && subIfds.exif < bytes.length) {
      this._readIfd(view, bytes, subIfds.exif, isLittleEndian, tags, subIfds, 'Exif');
    }
    if (subIfds.gps && subIfds.gps < bytes.length) {
      this._readGpsIfd(view, bytes, subIfds.gps, isLittleEndian, tags);
    }
  }

  static _readIfd(view, bytes, offset, le, tags, subIfds, prefix) {
    if (offset + 2 > bytes.length) return;
    const numEntries = view.getUint16(offset, le);
    offset += 2;

    const TAGS = {
      0x010f: { name: 'Camera Make', cat: 'Device' },
      0x0110: { name: 'Camera Model', cat: 'Device' },
      0x0112: { name: 'Orientation', cat: 'Image Spec' },
      0x011a: { name: 'X-Resolution', cat: 'Image Spec' },
      0x011b: { name: 'Y-Resolution', cat: 'Image Spec' },
      0x0131: { name: 'Software', cat: 'Software' },
      0x0132: { name: 'Date/Time', cat: 'Timestamp' },
      0x013b: { name: 'Artist / Creator', cat: 'Author' },
      0x8298: { name: 'Copyright', cat: 'Author' },
      0x829a: { name: 'Exposure Time', cat: 'Camera Settings' },
      0x829d: { name: 'F-Number', cat: 'Camera Settings' },
      0x8822: { name: 'Exposure Program', cat: 'Camera Settings' },
      0x8827: { name: 'ISO Speed', cat: 'Camera Settings' },
      0x9003: { name: 'Date Taken (Original)', cat: 'Timestamp' },
      0x9004: { name: 'Date Digitized', cat: 'Timestamp' },
      0x920a: { name: 'Focal Length', cat: 'Lens' },
      0xa433: { name: 'Lens Make', cat: 'Lens' },
      0xa434: { name: 'Lens Model', cat: 'Lens' },
      0x8769: { name: 'ExifOffset', sub: 'exif' },
      0x8825: { name: 'GPSOffset', sub: 'gps' }
    };

    for (let i = 0; i < numEntries; i++) {
      const entryOffset = offset + i * 12;
      if (entryOffset + 12 > bytes.length) break;

      const tagId = view.getUint16(entryOffset, le);
      const type = view.getUint16(entryOffset + 2, le);
      const count = view.getUint32(entryOffset + 4, le);
      const valOffset = entryOffset + 8;

      if (TAGS[tagId]?.sub === 'exif') {
        subIfds.exif = view.getUint32(valOffset, le);
        continue;
      }
      if (TAGS[tagId]?.sub === 'gps') {
        subIfds.gps = view.getUint32(valOffset, le);
        continue;
      }

      if (TAGS[tagId]) {
        const val = this._readTiffValue(view, bytes, type, count, valOffset, le);
        if (val !== null && val !== undefined && val !== '') {
          tags.push({
            category: TAGS[tagId].cat || prefix,
            label: TAGS[tagId].name,
            value: String(val)
          });
        }
      }
    }
  }

  static _readGpsIfd(view, bytes, offset, le, tags) {
    if (offset + 2 > bytes.length) return;
    const numEntries = view.getUint16(offset, le);
    offset += 2;

    let latRef = 'N', lonRef = 'E';
    let latCoord = null, lonCoord = null, alt = null;

    for (let i = 0; i < numEntries; i++) {
      const entryOffset = offset + i * 12;
      if (entryOffset + 12 > bytes.length) break;

      const tagId = view.getUint16(entryOffset, le);
      const type = view.getUint16(entryOffset + 2, le);
      const count = view.getUint32(entryOffset + 4, le);
      const valOffset = entryOffset + 8;

      if (tagId === 1) { // LatRef
        latRef = String.fromCharCode(view.getUint8(valOffset));
      } else if (tagId === 2) { // Latitude (3 rationals)
        latCoord = this._readGpsCoordinate(view, bytes, count, valOffset, le);
      } else if (tagId === 3) { // LonRef
        lonRef = String.fromCharCode(view.getUint8(valOffset));
      } else if (tagId === 4) { // Longitude (3 rationals)
        lonCoord = this._readGpsCoordinate(view, bytes, count, valOffset, le);
      } else if (tagId === 6) { // Altitude
        alt = this._readRational(view, bytes, valOffset, le);
      }
    }

    if (latCoord && lonCoord) {
      const finalLat = (latCoord * (latRef === 'S' ? -1 : 1)).toFixed(6);
      const finalLon = (lonCoord * (lonRef === 'W' ? -1 : 1)).toFixed(6);
      tags.push({
        category: 'Location / GPS',
        label: 'GPS Coordinates',
        value: `${finalLat}, ${finalLon} (${latRef} / ${lonRef})`,
        raw: { lat: finalLat, lon: finalLon }
      });
    }
    if (alt !== null) {
      tags.push({
        category: 'Location / GPS',
        label: 'GPS Altitude',
        value: `${alt.toFixed(1)} meters`
      });
    }
  }

  static _readGpsCoordinate(view, bytes, count, valOffset, le) {
    const dataOffset = count * 8 > 4 ? view.getUint32(valOffset, le) : valOffset;
    if (dataOffset + 24 > bytes.length) return null;
    const deg = this._readRational(view, bytes, dataOffset, le);
    const min = this._readRational(view, bytes, dataOffset + 8, le);
    const sec = this._readRational(view, bytes, dataOffset + 16, le);
    if (deg === null || min === null || sec === null) return null;
    return deg + min / 60 + sec / 3600;
  }

  static _readRational(view, bytes, offset, le) {
    if (offset + 8 > bytes.length) return null;
    const num = view.getUint32(offset, le);
    const den = view.getUint32(offset + 4, le);
    return den === 0 ? 0 : num / den;
  }

  static _readTiffValue(view, bytes, type, count, valOffset, le) {
    // 1: BYTE, 2: ASCII, 3: SHORT, 4: LONG, 5: RATIONAL
    if (type === 2) { // ASCII
      const dataOffset = count > 4 ? view.getUint32(valOffset, le) : valOffset;
      if (dataOffset + count > bytes.length) return null;
      let str = '';
      for (let i = 0; i < count; i++) {
        const c = bytes[dataOffset + i];
        if (c === 0) break;
        str += String.fromCharCode(c);
      }
      return str.trim();
    }
    if (type === 3) { // SHORT
      return view.getUint16(valOffset, le);
    }
    if (type === 4) { // LONG
      return view.getUint32(valOffset, le);
    }
    if (type === 5) { // RATIONAL
      const dataOffset = view.getUint32(valOffset, le);
      const r = this._readRational(view, bytes, dataOffset, le);
      return r !== null ? r.toFixed(2) : null;
    }
    return null;
  }

  static _parseXmpString(bytes, tags) {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    const patterns = [
      { pattern: /<dc:creator>[\s\S]*?<rdf:li>(.*?)<\/rdf:li>/i, label: 'Author (XMP)' },
      { pattern: /xmp:CreatorTool="(.*?)"/i, label: 'Creator Tool (XMP)' },
      { pattern: /<photoshop:DateCreated>(.*?)<\/photoshop:DateCreated>/i, label: 'Creation Date (XMP)' },
      { pattern: /c2pa|contentcredentials|jumbf/i, label: 'C2PA Credentials', value: 'Content authenticity / provenance manifest found' }
    ];

    patterns.forEach(({ pattern, label, value }) => {
      const match = text.match(pattern);
      if (match) {
        tags.push({
          category: 'XMP Metadata',
          label,
          value: value || match[1] || 'Found'
        });
      }
    });
  }

  static _parseIptc(bytes, tags) {
    const text = new TextDecoder('latin1').decode(bytes);
    if (/caption|byline|credit|copyright/i.test(text)) {
      tags.push({ category: 'IPTC', label: 'IPTC Records', value: 'Embedded copyright / editorial tags detected' });
    }
  }

  /* -------------------------------------------------------------
     PNG PARSING (Scans full file including trailing chunks)
  ------------------------------------------------------------- */
  static _parsePng(bytes, tags) {
    let p = 8; // skip PNG signature
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    while (p + 8 <= bytes.length) {
      const length = view.getUint32(p);
      const type = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
      p += 8;

      if (p + length > bytes.length) break;
      const chunkData = bytes.subarray(p, p + length);

      if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') {
        const nullIdx = chunkData.indexOf(0);
        const keyword = nullIdx !== -1 ? new TextDecoder('latin1').decode(chunkData.subarray(0, nullIdx)) : 'Text';
        tags.push({
          category: 'PNG Text',
          label: `PNG ${type} (${keyword})`,
          value: `Embedded ${keyword} metadata chunk`
        });
      } else if (type === 'eXIf') {
        tags.push({ category: 'Container', label: 'PNG eXIf Chunk', value: 'Embedded EXIF metadata chunk' });
        this._parseTiffHeader(chunkData, tags);
      } else if (type === 'iCCP') {
        tags.push({ category: 'Color Profile', label: 'PNG iCCP', value: 'Embedded ICC color space profile' });
      } else if (type === 'pHYs') {
        tags.push({ category: 'Image Spec', label: 'PNG pHYs', value: 'Physical pixel dimensions / resolution' });
      } else if (type === 'tIME') {
        tags.push({ category: 'Timestamp', label: 'PNG tIME', value: 'Image last-modified timestamp' });
      }

      p += length + 4; // skip data + 4-byte CRC
      if (type === 'IEND') break;
    }
  }

  /* -------------------------------------------------------------
     WEBP PARSING
  ------------------------------------------------------------- */
  static _parseWebP(bytes, tags) {
    let p = 12; // skip RIFF + len + WEBP
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    while (p + 8 <= bytes.length) {
      const fourCC = String.fromCharCode(bytes[p], bytes[p + 1], bytes[p + 2], bytes[p + 3]);
      const chunkSize = view.getUint32(p + 4, true); // WebP uses little-endian chunk sizes
      p += 8;

      if (p + chunkSize > bytes.length) break;
      const chunkData = bytes.subarray(p, p + chunkSize);

      if (fourCC === 'EXIF') {
        tags.push({ category: 'Container', label: 'WebP EXIF Chunk', value: 'Embedded EXIF metadata' });
        this._parseTiffHeader(chunkData, tags);
      } else if (fourCC === 'XMP ') {
        tags.push({ category: 'Container', label: 'WebP XMP Chunk', value: 'Embedded XMP metadata' });
        this._parseXmpString(chunkData, tags);
      } else if (fourCC === 'ICCP') {
        tags.push({ category: 'Color Profile', label: 'WebP ICCP', value: 'Embedded ICC color profile' });
      }

      // WebP chunks are padded to even bytes
      p += chunkSize + (chunkSize % 2);
    }
  }

  /* -------------------------------------------------------------
     MP4 / MOV (ISOBMFF & QuickTime) PARSING
  ------------------------------------------------------------- */
  static _isIsoBmff(bytes) {
    if (bytes.length < 8) return false;
    const type = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
    return type === 'ftyp' || type === 'moov';
  }

  static _parseIsoBmff(bytes, tags) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this._walkBoxes(view, bytes, 0, bytes.length, (type, offset, size, headerSize) => {
      if (type === 'moov') {
        // Recurse into moov
        this._walkBoxes(view, bytes, offset + headerSize, offset + size, (subType, subOffset, subSize, subHeaderSize) => {
          if (subType === 'mvhd') {
            this._parseMvhd(view, subOffset + subHeaderSize, tags);
          } else if (subType === 'udta') {
            tags.push({ category: 'Video Metadata', label: 'User Data (udta)', value: 'Embedded QuickTime metadata' });
            this._parseUdta(bytes, subOffset + subHeaderSize, subSize - subHeaderSize, tags);
          } else if (subType === 'meta') {
            tags.push({ category: 'Video Metadata', label: 'Meta Container (meta)', value: 'iTunes / MP4 metadata item list' });
            this._parseMetaBox(bytes, subOffset + subHeaderSize, subSize - subHeaderSize, tags);
          }
        });
      }
    });
  }

  static _walkBoxes(view, bytes, start, end, callback) {
    let p = start;
    while (p + 8 <= end) {
      let size = view.getUint32(p, false);
      const type = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
      let headerSize = 8;

      if (size === 1) { // 64-bit extended size
        if (p + 16 > end) break;
        const high = view.getUint32(p + 8, false);
        const low = view.getUint32(p + 12, false);
        size = high * 4294967296 + low;
        headerSize = 16;
      } else if (size === 0) {
        size = end - p;
      }

      if (size < headerSize || p + size > end) break;
      callback(type, p, size, headerSize);
      p += size;
    }
  }

  static _parseMvhd(view, offset, tags) {
    const version = view.getUint8(offset);
    let creationTime = 0;
    let modificationTime = 0;

    if (version === 0) {
      creationTime = view.getUint32(offset + 4, false);
      modificationTime = view.getUint32(offset + 8, false);
    } else if (version === 1) {
      creationTime = view.getUint32(offset + 8, false);
      modificationTime = view.getUint32(offset + 16, false);
    }

    const toDate = (sec) => {
      if (sec === 0) return null;
      const d = new Date((sec - 2082844800) * 1000);
      return !isNaN(d.getTime()) ? d.toUTCString() : null;
    };

    const cDate = toDate(creationTime);
    const mDate = toDate(modificationTime);

    if (cDate) {
      tags.push({ category: 'Timestamp', label: 'Video Created', value: cDate });
    }
    if (mDate) {
      tags.push({ category: 'Timestamp', label: 'Video Modified', value: mDate });
    }
  }

  static _parseUdta(bytes, offset, length, tags) {
    const text = new TextDecoder('latin1').decode(bytes.subarray(offset, offset + length));
    
    // Check for GPS coordinates tag: ©xyz
    const gpsMatch = text.match(/\xA9xyz([^\x00\r\n\t]+)/);
    if (gpsMatch) {
      tags.push({ category: 'Location / GPS', label: 'Video GPS', value: gpsMatch[1].replace(/[^\d.+-]/g, ' ').trim() });
    }

    const map = [
      { key: '\xA9nam', label: 'Video Title' },
      { key: '\xA9mak', label: 'Camera Make' },
      { key: '\xA9mod', label: 'Camera Model' },
      { key: '\xA9swr', label: 'Software' },
      { key: '\xA9day', label: 'Recording Date' },
      { key: '\xA9wrt', label: 'Author / Artist' }
    ];

    map.forEach(({ key, label }) => {
      const idx = text.indexOf(key);
      if (idx !== -1) {
        // Read up to null byte or next © marker
        let segment = text.slice(idx + 4, idx + 60);
        const nullIdx = segment.indexOf('\x00');
        if (nullIdx !== -1) segment = segment.slice(0, nullIdx);
        const nextMarker = segment.indexOf('\xA9');
        if (nextMarker !== -1) segment = segment.slice(0, nextMarker);
        const cleaned = segment.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ').trim();
        if (cleaned) tags.push({ category: 'Video Metadata', label, value: cleaned });
      }
    });
  }

  static _parseMetaBox(bytes, offset, length, tags) {
    const text = new TextDecoder('latin1').decode(bytes.subarray(offset, offset + length));
    if (/tool|encoder|handler|c2pa|apple/i.test(text)) {
      tags.push({ category: 'Video Metadata', label: 'Meta Information', value: 'Encoder / Device metadata tags detected' });
    }
  }

  /* -------------------------------------------------------------
     WEBM / MKV PARSING
  ------------------------------------------------------------- */
  static _isWebm(bytes) {
    return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  }

  static _parseWebm(bytes, tags) {
    const text = new TextDecoder('latin1').decode(bytes);
    if (/MuxingApp|WritingApp|Title/i.test(text)) {
      tags.push({ category: 'Video Metadata', label: 'WebM Header', value: 'Muxer / Application metadata tags found' });
    }
  }

  /* -------------------------------------------------------------
     UTILITIES
  ------------------------------------------------------------- */
  static _checkSignature(bytes, sig) {
    if (bytes.length < sig.length) return false;
    return sig.every((b, i) => bytes[i] === b);
  }

  static _checkString(bytes, offset, str) {
    if (offset + str.length > bytes.length) return false;
    for (let i = 0; i < str.length; i++) {
      if (bytes[offset + i] !== str.charCodeAt(i)) return false;
    }
    return true;
  }

  static _deduplicateTags(tags) {
    const map = new Map();
    tags.forEach(t => {
      const k = `${t.category}|${t.label}|${t.value}`;
      if (!map.has(k)) map.set(k, t);
    });
    return Array.from(map.values());
  }
}
