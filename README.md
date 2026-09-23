# MetaClean Pro

Privacy-first browser image metadata cleaner and EXIF tag editor. Runs 100% locally on your device with no server uploads.

## Features

### 1. 🧹 Quick Metadata Cleaner
- **Deep Scan**: Scans JPEG APP segments, EXIF, XMP, and IPTC blocks, PNG text chunks (`tEXt`, `zTXt`, `iTXt`), and markers for GPS, camera hardware, dates, software, and provenance.
- **Canvas Rebuild**: Re-encodes raster images through HTML5 Canvas into fresh JPEG, PNG, or WebP files, stripping embedded metadata payloads.
- **Verification**: Automatically scans the generated output to verify stripped fields before downloading.

### 2. ✏️ EXIF Photo Editor
- **Tag Inspector**: Parses and displays raw EXIF tags from `IFD0`, `Exif`, and `GPS` IFD blocks with color-coded syntax.
- **Precision Metadata Editing**:
  - **Date & Time**: Date Taken (`DateTimeOriginal`), Date Modified (`DateTime`), and Date Digitized (`DateTimeDigitized`).
  - **Camera Hardware**: Make, Model, Processing Software, and ISO Speed.
  - **GPS Location**: Latitude, Longitude, and Altitude with decimal/DMS coordinates.
  - **Attribution & Copyright**: Description / Caption, Artist / Photographer, and Copyright notice.
- **In-Place Injection**: Injects updated EXIF metadata directly into JPEG binary without image re-compression using `piexifjs`.
- **Strip All EXIF**: Wipes all EXIF IFD records while retaining original image binary.

## Run Locally

Open `index.html` in any modern web browser or serve with a local static server:

```bash
python3 -m http.server 8000
```

## Privacy & Security

All image reading, canvas rebuilding, EXIF parsing, and downloads occur entirely inside the client's browser using standard Web APIs. No photos, EXIF fields, or location data are ever transmitted to an external server.
