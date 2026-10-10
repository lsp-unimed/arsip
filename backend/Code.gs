/** @OnlyCurrentDoc */
/**
 * Arsip Dokumen LSP UNIMED — backend Apps Script + Spreadsheet sebagai database.
 * Repo: lsp-unimed/laman-utama-demo (folder backend/). TIDAK menyentuh repo SIPINTAR.
 *
 * Tabel (nama tab = nama tabel, JANGAN diganti setelah deploy):
 *   Dokumen, Revisi, SuratMasuk, Disposisi, Nomor, Agenda, AgendaButir,
 *   Templat, Kop, Pengguna, Log
 * Kolom 'id', 'dibuat', 'diubah' otomatis; jangan ditulis di 'kolom'.
 *
 * Login seperti SIPINTAR: username + password per pengguna (sheet Pengguna:
 * username, nama, peran, salt, password_hash, aktif). Sesi memakai token
 * (CacheService 6 jam, "ingat saya" 7 hari via Script Properties).
 *
 * Hak akses per peran DIJAGA DI SERVER (izinTabel_/saringBaca_), sama dengan aturan tampilan.
 * Berkas Drive privat; dibuka lewat aksi lihatBerkas. Jalankan privatkanBerkas() sekali untuk berkas lama.
 * Aksi bawaan (semua tabel): ping, skema, masuk, list, ambil, tambah, ubah, hapus
 * GET  : ?aksi=list&tabel=x (baca saja, tanpa token tidak dilayani kecuali ping/skema publik)
 * POST : body JSON {aksi, tabel, id, data, opsi, token} sebagai text/plain
 * Aksi khusus: login, logout, saya, gantiPassword (min. 8, sesi aktif tetap jalan),
 *   daftarPengguna, simpanPengguna (buatPengguna lama, tambah+ubah incl. username/password),
 *   hapusPengguna, aturSandi, cekNomor, saranNomor, ringkasan
 */

var CONFIG = {
  SPREADSHEET_ID: '1FuefPlkCHgFlfxSeVkazU369uAz1zx4eslYNc-aii80', // ID Database Arsip LSP UNIMED (diisi Pak Boss 10 Okt 2026).
  // Cara isi: buka spreadsheet Database Arsip > salin ID dari URL
  // https://docs.google.com/spreadsheets/d/ID_INI/edit > tempel di sini > Save > Run.
  // Kosongkan ('') hanya bila script ditempel via Extensions > Apps Script dari spreadsheet itu.
  FOLDER_NAMA: 'Arsip LSP UNIMED', // folder Drive tujuan berkas (dibuat otomatis oleh siapkanDrive).
  SESSION_SECONDS: 21600, // 6 jam (maksimum CacheService)
  INGAT_HARI: 7,
  TZ: 'Asia/Jakarta'
};

var SS_ = null;
var SHEET_MEMO = {}, JUDUL_MEMO = {}, BACA_MEMO = {}, VERSI_DICEK = false; // berlaku selama satu eksekusi
function ss_() {
  if (SS_) return SS_;
  if (CONFIG.SPREADSHEET_ID) {
    SS_ = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    return SS_;
  }
  SS_ = SpreadsheetApp.getActive();
  if (!SS_) throw galat('Spreadsheet tidak ketemu. Isi CONFIG.SPREADSHEET_ID dengan ID spreadsheet Database Arsip, lalu Save dan Run ulang. (Buka spreadsheet > salin ID dari URL /d/ID/edit)');
  return SS_;
}

// ===================== SKEMA =====================
var SKEMA = {
  Dokumen: {
    kolom: ['kode', 'kat', 'judul', 'pemilik', 'terbit', 'sampai', 'status', 'arsip', 'rev', 'alur', 'surat', 'tpl_id', 'tpl_data', 'file_id', 'file_nama', 'file_url', 'ket'],
    publik: [],
    aturan: {
      kode:  { wajib: true, maks: 80, pesan: 'Kode/nomor dokumen wajib diisi.' },
      kat:   { wajib: true, pilihan: ['LIS', 'MUT', 'SKM', 'ASR', 'TUK', 'ASM', 'MNJ', 'KOR'], pesan: 'Kategori tidak dikenal.' },
      judul: { wajib: true, maks: 300, pesan: 'Judul wajib diisi (maks. 300 karakter).' },
      pemilik: { maks: 60 },
      terbit: { jenis: 'tanggal' },
      sampai: { jenis: 'tanggal' },
      status: { pilihan: ['Berlaku', 'Draf', 'Diajukan', 'Disahkan', 'Terkirim', 'Kedaluwarsa'], pesan: 'Status tidak dikenal.' },
      rev:   { jenis: 'angka' },
      alur:  { pilihan: ['', 'Draf', 'Diajukan', 'Disahkan', 'Terkirim'], pesan: 'Alur tidak dikenal.' },
      surat: { pilihan: ['', 'Y', 'T'], pesan: 'Surat harus Y/T.' }
    },
    izin: { list: 'admin', ambil: 'admin', tambah: 'admin', ubah: 'admin', hapus: 'admin' }
  },
  Revisi: {
    kolom: ['dokumen_id', 'rev', 'tanggal', 'oleh', 'catatan', 'file_id', 'file_nama', 'file_url'],
    publik: [],
    aturan: {
      dokumen_id: { wajib: true, maks: 20, pesan: 'dokumen_id wajib diisi.' },
      rev: { wajib: true, jenis: 'angka', pesan: 'Revisi harus angka.' },
      tanggal: { jenis: 'tanggal' }
    },
    izin: { list: 'admin', ambil: 'admin', tambah: 'admin', ubah: 'admin', hapus: 'admin' }
  },
  SuratMasuk: {
    kolom: ['agenda', 'tgl_surat', 'terima', 'asal', 'nomor', 'perihal', 'sifat', 'status', 'arsip', 'file_id', 'file_nama', 'file_url'],
    publik: [],
    aturan: {
      agenda: { wajib: true, maks: 30, pesan: 'Nomor agenda (SM-xxx/tahun) wajib diisi.' },
      perihal: { wajib: true, maks: 300, pesan: 'Perihal wajib diisi.' },
      tgl_surat: { jenis: 'tanggal' },
      terima: { jenis: 'tanggal' },
      sifat: { pilihan: ['', 'Biasa', 'Segera', 'Sangat segera', 'Rahasia'], pesan: 'Sifat tidak dikenal.' },
      status: { pilihan: ['', 'Diterima', 'Didisposisi', 'Selesai'], pesan: 'Status tidak dikenal.' },
      file_url: { maks: 500 }
    },
    izin: { list: 'admin', ambil: 'admin', tambah: 'admin', ubah: 'admin', hapus: 'admin' }
  },
  Disposisi: {
    kolom: ['surat_id', 'tgl', 'ke', 'instruksi', 'catatan', 'batas', 'status'],
    publik: [],
    aturan: {
      surat_id: { wajib: true, maks: 20, pesan: 'surat_id wajib diisi.' },
      ke: { wajib: true, maks: 200, pesan: 'Tujuan disposisi wajib diisi.' },
      instruksi: { maks: 300 }
    },
    izin: { list: 'admin', ambil: 'admin', tambah: 'admin', ubah: 'admin', hapus: 'admin' }
  },
  Nomor: {
    kolom: ['nomor', 'jenis', 'tahun', 'bulan', 'urut', 'dokumen_id', 'ket'],
    publik: [],
    aturan: {
      nomor: { wajib: true, maks: 80, pesan: 'Nomor surat wajib diisi (ketik manual sesuai buku agenda).' },
      jenis: { maks: 10 },
      tahun: { maks: 4 },
      urut: { jenis: 'angka' }
    },
    izin: { list: 'admin', ambil: 'admin', tambah: 'admin', ubah: 'admin', hapus: 'admin' }
  },
  Agenda: {
    kolom: ['nama', 'tanggal', 'tempat', 'catatan'],
    publik: [],
    aturan: {
      nama: { wajib: true, maks: 200, pesan: 'Nama agenda wajib diisi.' },
      tanggal: { wajib: true, jenis: 'tanggal', pesan: 'Tanggal agenda wajib diisi.' }
    },
    izin: { list: 'admin', ambil: 'admin', tambah: 'admin', ubah: 'admin', hapus: 'admin' }
  },
  AgendaButir: {
    kolom: ['agenda_id', 'nama', 'status', 'ket'],
    publik: [],
    aturan: {
      agenda_id: { wajib: true, maks: 20, pesan: 'agenda_id wajib diisi.' },
      nama: { wajib: true, maks: 300, pesan: 'Nama butir wajib diisi.' },
      status: { wajib: true, pilihan: ['ok', 'warn', 'bad'], pesan: 'Status butir: ok/warn/bad.' }
    },
    izin: { list: 'admin', ambil: 'admin', tambah: 'admin', ubah: 'admin', hapus: 'admin' }
  },
  Templat: {
    kolom: ['tpl_id', 'nama', 'kat', 'ket'],
    publik: ['tpl_id', 'nama', 'kat', 'ket'],
    aturan: {
      tpl_id: { wajib: true, maks: 30, pesan: 'tpl_id wajib diisi.' },
      nama: { wajib: true, maks: 120, pesan: 'Nama templat wajib diisi.' }
    },
    izin: { list: 'publik', ambil: 'publik', tambah: 'admin', ubah: 'admin', hapus: 'admin' }
  },
  TemplatKustom: {
    kolom: ['tpl_id', 'nama', 'kode', 'kat', 'ket', 'surat', 'definisi'],
    publik: ['tpl_id', 'nama', 'kode', 'kat', 'ket', 'surat', 'definisi'],
    aturan: {
      tpl_id: { wajib: true, maks: 40, pesan: 'tpl_id wajib diisi.' },
      nama: { wajib: true, maks: 120, pesan: 'Nama templat wajib diisi.' },
      kode: { maks: 10 },
      definisi: { maks: 20000 },
      kat: { pilihan: ['LIS', 'MUT', 'SKM', 'ASR', 'TUK', 'ASM', 'MNJ', 'KOR'], pesan: 'Kategori tidak dikenal.' }
    },
    izin: { list: 'publik', ambil: 'publik', tambah: 'admin', ubah: 'admin', hapus: 'admin' }
  },
  Kop: {
    kolom: ['l1', 'l2', 'l3', 'l4', 'l5', 'kota', 'jabatan', 'nama', 'nip'],
    publik: ['l1', 'l2', 'l3', 'l4', 'l5', 'kota', 'jabatan', 'nama', 'nip'],
    aturan: {},
    izin: { list: 'publik', ambil: 'publik', tambah: 'admin', ubah: 'admin', hapus: 'admin' }
  },
  Pengguna: {
    kolom: ['username', 'nama', 'peran', 'salt', 'password_hash', 'aktif', 'bagian', 'email'],
    publik: [],
    aturan: {
      username: { wajib: true, pola: '^[a-z0-9._]{3,30}$', pesan: 'Username 3-30 karakter: huruf kecil, angka, titik, garis bawah.' },
      nama: { wajib: true, maks: 80, pesan: 'Nama pengguna wajib diisi.' },
      peran: { wajib: true, pilihan: ['Ketua LSP', 'Admin', 'Sekretariat', 'Administrasi', 'Bidang Sertifikasi', 'Manajemen Mutu', 'Bidang Skema'], pesan: 'Peran tidak dikenal.' },
      aktif: { pilihan: ['', 'YA', 'TIDAK'], pesan: 'Aktif harus YA/TIDAK.' }
    },
    izin: { list: 'admin', ambil: 'admin', tambah: 'admin', ubah: 'admin', hapus: 'admin' }
  },
  Log: {
    kolom: ['waktu', 'siapa', 'aksi'],
    publik: [],
    aturan: {
      aksi: { wajib: true, maks: 300, pesan: 'Aksi wajib diisi.' }
    },
    izin: { list: 'admin', ambil: 'admin', tambah: 'admin', ubah: 'admin', hapus: 'admin' }
  }
};

// Aksi tambahan khusus Arsip.
var AKSI_KHUSUS = {
  // Cek duplikat nomor surat manual: {nomor} -> {ada:true/false}
  cekNomor: {
    izin: 'admin',
    jalankan: function (body) {
      var nomor = String((body.data && body.data.nomor) || '').trim();
      if (!nomor) throw galat('Nomor kosong.');
      var adaDok = bacaTabel('Dokumen').some(function (r) { return String(r.kode) === nomor; });
      var adaNo = bacaTabel('Nomor').some(function (r) { return String(r.nomor) === nomor; });
      return { nomor: nomor, ada: adaDok || adaNo };
    }
  },
  // Saran urutan berikutnya: {jenis:'UND', bulan:'X', tahun:'2026'} -> {saran:'075/LSP-UNIMED/UND/X/2026', terakhir:[...]}
  saranNomor: {
    izin: 'admin',
    jalankan: function (body) {
      var d = body.data || {};
      var jenis = String(d.jenis || ''), bulan = String(d.bulan || ''), tahun = String(d.tahun || '');
      var semua = bacaTabel('Nomor');
      var cocok = semua.filter(function (r) { return String(r.jenis) === jenis && String(r.bulan) === bulan && String(r.tahun) === tahun; });
      var maks = 0;
      cocok.forEach(function (r) { var n = Number(r.urut) || 0; if (n > maks) maks = n; });
      var urut = maks + 1;
      var tengah = jenis ? '/' + jenis + '/' : '/';
      var saran = String(urut).padStart(3, '0') + '/LSP-UNIMED' + tengah + bulan + '/' + tahun;
      var terakhir = semua.slice(-5).map(function (r) { return r.nomor; });
      return { saran: saran, urut: urut, terakhir: terakhir };
    }
  },
  // Drive: siapkan folder arsip + subfolder per kategori. Jalankan sekali dari editor (Run).
  siapkanDrive: {
    izin: 'admin',
    jalankan: function (body, user) {
      if (!penuh_(kunciPeran_(user.peran))) throw galat(TOLAK_);
      return siapkanDrive_();
    }
  },
  // Unggah berkas base64 ke Drive: {nama, mime, base64, kat} -> {file_id, file_nama, file_url}
  // Batas praktis ~10 MB (Apps Script). Untuk berkas besar: unggah manual ke Drive lalu tempel link via Ubah data.
  unggahBerkas: {
    izin: 'admin',
    jalankan: function (body, user) {
      var d = body.data || {};
      var nama = String(d.nama || 'berkas.pdf').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120);
      var b64 = String(d.base64 || '');
      if (!b64) throw galat('Berkas kosong.');
      var kat = String(d.kat || '');
      if ((SKEMA.Dokumen.aturan.kat.pilihan || []).indexOf(kat) < 0) throw galat('Kategori tidak dikenal.');
      if (!bolehUbahKat_(kunciPeran_(user.peran), kat)) throw galat('Kategori ' + kat + ' di luar wewenang peran Anda.');
      var ext = (nama.match(/\.([a-z0-9]+)$/i) || [])[1];
      var MIME = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
      if (!ext || !MIME[ext.toLowerCase()]) throw galat('Jenis berkas tidak diizinkan (PDF, DOC/DOCX, XLS/XLSX, JPG, PNG).');
      var bytes = Utilities.base64Decode(b64.split(',').pop());
      if (bytes.length > 10 * 1024 * 1024) throw galat('Berkas lebih dari 10 MB.');
      var f = folderArsip_(kat).createFile(Utilities.newBlob(bytes, MIME[ext.toLowerCase()], nama));
      // Berkas TIDAK dibagikan publik; dibuka lewat aksi lihatBerkas setelah hak akses diperiksa.
      return { file_id: f.getId(), file_nama: f.getName(), file_url: '' };
    }
  },
  // Buka berkas arsip tanpa membuka akses publik: {file_id} -> {nama, mime, base64}
  lihatBerkas: {
    izin: 'admin',
    jalankan: function (body, user) {
      return lihatBerkas_(user, String((body.data && body.data.file_id) || ''));
    }
  },
  // Catatan aktivitas yang tidak disertai perubahan data (mis. membuka/mencetak).
  catat: {
    izin: 'admin',
    jalankan: function (body, user) {
      var pesan = String((body.data && body.data.pesan) || '').trim().slice(0, 300);
      if (!pesan) return false;
      var c = CacheService.getScriptCache(), k = 'catat_' + user.username + '_' + Math.floor(Date.now() / 60000);
      var n = Number(c.get(k) || 0) + 1; c.put(k, String(n), 120);
      if (n > 60) return false;
      catatLog(user, pesan);
      return true;
    }
  },
  // Beberapa perubahan dalam SATU panggilan (mis. disposisi + status surat, revisi + dokumen).
  batch: {
    izin: 'admin',
    jalankan: function (body, user) {
      var ops = (body.data && body.data.ops) || [];
      if (!ops.length || ops.length > 10) throw galat('Jumlah operasi tidak valid.');
      var hasil = ops.map(function (o) {
        return jalankanTabel_(user, String(o.aksi || ''), String(o.tabel || ''), String(o.id || ''), o.data || {}, o.opsi || {}, '', true);
      });
      catatLog(user, teksCatatan_(body.catatan) || ops.map(function (o) { return o.aksi + ' ' + o.tabel; }).join(', '));
      return hasil;
    }
  },
  // Ringkasan dashboard: hitung dokumen per status, surat masuk terbuka, progres agenda.
  ringkasan: {
    izin: 'admin',
    jalankan: function (body, user) {
      var dok = saringBaca_(user, 'Dokumen', bacaTabel('Dokumen'));
      var sm = bacaTabel('SuratMasuk');
      var ag = bacaTabel('Agenda');
      var butir = bacaTabel('AgendaButir');
      var byStatus = {};
      dok.forEach(function (r) { var s = r.status || '-'; byStatus[s] = (byStatus[s] || 0) + 1; });
      var smBuka = sm.filter(function (r) { return r.status !== 'Selesai'; }).length;
      var perAgenda = ag.map(function (a) {
        var b = butir.filter(function (x) { return String(x.agenda_id) === String(a.id); });
        var ok = b.filter(function (x) { return x.status === 'ok'; }).length;
        return { id: a.id, nama: a.nama, tanggal: a.tanggal, total: b.length, siap: ok };
      });
      return { dokumen: dok.length, byStatus: byStatus, suratBuka: smBuka, agenda: perAgenda };
    }
  },
  // Dasbor cepat ala SIPINTAR (summary+refData): SATU panggilan baca semua tabel
  // dalam SATU eksekusi server. Frontend lama memanggil 7-8x list() paralel,
  // tiap panggilan baca ulang sheet Pengguna (auth) + 1 sheet → lambat.
  // Hasil di-cache 60 detik; dihapus otomatis tiap tambah/ubah/hapus.
  dasbor: {
    izin: 'admin',
    jalankan: function (body, user) {
      return dasborUntuk_(user);
    }
  }
};

var BATAS_KIRIM_PER_MENIT = 30;
var DETIK_CACHE = 60;
var MAKS_PER_HALAMAN = 200;
// =================== AKHIR PENGATURAN ===================


function doGet(e) {
  var p = (e && e.parameter) || {};
  // GET hanya untuk cek koneksi; semua aksi lain wajib POST agar password/token tidak masuk URL.
  if ((p.aksi || 'ping') !== 'ping') return balas({ ok: false, pesan: 'Aksi ini harus lewat POST.' });
  return jalankan({ aksi: 'ping' }, false);
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return balas({ ok: false, pesan: 'Format permintaan salah.' });
  }
  return jalankan(body, true);
}

function jalankan(body, lewatPost) {
  try {
    var aksi = String(body.aksi || '');

    if (aksi === 'ping')  return balas({ ok: true, data: { waktu: new Date().toISOString() } });
    if (aksi === 'login') {
      var m = masuk(body.data || {});
      // Data dasbor ikut dikirim agar panel terbuka tanpa panggilan kedua.
      if (body.data && body.data.awal) { try { m.awal = dasborUntuk_(m.user); } catch (e) { /* panel memuat sendiri */ } }
      return balas({ ok: true, data: m });
    }
    if (aksi === 'skema') {
      var u0 = body.token ? authUser(body.token) : null;
      return balas({ ok: true, data: skemaPublik(!!u0) });
    }

    // Semua aksi lain wajib login (token seperti SIPINTAR).
    var user = authUser(body.token);
    user._token = body.token;
    if (aksi === 'logout') { hapusSesi_(body.token); return balas({ ok: true, data: true }); }
    if (aksi === 'saya') return balas({ ok: true, data: { username: user.username, nama: user.nama, peran: user.peran } });
    if (aksi === 'gantiPassword') return balas({ ok: true, data: gantiPassword(user, body.data || {}) });
    if (aksi === 'daftarPengguna') return balas({ ok: true, data: daftarPengguna_(user) });
    if (aksi === 'buatPengguna') return balas({ ok: true, data: simpanPengguna_(user, body.data || {}) });
    if (aksi === 'simpanPengguna') return balas({ ok: true, data: simpanPengguna_(user, body.data || {}) });
    if (aksi === 'hapusPengguna') return balas({ ok: true, data: hapusPengguna_(user, body.data || {}) });
    if (aksi === 'aturSandi') return balas({ ok: true, data: aturSandi_(user, body.data || {}) });

    if (AKSI_KHUSUS[aksi]) {
      return balas({ ok: true, data: AKSI_KHUSUS[aksi].jalankan(body, user) });
    }

    var hasil = jalankanTabel_(user, aksi, String(body.tabel || ''), String(body.id || ''), body.data || {}, body.opsi || {}, body.catatan, false);
    return balas({ ok: true, data: hasil });
  } catch (err) {
    if (err && err.publik) return balas({ ok: false, pesan: err.message });
    console.error(err && err.stack || err);
    return balas({ ok: false, pesan: 'Terjadi kesalahan di server.' });
  }
}

function ringkasData(d) {
  var s = String(d.kode || d.nomor || d.nama || d.judul || d.agenda || d.username || '');
  return s.slice(0, 80);
}

function catatLog(user, aksi) {
  // Tanpa kunci: appendRow atomik. Versi lama memakai denganKunci di sini
  // sehingga macet (lock timeout) bila dipanggil dari dalam fungsi yang
  // sudah memegang kunci — mis. masuk() dan simpanPengguna_().
  try {
    var sh = sheetTabel('Log');
    var judul = judulKolom(sh);
    var bar = judul.map(function (j) {
      if (j === 'id') return Utilities.getUuid().replace(/-/g, '').slice(0, 10);
      if (j === 'dibuat' || j === 'waktu') return new Date().toISOString();
      if (j === 'diubah') return '';
      if (j === 'siapa') return (user.nama || user.username) + ' (' + user.peran + ')';
      if (j === 'aksi') return String(aksi).slice(0, 300);
      return '';
    });
    sh.appendRow(bar);
    delete BACA_MEMO.Log; // dasbor tetap di-cache; riwayat aktivitas boleh tertinggal paling lama 60 detik
  } catch (e) { /* log tidak boleh menggagalkan transaksi */ }
}



// ===================== Hak akses per peran (dijaga di server) =====================
// Sama persis dengan aturan tampilan: Ketua/Admin/Sekretariat penuh; bidang hanya kategorinya.
var PENUH_ = ['Ketua', 'Admin', 'Sekretariat'];
var KAT_TERBATAS_ = ['ASR', 'ASM'];
var HAK_UBAH_ = { Ketua: 'SEMUA', Admin: 'SEMUA', Sekretariat: 'SEMUA', Mutu: ['MUT', 'MNJ', 'ASR'], Sertifikasi: ['ASR', 'TUK', 'ASM'], Skema: ['SKM', 'MNJ'], Administrasi: ['KOR', 'ASM', 'MNJ'] };
var BAGIAN_ = { Sekretariat: 'Sekretariat', Administrasi: 'Administrasi', Sertifikasi: 'Bidang Sertifikasi', Mutu: 'Manajemen Mutu', Skema: 'Bidang Skema' };

function kunciPeran_(peran) {
  var p = String(peran || '').toLowerCase();
  if (p.indexOf('ketua') >= 0) return 'Ketua';
  if (p.indexOf('admin') >= 0 && p.indexOf('administrasi') < 0) return 'Admin';
  if (p.indexOf('sekretariat') >= 0) return 'Sekretariat';
  if (p.indexOf('mutu') >= 0) return 'Mutu';
  if (p.indexOf('sertifikasi') >= 0) return 'Sertifikasi';
  if (p.indexOf('skema') >= 0) return 'Skema';
  return 'Administrasi';
}
function penuh_(k) { return PENUH_.indexOf(k) >= 0; }
function bolehLihatKat_(k, kat) {
  if (penuh_(k) || KAT_TERBATAS_.indexOf(kat) < 0) return true;
  if (kat === 'ASR') return k === 'Mutu' || k === 'Sertifikasi';
  return k === 'Sertifikasi' || k === 'Administrasi';
}
function bolehUbahKat_(k, kat) {
  var h = HAK_UBAH_[k];
  return h === 'SEMUA' || (Array.isArray(h) && h.indexOf(kat) >= 0);
}
function milik_(k, baris) {
  var b = BAGIAN_[k], p = String((baris && baris.pemilik) || '');
  if (!b || !p) return false;
  var akhir = function (x) { var w = String(x).toLowerCase().split(/[^a-z]+/).filter(Boolean); return w[w.length - 1]; };
  return akhir(b) === akhir(p);
}
function barisById_(nama, id) {
  return bacaTabel(nama).filter(function (r) { return String(r.id) === String(id); })[0] || null;
}
function tugasDisposisi_(k, suratId) {
  var b = BAGIAN_[k];
  return !!b && bacaTabel('Disposisi').some(function (x) { return String(x.surat_id) === String(suratId) && String(x.ke).indexOf(b) >= 0; });
}
var TOLAK_ = 'Peran Anda tidak berwenang untuk perubahan ini.';

/** Periksa izin satu operasi tabel. Mengembalikan data yang boleh ditulis (bisa dipersempit). */
function izinTabel_(user, aksi, nama, id, data) {
  var k = kunciPeran_(user.peran), baca = aksi === 'list' || aksi === 'ambil';
  switch (nama) {
    case 'Pengguna': throw galat('Akun dikelola lewat menu Pengguna.');
    case 'Log':
      if (baca) return data;
      throw galat('Riwayat aktivitas tidak dapat ditambah, diubah, atau dihapus langsung.');
    case 'Templat': case 'TemplatKustom': case 'Kop': case 'Nomor':
      if (baca || penuh_(k)) return data;
      throw galat(TOLAK_);
    case 'Agenda': case 'AgendaButir':
      if (penuh_(k)) return data;
      throw galat('Agenda hanya untuk Ketua, Admin, dan Sekretariat.');
    case 'Disposisi':
      if (baca || penuh_(k)) return data;
      throw galat('Disposisi dibuat oleh Ketua, Admin, atau Sekretariat.');
    case 'SuratMasuk':
      if (baca || penuh_(k)) return data;
      if (aksi === 'ubah' && tugasDisposisi_(k, id)) {
        if (String(data.status || '') !== 'Selesai') throw galat('Anda hanya dapat menandai selesai surat yang didisposisikan kepada bagian Anda.');
        return { status: 'Selesai' };
      }
      throw galat('Surat masuk dicatat dan diubah oleh Ketua, Admin, atau Sekretariat.');
    case 'Dokumen':
      if (baca) return data;
      if (aksi === 'tambah') {
        if (!bolehUbahKat_(k, String(data.kat || ''))) throw galat('Kategori ' + (data.kat || '-') + ' di luar wewenang peran Anda.');
        return data;
      }
      var lama = barisById_('Dokumen', id);
      if (!lama || !bolehLihatKat_(k, lama.kat)) throw galat('Data tidak ditemukan.');
      if (!bolehUbahKat_(k, lama.kat)) throw galat('Kategori ' + lama.kat + ' di luar wewenang peran Anda.');
      if (aksi === 'hapus') {
        if (!penuh_(k) && !milik_(k, lama)) throw galat('Hanya Admin/Sekretariat, atau pemilik dokumen di kategorinya.');
        return data;
      }
      if (data.kat && !bolehUbahKat_(k, String(data.kat))) throw galat('Kategori ' + data.kat + ' di luar wewenang peran Anda.');
      if (String(data.alur || '') === 'Disahkan' && String(lama.alur || '') !== 'Disahkan' && k !== 'Ketua') throw galat('Hanya Ketua LSP yang dapat mengesahkan surat.');
      return data;
    case 'Revisi':
      if (baca) return data;
      if (aksi === 'tambah') {
        var dk = barisById_('Dokumen', String(data.dokumen_id || ''));
        if (!dk || !bolehLihatKat_(k, dk.kat) || !bolehUbahKat_(k, dk.kat)) throw galat(TOLAK_);
        return data;
      }
      if (penuh_(k)) return data;
      throw galat(TOLAK_);
  }
  throw galat('Tabel "' + nama + '" tidak dikenal.');
}

/** Saring baris yang boleh DIBACA peran ini (kategori terbatas disembunyikan di server). */
function saringBaca_(user, nama, baris) {
  var k = kunciPeran_(user.peran);
  if (penuh_(k)) return baris;
  if (nama === 'Dokumen') return baris.filter(function (r) { return bolehLihatKat_(k, r.kat); });
  if (nama === 'Revisi') {
    var boleh = {};
    bacaTabel('Dokumen').forEach(function (d) { if (bolehLihatKat_(k, d.kat)) boleh[String(d.id)] = 1; });
    return baris.filter(function (r) { return boleh[String(r.dokumen_id)]; });
  }
  return baris;
}

function teksCatatan_(c) { return String(c || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 300); }

/** Satu operasi tabel lengkap: izin -> jalankan -> catat. */
function jalankanTabel_(user, aksi, nama, id, data, opsi, catatan, tanpaLog) {
  var t = SKEMA[nama];
  if (!t) throw galat('Tabel "' + nama + '" tidak dikenal.');
  if (['list', 'ambil', 'tambah', 'ubah', 'hapus'].indexOf(aksi) < 0) throw galat('Aksi tidak dikenal.');
  data = izinTabel_(user, aksi, nama, id, data);
  var hasil;
  switch (aksi) {
    case 'list':   hasil = list(nama, opsi || {}, true, user); break;
    case 'ambil':
      hasil = ambil(nama, id, true);
      if (!saringBaca_(user, nama, [hasil]).length) throw galat('Data tidak ditemukan.');
      break;
    case 'tambah': hasil = tambah(nama, data, true); break;
    case 'ubah':   hasil = ubah(nama, id, data, true); break;
    case 'hapus':  hasil = hapus(nama, id); break;
  }
  if (!tanpaLog && (aksi === 'tambah' || aksi === 'ubah' || aksi === 'hapus')) {
    var bawaan = { tambah: 'Menambah ', ubah: 'Mengubah ', hapus: 'Menghapus ' }[aksi] + nama + ' ' + (aksi === 'tambah' ? ringkasData(data) : id);
    catatLog(user, teksCatatan_(catatan) || bawaan);
  }
  return hasil;
}

// ===================== Dasbor (satu panggilan untuk semua data panel) =====================
function dasborMentah_() {
  var cache = CacheService.getScriptCache();
  try { var hit = cache.get('dasbor'); if (hit) return JSON.parse(hit); } catch (e) {}
  var out = {
    dok: bacaTabel('Dokumen'),
    rev: bacaTabel('Revisi'),
    sm: bacaTabel('SuratMasuk'),
    disp: bacaTabel('Disposisi'),
    ag: bacaTabel('Agenda'),
    agB: bacaTabel('AgendaButir'),
    log: bacaTabel('Log').slice(-60),
    kop: bacaTabel('Kop')[0] || null
  };
  try { cache.put('dasbor', JSON.stringify(out), 60); } catch (e) { /* > 100 KB: tidak di-cache, tetap dikirim */ }
  return out;
}
function dasborUntuk_(user) {
  var d = dasborMentah_(), k = kunciPeran_(user.peran);
  d.dok = saringBaca_(user, 'Dokumen', d.dok);
  if (!penuh_(k)) {
    var boleh = {}; d.dok.forEach(function (x) { boleh[String(x.id)] = 1; });
    d.rev = d.rev.filter(function (r) { return boleh[String(r.dokumen_id)]; });
    d.ag = []; d.agB = [];
  }
  d.saya = { username: user.username, nama: user.nama, peran: user.peran };
  return d;
}

// ===================== Berkas arsip privat =====================
function lihatBerkas_(user, fid) {
  if (!/^[A-Za-z0-9_-]{20,}$/.test(fid)) throw galat('Berkas tidak valid.');
  var k = kunciPeran_(user.peran), ok = false, ref = '';
  var dok = bacaTabel('Dokumen').filter(function (r) { return String(r.file_id) === fid; })[0];
  if (dok) { ok = bolehLihatKat_(k, dok.kat); ref = dok.kode; }
  else {
    var rv = bacaTabel('Revisi').filter(function (r) { return String(r.file_id) === fid; })[0];
    if (rv) { var dk = barisById_('Dokumen', rv.dokumen_id); ok = !!dk && bolehLihatKat_(k, dk.kat); ref = (dk ? dk.kode : '') + ' rev. ' + rv.rev; }
    else {
      var sm = bacaTabel('SuratMasuk').filter(function (r) { return String(r.file_id) === fid; })[0];
      if (sm) { ok = true; ref = sm.agenda; }
    }
  }
  var f = null;
  if (ok) { try { f = DriveApp.getFileById(fid); } catch (e) { f = null; } }
  if (!ok || !f || !diFolderArsip_(f)) throw galat('Berkas tidak ditemukan atau di luar wewenang Anda.');
  var blob = f.getBlob(), bytes = blob.getBytes();
  if (bytes.length > 25 * 1024 * 1024) throw galat('Berkas terlalu besar untuk dibuka di sini; buka langsung dari Drive LSP.');
  catatLog(user, 'Membuka berkas ' + ref);
  return { nama: f.getName(), mime: blob.getContentType() || 'application/octet-stream', base64: Utilities.base64Encode(bytes) };
}
function diFolderArsip_(f) {
  var akar = folderArsip_('').getId();
  var antrian = [], it = f.getParents();
  while (it.hasNext()) antrian.push({ f: it.next(), d: 0 });
  while (antrian.length) {
    var x = antrian.shift();
    if (x.f.getId() === akar) return true;
    if (x.d < 3) { var p = x.f.getParents(); while (p.hasNext()) antrian.push({ f: p.next(), d: x.d + 1 }); }
  }
  return false;
}
/** Jalankan SEKALI dari editor: cabut akses "siapa saja yang memiliki link" dari semua berkas arsip lama. */
function privatkanBerkas() {
  var n = 0, gagal = 0;
  var jalan = function (folder) {
    var fs = folder.getFiles();
    while (fs.hasNext()) {
      var f = fs.next();
      try { if (f.getSharingAccess() !== DriveApp.Access.PRIVATE) { f.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE); n++; } } catch (e) { gagal++; }
    }
    var sub = folder.getFolders();
    while (sub.hasNext()) jalan(sub.next());
  };
  jalan(folderArsip_(''));
  var pesan = 'Berkas dijadikan privat: ' + n + (gagal ? ' · gagal: ' + gagal : '');
  Logger.log(pesan);
  return pesan;
}

// ===================== Cache akun (pemeriksaan sesi) =====================
/** Data akun untuk pemeriksaan sesi; disimpan 60 detik di cache dan dihapus setiap akun diubah. */
function akun_(username) {
  var un = String(username || '').toLowerCase(), c = CacheService.getScriptCache(), key = 'akun_' + un;
  var hit = c.get(key);
  if (hit) return JSON.parse(hit);
  var r = bacaTabel('Pengguna').filter(function (x) { return String(x.username).toLowerCase() === un; })[0];
  var o = r ? { username: r.username, nama: r.nama, peran: r.peran, aktif: r.aktif } : null;
  if (o) { try { c.put(key, JSON.stringify(o), 60); } catch (e) {} }
  return o;
}
function lupakanAkun_(username) {
  try { CacheService.getScriptCache().remove('akun_' + String(username || '').toLowerCase()); } catch (e) {}
}

// ===================== Login ala SIPINTAR =====================

function masuk(d) {
  var u = String(d.username || '').trim().toLowerCase();
  if (!u) throw galat('Username wajib diisi.');
  var cache = CacheService.getScriptCache();
  var kunciGagal = 'gagal_' + u;
  return denganKunciNilai(function () {
    var gagal = Number(cache.get(kunciGagal) || 0);
    if (gagal >= 5) throw galat('Terlalu banyak percobaan gagal. Coba lagi 10 menit lagi.');
    var user = bacaTabel('Pengguna').filter(function (r) { return String(r.username).toLowerCase() === u; })[0];
    // Hash tetap dihitung walau username tidak ada agar waktu respons tidak membocorkan username.
    var cocok = hashKata_(d.password || '', user ? user.salt : 'arsip-dummy-salt') === (user ? user.password_hash : 'x');
    if (!user || !cocok || String(user.aktif).toUpperCase() === 'TIDAK') {
      cache.put(kunciGagal, String(gagal + 1), 600);
      throw galat('Username atau password salah.');
    }
    cache.remove(kunciGagal);
    var token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
    var ingat = d.ingat === true || d.ingat === 'on' || d.ingat === 'YA';
    var sesi = { username: user.username, nama: user.nama, peran: user.peran,
      t: Date.now(), ingat: ingat,
      exp: Date.now() + (ingat ? CONFIG.INGAT_HARI * 86400000 : CONFIG.SESSION_SECONDS * 1000) };
    simpanSesi_(token, sesi);
    try { bersihkanSesi_(); } catch (e) {}
    catatLog({ nama: user.nama, username: user.username, peran: user.peran }, 'Masuk aplikasi' + (ingat ? ' (ingat perangkat ' + CONFIG.INGAT_HARI + ' hari)' : ''));
    return { token: token, user: { username: user.username, nama: user.nama, peran: user.peran } };
  });
}

function gantiPassword(user, d) {
  var me = bacaTabel('Pengguna').filter(function (r) { return String(r.username).toLowerCase() === String(user.username).toLowerCase(); })[0];
  if (!me || hashKata_(String(d.lama || ''), me.salt) !== me.password_hash) throw galat('Password lama salah.');
  if (String(d.baru || '').length < 8) throw galat('Password baru minimal 8 karakter.');
  var salt = Utilities.getUuid();
  denganKunci(function () {
    var sh = sheetTabel('Pengguna');
    var judul = judulKolom(sh);
    var ids = sh.getRange(1, judul.indexOf('username') + 1, sh.getLastRow(), 1).getValues();
    var baris = -1;
    for (var i = 1; i < ids.length; i++) {
      if (String(ids[i][0]).toLowerCase() === String(user.username).toLowerCase()) { baris = i + 1; break; }
    }
    if (baris < 0) throw galat('Akun tidak ditemukan.');
    sh.getRange(baris, judul.indexOf('salt') + 1).setValue(salt);
    sh.getRange(baris, judul.indexOf('password_hash') + 1).setValue(hashKata_(String(d.baru), salt));
    sh.getRange(baris, judul.indexOf('diubah') + 1).setValue(new Date().toISOString());
  });
  hapusCache('Pengguna');
  cabutSesi_(user.username); // sesi lain (perangkat lain / token bocor) ikut berakhir
  // sesi saat ini tetap aktif (plek SIPINTAR)
  simpanSesi_(user._token, { username: user.username, nama: user.nama, peran: user.peran, t: Date.now() + 1000, ingat: !!user.ingat, exp: Number(user.exp) || (Date.now() + CONFIG.SESSION_SECONDS * 1000) });
  catatLog(user, 'Ganti password');
  return { ok: true };
}

function hashKata_(pw, salt) {
  var h = String(salt) + String(pw);
  for (var i = 0; i < 300; i++) {
    h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h, Utilities.Charset.UTF_8)
      .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
  }
  return h;
}

function authUser(token) {
  if (!token) throw galat('Sesi berakhir. Silakan login kembali.');
  var sesi = bacaSesi_(token);
  if (!sesi) throw galat('Sesi berakhir. Silakan login kembali.');
  // Periksa ulang akun setiap permintaan: nonaktif / peran berubah / password diganti langsung berlaku.
  var u = akun_(sesi.username);
  var ver = Number(PropertiesService.getScriptProperties().getProperty('uver_' + String(sesi.username).toLowerCase()) || 0);
  if (!u || String(u.aktif).toUpperCase() === 'TIDAK' || ver > Number(sesi.t || 0)) {
    hapusSesi_(token);
    throw galat('Sesi berakhir. Silakan login kembali.');
  }
  sesi.peran = u.peran; sesi.nama = u.nama; sesi.ingat = sesi.ingat; sesi.exp = sesi.exp;
  return sesi;
}

function kunciSesi_(token) {
  return 'sesi_' + Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(token), Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('').slice(0, 40);
}
function simpanSesi_(token, sesi) {
  var sisa = Math.floor((Number(sesi.exp) - Date.now()) / 1000);
  if (sisa <= 0) return;
  CacheService.getScriptCache().put('sess_' + token, JSON.stringify(sesi), Math.min(CONFIG.SESSION_SECONDS, sisa));
  if (sesi.ingat) PropertiesService.getScriptProperties().setProperty(kunciSesi_(token), JSON.stringify(sesi));
}
function bacaSesi_(token) {
  var c = CacheService.getScriptCache().get('sess_' + token);
  if (c) return JSON.parse(c);
  var props = PropertiesService.getScriptProperties();
  var p = props.getProperty(kunciSesi_(token));
  if (!p) return null;
  var sesi = JSON.parse(p);
  if (Number(sesi.exp) <= Date.now()) { props.deleteProperty(kunciSesi_(token)); return null; }
  simpanSesi_(token, sesi);
  return sesi;
}
function hapusSesi_(token) {
  CacheService.getScriptCache().remove('sess_' + token);
  PropertiesService.getScriptProperties().deleteProperty(kunciSesi_(token));
}
function bersihkanSesi_() {
  var props = PropertiesService.getScriptProperties(), semua = props.getProperties(), now = Date.now();
  Object.keys(semua).forEach(function (k) {
    if (k.indexOf('sesi_') !== 0) return;
    try { if (Number(JSON.parse(semua[k]).exp) <= now) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); }
  });
}
function cabutSesi_(username) {
  lupakanAkun_(username);
  PropertiesService.getScriptProperties().setProperty('uver_' + String(username).toLowerCase(), String(Date.now()));
}

// Hanya Admin dan Ketua yang boleh mengelola akun.
function hanyaPengelola_(user) {
  if (['Admin', 'Ketua LSP'].indexOf(user.peran) < 0) throw galat('Hanya Admin atau Ketua LSP yang dapat mengelola akun.');
}

function daftarPengguna_(user) {
  hanyaPengelola_(user);
  // Baris contoh lama tanpa username disembunyikan (tanpa username tidak bisa login juga).
  return bacaTabel('Pengguna').filter(function (r) { return String(r.username || '').trim(); }).map(function (r) {
    return { username: r.username, nama: r.nama, peran: r.peran, aktif: r.aktif, bagian: r.bagian, email: r.email };
  });
}

// Manajemen pengguna ala SIPINTAR (saveUser): tambah + ubah (termasuk username,
// peran, nonaktif, dan password) dalam satu aksi. Hanya Admin dan Ketua.
function simpanPengguna_(user, d) {
  hanyaPengelola_(user);
  var un = String(d.username || '').trim().toLowerCase();
  if (!/^[a-z0-9._]{3,30}$/.test(un)) throw galat('Username 3–30 karakter: huruf kecil, angka, titik, garis bawah.');
  if (['Ketua LSP', 'Admin', 'Sekretariat', 'Administrasi', 'Bidang Sertifikasi', 'Manajemen Mutu', 'Bidang Skema'].indexOf(d.peran) < 0) throw galat('Peran tidak dikenal.');
  var hasil = null;
  denganKunci(function () {
    var semua = bacaTabel('Pengguna');
    var lama = String(d.lama || d.usernameLama || '').trim().toLowerCase() || un;
    var ada = semua.filter(function (r) { return String(r.username).toLowerCase() === lama; })[0];
    // Ganti username: pastikan nama baru belum dipakai orang lain.
    if (un !== lama && semua.some(function (r) { return String(r.username).toLowerCase() === un; })) {
      throw galat('Username "' + un + '" sudah dipakai.');
    }
    var patch = { username: un, nama: d.nama || un, peran: d.peran, aktif: d.aktif || 'YA', bagian: d.bagian || '', email: d.email || '' };
    if (d.password) {
      if (String(d.password).length < 8) throw galat('Password minimal 8 karakter.');
      patch.salt = Utilities.getUuid();
      patch.password_hash = hashKata_(String(d.password), patch.salt);
    }
    var sh = sheetTabel('Pengguna');
    var judul = judulKolom(sh);
    if (ada) {
      var ncol = sh.getRange(1, judul.indexOf('username') + 1, sh.getLastRow(), 1).getValues();
      for (var i = 1; i < ncol.length; i++) {
        if (String(ncol[i][0]).toLowerCase() === lama) {
          Object.keys(patch).forEach(function (k) {
            if (judul.indexOf(k) >= 0) sh.getRange(i + 1, judul.indexOf(k) + 1).setValue(patch[k]);
          });
          sh.getRange(i + 1, judul.indexOf('diubah') + 1).setValue(new Date().toISOString());
          break;
        }
      }
      if (d.password || (ada.peran !== patch.peran) || patch.aktif === 'TIDAK' || un !== lama) {
        cabutSesi_(lama);
        if (un !== lama) cabutSesi_(un);
      }
      hasil = { username: un, nama: patch.nama, peran: patch.peran, diubah: true };
      catatLog(user, 'Mengubah akun ' + lama + (un !== lama ? ' menjadi ' + un : '') + ' (' + patch.peran + (patch.aktif === 'TIDAK' ? ', nonaktif' : '') + (d.password ? ' · password diatur ulang' : '') + ')');
    } else {
      if (!d.password) throw galat('Password wajib untuk pengguna baru (min. 8 karakter).');
      var salt = patch.salt || Utilities.getUuid();
      var bersih = validasi('Pengguna', { username: un, nama: patch.nama, peran: patch.peran, salt: patch.salt ? patch.salt : salt, password_hash: patch.password_hash ? patch.password_hash : hashKata_(String(d.password), salt), aktif: patch.aktif, bagian: patch.bagian, email: patch.email }, false);
      bersih.id = Utilities.getUuid().replace(/-/g, '').slice(0, 10);
      bersih.dibuat = new Date().toISOString();
      bersih.diubah = '';
      sh.appendRow(judul.map(function (j) { return bersih[j] != null ? bersih[j] : ''; }));
      hasil = { username: un, nama: patch.nama, peran: patch.peran, dibuat: true };
      catatLog(user, 'Membuat akun ' + un + ' (' + patch.peran + ')');
    }
  });
  hapusCache('Pengguna');
  lupakanAkun_(un); lupakanAkun_(d.lama || d.usernameLama || un);
  return hasil;
}

// Hapus akun (hanya Admin/Ketua). Tidak boleh menghapus diri sendiri.
function hapusPengguna_(user, d) {
  hanyaPengelola_(user);
  var un = String(d.username || '').trim().toLowerCase();
  if (!un) throw galat('Username kosong.');
  if (un === String(user.username).toLowerCase()) throw galat('Tidak dapat menghapus akun sendiri yang sedang dipakai.');
  denganKunci(function () {
    var sh = sheetTabel('Pengguna');
    var judul = judulKolom(sh);
    var ncol = sh.getRange(1, judul.indexOf('username') + 1, sh.getLastRow(), 1).getValues();
    var baris = -1;
    for (var i = 1; i < ncol.length; i++) {
      if (String(ncol[i][0]).toLowerCase() === un) { baris = i + 1; break; }
    }
    if (baris < 0) throw galat('Akun "' + un + '" tidak ditemukan.');
    sh.deleteRow(baris);
  });
  hapusCache('Pengguna');
  cabutSesi_(un);
  catatLog(user, 'Menghapus akun ' + un);
  return { ok: true };
}

function aturSandi_(user, d) {
  hanyaPengelola_(user);
  var u = String(d.username || '').trim().toLowerCase();
  var pw = String(d.password || '');
  if (pw.length < 8) throw galat('Password minimal 8 karakter.');
  denganKunci(function () {
    var sh = sheetTabel('Pengguna');
    var judul = judulKolom(sh);
    var ncol = sh.getRange(1, judul.indexOf('username') + 1, sh.getLastRow(), 1).getValues();
    var baris = -1;
    for (var i = 1; i < ncol.length; i++) {
      if (String(ncol[i][0]).toLowerCase() === u) { baris = i + 1; break; }
    }
    if (baris < 0) throw galat('Akun "' + u + '" tidak ditemukan.');
    var salt = Utilities.getUuid();
    sh.getRange(baris, judul.indexOf('salt') + 1).setValue(salt);
    sh.getRange(baris, judul.indexOf('password_hash') + 1).setValue(hashKata_(pw, salt));
    sh.getRange(baris, judul.indexOf('diubah') + 1).setValue(new Date().toISOString());
  });
  cabutSesi_(u); // semua sesi akun itu langsung hangus
  catatLog(user, 'Mereset sandi akun ' + u);
  return { ok: true };
}

/** Akun admin pertama TANPA parameter (tinggal Run): password acak tampil di Log Eksekusi. */
function buatAdminPertama() {
  var pw = Utilities.getUuid().replace(/-/g, '').slice(0, 10) + 'A1';
  var hasil = buatAdminAwal('admin', pw, 'Admin Arsip');
  var pesan = 'Akun admin ' + hasil + '. Username: admin | Password: ' + pw + ' | Segera ganti setelah login via menu Pengguna.';
  Logger.log(pesan);
  console.log(pesan);
  return pesan;
}

/** Jalankan sekali dari editor untuk membuat akun admin pertama: buatAdminAwal('admin', 'Ganti-Sandi-Min-8', 'Nama Admin'). */
function buatAdminAwal(username, password, nama) {
  var u = String(username || '').trim().toLowerCase();
  if (!/^[a-z0-9._]{3,30}$/.test(u)) throw new Error('Username tidak valid.');
  if (String(password).length < 8) throw new Error('Password minimal 8 karakter.');
  var salt = Utilities.getUuid();
  var bersih = validasi('Pengguna', { username: u, nama: nama || u, peran: 'Admin', salt: salt, password_hash: hashKata_(password, salt), aktif: 'YA', bagian: '', email: '' }, false);
  var hasil = null;
  denganKunci(function () {
    var ada = bacaTabel('Pengguna').some(function (r) { return String(r.username).toLowerCase() === u; });
    var sh = sheetTabel('Pengguna');
    var judul = judulKolom(sh);
    if (ada) {
      var ncol = sh.getRange(1, judul.indexOf('username') + 1, sh.getLastRow(), 1).getValues();
      for (var i = 1; i < ncol.length; i++) {
        if (String(ncol[i][0]).toLowerCase() === u) {
          sh.getRange(i + 1, judul.indexOf('salt') + 1).setValue(salt);
          sh.getRange(i + 1, judul.indexOf('password_hash') + 1).setValue(bersih.password_hash);
          sh.getRange(i + 1, judul.indexOf('nama') + 1).setValue(nama || u);
          sh.getRange(i + 1, judul.indexOf('peran') + 1).setValue('Admin');
          sh.getRange(i + 1, judul.indexOf('aktif') + 1).setValue('YA');
          sh.getRange(i + 1, judul.indexOf('diubah') + 1).setValue(new Date().toISOString());
          break;
        }
      }
      hasil = 'diperbarui';
    } else {
      bersih.id = Utilities.getUuid().replace(/-/g, '').slice(0, 10);
      bersih.dibuat = new Date().toISOString();
      bersih.diubah = '';
      sh.appendRow(judul.map(function (j) { return bersih[j] != null ? bersih[j] : ''; }));
      hasil = 'dibuat';
    }
  });
  cabutSesi_(u);
  Logger.log('Akun ' + u + ' ' + hasil + '. Hapus fungsi ini tidak wajib; aman dibiarkan.');
  return hasil;
}
function denganKunciNilai(fn) {
  var kunci = LockService.getScriptLock();
  kunci.waitLock(10000);
  try { return fn(); } finally { kunci.releaseLock(); }
}


// ===================== Aksi =====================

function list(nama, opsi, isAdmin, user) {
  var kunciCache = 'list:' + nama;
  var cache = CacheService.getScriptCache();
  var baris;
  var simpan = !isAdmin && cache.get(kunciCache);
  if (simpan) {
    baris = JSON.parse(simpan);
  } else {
    baris = bacaTabel(nama).map(function (r) { return saring(nama, r, isAdmin); });
    if (!isAdmin) { try { cache.put(kunciCache, JSON.stringify(baris), DETIK_CACHE); } catch (e) {} }
  }
  if (user) baris = saringBaca_(user, nama, baris);
  if (nama === 'Pengguna') baris = baris.map(function (r) { var o = {}; Object.keys(r).forEach(function (k) { if (k !== 'salt' && k !== 'password_hash') o[k] = r[k]; }); return o; });

  if (opsi.cari) {
    var q = String(opsi.cari).toLowerCase();
    baris = baris.filter(function (r) {
      return Object.keys(r).some(function (k) { return String(r[k]).toLowerCase().indexOf(q) >= 0; });
    });
  }
  if (opsi.saring && typeof opsi.saring === 'object') {
    Object.keys(opsi.saring).forEach(function (k) {
      baris = baris.filter(function (r) { return String(r[k]) === String(opsi.saring[k]); });
    });
  }
  var urut = opsi.urut || 'dibuat';
  var turun = opsi.turun == null ? true : String(opsi.turun) !== 'false';
  baris.sort(function (a, b) {
    var x = a[urut], y = b[urut];
    if (x === y) return 0;
    return (x > y ? 1 : -1) * (turun ? -1 : 1);
  });

  var per = Math.min(Number(opsi.per) || MAKS_PER_HALAMAN, MAKS_PER_HALAMAN);
  var hal = Math.max(Number(opsi.halaman) || 1, 1);
  return { baris: baris.slice((hal - 1) * per, hal * per), total: baris.length, halaman: hal, per: per };
}

function ambil(nama, id, isAdmin) {
  var r = bacaTabel(nama).filter(function (x) { return String(x.id) === id; })[0];
  if (!r) throw galat('Data tidak ditemukan.');
  return saring(nama, r, isAdmin);
}

function tambah(nama, data, isAdmin) {
  if (data.situs) return null;
  if (!isAdmin) batasiKiriman();
  var bersih = validasi(nama, data, false);
  bersih.id = Utilities.getUuid().replace(/-/g, '').slice(0, 10);
  bersih.dibuat = new Date().toISOString();
  bersih.diubah = '';

  denganKunci(function () {
    var sh = sheetTabel(nama);
    var judul = judulKolom(sh);
    sh.appendRow(judul.map(function (j) { return bersih[j] != null ? bersih[j] : ''; }));
  });
  hapusCache(nama);
  delete BACA_MEMO[nama];
  return saring(nama, bersih, isAdmin);
}

function ubah(nama, id, data, isAdmin) {
  if (!id) throw galat('ID kosong.');
  var bersih = validasi(nama, data, true);
  bersih.diubah = new Date().toISOString();
  var hasil = {};
  denganKunci(function () {
    var sh = sheetTabel(nama);
    var judul = judulKolom(sh);
    var rentang = sh.getRange(cariBaris(sh, id), 1, 1, judul.length);
    var nilai = rentang.getValues()[0];
    judul.forEach(function (j, i) { if (bersih.hasOwnProperty(j)) nilai[i] = bersih[j]; });
    rentang.setValues([nilai]);
    judul.forEach(function (j, i) { hasil[j] = nilai[i] instanceof Date ? nilai[i].toISOString() : nilai[i]; });
  });
  hapusCache(nama);
  delete BACA_MEMO[nama];
  return saring(nama, hasil, isAdmin);
}

function hapus(nama, id) {
  if (!id) throw galat('ID kosong.');
  denganKunci(function () {
    var sh = sheetTabel(nama);
    sh.deleteRow(cariBaris(sh, id));
  });
  hapusCache(nama);
  delete BACA_MEMO[nama];
  return { id: id };
}


// ===================== Validasi & izin =====================

function validasi(nama, data, sebagian) {
  var t = SKEMA[nama], aturan = t.aturan || {}, bersih = {};
  t.kolom.forEach(function (k) {
    if (sebagian && !data.hasOwnProperty(k)) return;
    var a = aturan[k] || {};
    var v = data[k] == null ? '' : String(data[k]).trim();
    var salah = a.pesan || ('Isian "' + k + '" tidak valid.');
    if (a.wajib && !v) throw galat(salah);
    if (v) {
      if (v.length > (a.maks || 2000)) throw galat(salah);
      if (a.pola && !new RegExp(a.pola).test(v)) throw galat(salah);
      if (a.pilihan && a.pilihan.indexOf(v) < 0) throw galat(salah);
      if (a.jenis === 'angka' && isNaN(Number(v))) throw galat(salah);
      if (a.jenis === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw galat(salah);
      if (a.jenis === 'tanggal' && isNaN(new Date(v).getTime())) throw galat(salah);
    }
    bersih[k] = amankanSel(v);
  });
  return bersih;
}

function izinkan(tingkat, isAdmin) {
  if (tingkat === 'publik') return;
  if (tingkat === 'admin' && isAdmin) return;
  throw galat(tingkat === 'admin' ? 'Perlu masuk sebagai petugas.' : 'Aksi tidak diizinkan.');
}

function saring(nama, r, isAdmin) {
  if (isAdmin) return r;
  var o = { id: r.id, dibuat: r.dibuat };
  (SKEMA[nama].publik || []).forEach(function (k) { o[k] = r[k]; });
  return o;
}

function skemaPublik(isAdmin) {
  var hasil = {};
  Object.keys(SKEMA).forEach(function (n) {
    var t = SKEMA[n];
    hasil[n] = { kolom: isAdmin ? t.kolom : (t.publik || []), aturan: t.aturan || {}, izin: t.izin };
  });
  return { tabel: hasil, aksiKhusus: Object.keys(AKSI_KHUSUS) };
}

function batasiKiriman() {
  var cache = CacheService.getScriptCache();
  var k = 'kirim-' + Math.floor(Date.now() / 60000);
  var n = Number(cache.get(k) || 0) + 1;
  cache.put(k, String(n), 120);
  if (n > BATAS_KIRIM_PER_MENIT) throw galat('Server sedang sibuk. Coba lagi sebentar.');
}


// ===================== Spreadsheet =====================

function bacaTabel(nama) {
  if (BACA_MEMO[nama]) return BACA_MEMO[nama].slice();
  var nilai = sheetTabel(nama).getDataRange().getValues();
  var judul = (nilai.shift() || []).map(String);
  JUDUL_MEMO[nama] = judul;
  BACA_MEMO[nama] = nilai
    .filter(function (b) { return b.join('') !== ''; })
    .map(function (b) {
      var o = {};
      judul.forEach(function (j, i) { if (j) o[j] = b[i] instanceof Date ? b[i].toISOString() : b[i]; });
      return o;
    });
  return BACA_MEMO[nama].slice();
}

/** Ambil sheet tabel. Pemeriksaan struktur kolom hanya dijalankan bila SKEMA berubah (bukan tiap permintaan). */
function sheetTabel(nama) {
  if (SHEET_MEMO[nama]) return SHEET_MEMO[nama];
  pastikanVersiSkema_();
  var sh = ss_().getSheetByName(nama) || pastikanSkema_(nama);
  SHEET_MEMO[nama] = sh;
  return sh;
}
function versiSkema_() {
  var teks = Object.keys(SKEMA).map(function (n) { return n + ':' + SKEMA[n].kolom.join(','); }).join('|');
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, teks).map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}
function pastikanVersiSkema_() {
  if (VERSI_DICEK) return;
  VERSI_DICEK = true;
  var v = versiSkema_(), c = CacheService.getScriptCache();
  if (c.get('skema_v') === v) return;
  var p = PropertiesService.getScriptProperties();
  if (p.getProperty('skema_v') !== v) {
    Object.keys(SKEMA).forEach(function (n) { pastikanSkema_(n); });
    p.setProperty('skema_v', v);
  }
  c.put('skema_v', v, 21600);
}
/** Membuat/menyesuaikan tab + header satu tabel (dipakai siapkanSheet dan saat SKEMA berubah). */
function pastikanSkema_(nama) {
  var ss = ss_();
  var sh = ss.getSheetByName(nama) || ss.insertSheet(nama);
  delete JUDUL_MEMO[nama]; delete BACA_MEMO[nama];
  var perlu = ['id', 'dibuat', 'diubah'].concat(SKEMA[nama].kolom);
  if (sh.getLastRow() === 0) {
    sh.getRange('A:Z').setNumberFormat('@');
    sh.appendRow(perlu);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, perlu.length).setFontWeight('bold');
    return sh;
  }
  var ada = judulKolom(sh);
  var kurang = perlu.filter(function (k) { return ada.indexOf(k) < 0; });
  if (kurang.length) {
    var mulai = ada.length + 1;
    sh.getRange(1, mulai, 1, kurang.length).setValues([kurang]).setFontWeight('bold');
    sh.getRange(1, mulai, sh.getMaxRows(), kurang.length).setNumberFormat('@');
    if (kurang.indexOf('id') >= 0) isiIdKosong(sh);
    delete JUDUL_MEMO[nama];
  }
  return sh;
}

function isiIdKosong(sh) {
  var kol = judulKolom(sh).indexOf('id') + 1, n = sh.getLastRow() - 1;
  if (n < 1) return;
  var r = sh.getRange(2, kol, n, 1), v = r.getValues();
  v.forEach(function (b) { if (!b[0]) b[0] = Utilities.getUuid().replace(/-/g, '').slice(0, 10); });
  r.setValues(v);
}

function judulKolom(sh) {
  var key = sh.getName();
  if (JUDUL_MEMO[key]) return JUDUL_MEMO[key];
  var n = sh.getLastColumn();
  var j = n ? sh.getRange(1, 1, 1, n).getValues()[0].map(String) : [];
  JUDUL_MEMO[key] = j;
  return j;
}

function cariBaris(sh, id) {
  var kol = judulKolom(sh).indexOf('id') + 1;
  if (!kol) throw galat('Kolom id tidak ada.');
  var ids = sh.getRange(1, kol, sh.getLastRow(), 1).getValues();
  for (var i = 1; i < ids.length; i++) if (String(ids[i][0]) === id) return i + 1;
  throw galat('Data tidak ditemukan.');
}

function denganKunci(fn) {
  var kunci = LockService.getScriptLock();
  kunci.waitLock(10000);
  try { fn(); } finally { kunci.releaseLock(); }
}

/** Cari/buat folder Drive arsip + subfolder kategori. Dipanggil unggahBerkas & siapkanDrive. */
function folderArsip_(kat) {
  var root = DriveApp.getFoldersByName(CONFIG.FOLDER_NAMA);
  var utama = root.hasNext() ? root.next() : DriveApp.createFolder(CONFIG.FOLDER_NAMA);
  if (!kat) return utama;
  var sub = utama.getFoldersByName(kat);
  return sub.hasNext() ? sub.next() : utama.createFolder(kat);
}

/** Jalankan sekali dari editor: membuat folder Drive arsip + subfolder tiap kategori. */
function siapkanDrive() {
  var info = siapkanDrive_();
  Logger.log('Folder Drive: ' + info.url);
  return info;
}

function siapkanDrive_() {
  var url = folderArsip_('').getUrl();
  var kat = SKEMA.Dokumen.aturan.kat.pilihan || [];
  kat.forEach(function (k) { folderArsip_(k); });
  try { folderArsip_('Revisi'); } catch (e) {}
  return { url: url, kategori: kat };
}

function hapusCache(nama) { CacheService.getScriptCache().remove('list:' + nama); try { CacheService.getScriptCache().remove('dasbor'); } catch (e) {} }

/** Jalankan sekali dari editor: membuat/menyesuaikan semua tab dan memicu layar izin Google. */
function siapkanSheet() {
  Object.keys(SKEMA).forEach(function (n) { pastikanSkema_(n); });
  PropertiesService.getScriptProperties().setProperty('skema_v', versiSkema_());
  migrasiPengguna_();
  migrasiKop_();
  Logger.log('Siap: ' + Object.keys(SKEMA).join(', '));
}

/** Melengkapi tab Pengguna lama (tanpa kolom username): tambah kolom + isi username dari nama. */
function migrasiPengguna_() {
  var sh = sheetTabel('Pengguna');
  var judul = judulKolom(sh);
  var peta = { 'ketua lsp': 'ketua', 'admin arsip': 'admin', 'sekretariat': 'sekretariat', 'bidang sertifikasi': 'sertifikasi', 'manajemen mutu': 'mutu', 'bidang skema': 'skema', 'administrasi': 'administrasi' };
  var iu = judul.indexOf('username') + 1, ina = judul.indexOf('nama') + 1, iak = judul.indexOf('aktif') + 1;
  if (!iu || !ina) return 'Kolom username/nama tidak ada.';
  var n = sh.getLastRow(), isi = 0, pasangY = 0;
  if (n < 2) return 'Pengguna kosong.';
  var un = sh.getRange(2, iu, n - 1, 1).getValues(), nm = sh.getRange(2, ina, n - 1, 1).getValues(), ak = iak ? sh.getRange(2, iak, n - 1, 1).getValues() : [];
  for (var i = 0; i < un.length; i++) {
    if (!String(un[i][0] || '').trim()) {
      var u = peta[String(nm[i][0] || '').trim().toLowerCase()] || '';
      if (u) { sh.getRange(i + 2, iu).setValue(u); un[i][0] = u; isi++; }
    }
    if (iak && String(ak[i][0] || '').toUpperCase() === 'Y') { sh.getRange(i + 2, iak).setValue('YA'); pasangY++; }
  }
  var pesan = 'Migrasi Pengguna: ' + isi + ' username diisi, ' + pasangY + ' status Y→YA. Akun contoh belum bisa login sebelum diberi sandi via Reset sandi.';
  Logger.log(pesan);
  return pesan;
}

/** Melengkapi tab Kop: bila kosong, isi satu baris bawaan (nama ketua/NIP bisa diubah). */
function migrasiKop_() {
  var sh = sheetTabel('Kop');
  var judul = judulKolom(sh);
  if (sh.getLastRow() > 1) return 'Kop sudah ada.';
  var bawaan = { l1: 'LEMBAGA SERTIFIKASI PROFESI', l2: 'UNIVERSITAS NEGERI MEDAN', l3: 'Sertifikat Lisensi Nomor : BNSP-LSP-1928-ID', l4: 'Sekretariat: Gedung FT, Jl. Willem Iskandar Pasar V, Medan Estate, Medan, 20221', l5: 'Website : https://lsp.unimed.ac.id', kota: 'Medan', jabatan: 'Ketua LSP Universitas Negeri Medan', nama: 'Nama Ketua LSP', nip: 'NIP. 19xxxxxxxxxxxxxxxx' };
  var bar = ['kop1', new Date().toISOString(), '', ''];
  judul.slice(3).forEach(function () { bar.push(''); });
  sh.getRange('A:Z').setNumberFormat('@');
  // petakan kolom Kop ke baris baru
  var nilai = judul.map(function (j) {
    if (j === 'id') return 'kop1';
    if (j === 'dibuat') return new Date().toISOString();
    if (j === 'diubah') return '';
    return bawaan[j] != null ? bawaan[j] : '';
  });
  sh.appendRow(nilai);
  Logger.log('Kop bawaan dibuat di tab Kop.');
  return 'Kop bawaan dibuat.';
}

function amankanSel(v) { return /^[=+\-@]/.test(v) ? "'" + v : v; }

function galat(pesan) { var e = new Error(pesan); e.publik = true; return e; }

function balas(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
