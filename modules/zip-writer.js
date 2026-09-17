/**
 * MetaClean Pro v2.0 - Client-Side Zip Creator
 * Zero-dependency pure JavaScript ZIP generator (Store mode)
 * Enables one-click bulk export for batch media cleaning.
 */

export class ZipWriter {
  constructor() {
    this.files = [];
  }

  /**
   * Add a file to the ZIP
   * @param {string} filename
   * @param {Uint8Array|ArrayBuffer|Blob} data
   */
  async addFile(filename, data) {
    let bytes;
    if (data instanceof Blob) {
      bytes = new Uint8Array(await data.arrayBuffer());
    } else if (data instanceof ArrayBuffer) {
      bytes = new Uint8Array(data);
    } else {
      bytes = data;
    }
    this.files.push({ name: filename, data: bytes });
  }

  /**
   * Generate ZIP Blob
   * @returns {Blob}
   */
  generate() {
    const parts = [];
    const centralEntries = [];
    let offset = 0;

    for (const file of this.files) {
      const nameBytes = new TextEncoder().encode(file.name);
      const crc = this._crc32(file.data);
      const size = file.data.length;

      // 1. Local File Header
      const header = new Uint8Array(30 + nameBytes.length);
      const hv = new DataView(header.buffer);
      hv.setUint32(0, 0x04034b50, true); // Local header signature
      hv.setUint16(4, 20, true);         // Version needed to extract
      hv.setUint16(6, 0, true);          // General purpose bit flag
      hv.setUint16(8, 0, true);          // Compression method: 0 (Store)
      hv.setUint16(10, 0, true);         // File last mod time
      hv.setUint16(12, 0, true);         // File last mod date
      hv.setUint32(14, crc, true);       // CRC-32
      hv.setUint32(18, size, true);      // Compressed size
      hv.setUint32(22, size, true);      // Uncompressed size
      hv.setUint16(26, nameBytes.length, true); // File name length
      hv.setUint16(28, 0, true);         // Extra field length
      header.set(nameBytes, 30);

      parts.push(header);
      parts.push(file.data);

      // 2. Prepare Central Directory Record
      const cHeader = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(cHeader.buffer);
      cv.setUint32(0, 0x02014b50, true); // Central directory signature
      cv.setUint16(4, 20, true);         // Version made by
      cv.setUint16(6, 20, true);         // Version needed
      cv.setUint16(8, 0, true);          // Flags
      cv.setUint16(10, 0, true);         // Method (Store)
      cv.setUint16(12, 0, true);         // Mod time
      cv.setUint16(14, 0, true);         // Mod date
      cv.setUint32(16, crc, true);       // CRC-32
      cv.setUint32(20, size, true);      // Compressed size
      cv.setUint32(24, size, true);      // Uncompressed size
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);         // Extra field length
      cv.setUint16(32, 0, true);         // Comment length
      cv.setUint16(34, 0, true);         // Disk number start
      cv.setUint16(36, 0, true);         // Internal attributes
      cv.setUint32(38, 0, true);         // External attributes
      cv.setUint32(42, offset, true);    // Relative offset of local header
      cHeader.set(nameBytes, 46);

      centralEntries.push(cHeader);
      offset += header.length + file.data.length;
    }

    // 3. Central Directory Records
    const cdOffset = offset;
    let cdSize = 0;
    for (const cEntry of centralEntries) {
      parts.push(cEntry);
      cdSize += cEntry.length;
    }

    // 4. End of Central Directory Record
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, this.files.length, true);
    ev.setUint16(10, this.files.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, cdOffset, true);
    ev.setUint16(20, 0, true);

    parts.push(eocd);

    return new Blob(parts, { type: 'application/zip' });
  }

  _crc32(bytes) {
    let crc = 0 ^ (-1);
    for (let i = 0; i < bytes.length; i++) {
      crc = (crc >>> 8) ^ ZipWriter.CRC_TABLE[(crc ^ bytes[i]) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
  }
}

ZipWriter.CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    table[i] = c >>> 0;
  }
  return table;
})();
