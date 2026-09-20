# MetaClean Pro

A client-side image metadata cleaner.

## Run
Open `index.html` directly, or serve the folder with any static web server.

Example:
`python3 -m http.server 8000`

## What it does
- Scans common JPEG APP segments and EXIF/XMP/IPTC markers.
- Scans common PNG text chunks.
- Checks for common GPS/camera/date/author/software/provenance markers.
- Rebuilds JPEG/PNG through the browser canvas and rescans the output.
- Does not upload files.

## Limitations
The inspector is a lightweight browser scanner, not a complete parser for every proprietary format. Canvas re-encoding strips common file metadata but cannot guarantee removal of every hidden/proprietary payload. It intentionally does not modify pixels to evade AI detectors or provenance systems. JPEG output is recompressed.
