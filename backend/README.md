# Backend Arsip Dokumen LSP UNIMED

Backend: **1 Spreadsheet (database) + 1 Apps Script (API JSON) + 1 folder Drive (file PDF)**.
Repo ini hanya `lsp-unimed/laman-utama-demo` — repo SIPINTAR tidak disentuh.

## File

- `Code.gs` — backend API, tempel ke Apps Script (Extensions > Apps Script).
- `appsscript.json` — manifest (timezone Asia/Jakarta, Web App anonim).
- `Database-Arsip-LSP-UNIMED.xlsx` — template database, upload ke Google Sheets.

## Tabel (nama tab = kontrak API, JANGAN diganti)

Dokumen, Revisi, SuratMasuk, Disposisi, Nomor, Agenda, AgendaButir,
Templat, Kop, Pengguna, Log + Petunjuk.

## Deploy manual (5 langkah)

1. Upload `Database-Arsip-LSP-UNIMED.xlsx` ke Drive → buka → Save as Google Sheets
   (atau buat spreadsheet kosong; tab dibuat otomatis oleh `siapkanSheet()`).
2. Di spreadsheet: Extensions > Apps Script → hapus `Code.gs` bawaan → tempel isi
   `backend/Code.gs` → simpan.
3. Project Settings > Script Properties > tambah `ADMIN_PASS` (kata sandi admin/petugas).
4. Di editor: pilih fungsi `siapkanSheet()` → Run (setujui izin Google).
   Ini membuat/menyesuaikan semua tab + header.
5. Deploy > New deployment > Web app → Execute as: **Me** → Access: **Anyone** →
   salin URL `/exec` → simpan sebagai `API_URL` frontend.

## Login (seperti SIPINTAR: username + password)

- Akun tersimpan di tab `Pengguna` (kolom `username, nama, peran, salt,
  password_hash, aktif`). Password tidak pernah tersimpan polos.
- Sesi memakai token (6 jam; "ingat saya" 7 hari), diperiksa ulang setiap
  permintaan: akun dinonaktifkan / peran diubah / sandi diganti langsung berlaku.
- Akun pertama: di editor Apps Script jalankan sekali
  `buatAdminAwal('admin', 'Ganti-Sandi-Ini', 'Nama Admin')`, lalu Deploy ulang
  (Manage deployments > pensil > New version). Setelah bisa login, buat akun
  lain dari menu Pengguna (hanya Admin/Ketua) dan catat password awal di luar repo.
- Di frontend `arsip/index.html`: `API_URL` sudah diisi URL `/exec` deployment ini.
  Buka halaman arsip, masuk dengan username + password.

## API

- GET (tanpa login): `?aksi=ping`
- POST (login): `{aksi:'login', data:{username, password, ingat}}`
- POST (sesudah login, sertakan `token`): `saya`, `logout`, `gantiPassword`,
  `daftarPengguna`, `buatPengguna`, `aturSandi`,
  `{aksi:'list'|'ambil'|'tambah'|'ubah'|'hapus', tabel, id, data, opsi, token}`
- Khusus (butuh login): `cekNomor {nomor}`, `saranNomor {jenis,bulan,tahun}`, `ringkasan {}`


## Pembaruan 10 Oktober 2026 — kecepatan & keamanan

Setelah menempel `Code.gs` versi ini:

1. **Deploy > Manage deployments > pensil > Version: New version > Deploy** (URL `/exec` tetap).
2. Jalankan **sekali** fungsi `privatkanBerkas()` dari editor (Run). Ini mencabut akses
   "siapa saja yang memiliki link" dari berkas arsip lama. Log eksekusi menampilkan jumlahnya.
3. Tidak perlu menjalankan `siapkanSheet()` lagi: struktur tab otomatis disesuaikan bila SKEMA berubah.

Yang berubah:

- **Hak akses dijaga di server** (`izinTabel_`, `saringBaca_`), sama dengan aturan tampilan:
  Ketua/Admin/Sekretariat penuh; bidang hanya kategorinya; kategori ASR/ASM tidak terkirim ke peran
  yang tidak berhak; hanya Ketua yang dapat mengesahkan surat; bidang tujuan disposisi hanya dapat
  menandai surat selesai; tab Log tidak dapat diubah/dihapus; tab Pengguna hanya lewat menu Pengguna
  (salt/hash tidak pernah dikirim).
- **Berkas privat**: `unggahBerkas` tidak lagi membagikan tautan publik. Berkas dibuka lewat aksi
  `lihatBerkas` setelah hak akses diperiksa, dan setiap pembukaan tercatat di Log.
- **Lebih cepat**: data akun di-cache 60 detik (dihapus otomatis saat akun diubah), struktur tab tidak
  lagi diperiksa di setiap permintaan, login langsung membawa data dasbor, dan catatan aktivitas ikut
  dalam panggilan simpan (tidak ada panggilan Log terpisah). Disposisi dan revisi memakai aksi `batch`
  (satu panggilan).
- Aksi baru: `lihatBerkas {file_id}`, `catat {pesan}`, `batch {ops:[...]}`; `login` menerima `awal:true`.

## Catatan

- Nomor surat **diketik manual** sesuai buku agenda; `cekNomor` menolak duplikat,
  `saranNomor` memberi saran urutan (075, 076, …) + 5 nomor terakhir.
- File PDF disimpan di Drive `ARSIP_LSP/<kategori>/`; cukup simpan `file_id`.
