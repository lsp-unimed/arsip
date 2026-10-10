# Arsip Dokumen LSP UNIMED

Aplikasi arsip dokumen LSP UNIMED (standalone, lepas dari laman utama).

- Frontend: `index.html` (buka via GitHub Pages)
- Backend: `backend/Code.gs` (Apps Script + Spreadsheet + Drive)
- Panduan deploy backend: `backend/README.md`

Alur: tempel `backend/Code.gs` ke Apps Script > Run `siapkanSheet` + `siapkanDrive` > Deploy New version > isi URL `/exec` ke `API_URL` di `index.html`.
