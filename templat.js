/* Arsip Dokumen LSP UNIMED — templat dokumen berkop (demo frontend).
   Petugas mengisi formulir singkat; sistem menyusun dokumen lengkap dengan kop surat,
   nomor otomatis, dan blok tanda tangan. Hasil dapat dicetak atau disimpan sebagai PDF. */
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const parse = (s) => { const [y, m, d] = String(s || '').split('-').map(Number); return y ? { y, m, d, w: new Date(Date.UTC(y, m - 1, d)).getUTCDay() } : null; };
  const tglPanjang = (s) => { const p = parse(s); return p ? p.d + ' ' + BULAN[p.m - 1] + ' ' + p.y : '…'; };
  const hariTgl = (s) => { const p = parse(s); return p ? HARI[p.w] + ', ' + tglPanjang(s) : '…'; };
  const SAT = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
  const terbilang = (n) => {
    n = Math.floor(n);
    if (n < 12) return SAT[n];
    if (n < 20) return terbilang(n - 10) + ' belas';
    if (n < 100) return terbilang(n / 10) + ' puluh' + (n % 10 ? ' ' + terbilang(n % 10) : '');
    if (n < 200) return 'seratus' + (n > 100 ? ' ' + terbilang(n - 100) : '');
    if (n < 1000) return terbilang(n / 100) + ' ratus' + (n % 100 ? ' ' + terbilang(n % 100) : '');
    if (n < 2000) return 'seribu' + (n > 1000 ? ' ' + terbilang(n - 1000) : '');
    return terbilang(n / 1000) + ' ribu' + (n % 1000 ? ' ' + terbilang(n % 1000) : '');
  };
  const tglTerbilang = (s) => { const p = parse(s); return p ? `${HARI[p.w]} tanggal ${terbilang(p.d)} bulan ${BULAN[p.m - 1]} tahun ${terbilang(p.y)}` : '…'; };
  const lines = (s) => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
  const rows = (s) => lines(s).map(l => l.split('|').map(x => x.trim()));
  const ol = (arr, cls) => arr.length ? `<ol${cls ? ` class="${cls}"` : ''}>${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : '';
  const para = (s) => lines(s).map(x => `<p class="j">${esc(x)}</p>`).join('');
  const KE = ['KESATU', 'KEDUA', 'KETIGA', 'KEEMPAT', 'KELIMA', 'KEENAM', 'KETUJUH', 'KEDELAPAN', 'KESEMBILAN', 'KESEPULUH'];
  const ABJ = 'abcdefghijklmnopqrstuvwxyz';

  /* Kop & penandatangan bawaan — dapat diubah di menu Templat dokumen */
  const KOP = {
    l1: 'LEMBAGA SERTIFIKASI PROFESI',
    l2: 'UNIVERSITAS NEGERI MEDAN',
    l3: 'Sertifikat Lisensi Nomor : BNSP-LSP-1928-ID',
    l4: 'Sekretariat: Gedung FT, Jl. Willem Iskandar Pasar V, Medan Estate, Medan, 20221',
    l5: 'Website : https://lsp.unimed.ac.id',
    kota: 'Medan',
    jabatan: 'Ketua LSP Universitas Negeri Medan',
    nama: 'Nama Ketua LSP',
    nip: 'NIP. 19xxxxxxxxxxxxxxxx'
  };
  window.KOP = KOP;
  const img = (f) => new URL('../assets/img/' + f, location.href).href;
  const kop = () => `<div class="kop"><img class="kiri" src="${img('logo-lsp.png')}" alt=""><div><div class="l1">${esc(KOP.l1)}</div><div class="l2">${esc(KOP.l2)}</div><div class="l3">${esc(KOP.l3)}</div><div class="l4">${esc(KOP.l4)}</div><div class="l4">${esc(KOP.l5)}</div></div><img class="kanan" src="${img('logo-bnsp.png')}" alt=""></div>`;
  const ttd = (d, o) => { const kepala = (o && o.tanpaTanggal) ? '' : (o && o.atas ? esc(o.atas) + '<br>' : `${esc(KOP.kota)}, ${tglPanjang(d.tanggal)}<br>`); return `<div class="ttd"><div>${kepala}${esc(d.ttdJabatan)},<div class="sp"></div><b class="u">${esc(d.ttdNama)}</b><br>${esc(d.ttdNip)}</div></div>`; };
  const ttd2 = (a, b) => `<div class="ttd2">${[a, b].map(p => `<div>${esc(p[0])},<div class="sp"></div><b class="u">${esc(p[1])}</b>${p[2] ? '<br>' + esc(p[2]) : ''}</div>`).join('')}</div>`;
  const meta = (pairs) => `<table class="meta">${pairs.map(p => `<tr><td>${esc(p[0])}</td><td>:</td><td>${p[2] ? p[1] : esc(p[1])}</td></tr>`).join('')}</table>`;
  const judulTengah = (j, no) => `<div class="judul"><b class="u">${esc(j)}</b>${no ? `<div>Nomor: ${esc(no)}</div>` : ''}</div>`;

  const PENANDATANGAN = [
    { k: 'ttdJabatan', l: 'Jabatan penanda tangan', grp: 'Penanda tangan' },
    { k: 'ttdNama', l: 'Nama penanda tangan', half: 1 },
    { k: 'ttdNip', l: 'NIP / NIDN', half: 1 }
  ];

  /* ---------- Daftar templat ---------- */
  const TEMPLAT = [
    {
      id: 'undangan', nama: 'Surat undangan rapat', kode: 'UND', surat: true, kat: 'KOR',
      ket: 'Undangan rapat atau kegiatan, lengkap dengan hari, waktu, tempat, dan acara.',
      judul: (d) => d.perihal || 'Undangan rapat',
      fields: [
        { k: 'tanggal', l: 'Tanggal surat', t: 'date', half: 1 }, { k: 'lampiran', l: 'Lampiran', v: '-', half: 1 },
        { k: 'perihal', l: 'Perihal', v: 'Undangan Rapat Persiapan Penyaksian BNSP' },
        { k: 'kepada', l: 'Kepada Yth.', t: 'textarea', h: 'Satu tujuan per baris', v: 'Pengurus LSP Universitas Negeri Medan\nPara Asesor Kompetensi LSP UNIMED\nPengelola TUK di lingkungan UNIMED' },
        { k: 'pembuka', l: 'Kalimat pembuka', t: 'textarea', v: 'Sehubungan dengan rencana penyaksian (witness) uji kompetensi oleh Badan Nasional Sertifikasi Profesi (BNSP) pada 17 Oktober 2026, kami mengundang Bapak/Ibu untuk hadir pada rapat yang akan dilaksanakan pada:' },
        { k: 'tglAcara', l: 'Hari/tanggal rapat', t: 'date', v: '2026-10-14', half: 1, grp: 'Pelaksanaan' }, { k: 'waktu', l: 'Waktu', v: '09.00 WIB s.d. selesai', half: 1 },
        { k: 'tempat', l: 'Tempat', v: 'Ruang Rapat LSP UNIMED, Kampus FT UNIMED' },
        { k: 'acara', l: 'Acara', t: 'textarea', h: 'Satu butir per baris', v: 'Pemaparan kesiapan penyaksian BNSP\nPemeriksaan kelengkapan dokumen mutu dan rekaman asesmen\nPembagian tugas panitia uji kompetensi 17 Oktober 2026' },
        { k: 'penutup', l: 'Kalimat penutup', t: 'textarea', v: 'Mengingat pentingnya acara tersebut, kami mengharapkan kehadiran Bapak/Ibu tepat waktu. Atas perhatian dan kehadirannya, kami ucapkan terima kasih.' },
        ...PENANDATANGAN,
        { k: 'tembusan', l: 'Tembusan', t: 'textarea', h: 'Kosongkan bila tidak ada', v: 'Rektor Universitas Negeri Medan (sebagai laporan)' }
      ],
      isi: (d, no) => {
        const kp = lines(d.kepada);
        return `${kop()}<table class="meta head"><tr><td>Nomor</td><td>:</td><td>${esc(no)}</td><td class="r">${esc(KOP.kota)}, ${tglPanjang(d.tanggal)}</td></tr><tr><td>Lampiran</td><td>:</td><td colspan="2">${esc(d.lampiran || '-')}</td></tr><tr><td>Perihal</td><td>:</td><td colspan="2"><b>${esc(d.perihal)}</b></td></tr></table>
          <div class="kpd">Yth. ${kp.length > 1 ? ol(kp) : esc(kp[0] || '')}<div>di tempat</div></div>
          <p>Dengan hormat,</p>${para(d.pembuka)}
          <div class="ind">${meta([['Hari/tanggal', hariTgl(d.tglAcara)], ['Waktu', d.waktu], ['Tempat', d.tempat], ['Acara', lines(d.acara).length > 1 ? ol(lines(d.acara)) : esc(d.acara), 1]])}</div>
          ${para(d.penutup)}${ttd(d, { tanpaTanggal: true })}${lines(d.tembusan).length ? `<div class="tembusan">Tembusan:${ol(lines(d.tembusan))}</div>` : ''}`;
      }
    },
    {
      id: 'tugas', nama: 'Surat tugas', kode: 'ST', surat: true, kat: 'ASR',
      ket: 'Penugasan asesor, panitia, atau petugas, dengan daftar nama dan uraian tugas.',
      judul: (d) => 'Surat Tugas — ' + (d.keperluan || '').slice(0, 70),
      fields: [
        { k: 'tanggal', l: 'Tanggal surat', t: 'date' },
        { k: 'dasar', l: 'Dasar penugasan', t: 'textarea', h: 'Satu dasar per baris, boleh dikosongkan', v: 'Surat BNSP perihal Jadwal Penyaksian Uji Kompetensi LSP Universitas Negeri Medan\nKeputusan Ketua LSP UNIMED tentang Penugasan Asesor Kompetensi pada Uji Kompetensi Tanggal 17 Oktober 2026' },
        { k: 'petugas', l: 'Yang ditugaskan', t: 'textarea', r: 5, h: 'Format per baris: Nama | NIP/No. Reg. | Tugas', v: 'Ali Akbar Lubis | MET.000.000687 2023 | Asesor kompetensi\nTuti Sriwedari | MET.000.000989 2021 | Asesor kompetensi\nHanapi Hasan | MET.000.000689 2023 | Asesor kompetensi' },
        { k: 'keperluan', l: 'Untuk', t: 'textarea', v: 'Melaksanakan asesmen uji kompetensi skema Okupasi Web Developer yang disaksikan oleh BNSP' },
        { k: 'tglTugas', l: 'Hari/tanggal', t: 'date', v: '2026-10-17', half: 1, grp: 'Pelaksanaan' }, { k: 'waktu', l: 'Waktu', v: '08.00 WIB s.d. selesai', half: 1 },
        { k: 'tempat', l: 'Tempat', v: 'TUK Multimedia dan Pemrograman, Kampus UNIMED' },
        { k: 'penutup', l: 'Kalimat penutup', t: 'textarea', v: 'Demikian surat tugas ini dibuat untuk dilaksanakan dengan penuh tanggung jawab dan melaporkan hasilnya kepada Ketua LSP.' },
        ...PENANDATANGAN
      ],
      isi: (d, no) => {
        const ds = lines(d.dasar), pt = rows(d.petugas);
        return `${kop()}<div class="r" style="margin-bottom:6pt">${esc(KOP.kota)}, ${tglPanjang(d.tanggal)}</div>${judulTengah('SURAT TUGAS', no)}
          ${ds.length ? `<table class="meta"><tr><td>Dasar</td><td>:</td><td>${ds.length > 1 ? ol(ds) : esc(ds[0])}</td></tr></table>` : ''}
          <p>Ketua Lembaga Sertifikasi Profesi Universitas Negeri Medan menugaskan kepada:</p>
          <table class="tbl"><thead><tr><th style="width:8%">No.</th><th>Nama</th><th>NIP / No. Reg.</th><th>Tugas</th></tr></thead><tbody>${pt.map((r, i) => `<tr><td class="c">${i + 1}.</td><td>${esc(r[0])}</td><td>${esc(r[1] || '')}</td><td>${esc(r[2] || '')}</td></tr>`).join('')}</tbody></table>
          ${meta([['Untuk', d.keperluan], ['Hari/tanggal', hariTgl(d.tglTugas)], ['Waktu', d.waktu], ['Tempat', d.tempat]])}
          ${para(d.penutup)}${ttd(d, { tanpaTanggal: true })}`;
      }
    },
    {
      id: 'sk', nama: 'Surat keputusan (SK)', kode: 'SK', surat: true, kat: 'ASR',
      ket: 'Keputusan Ketua LSP dengan susunan menimbang, mengingat, memutuskan, dan lampiran.',
      judul: (d) => 'SK Ketua LSP tentang ' + (d.tentang || ''),
      fields: [
        { k: 'tanggal', l: 'Tanggal ditetapkan', t: 'date' },
        { k: 'tentang', l: 'Tentang', v: 'Penugasan Asesor Kompetensi pada Uji Kompetensi Tanggal 17 Oktober 2026' },
        { k: 'menimbang', l: 'Menimbang', t: 'textarea', r: 4, h: 'Satu pertimbangan per baris (a, b, c otomatis)', v: 'bahwa dalam rangka pelaksanaan uji kompetensi pada tanggal 17 Oktober 2026 perlu ditetapkan asesor kompetensi yang bertugas;\nbahwa nama-nama yang tercantum dalam lampiran keputusan ini memenuhi syarat dan memiliki sertifikat asesor yang masih berlaku;\nbahwa berdasarkan pertimbangan sebagaimana dimaksud pada huruf a dan huruf b, perlu menetapkan Keputusan Ketua LSP tentang Penugasan Asesor Kompetensi.' },
        { k: 'mengingat', l: 'Mengingat', t: 'textarea', r: 4, h: 'Satu dasar hukum per baris (1, 2, 3 otomatis)', v: 'Undang-Undang Nomor 13 Tahun 2003 tentang Ketenagakerjaan;\nPeraturan Pemerintah Nomor 10 Tahun 2018 tentang Badan Nasional Sertifikasi Profesi;\nKeputusan BNSP Nomor KEP.0650/BNSP/IV/2021 tentang Lisensi Lembaga Sertifikasi Profesi Universitas Negeri Medan.' },
        { k: 'diktum', l: 'Memutuskan (diktum)', t: 'textarea', r: 5, h: 'Satu diktum per baris (KESATU, KEDUA otomatis)', v: 'Menugaskan nama-nama sebagaimana tercantum dalam lampiran keputusan ini sebagai asesor kompetensi pada uji kompetensi tanggal 17 Oktober 2026.\nAsesor sebagaimana dimaksud pada diktum KESATU melaksanakan asesmen sesuai skema sertifikasi dan menjaga kerahasiaan materi uji.\nKeputusan ini berlaku sejak tanggal ditetapkan, dengan ketentuan apabila di kemudian hari terdapat kekeliruan akan diperbaiki sebagaimana mestinya.' },
        { k: 'lampiran', l: 'Lampiran (opsional)', t: 'textarea', r: 4, h: 'Format per baris: Nama | Keterangan. Kosongkan bila tanpa lampiran', v: 'Ali Akbar Lubis | Asesor skema Okupasi Web Developer\nTuti Sriwedari | Asesor skema Okupasi Web Developer\nHanapi Hasan | Asesor skema Kualifikasi IV Teknik Sepeda Motor' },
        ...PENANDATANGAN
      ],
      isi: (d, no) => {
        const T = String(d.tentang || '').toUpperCase(), lp = rows(d.lampiran);
        const ttdSk = `<div class="ttd"><div>Ditetapkan di ${esc(KOP.kota)}<br>pada tanggal ${tglPanjang(d.tanggal)}<br>${esc(d.ttdJabatan)},<div class="sp"></div><b class="u">${esc(d.ttdNama)}</b><br>${esc(d.ttdNip)}</div></div>`;
        return `${kop()}<div class="judul sk"><b>KEPUTUSAN KETUA LEMBAGA SERTIFIKASI PROFESI<br>UNIVERSITAS NEGERI MEDAN</b><div>NOMOR ${esc(no)}</div><div>TENTANG</div><b>${esc(T)}</b><div style="margin-top:10px">KETUA LEMBAGA SERTIFIKASI PROFESI UNIVERSITAS NEGERI MEDAN,</div></div>
          <table class="sk-t"><tr><td>Menimbang</td><td>:</td><td><ol class="abc">${lines(d.menimbang).map((x, i) => `<li><span>${ABJ[i]}.</span>${esc(x)}</li>`).join('')}</ol></td></tr>
          <tr><td>Mengingat</td><td>:</td><td>${ol(lines(d.mengingat))}</td></tr></table>
          <div class="c" style="margin:10px 0"><b>MEMUTUSKAN:</b></div>
          <table class="sk-t"><tr><td>Menetapkan</td><td>:</td><td><b>KEPUTUSAN KETUA LEMBAGA SERTIFIKASI PROFESI UNIVERSITAS NEGERI MEDAN TENTANG ${esc(T)}.</b></td></tr>
          ${lines(d.diktum).map((x, i) => `<tr><td>${KE[i] || ''}</td><td>:</td><td class="j">${esc(x)}</td></tr>`).join('')}</table>
          ${ttdSk}
          ${lp.length ? `<div class="pb"></div><table class="meta lamp"><tr><td>LAMPIRAN</td><td>:</td><td>KEPUTUSAN KETUA LSP UNIVERSITAS NEGERI MEDAN</td></tr><tr><td>NOMOR</td><td>:</td><td>${esc(no)}</td></tr><tr><td>TANGGAL</td><td>:</td><td>${tglPanjang(d.tanggal).toUpperCase()}</td></tr><tr><td>TENTANG</td><td>:</td><td>${esc(T)}</td></tr></table>
          <table class="tbl"><thead><tr><th style="width:8%">No.</th><th>Nama</th><th>Keterangan</th></tr></thead><tbody>${lp.map((r, i) => `<tr><td class="c">${i + 1}.</td><td>${esc(r[0])}</td><td>${esc(r[1] || '')}</td></tr>`).join('')}</tbody></table>${ttd(d, { atas: ' ' })}` : ''}`;
      }
    },
    {
      id: 'ba', nama: 'Berita acara', kode: 'BA', surat: false, kat: 'ASM',
      ket: 'Berita acara kegiatan dengan tanggal terbilang dan tanda tangan dua pihak.',
      judul: (d) => 'Berita Acara ' + (d.kegiatan || ''),
      fields: [
        { k: 'tanggal', l: 'Tanggal kegiatan', t: 'date', v: '2026-10-17' },
        { k: 'kegiatan', l: 'Kegiatan', v: 'Uji Kompetensi Skema Okupasi Web Developer' },
        { k: 'tempat', l: 'Tempat', v: 'TUK Multimedia dan Pemrograman, Kampus UNIMED' },
        { k: 'uraian', l: 'Uraian / hasil', t: 'textarea', r: 6, h: 'Satu butir per baris', v: 'Jumlah asesi terdaftar: 10 orang.\nJumlah asesi hadir: 10 orang.\nAsesor yang bertugas: Ali Akbar Lubis dan Tuti Sriwedari.\nRekomendasi asesor: 9 orang kompeten (K) dan 1 orang belum kompeten (BK).\nPelaksanaan berlangsung tertib sesuai jadwal dan disaksikan oleh perwakilan BNSP.' },
        { k: 'p1Jabatan', l: 'Pihak 1 — jabatan', v: 'Asesor Kompetensi', grp: 'Penanda tangan' }, { k: 'p1Nama', l: 'Pihak 1 — nama', v: 'Ali Akbar Lubis', half: 1 }, { k: 'p1Nip', l: 'Pihak 1 — NIP/No. Reg.', v: 'MET.000.000687 2023', half: 1 },
        { k: 'p2Jabatan', l: 'Pihak 2 — jabatan', v: 'Ketua LSP Universitas Negeri Medan' }, { k: 'p2Nama', l: 'Pihak 2 — nama', v: '', half: 1 }, { k: 'p2Nip', l: 'Pihak 2 — NIP', v: '', half: 1 }
      ],
      isi: (d, no) => `${kop()}${judulTengah('BERITA ACARA ' + String(d.kegiatan || '').toUpperCase(), no)}
        <p class="j">Pada hari ini ${tglTerbilang(d.tanggal)} (${tglPanjang(d.tanggal)}), bertempat di ${esc(d.tempat)}, telah dilaksanakan ${esc(d.kegiatan)} dengan rincian sebagai berikut:</p>
        ${ol(lines(d.uraian))}
        <p class="j">Demikian berita acara ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.</p>
        <div class="c" style="margin-top:14px">${esc(KOP.kota)}, ${tglPanjang(d.tanggal)}</div>
        ${ttd2([d.p1Jabatan, d.p1Nama, d.p1Nip], [d.p2Jabatan, d.p2Nama || KOP.nama, d.p2Nip || KOP.nip])}`
    },
    {
      id: 'hadir', nama: 'Daftar hadir', kode: 'DH', surat: false, kat: 'MNJ',
      ket: 'Daftar hadir rapat atau kegiatan dengan kolom tanda tangan berselang.',
      judul: (d) => 'Daftar Hadir ' + (d.kegiatan || ''),
      fields: [
        { k: 'kegiatan', l: 'Kegiatan', v: 'Rapat Persiapan Penyaksian BNSP' },
        { k: 'tanggal', l: 'Hari/tanggal', t: 'date', v: '2026-10-14', half: 1 }, { k: 'waktu', l: 'Waktu', v: '09.00 WIB s.d. selesai', half: 1 },
        { k: 'tempat', l: 'Tempat', v: 'Ruang Rapat LSP UNIMED, Kampus FT UNIMED' },
        { k: 'peserta', l: 'Nama peserta (opsional)', t: 'textarea', r: 5, h: 'Format per baris: Nama | Jabatan/Unsur. Kosongkan untuk baris kosong', v: 'Ali Akbar Lubis | Asesor\nTuti Sriwedari | Asesor\nHanapi Hasan | Asesor' },
        { k: 'baris', l: 'Jumlah baris', t: 'number', v: '15', half: 1 },
        ...PENANDATANGAN
      ],
      isi: (d) => {
        const ps = rows(d.peserta), n = Math.max(ps.length, Math.min(60, +d.baris || 0));
        const tr = Array.from({ length: n }, (_, i) => { const r = ps[i] || []; const no = i + 1; return `<tr><td class="c">${no}.</td><td>${esc(r[0] || '')}</td><td>${esc(r[1] || '')}</td><td class="sig">${no % 2 ? no + '.' : ''}</td><td class="sig">${no % 2 ? '' : no + '.'}</td></tr>`; }).join('');
        return `${kop()}${judulTengah('DAFTAR HADIR')}${meta([['Kegiatan', d.kegiatan], ['Hari/tanggal', hariTgl(d.tanggal)], ['Waktu', d.waktu], ['Tempat', d.tempat]])}
          <table class="tbl hadir"><thead><tr><th style="width:7%">No.</th><th style="width:33%">Nama</th><th style="width:24%">Jabatan/Unsur</th><th colspan="2">Tanda tangan</th></tr></thead><tbody>${tr}</tbody></table>${ttd(d, { atas: 'Mengetahui,' })}`;
      }
    },
    {
      id: 'notulen', nama: 'Notulen rapat', kode: 'NOT', surat: false, kat: 'MNJ',
      ket: 'Notulen dengan agenda, pokok pembahasan, dan tabel keputusan serta tindak lanjut.',
      judul: (d) => 'Notulen ' + (d.rapat || ''),
      fields: [
        { k: 'rapat', l: 'Nama rapat', v: 'Rapat Persiapan Penyaksian BNSP' },
        { k: 'tanggal', l: 'Hari/tanggal', t: 'date', v: '2026-10-14', half: 1 }, { k: 'waktu', l: 'Waktu', v: '09.00–11.30 WIB', half: 1 },
        { k: 'tempat', l: 'Tempat', v: 'Ruang Rapat LSP UNIMED, Kampus FT UNIMED' },
        { k: 'pimpinan', l: 'Pimpinan rapat', v: 'Ketua LSP UNIMED', half: 1 }, { k: 'notulis', l: 'Notulis', v: 'Sekretariat LSP', half: 1 },
        { k: 'peserta', l: 'Peserta', v: 'Sesuai daftar hadir terlampir' },
        { k: 'agenda', l: 'Agenda', t: 'textarea', h: 'Satu butir per baris', v: 'Kesiapan dokumen mutu dan rekaman asesmen\nKesiapan TUK dan peralatan\nPembagian tugas panitia' },
        { k: 'bahas', l: 'Pokok pembahasan', t: 'textarea', r: 5, h: 'Satu butir per baris', v: 'Daftar induk dokumen sudah diperbarui (revisi 9); empat MUK masih berstatus draf.\nTUK Multimedia dan Pemrograman telah diverifikasi pada 12 September 2026.\nBukti proses perpanjangan lisensi BNSP perlu dilampirkan pada berkas penyaksian.' },
        { k: 'putus', l: 'Keputusan dan tindak lanjut', t: 'textarea', r: 4, h: 'Format per baris: Keputusan | Penanggung jawab | Batas waktu', v: 'Mengesahkan empat MUK yang masih draf | Bidang Skema | 15 Oktober 2026\nMelampirkan bukti perpanjangan lisensi | Sekretariat | 15 Oktober 2026\nGladi pelaksanaan uji kompetensi | Bidang Sertifikasi | 16 Oktober 2026' },
        { k: 'pimNama', l: 'Nama pimpinan rapat', v: '', grp: 'Penanda tangan', half: 1 }, { k: 'notNama', l: 'Nama notulis', v: '', half: 1 }
      ],
      isi: (d) => `${kop()}${judulTengah('NOTULEN RAPAT')}
        ${meta([['Rapat', d.rapat], ['Hari/tanggal', hariTgl(d.tanggal)], ['Waktu', d.waktu], ['Tempat', d.tempat], ['Pimpinan rapat', d.pimpinan], ['Notulis', d.notulis], ['Peserta', d.peserta]])}
        <h4>A. Agenda</h4>${ol(lines(d.agenda))}
        <h4>B. Pokok pembahasan</h4>${ol(lines(d.bahas))}
        <h4>C. Keputusan dan tindak lanjut</h4>
        <table class="tbl"><thead><tr><th style="width:7%">No.</th><th>Keputusan</th><th style="width:24%">Penanggung jawab</th><th style="width:20%">Batas waktu</th></tr></thead><tbody>${rows(d.putus).map((r, i) => `<tr><td class="c">${i + 1}.</td><td>${esc(r[0])}</td><td>${esc(r[1] || '')}</td><td>${esc(r[2] || '')}</td></tr>`).join('')}</tbody></table>
        <div class="c" style="margin-top:14px">${esc(KOP.kota)}, ${tglPanjang(d.tanggal)}</div>
        ${ttd2(['Pimpinan rapat', d.pimNama || KOP.nama, ''], ['Notulis', d.notNama || '……………………', ''])}`
    }
  ];
  window.TEMPLAT = TEMPLAT;

  /* Nilai bawaan sebuah templat, ditimpa oleh data yang tersimpan */
  const bawaan = (t, hariIni) => {
    const o = {};
    t.fields.forEach(f => { o[f.k] = f.v != null ? f.v : (f.t === 'date' ? hariIni : ''); });
    if ('ttdNama' in o) { o.ttdJabatan = KOP.jabatan; o.ttdNama = KOP.nama; o.ttdNip = KOP.nip; }
    return o;
  };
  window.susunDokumen = (id, data, nomor, hariIni) => {
    const t = TEMPLAT.find(x => x.id === id); if (!t) return '';
    const d = Object.assign(bawaan(t, hariIni), data || {});
    return t.isi(d, nomor);
  };

  /* Lembar disposisi surat masuk */
  window.lembarDisposisi = (s, bagian) => `${kop()}${judulTengah('LEMBAR DISPOSISI')}
    <table class="tbl disp"><tbody>
      <tr><td style="width:50%">Surat dari: <b>${esc(s.asal)}</b></td><td>Diterima tanggal: <b>${tglPanjang(s.terima)}</b></td></tr>
      <tr><td>Nomor surat: <b>${esc(s.nomor)}</b></td><td>Nomor agenda: <b>${esc(s.agenda)}</b></td></tr>
      <tr><td>Tanggal surat: <b>${tglPanjang(s.tglSurat)}</b></td><td>Sifat: ${['Biasa', 'Segera', 'Sangat segera', 'Rahasia'].map(x => `${x === s.sifat ? '■' : '□'} ${x}`).join(' &nbsp; ')}</td></tr>
      <tr><td colspan="2">Perihal: <b>${esc(s.perihal)}</b></td></tr>
      <tr><td><b>Diteruskan kepada:</b><br>${bagian.map(b => `${(s.disp || []).some(x => x.ke.includes(b)) ? '■' : '□'} ${esc(b)}`).join('<br>')}</td>
          <td><b>Instruksi:</b><br>${['Tindak lanjuti', 'Pelajari dan beri saran', 'Siapkan jawaban', 'Hadiri / wakili', 'Untuk diketahui', 'Arsipkan'].map(x => `${(s.disp || []).some(y => y.instruksi === x) ? '■' : '□'} ${x}`).join('<br>')}</td></tr>
      <tr><td colspan="2" style="height:90px"><b>Catatan:</b><br>${(s.disp || []).map(x => esc(x.catatan) + (x.batas ? ` (batas ${tglPanjang(x.batas)})` : '')).join('<br>')}</td></tr>
    </tbody></table>
    <div class="ttd"><div>${esc(KOP.kota)}, ${tglPanjang((s.disp && s.disp[0] && s.disp[0].tgl) || s.terima)}<br>${esc(KOP.jabatan)},<div class="sp"></div><b class="u">${esc(KOP.nama)}</b><br>${esc(KOP.nip)}</div></div>`;

  /* ---------- Gaya kertas (pratinjau & cetak) ---------- */
  const DOC_CSS = `
  .kertas{box-sizing:border-box;width:210mm;min-height:297mm;padding:12mm 20mm 20mm 25mm;background:#fff;color:#000;font-family:"Times New Roman",Times,serif;font-size:12pt;line-height:1.45;font-style:normal;text-align:left}
  .kertas *{color:#000!important;font-style:normal!important}
  .kertas table{font-size:inherit;width:auto}.kertas th,.kertas td{border:0;padding:0;background:none;font-size:inherit;color:#000;white-space:normal}.kertas tbody tr{cursor:default}.kertas tbody tr:hover{background:none}
  .kertas p{margin:0 0 8pt}.kertas .j{text-align:justify}.kertas .c{text-align:center}.kertas .r{text-align:right;white-space:nowrap}
  .kertas .u{text-decoration:underline}.kertas h4{font-size:12pt;margin:12pt 0 4pt}
  .kertas ol{margin:0 0 8pt;padding-left:18pt}.kertas li{margin:0 0 2pt;text-align:justify}
  .kertas .kop{display:grid;grid-template-columns:22mm 1fr 34mm;gap:4mm;align-items:center;text-align:center;border-bottom:1.5pt solid #000;padding-bottom:1.5mm;margin-bottom:5mm}
  .kertas .kop>div{min-width:0}
  .kertas .kop img{width:21mm;height:21mm;object-fit:contain}
  .kertas .kop img.kanan{width:32mm;height:16mm}
  .kertas .kop .l1{font-size:13pt;font-weight:bold;line-height:1.25;white-space:nowrap}.kertas .kop .l2{font-size:13pt;font-weight:bold;line-height:1.25;white-space:nowrap}.kertas .kop .l3{font-size:10.5pt;font-weight:bold;line-height:1.3;white-space:nowrap}.kertas .kop .l4{font-size:8.5pt;line-height:1.25;white-space:nowrap}
  .kertas table{border-collapse:collapse}
  .kertas .meta{margin:0 0 8pt}.kertas .meta td{padding:0 4pt 1pt 0;vertical-align:top}.kertas .meta td:first-child{white-space:nowrap;min-width:28mm}.kertas .meta td:nth-child(2){width:8pt}
  .kertas .meta ol{margin:0;padding-left:14pt}
  .kertas .meta.head{width:100%;margin-bottom:12pt}.kertas .tbl{width:100%}
  .kertas .ind{padding-left:12mm}
  .kertas .kpd{margin:0 0 12pt}.kertas .kpd ol{margin:0;padding-left:16pt}
  .kertas .judul{text-align:center;margin:0 0 12pt}
  .kertas .judul.sk{line-height:1.5}
  .kertas .tbl{width:100%;margin:4pt 0 10pt}.kertas .tbl th,.kertas .tbl td{border:1px solid #000;padding:3pt 5pt;vertical-align:top;font-size:11.5pt}.kertas .tbl th{text-align:center;font-weight:bold}
  .kertas .hadir td{height:9mm;vertical-align:middle}.kertas .hadir .sig{width:18%;font-size:9pt;vertical-align:top}
  .kertas .disp td{height:auto}
  .kertas .sk-t{width:100%;margin:0 0 6pt}.kertas .sk-t td{vertical-align:top;padding:0 4pt 4pt 0}.kertas .sk-t td:first-child{width:28mm;white-space:nowrap}.kertas .sk-t td:nth-child(2){width:8pt}
  .kertas .abc{list-style:none;padding:0}.kertas .abc li{display:grid;grid-template-columns:14pt 1fr}
  .kertas .ttd{display:flex;justify-content:flex-end;margin:16pt 0 10pt;break-inside:avoid}.kertas .ttd>div{width:78mm}
  .kertas .ttd2{display:grid;grid-template-columns:1fr 1fr;gap:12mm;margin:10pt 0;text-align:center;break-inside:avoid}
  .kertas .sp{height:22mm}
  .kertas .tembusan{font-size:11pt;margin-top:10pt}.kertas .tembusan ol{padding-left:16pt}
  .kertas .lamp{margin:0 0 12pt auto;font-size:11pt}
  .kertas .pb{break-before:page;height:0;border-top:1px dashed #9aa;margin:14mm -20mm 10mm -25mm}
  @media print{.kertas .pb{border:0;margin:0}}`;
  const st = document.createElement('style'); st.textContent = DOC_CSS; document.head.appendChild(st);

  /* Cetak / simpan PDF lewat iframe tersembunyi (tanpa jendela pop-up) */
  window.cetakDokumen = (html, judul) => {
    const fr = document.createElement('iframe');
    fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(fr);
    const w = fr.contentWindow;
    w.document.open();
    w.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(judul || 'Dokumen')}</title><style>${DOC_CSS}
      @page{size:A4;margin:12mm 20mm 18mm 25mm}html,body{margin:0;background:#fff}
      @media print{.kertas{width:auto;min-height:0;padding:0}}</style></head><body><div class="kertas">${html}</div></body></html>`);
    w.document.close();
    const go = () => { try { w.focus(); w.print(); } catch (e) { /* abaikan */ } setTimeout(() => fr.remove(), 60000); };
    const imgs = Array.from(w.document.images);
    Promise.all(imgs.map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))).then(() => setTimeout(go, 50));
  };

  /* ---------- Editor templat: formulir + pratinjau A4 langsung ---------- */
  window.bukaTemplat = (id, API, ada) => {
    const t = TEMPLAT.find(x => x.id === id); if (!t) return;
    ada = ada || null;
    const data = Object.assign(bawaan(t, API.hariIni), ada ? ada.data : {});
    let kat = ada ? ada.kat : t.kat;
    const kodeJenis = () => t.kode || 'DOK';
    const saran = () => (t.surat ? API.saranSurat(t.kode, data.tanggal || API.hariIni) : API.saranSurat(t.kode, data.tanggal || API.hariIni));
    const nomor = () => ada ? ada.nomor : (data._nomor || '').trim();
    const riwayatNo = () => (!ada && API.nomorTerakhir) ? API.nomorTerakhir(5) : [];

    // susun field: pasangan "half" digabung dalam satu baris
    let html = '', buf = [];
    const flush = () => { if (buf.length) { html += `<div class="row2">${buf.join('')}</div>`; buf = []; } };
    t.fields.forEach(f => {
      if (f.grp) { flush(); html += `<div class="ed-grp">${esc(f.grp)}</div>`; }
      const v = data[f.k] == null ? '' : data[f.k];
      const lab = `${esc(f.l)}${f.h ? `<small>${esc(f.h)}</small>` : ''}`;
      const el = f.t === 'textarea'
        ? `<label class="f">${lab}<textarea name="${f.k}" rows="${f.r || 3}">${esc(v)}</textarea></label>`
        : `<label class="f">${lab}<input name="${f.k}" type="${f.t || 'text'}" value="${esc(v)}"${f.t === 'number' ? ' min="0" max="60"' : ''}></label>`;
      if (f.half) { buf.push(el); if (buf.length === 2) flush(); } else { flush(); html += el; }
    });
    flush();

    document.body.insertAdjacentHTML('beforeend', `<div class="editor" role="dialog" aria-modal="true" aria-label="${esc(t.nama)}">
      <div class="ed-top"><div><span class="muted" style="font-size:.8rem">${ada ? 'Ubah draf' : 'Buat dari templat'}</span><h2>${esc(t.nama)}</h2></div>
        <div class="ed-act"><button class="btn ghost" data-x>Batal</button><button class="btn ghost" data-print>Cetak / PDF</button><button class="btn ghost" data-save="Draf">Simpan draf</button>${t.surat ? '<button class="btn" data-save="Diajukan">Ajukan pengesahan</button>' : '<button class="btn" data-save="Berlaku">Simpan & arsipkan</button>'}</div></div>
      <div class="ed-tabs"><button class="on" data-tab="f">Isi formulir</button><button data-tab="p">Pratinjau</button></div>
      <div class="ed-body"><form class="ed-form form" autocomplete="off">
        ${!ada ? `<label class="f">Nomor dokumen (ketik manual sesuai buku agenda)<input name="_nomor" value="${esc(data._nomor || saran())}" placeholder="mis. 075/LSP-UNIMED/${esc(kodeJenis())}/X/2026"><small>Saran urutan berikutnya: ${esc(saran())}. Nomor terakhir: ${(riwayatNo().map(esc).join(', ') || '—')}. Lihat tab Pedoman penomoran untuk kode jenis.</small></label>` : `<div class="nobox"><span>Nomor dokumen (sudah dikunci)</span><b id="edNo"></b><small>Nomor sudah dikunci.</small></div>`}
        <label class="f">Simpan di kategori<select name="_kat">${API.KAT.map(k => `<option value="${k[0]}"${k[0] === kat ? ' selected' : ''}>${esc(k[1])}</option>`).join('')}</select></label>
        ${html}
      </form><div class="ed-prev"><div class="skala"><div class="kertas" id="edKertas"></div></div></div></div></div>`);

    const ed = document.querySelector('.editor'), f = ed.querySelector('form'), K = ed.querySelector('#edKertas'), sk = ed.querySelector('.skala'), pv = ed.querySelector('.ed-prev');
    document.body.classList.add('ed-open');
    const baca = () => { t.fields.forEach(x => { if (f[x.k]) data[x.k] = f[x.k].value; }); if (f._nomor) data._nomor = f._nomor.value; kat = f._kat.value; };
    const skala = () => {
      if (pv.clientWidth < 60) return;
      const s = Math.min(1, (pv.clientWidth - 24) / K.offsetWidth);
      K.style.transform = `scale(${s})`; sk.style.width = K.offsetWidth * s + 'px'; sk.style.height = K.offsetHeight * s + 'px';
    };
    const gambar = () => { baca(); const no = nomor(); const slot = ed.querySelector('#edNo'); if (slot) slot.textContent = no; K.innerHTML = t.isi(data, no || saran()); skala(); };
    let tm; f.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(gambar, 120); });
    f.addEventListener('change', gambar);
    const ro = new ResizeObserver(skala); ro.observe(pv);
    gambar(); setTimeout(skala, 300);

    const tutup = () => { ro.disconnect(); ed.remove(); document.body.classList.remove('ed-open'); };
    ed.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-tab]');
      if (tab) { ed.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b === tab)); ed.classList.toggle('show-prev', tab.dataset.tab === 'p'); setTimeout(skala, 0); return; }
      if (e.target.closest('[data-x]')) { tutup(); return; }
      if (e.target.closest('[data-print]')) { gambar(); window.cetakDokumen(K.innerHTML, t.judul(data)); return; }
      const sv = e.target.closest('[data-save]');
      if (sv) {
        gambar();
        const no = nomor();
        if (!ada && !no) { alert('Isi nomor dokumen dulu (lihat Pedoman penomoran).'); return; }
        if (!ada && API.nomorDipakai && API.nomorDipakai(no)) { alert('Nomor ' + no + ' sudah dipakai. Ganti dengan nomor lain.'); return; }
        tutup();
        API.simpan({ id: ada && ada.id, kat, judul: t.judul(data), nomor: no, surat: t.surat, jenis: t.nama, alur: sv.dataset.save, tanggal: data.tanggal, tpl: { id: t.id, data: Object.assign({}, data) } });
      }
    });
    const esc_ = (e) => { if (e.key === 'Escape' && document.body.contains(ed)) { tutup(); document.removeEventListener('keydown', esc_); } };
    document.addEventListener('keydown', esc_);
  };
})();
