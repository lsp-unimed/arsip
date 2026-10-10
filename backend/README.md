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

## Catatan

- Nomor surat **diketik manual** sesuai buku agenda; `cekNomor` menolak duplikat,
  `saranNomor` memberi saran urutan (075, 076, …) + 5 nomor terakhir.
- File PDF disimpan di Drive `ARSIP_LSP/<kategori>/`; cukup simpan `file_id`.
- Frontend `arsip/` masih mode demo (data contoh di browser); penyambungan
  `API_URL` ke backend ini langkah berikutnya setelah URL `/exec` ada.
