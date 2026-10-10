/* Arsip LSP UNIMED — Templat kustom (Kelola Templat).
   Templat bawaan di templat.js TIDAK disentuh. File ini menambah:
   - window.TEMPLAT_KUSTOM : daftar templat buatan petugas (dari sheet TemplatKustom)
   - window.muatTemplatKustom(api) : muat dari backend
   - window.tplKustomRender(kc, data, nomor) : susun HTML dokumen (kop otomatis ikut sheet)
   - window.bukaTemplatKustom(id, API, ada) : isi formulir + pratinjau + simpan
   - window.bukaKelolaTemplat(API) : daftar + editor blok + hapus
   Blok yang didukung: nomor (tengah/kiri + lampiran/perihal/kepada), judul,
   narasi, daftar bernomor, tabel (tambah baris/kolom), tanda tangan
   (kanan/tengah/kiri-kanan), tembusan, lampiran (paragraf + tabel + tanda tangan). */
(function () {
  'use strict';
  var H = function () { return window._tplHelp || {}; };
  var esc = function (s) { var h = H(); return h.esc ? h.esc(s) : String(s == null ? '' : s); };

  window.TEMPLAT_KUSTOM = window.TEMPLAT_KUSTOM || [];

  function defDefault() {
    return {
      nomorPosisi: 'kiri', pakaiLampiran: true, pakaiPerihal: true, pakaiKepada: false,
      judulTeks: 'Judul Dokumen', tanggalLetak: 'bawah',
      blocks: [
        { jenis: 'narasi', label: 'Pembuka', isi: 'Dengan hormat,\nTulis paragraf pembuka di sini.' },
        { jenis: 'daftar', label: 'Acara / Uraian', gaya: 'nomor', isi: 'Butir pertama\nButir kedua\nButir ketiga' }
      ],
      pakaiTabel: false, tabelLabel: 'Daftar nama', kolom: ['Nama', 'Keterangan'], contoh: [['', '']],
      ttdModel: 'kanan', kiriJabatan: '', kiriNama: '', kiriNip: '',
      pakaiTembusan: false, tembusanIsi: '',
      pakaiLampiran2: false, lampJudul: 'Lampiran', lampParagraf: '',
      lampKolom: ['No.', 'Uraian'], lampContoh: [['1', '']],
      lampTtd: 'kanan'
    };
  }

  function normDef(raw) {
    var d = defDefault();
    if (!raw) return d;
    var o = raw;
    if (typeof o === 'string') { try { o = JSON.parse(o); } catch (e) { return d; } }
    if (o && typeof o === 'object') {
      Object.keys(o).forEach(function (k) { d[k] = o[k]; });
    }
    if (!Array.isArray(d.blocks)) d.blocks = [];
    if (!Array.isArray(d.kolom) || !d.kolom.length) d.kolom = ['Nama', 'Keterangan'];
    if (!Array.isArray(d.contoh)) d.contoh = [['', '']];
    if (!Array.isArray(d.lampKolom) || !d.lampKolom.length) d.lampKolom = ['Uraian'];
    if (!Array.isArray(d.lampContoh)) d.lampContoh = [['1', '']];
    return d;
  }
  window.tplKustomNorm = normDef;

  /* Muat dari backend: api('list',{tabel:'TemplatKustom'}) -> baris {id,tpl_id,nama,...} */
  window.muatTemplatKustom = async function (apiFn) {
    var r = null;
    try { r = await apiFn('list', { tabel: 'TemplatKustom', opsi: { per: 200 } }); }
    catch (e) { return window.TEMPLAT_KUSTOM; }
    var arr = (r && r.baris) || [];
    window.TEMPLAT_KUSTOM = arr.map(function (x) {
      return {
        _rid: x.id, id: x.tpl_id || x.id,
        nama: x.nama || 'Templat kustom', kode: x.kode || 'DOK',
        kat: x.kat || 'KOR', ket: x.ket || 'Templat buatan petugas.',
        surat: String(x.surat || '').toUpperCase() === 'Y',
        def: normDef(x.definisi)
      };
    });
    return window.TEMPLAT_KUSTOM;
  };

  function barisKeTeks(rows) {
    return (rows || []).map(function (r) { return (r || []).join(' | '); }).join('\n');
  }
  function teksKeBaris(txt, nkol) {
    var out = String(txt || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean)
      .map(function (l) { return l.split('|').map(function (c) { return c.trim(); }); });
    return out.map(function (r) { while (r.length < nkol) r.push(''); return r.slice(0, nkol); });
  }

  function kustomJudul(kc, data) {
    var p = (data && (data.perihal || data.judulIsi)) || '';
    return p ? p.slice(0, 120) : kc.nama;
  }

  /* Susun HTML dokumen kustom. data = isian petugas, nomor = nomor manual. */
  window.tplKustomRender = function (kc, data, nomor) {
    var h = H(), d = data || {}, def = kc.def || defDefault();
    var kopFn = h.kop, jt = h.judulTengah, para = h.para, ol = h.ol, lines = h.lines;
    var rows = h.rows, meta = h.meta, ttd = h.ttd, ttd2 = h.ttd2;
    var tglP = h.tglPanjang, K = h.KOPaktif ? h.KOPaktif() : {};
    var out = kopFn(), no = nomor || '';
    var tglAtas = (def.tanggalLetak || 'bawah') === 'atas' ? (K.kota + ', ' + tglP(d.tanggal)) : '';

    /* 1. Nomor: tengah atau kiri (sejajar lampiran/perihal) */
    if ((def.nomorPosisi || 'kiri') === 'tengah') {
      out += jt(d.judulIsi || def.judulTeks || kc.nama, no);
      var mp = [];
      if (def.pakaiLampiran) mp.push(['Lampiran', d.headLampiran || '-']);
      if (def.pakaiPerihal) mp.push(['Perihal', '<b>' + esc(d.perihal || '') + '</b>', 1]);
      if (mp.length) out += meta(mp);
      if (tglAtas) out = out.replace(/<div class="judul">/, '<div class="r">' + esc(tglAtas) + '</div><div class="judul">');
    } else {
      var selKanan = tglAtas ? '<td class="r">' + esc(tglAtas) + '</td>' : '<td class="r"></td>';
      out += '<table class="meta head"><tr><td>Nomor</td><td>:</td><td>' + esc(no) + '</td>' + selKanan + '</tr>';
      if (def.pakaiLampiran) out += '<tr><td>Lampiran</td><td>:</td><td colspan="2">' + esc(d.headLampiran || '-') + '</td></tr>';
      if (def.pakaiPerihal) out += '<tr><td>Perihal</td><td>:</td><td colspan="2"><b>' + esc(d.perihal || '') + '</b></td></tr>';
      out += '</table>';
      if (d.judulIsi || def.judulTeks) out += '<div class="judul"><b class="u">' + esc(d.judulIsi || def.judulTeks) + '</b></div>';
    }
    /* Kepada */
    if (def.pakaiKepada) {
      var kp = lines(d.kepada);
      out += '<div class="kpd">Yth. ' + (kp.length > 1 ? ol(kp) : esc(kp[0] || '')) + '<div>di tempat</div></div>';
    }
    /* 2-3. Blok narasi + daftar */
    (def.blocks || []).forEach(function (b, i) {
      var isi = d['b_' + i] != null ? d['b_' + i] : (b.isi || '');
      if (b.jenis === 'daftar') {
        var arr = lines(isi);
        if (b.label) out += '<p style="margin:8pt 0 2pt"><b>' + esc(b.label) + '</b></p>';
        out += (b.gaya === 'huruf' ? ol(arr, 'abc') : ol(arr));
      } else {
        if (b.label) out += '<p style="margin:8pt 0 2pt"><b>' + esc(b.label) + '</b></p>';
        out += para(isi);
      }
    });
    /* 4. Tabel utama */
    if (def.pakaiTabel) {
      var kol = def.kolom || ['Nama', 'Keterangan'];
      var brs = teksKeBaris(d.tabelIsi != null ? d.tabelIsi : barisKeTeks(def.contoh), kol.length);
      if (def.tabelLabel) out += '<p style="margin:8pt 0 2pt"><b>' + esc(def.tabelLabel) + '</b></p>';
      out += '<table class="tbl"><thead><tr><th style="width:7%">No.</th>' + kol.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>'
        + brs.map(function (r, ix) { return '<tr><td class="c">' + (ix + 1) + '.</td>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('')
        + '</tbody></table>';
    }
    /* Tanggal bawah (di atas tanda tangan, seperti Surat Tugas) */
    if ((def.tanggalLetak || 'bawah') === 'bawah') {
      out += '<div class="r" style="margin:10pt 0 0">' + esc(K.kota) + ', ' + tglP(d.tanggal) + '</div>';
    }
    /* 5. Tanda tangan */
    var ttdD = { ttdJabatan: d.ttdJabatan || K.jabatan, ttdNama: d.ttdNama || K.nama, ttdNip: d.ttdNip || K.nip };
    if ((def.ttdModel || 'kanan') === 'tengah') {
      out += '<div class="ttd" style="justify-content:center"><div style="text-align:center">' + esc(ttdD.ttdJabatan) + ',<div class="sp"></div><b class="u">' + esc(ttdD.ttdNama) + '</b><br>' + esc(ttdD.ttdNip) + '</div></div>';
    } else if (def.ttdModel === 'kiri-kanan') {
      out += ttd2(
        [d.kiriJabatan || def.kiriJabatan || 'Pihak Kiri', d.kiriNama || def.kiriNama || '……………………', d.kiriNip || def.kiriNip || ''],
        [ttdD.ttdJabatan, ttdD.ttdNama, ttdD.ttdNip]);
    } else {
      out += ttd(ttdD, { tanpaTanggal: true });
    }
    /* 6. Tembusan */
    if (def.pakaiTembusan) {
      var tb = lines(d.tembusan != null ? d.tembusan : (def.tembusanIsi || ''));
      if (tb.length) out += '<div class="tembusan">Tembusan:' + ol(tb) + '</div>';
    }
    /* 7. Lampiran (paragraf + tabel + tanda tangan sendiri) */
    if (def.pakaiLampiran2) {
      out += '<div class="pb"></div><table class="meta lamp"><tr><td>LAMPIRAN</td><td>:</td><td>' + esc(no) + '</td></tr>'
        + (def.lampJudul ? '<tr><td>PERIHAL</td><td>:</td><td>' + esc(def.lampJudul) + '</td></tr>' : '') + '</table>';
      if (d.lampParagraf || def.lampParagraf) out += para(d.lampParagraf != null ? d.lampParagraf : (def.lampParagraf || ''));
      var lk = def.lampKolom && def.lampKolom.length ? def.lampKolom : ['Uraian'];
      var lb = teksKeBaris(d.lampTabelIsi != null ? d.lampTabelIsi : barisKeTeks(def.lampContoh), lk.length);
      if (lb.length) {
        out += '<table class="tbl"><thead><tr><th style="width:7%">No.</th>' + lk.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>'
          + lb.map(function (r, ix) { return '<tr><td class="c">' + (ix + 1) + '.</td>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('')
          + '</tbody></table>';
      }
      var lm = def.lampTtd || 'kanan';
      if (lm === 'kiri-kanan') out += ttd2(['Pihak Kiri', '……………………', ''], [ttdD.ttdJabatan, ttdD.ttdNama, ttdD.ttdNip]);
      else if (lm === 'tengah') out += '<div class="ttd" style="justify-content:center"><div style="text-align:center">' + esc(ttdD.ttdJabatan) + ',<div class="sp"></div><b class="u">' + esc(ttdD.ttdNama) + '</b><br>' + esc(ttdD.ttdNip) + '</div></div>';
      else if (lm !== 'tanpa') out += ttd(ttdD, { tanpaTanggal: true });
    }
    void rows;
    return out;
  };

  /* Nilai awal isian dokumen dari definisi */
  function bawaanKustom(kc, hariIni) {
    var h = H(), K = h.KOPaktif ? h.KOPaktif() : {}, def = kc.def || defDefault(), o = {};
    o.tanggal = hariIni; o.headLampiran = '-'; o.perihal = ''; o.kepada = ''; o.judulIsi = def.judulTeks || '';
    (def.blocks || []).forEach(function (b, i) { o['b_' + i] = b.isi || ''; });
    o.tabelIsi = barisKeTeks(def.contoh);
    o.ttdJabatan = K.jabatan || ''; o.ttdNama = K.nama || ''; o.ttdNip = K.nip || '';
    o.kiriJabatan = def.kiriJabatan || ''; o.kiriNama = def.kiriNama || ''; o.kiriNip = def.kiriNip || '';
    o.tembusan = def.tembusanIsi || '';
    o.lampParagraf = def.lampParagraf || ''; o.lampTabelIsi = barisKeTeks(def.lampContoh);
    return o;
  }

  /* Formulir pengisian dokumen dari templat kustom + pratinjau A4 */
  window.bukaTemplatKustom = function (id, API, ada) {
    var kc = (window.TEMPLAT_KUSTOM || []).find(function (x) { return x.id === id; });
    if (!kc) return;
    ada = ada || null;
    var def = kc.def || defDefault();
    var data = Object.assign(bawaanKustom(kc, API.hariIni), ada ? ada.data : {});
    var K0 = (H().KOPaktif ? H().KOPaktif() : {});
    if (!ada || !ada.data || !ada.data.ttdNama || ada.data.ttdNama === 'Nama Ketua LSP') {
      data.ttdJabatan = K0.jabatan || data.ttdJabatan; data.ttdNama = K0.nama || data.ttdNama; data.ttdNip = K0.nip || data.ttdNip;
    }
    var kat = ada ? ada.kat : kc.kat;
    var saran = function () { return API.saranSurat(kc.kode || 'DOK', data.tanggal || API.hariIni); };
    var nomor = function () { return ada ? ada.nomor : (data._nomor || '').trim(); };

    var fhtml = '';
    fhtml += '<label class="f">Tanggal surat<input name="tanggal" type="date" value="' + esc(data.tanggal) + '"></label>';
    if (def.pakaiLampiran) fhtml += '<label class="f">Lampiran<input name="headLampiran" value="' + esc(data.headLampiran) + '"></label>';
    if (def.pakaiPerihal) fhtml += '<label class="f">Perihal<input name="perihal" value="' + esc(data.perihal) + '"></label>';
    if (def.pakaiKepada) fhtml += '<label class="f">Kepada Yth. (satu tujuan per baris)<textarea name="kepada" rows="3">' + esc(data.kepada) + '</textarea></label>';
    fhtml += '<label class="f">Judul dokumen<input name="judulIsi" value="' + esc(data.judulIsi) + '"></label>';
    (def.blocks || []).forEach(function (b, i) {
      var v = data['b_' + i] == null ? '' : data['b_' + i];
      fhtml += '<label class="f">' + esc(b.label || (b.jenis === 'daftar' ? 'Daftar' : 'Paragraf narasi'))
        + (b.jenis === 'daftar' ? '<small>Satu butir per baris</small>' : '')
        + '<textarea name="b_' + i + '" rows="' + (b.jenis === 'daftar' ? 4 : 3) + '">' + esc(v) + '</textarea></label>';
    });
    if (def.pakaiTabel) {
      fhtml += '<label class="f">' + esc(def.tabelLabel || 'Tabel') + '<small>Format per baris: ' + esc((def.kolom || []).join(' | ')) + ' — tombol di bawah untuk tambah baris/kolom</small>'
        + '<textarea name="tabelIsi" rows="4">' + esc(data.tabelIsi) + '</textarea></label>'
        + '<div style="display:flex;gap:8px;margin:-4px 0 8px"><button type="button" class="btn ghost" data-tb="baris">+ Baris</button><button type="button" class="btn ghost" data-tb="kolom">+ Kolom</button></div>';
    }
    fhtml += '<div class="ed-grp">Penanda tangan</div>';
    if ((def.ttdModel || 'kanan') === 'kiri-kanan') {
      fhtml += '<div class="row2"><label class="f">Kiri — jabatan<input name="kiriJabatan" value="' + esc(data.kiriJabatan) + '"></label>'
        + '<label class="f">Kiri — nama<input name="kiriNama" value="' + esc(data.kiriNama) + '"></label></div>'
        + '<label class="f">Kiri — NIP/No. Reg.<input name="kiriNip" value="' + esc(data.kiriNip) + '"></label>';
    }
    fhtml += '<label class="f">Jabatan penanda tangan<input name="ttdJabatan" value="' + esc(data.ttdJabatan) + '"></label>'
      + '<div class="row2"><label class="f">Nama penanda tangan<input name="ttdNama" value="' + esc(data.ttdNama) + '"></label>'
      + '<label class="f">NIP / NIDN<input name="ttdNip" value="' + esc(data.ttdNip) + '"></label></div>';
    if (def.pakaiTembusan) fhtml += '<label class="f">Tembusan (satu tujuan per baris)<textarea name="tembusan" rows="2">' + esc(data.tembusan) + '</textarea></label>';
    if (def.pakaiLampiran2) {
      fhtml += '<div class="ed-grp">Lampiran</div><label class="f">Paragraf lampiran<textarea name="lampParagraf" rows="3">' + esc(data.lampParagraf) + '</textarea></label>'
        + '<label class="f">Tabel lampiran<small>Format per baris: ' + esc((def.lampKolom || []).join(' | ')) + '</small><textarea name="lampTabelIsi" rows="3">' + esc(data.lampTabelIsi) + '</textarea></label>'
        + '<div style="display:flex;gap:8px;margin:-4px 0 8px"><button type="button" class="btn ghost" data-tb="lamp-baris">+ Baris lampiran</button><button type="button" class="btn ghost" data-tb="lamp-kolom">+ Kolom lampiran</button></div>';
    }

    document.body.insertAdjacentHTML('beforeend', '<div class="editor" role="dialog" aria-modal="true" aria-label="' + esc(kc.nama) + '">'
      + '<div class="ed-top"><div><span class="muted" style="font-size:.8rem">' + (ada ? 'Ubah draf' : 'Buat dari templat kustom') + '</span><h2>' + esc(kc.nama) + '</h2></div>'
      + '<div class="ed-act"><button class="btn ghost" data-x>Batal</button><button class="btn ghost" data-print>Cetak / PDF</button><button class="btn ghost" data-save="Draf">Simpan draf</button>'
      + (kc.surat ? '<button class="btn" data-save="Diajukan">Ajukan pengesahan</button>' : '<button class="btn" data-save="Berlaku">Simpan & arsipkan</button>') + '</div></div>'
      + '<div class="ed-tabs"><button class="on" data-tab="f">Isi formulir</button><button data-tab="p">Pratinjau</button></div>'
      + '<div class="ed-body"><form class="ed-form form" autocomplete="off">'
      + (!ada ? '<label class="f">Nomor dokumen (ketik manual sesuai buku agenda)<input name="_nomor" value="' + esc(data._nomor || saran()) + '"><small>Saran urutan berikutnya: ' + esc(saran()) + '. Lihat tab Pedoman penomoran.</small></label>'
        : '<div class="nobox"><span>Nomor dokumen (sudah dikunci)</span><b id="edNo"></b><small>Nomor sudah dikunci.</small></div>')
      + '<label class="f">Simpan di kategori<select name="_kat">' + API.KAT.map(function (k) { return '<option value="' + k[0] + '"' + (k[0] === kat ? ' selected' : '') + '>' + esc(k[1]) + '</option>'; }).join('') + '</select></label>'
      + fhtml + '</form><div class="ed-prev"><div class="skala"><div class="kertas" id="edKertas"></div></div></div></div></div>');

    var ed = document.querySelector('.editor'), f = ed.querySelector('form'), Kr = ed.querySelector('#edKertas'), sk = ed.querySelector('.skala'), pv = ed.querySelector('.ed-prev');
    document.body.classList.add('ed-open');
    var baca = function () {
      Array.from(f.elements).forEach(function (x) { if (x.name) data[x.name] = x.value; });
      kat = f._kat.value;
    };
    var skala = function () {
      if (!pv || pv.clientWidth < 60) return;
      var s = Math.min(1, (pv.clientWidth - 24) / Kr.offsetWidth);
      Kr.style.transform = 'scale(' + s + ')'; sk.style.width = Kr.offsetWidth * s + 'px'; sk.style.height = Kr.offsetHeight * s + 'px';
    };
    var gambar = function () { baca(); var no = nomor(); var slot = ed.querySelector('#edNo'); if (slot) slot.textContent = no; Kr.innerHTML = window.tplKustomRender(kc, data, no || saran()); skala(); };
    var tm; f.addEventListener('input', function () { clearTimeout(tm); tm = setTimeout(gambar, 120); });
    f.addEventListener('change', gambar);
    var ro = new ResizeObserver(skala); if (pv) ro.observe(pv);
    gambar(); setTimeout(skala, 300);
    var tutup = function () { try { ro.disconnect(); } catch (e) {} ed.remove(); document.body.classList.remove('ed-open'); };
    ed.addEventListener('click', function (e) {
      var tb = e.target.closest('[data-tb]');
      if (tb) {
        baca();
        var tambahBaris = function (txt) { return (txt ? txt + '\n' : '') + 'Baris baru'; };
        if (tb.dataset.tb === 'baris') { data.tabelIsi = tambahBaris(data.tabelIsi); f.tabelIsi.value = data.tabelIsi; }
        else if (tb.dataset.tb === 'kolom') {
          def.kolom.push('Kolom ' + (def.kolom.length + 1));
          var nk = def.kolom.length;
          data.tabelIsi = teksKeBaris(data.tabelIsi, nk).map(function (r) { return r.join(' | '); }).join('\n');
          f.tabelIsi.value = data.tabelIsi;
        }
        else if (tb.dataset.tb === 'lamp-baris') { data.lampTabelIsi = tambahBaris(data.lampTabelIsi); f.lampTabelIsi.value = data.lampTabelIsi; }
        else if (tb.dataset.tb === 'lamp-kolom') {
          def.lampKolom.push('Kolom ' + (def.lampKolom.length + 1));
          var nl = def.lampKolom.length;
          data.lampTabelIsi = teksKeBaris(data.lampTabelIsi, nl).map(function (r) { return r.join(' | '); }).join('\n');
          f.lampTabelIsi.value = data.lampTabelIsi;
        }
        gambar(); return;
      }
      var tab = e.target.closest('[data-tab]');
      if (tab) { ed.querySelectorAll('[data-tab]').forEach(function (bb) { bb.classList.toggle('on', bb === tab); }); ed.classList.toggle('show-prev', tab.dataset.tab === 'p'); setTimeout(skala, 0); return; }
      if (e.target.closest('[data-x]')) { tutup(); return; }
      if (e.target.closest('[data-print]')) { gambar(); window.cetakDokumen(Kr.innerHTML, kustomJudul(kc, data)); return; }
      var sv = e.target.closest('[data-save]');
      if (sv) {
        gambar();
        var no = nomor();
        if (!ada && !no) { alert('Isi nomor dokumen dulu (lihat Pedoman penomoran).'); return; }
        if (!ada && API.nomorDipakai && API.nomorDipakai(no)) { alert('Nomor ' + no + ' sudah dipakai. Ganti dengan nomor lain.'); return; }
        tutup();
        API.simpan({ id: ada && ada.id, kat: kat, judul: kustomJudul(kc, data), nomor: no, surat: kc.surat, jenis: kc.nama, alur: sv.dataset.save, tanggal: data.tanggal, tpl: { id: kc.id, data: Object.assign({}, data) } });
      }
    });
    var esc_ = function (e) { if (e.key === 'Escape' && document.body.contains(ed)) { tutup(); document.removeEventListener('keydown', esc_); } };
    document.addEventListener('keydown', esc_);
  };

  /* ---------- Kelola Templat (daftar + editor blok) ---------- */
  function slug(s) {
    return 'k-' + String(s || 'templat').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) + '-' + Date.now().toString(36);
  }

  window.bukaKelolaTemplat = function (API) {
    var list = window.TEMPLAT_KUSTOM || [];
    var items = list.map(function (t) {
      return '<li><span><b>' + esc(t.nama) + '</b> <span class="chip">' + (t.surat ? 'surat' : 'dokumen') + ' · ' + esc(t.kode || '') + ' · ' + esc(t.kat) + '</span><br><span class="muted" style="font-size:.84rem">' + esc(t.ket || '') + '</span></span>'
        + '<span style="display:flex;gap:6px"><button class="btn ghost" type="button" data-e="' + esc(t.id) + '">Ubah</button><button class="btn ghost" type="button" data-h="' + esc(t.id) + '">Hapus</button></span></li>';
    }).join('') || '<li class="muted">Belum ada templat kustom. Buat yang pertama lewat tombol di bawah.</li>';
    var back = document.createElement('div');
    back.className = 'drawer-back';
    back.innerHTML = '<div class="drawer" role="dialog" aria-modal="true"><button class="x" aria-label="Tutup">×</button>'
      + '<h2>Kelola Templat</h2><p class="muted">Templat bawaan tetap ada dan tidak berubah. Templat kustom tersimpan di sheet backend (tab TemplatKustom) sehingga tidak hilang saat refresh.</p>'
      + '<div style="margin:10px 0"><button class="btn" id="bBaruTpl">+ Tambah templat</button></div>'
      + '<ul class="list" id="listKustom">' + items + '</ul></div>';
    document.body.appendChild(back);
    var tutup = function () { back.remove(); };
    back.addEventListener('click', function (e) { if (e.target === back || e.target.closest('.x')) tutup(); });
    back.querySelector('#bBaruTpl').onclick = function () { editorTpl(API, null, function () { tutup(); window.bukaKelolaTemplat(API); }); };
    back.querySelectorAll('[data-e]').forEach(function (b) {
      b.onclick = function () {
        var t = (window.TEMPLAT_KUSTOM || []).find(function (x) { return x.id === b.dataset.e; });
        editorTpl(API, t, function () { tutup(); window.bukaKelolaTemplat(API); });
      };
    });
    back.querySelectorAll('[data-h]').forEach(function (b) {
      b.onclick = async function () {
        var t = (window.TEMPLAT_KUSTOM || []).find(function (x) { return x.id === b.dataset.h; });
        if (!t) return;
        if (!confirm('Hapus templat "' + t.nama + '"? Dokumen yang sudah dibuat dari templat ini tetap tersimpan.')) return;
        try {
          if (t._rid) await API._api('hapus', { tabel: 'TemplatKustom', id: t._rid });
          window.TEMPLAT_KUSTOM = (window.TEMPLAT_KUSTOM || []).filter(function (x) { return x.id !== t.id; });
          try { API._catat('Menghapus templat kustom ' + t.nama); } catch (e) {}
          tutup(); window.bukaKelolaTemplat(API);
        } catch (err) { alert(err.message); }
      };
    });
  };

  /* Editor definisi templat: kiri formulir, kanan pratinjau */
  function editorTpl(API, lama, selesai) {
    var E = lama ? {
      _rid: lama._rid, tpl_id: lama.id, nama: lama.nama, kode: lama.kode, kat: lama.kat, ket: lama.ket, surat: !!lama.surat,
      def: JSON.parse(JSON.stringify(lama.def || defDefault()))
    } : {
      _rid: '', tpl_id: slug('templat'), nama: '', kode: 'UND', kat: 'KOR', ket: '', surat: true,
      def: defDefault()
    };
    var KAT = API.KAT || [], JENIS = API.JENIS || [];
    var katOps = KAT.map(function (k) { return '<option value="' + k[0] + '"' + (k[0] === E.kat ? ' selected' : '') + '>' + esc(k[1]) + '</option>'; }).join('');
    var jenOps = JENIS.map(function (j) { return '<option value="' + j[0] + '"' + (j[0] === E.kode ? ' selected' : '') + '>' + j[0] + ' — ' + esc(j[1]) + '</option>'; }).join('');

    document.body.insertAdjacentHTML('beforeend', '<div class="editor" role="dialog" aria-modal="true" aria-label="Editor templat">'
      + '<div class="ed-top"><div><span class="muted" style="font-size:.8rem">' + (lama ? 'Ubah templat kustom' : 'Templat kustom baru') + '</span><h2>Kelola Templat</h2></div>'
      + '<div class="ed-act"><button class="btn ghost" data-x>Batal</button><button class="btn" data-simpan>Simpan templat</button></div></div>'
      + '<div class="ed-tabs"><button class="on" data-tab="f">Pengaturan</button><button data-tab="p">Pratinjau</button></div>'
      + '<div class="ed-body"><form class="ed-form form" autocomplete="off" id="fTpl">'
      + '<label class="f">Nama templat<input name="nama" required value="' + esc(E.nama) + '" placeholder="mis. Surat pemberitahuan witness"></label>'
      + '<div class="row2"><label class="f">Kode jenis<select name="kode">' + jenOps + '</select></label>'
      + '<label class="f">Kategori<select name="kat">' + katOps + '</select></label></div>'
      + '<div class="row2"><label class="f">Jenis naskah<select name="surat"><option value="Y"' + (E.surat ? ' selected' : '') + '>Surat keluar (bernominasi + alur pengesahan)</option><option value="T"' + (!E.surat ? ' selected' : '') + '>Dokumen / arsip biasa</option></select></label>'
      + '<label class="f">Keterangan singkat<input name="ket" value="' + esc(E.ket) + '"></label></div>'
      + '<div class="ed-grp">Kepala surat (kop otomatis dari sheet)</div>'
      + '<div class="row2"><label class="f">Posisi nomor<select name="nomorPosisi"><option value="kiri"' + (E.def.nomorPosisi !== 'tengah' ? ' selected' : '') + '>Kiri (sejajar lampiran & perihal)</option><option value="tengah"' + (E.def.nomorPosisi === 'tengah' ? ' selected' : '') + '>Tengah (judul + nomor di tengah)</option></select></label>'
      + '<label class="f">Letak tanggal<select name="tanggalLetak"><option value="bawah"' + ((E.def.tanggalLetak || 'bawah') === 'bawah' ? ' selected' : '') + '>Bawah (di atas tanda tangan)</option><option value="atas"' + (E.def.tanggalLetak === 'atas' ? ' selected' : '') + '>Atas (sebaris nomor)</option></select></label></div>'
      + '<label class="f" style="flex-direction:row;gap:8px;align-items:center"><input type="checkbox" name="pakaiLampiran" style="width:auto"' + (E.def.pakaiLampiran ? ' checked' : '') + '> Tampilkan baris Lampiran</label>'
      + '<label class="f" style="flex-direction:row;gap:8px;align-items:center"><input type="checkbox" name="pakaiPerihal" style="width:auto"' + (E.def.pakaiPerihal ? ' checked' : '') + '> Tampilkan baris Perihal</label>'
      + '<label class="f" style="flex-direction:row;gap:8px;align-items:center"><input type="checkbox" name="pakaiKepada" style="width:auto"' + (E.def.pakaiKepada ? ' checked' : '') + '> Tampilkan Kepada Yth.</label>'
      + '<label class="f">Judul dokumen (bawaan)<input name="judulTeks" value="' + esc(E.def.judulTeks || '') + '"></label>'
      + '<div class="ed-grp">Isi: paragraf narasi & daftar bernomor <button type="button" class="btn ghost" data-add="narasi" style="margin-left:8px">+ Narasi</button> <button type="button" class="btn ghost" data-add="daftar">+ Daftar</button></div>'
      + '<div id="blokList"></div>'
      + '<div class="ed-grp">Tabel <label style="font-weight:400;font-size:.85rem"><input type="checkbox" name="pakaiTabel" style="width:auto"' + (E.def.pakaiTabel ? ' checked' : '') + '> pakai tabel</label></div>'
      + '<div id="tabelBox"><label class="f">Judul tabel<input name="tabelLabel" value="' + esc(E.def.tabelLabel || '') + '"></label>'
      + '<label class="f">Kolom tabel (satu kolom per baris)<textarea name="kolom" rows="3">' + esc((E.def.kolom || []).join('\n')) + '</textarea></label>'
      + '<label class="f">Contoh baris (format: sel1 | sel2)<textarea name="contoh" rows="3">' + esc(barisKeTeks(E.def.contoh)) + '</textarea></label>'
      + '<div style="display:flex;gap:8px"><button type="button" class="btn ghost" data-tb="kolom">+ Kolom</button><button type="button" class="btn ghost" data-tb="baris">+ Baris contoh</button></div></div>'
      + '<div class="ed-grp">Tanda tangan</div>'
      + '<label class="f">Model tanda tangan<select name="ttdModel"><option value="kanan"' + ((E.def.ttdModel || 'kanan') === 'kanan' ? ' selected' : '') + '>Satu kolom di kanan</option><option value="tengah"' + (E.def.ttdModel === 'tengah' ? ' selected' : '') + '>Satu kolom di tengah</option><option value="kiri-kanan"' + (E.def.ttdModel === 'kiri-kanan' ? ' selected' : '') + '>Dua kolom (kiri & kanan)</option></select></label>'
      + '<div id="kiriBox"><div class="row2"><label class="f">Kiri — jabatan<input name="kiriJabatan" value="' + esc(E.def.kiriJabatan || '') + '"></label><label class="f">Kiri — nama<input name="kiriNama" value="' + esc(E.def.kiriNama || '') + '"></label></div>'
      + '<label class="f">Kiri — NIP<input name="kiriNip" value="' + esc(E.def.kiriNip || '') + '"></label></div>'
      + '<label class="f" style="flex-direction:row;gap:8px;align-items:center"><input type="checkbox" name="pakaiTembusan" style="width:auto"' + (E.def.pakaiTembusan ? ' checked' : '') + '> pakai tembusan</label>'
      + '<label class="f">Isi tembusan (satu tujuan per baris)<textarea name="tembusanIsi" rows="2">' + esc(E.def.tembusanIsi || '') + '</textarea></label>'
      + '<div class="ed-grp">Lampiran <label style="font-weight:400;font-size:.85rem"><input type="checkbox" name="pakaiLampiran2" style="width:auto"' + (E.def.pakaiLampiran2 ? ' checked' : '') + '> pakai halaman lampiran</label></div>'
      + '<div id="lampBox"><label class="f">Judul lampiran<input name="lampJudul" value="' + esc(E.def.lampJudul || '') + '"></label>'
      + '<label class="f">Paragraf lampiran<textarea name="lampParagraf" rows="3">' + esc(E.def.lampParagraf || '') + '</textarea></label>'
      + '<label class="f">Kolom tabel lampiran (satu per baris)<textarea name="lampKolom" rows="2">' + esc((E.def.lampKolom || []).join('\n')) + '</textarea></label>'
      + '<label class="f">Contoh baris lampiran<textarea name="lampContoh" rows="2">' + esc(barisKeTeks(E.def.lampContoh)) + '</textarea></label>'
      + '<label class="f">Tanda tangan lampiran<select name="lampTtd"><option value="kanan"' + ((E.def.lampTtd || 'kanan') === 'kanan' ? ' selected' : '') + '>Kanan</option><option value="tengah"' + (E.def.lampTtd === 'tengah' ? ' selected' : '') + '>Tengah</option><option value="kiri-kanan"' + (E.def.lampTtd === 'kiri-kanan' ? ' selected' : '') + '>Kiri-kanan</option><option value="tanpa"' + (E.def.lampTtd === 'tanpa' ? ' selected' : '') + '>Tanpa tanda tangan</option></select></label></div>'
      + '</form><div class="ed-prev"><div class="skala"><div class="kertas" id="edKertas2"></div></div></div></div></div>');

    var ed = document.querySelector('.editor'), f = ed.querySelector('#fTpl');
    var Kr = ed.querySelector('#edKertas2'), sk = ed.querySelector('.skala'), pv = ed.querySelector('.ed-prev');
    document.body.classList.add('ed-open');

    var gambarBlok = function () {
      var box = ed.querySelector('#blokList');
      box.innerHTML = E.def.blocks.map(function (b, i) {
        return '<div class="panel" style="margin:0 0 8px;padding:10px"><div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">'
          + '<b style="font-size:.85rem">' + (b.jenis === 'daftar' ? 'Daftar bernomor' : 'Paragraf narasi') + '</b>'
          + '<select data-bi="' + i + '" data-k="jenis" style="font:inherit"><option value="narasi"' + (b.jenis !== 'daftar' ? ' selected' : '') + '>Narasi</option><option value="daftar"' + (b.jenis === 'daftar' ? ' selected' : '') + '>Daftar</option></select>'
          + '<select data-bi="' + i + '" data-k="gaya" style="font:inherit"' + (b.jenis !== 'daftar' ? ' disabled' : '') + '><option value="nomor"' + ((b.gaya || 'nomor') === 'nomor' ? ' selected' : '') + '>1,2,3</option><option value="huruf"' + (b.gaya === 'huruf' ? ' selected' : '') + '>a,b,c</option></select>'
          + '<span style="flex:1"></span><button type="button" data-up="' + i + '">↑</button><button type="button" data-dn="' + i + '">↓</button><button type="button" data-del="' + i + '">Hapus</button></div>'
          + '<label class="f">Label blok<input data-bi="' + i + '" data-k="label" value="' + esc(b.label || '') + '"></label>'
          + '<label class="f">Isi bawaan<textarea data-bi="' + i + '" data-k="isi" rows="3">' + esc(b.isi || '') + '</textarea></label></div>';
      }).join('');
    };
    var bacaForm = function () {
      ['nama', 'kode', 'kat', 'ket'].forEach(function (k) { E[k] = f[k].value; });
      E.surat = f.surat.value === 'Y';
      var d = E.def;
      d.nomorPosisi = f.nomorPosisi.value; d.tanggalLetak = f.tanggalLetak.value;
      d.pakaiLampiran = f.pakaiLampiran.checked; d.pakaiPerihal = f.pakaiPerihal.checked; d.pakaiKepada = f.pakaiKepada.checked;
      d.judulTeks = f.judulTeks.value;
      d.pakaiTabel = f.pakaiTabel.checked; d.tabelLabel = f.tabelLabel.value;
      d.kolom = String(f.kolom.value).split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
      if (!d.kolom.length) d.kolom = ['Kolom 1'];
      d.contoh = teksKeBaris(f.contoh.value, d.kolom.length);
      d.ttdModel = f.ttdModel.value;
      d.kiriJabatan = f.kiriJabatan.value; d.kiriNama = f.kiriNama.value; d.kiriNip = f.kiriNip.value;
      d.pakaiTembusan = f.pakaiTembusan.checked; d.tembusanIsi = f.tembusanIsi.value;
      d.pakaiLampiran2 = f.pakaiLampiran2.checked; d.lampJudul = f.lampJudul.value; d.lampParagraf = f.lampParagraf.value;
      d.lampKolom = String(f.lampKolom.value).split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
      if (!d.lampKolom.length) d.lampKolom = ['Uraian'];
      d.lampContoh = teksKeBaris(f.lampContoh.value, d.lampKolom.length);
      d.lampTtd = f.lampTtd.value;
    };
    var kcSementara = function () {
      bacaForm();
      return { id: E.tpl_id, nama: E.nama || 'Templat baru', kode: E.kode, kat: E.kat, ket: E.ket, surat: E.surat, def: E.def };
    };
    var contohData = function () {
      var kc = kcSementara(), dd = bawaanKustom(kc, (API.hariIni || '2026-10-10'));
      dd._nomor = ''; return { kc: kc, dd: dd };
    };
    var skala = function () {
      if (!pv || pv.clientWidth < 60) return;
      var s = Math.min(1, (pv.clientWidth - 24) / Kr.offsetWidth);
      Kr.style.transform = 'scale(' + s + ')'; sk.style.width = Kr.offsetWidth * s + 'px'; sk.style.height = Kr.offsetHeight * s + 'px';
    };
    var gambar = function () {
      var c = contohData();
      Kr.innerHTML = window.tplKustomRender(c.kc, c.dd, '001/LSP-UNIMED/' + (E.kode || 'DOK') + '/X/2026');
      skala();
    };
    gambarBlok(); gambar(); setTimeout(skala, 300);
    var tm; f.addEventListener('input', function () { clearTimeout(tm); tm = setTimeout(gambar, 200); });
    f.addEventListener('change', gambar);
    ed.querySelector('#blokList').addEventListener('input', function (e) {
      var bi = e.target.dataset.bi, k = e.target.dataset.k;
      if (bi == null) return;
      E.def.blocks[+bi][k] = e.target.value;
      if (k === 'jenis') gambarBlok();
      gambar();
    });
    ed.querySelector('#blokList').addEventListener('click', function (e) {
      var del = e.target.closest('[data-del]'), up = e.target.closest('[data-up]'), dn = e.target.closest('[data-dn]');
      if (del) { E.def.blocks.splice(+del.dataset.del, 1); gambarBlok(); gambar(); }
      else if (up) { var i = +up.dataset.up; if (i > 0) { var t = E.def.blocks[i - 1]; E.def.blocks[i - 1] = E.def.blocks[i]; E.def.blocks[i] = t; gambarBlok(); gambar(); } }
      else if (dn) { var j = +dn.dataset.dn; if (j < E.def.blocks.length - 1) { var u = E.def.blocks[j + 1]; E.def.blocks[j + 1] = E.def.blocks[j]; E.def.blocks[j] = u; gambarBlok(); gambar(); } }
    });
    var ro = new ResizeObserver(skala); if (pv) ro.observe(pv);
    var tutup = function () { try { ro.disconnect(); } catch (e) {} ed.remove(); document.body.classList.remove('ed-open'); };
    ed.addEventListener('click', async function (e) {
      var ad = e.target.closest('[data-add]');
      if (ad) {
        E.def.blocks.push(ad.dataset.add === 'daftar'
          ? { jenis: 'daftar', label: 'Daftar baru', gaya: 'nomor', isi: 'Butir pertama\nButir kedua' }
          : { jenis: 'narasi', label: 'Paragraf baru', isi: 'Tulis paragraf di sini.' });
        gambarBlok(); gambar(); return;
      }
      var tbb = e.target.closest('[data-tb]');
      if (tbb) {
        bacaForm();
        if (tbb.dataset.tb === 'kolom') { E.def.kolom.push('Kolom ' + (E.def.kolom.length + 1)); f.kolom.value = E.def.kolom.join('\n'); }
        else { f.contoh.value = (f.contoh.value ? f.contoh.value + '\n' : '') + 'Sel baru | Sel baru'; }
        gambar(); return;
      }
      var tab = e.target.closest('[data-tab]');
      if (tab) { ed.querySelectorAll('[data-tab]').forEach(function (bb) { bb.classList.toggle('on', bb === tab); }); ed.classList.toggle('show-prev', tab.dataset.tab === 'p'); setTimeout(skala, 0); return; }
      if (e.target.closest('[data-x]')) { tutup(); return; }
      var sv = e.target.closest('[data-simpan]');
      if (sv) {
        bacaForm();
        if (!E.nama.trim()) { alert('Isi nama templat dulu.'); return; }
        sv.disabled = true; sv.textContent = 'Menyimpan…';
        var payload = { tpl_id: E.tpl_id, nama: E.nama.trim(), kode: E.kode, kat: E.kat, ket: E.ket || '', surat: E.surat ? 'Y' : 'T', definisi: JSON.stringify(E.def) };
        try {
          var hasil;
          if (E._rid) hasil = await API._api('ubah', { tabel: 'TemplatKustom', id: E._rid, data: payload });
          else hasil = await API._api('tambah', { tabel: 'TemplatKustom', data: payload });
          var rec = { _rid: (hasil && hasil.id) || E._rid, id: E.tpl_id, nama: payload.nama, kode: payload.kode, kat: payload.kat, ket: payload.ket, surat: E.surat, def: E.def };
          var ix = (window.TEMPLAT_KUSTOM || []).findIndex(function (x) { return x.id === E.tpl_id; });
          if (ix >= 0) window.TEMPLAT_KUSTOM[ix] = rec; else window.TEMPLAT_KUSTOM.push(rec);
          try { API._catat('Menyimpan templat kustom ' + payload.nama); } catch (err) {}
          tutup(); alert('Templat tersimpan & langsung bisa dipakai.');
          if (selesai) selesai();
        } catch (err) { alert(err.message); sv.disabled = false; sv.textContent = 'Simpan templat'; }
      }
    });
    var esc_ = function (e) { if (e.key === 'Escape' && document.body.contains(ed)) { tutup(); document.removeEventListener('keydown', esc_); } };
    document.addEventListener('keydown', esc_);
  }
})();
