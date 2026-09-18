# MetaClean Pro v2.0 — Private Media Sanitizer & Cyber Extractor

A 100% client-side, zero-dependency privacy suite for **images** and **videos** with a toggleable **Cyber/Hacker OSINT Extraction Mode**.

---

## ⚡ Dual-Mode Architecture

### 1. 🛡️ Sanitizer Mode (Default)
* **Lossless Video Scrubbing**: Rewrites MP4/MOV container boxes (`udta`, `meta`) into `free` padding boxes and neutralizes creation timestamps without transcoding.
* **Native WebP & Alpha Retention**: Exports WebP natively with alpha transparency.
* **Color Space & Orientation**: Respects Display P3 wide-gamut colors and normalizes smartphone portrait rotations.
* **Batch Processing**: Multi-file queue with bulk `.zip` download.

### 2. 💻 Cyber Extraction Mode (Toggled via Button)
* **Matrix / Hacker Theme**: Phosphor green `#00ff88` and cyber cyan terminal aesthetic with CRT scanlines.
* **GPS Telemetry & Google Maps**: Extracts latitude, longitude, and altitude with a direct one-click link to Google Maps.
* **Hardware & Optics Dossier**: Displays camera make/model, lens specs, aperture ($f$-stop), shutter speed, ISO rating, and timestamps.
* **Searchable Raw Buffer**: Real-time filterable table showing every metadata tag detected in the file.
* **Direct Scrub Action**: Allows immediate transition from extraction to sanitization.

---

## 🏃 Local Run Instructions

No build tools or Node.js required. Serve locally with Python:

```bash
python3 -m http.server 8080 --directory metaclean-pro-v2
```

Open `http://localhost:8080` in your browser.
Press `Ctrl + E` (or `Cmd + E`) to toggle Extraction Mode anytime!
