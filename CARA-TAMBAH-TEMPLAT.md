# Cara menambah templat surat baru (5 menit, tanpa ngoding berat)

File templat ada di: `templat.js`, di dalam daftar `const TEMPLAT = [ ... ]`.
Satu templat = satu blok `{ ... }`. Cara termudah: **copy satu blok yang mirip, tempel di bawahnya, ubah isinya.**

Contoh blok paling sederhana (Surat tugas, `id: 'tugas'`):

```js
{
  id: 'tugasbaru', nama: 'Surat tugas baru', kode: 'ST', surat: true, kat: 'ASR',
  ket: 'Penjelasan singkat templat ini.',
  judul: (d) => 'Surat Tugas — ' + (d.keperluan || '').slice(0, 70),
  fields: [
    { k: 'tanggal', l: 'Tanggal surat', t: 'date' },
    { k: 'keperluan', l: 'Untuk', t: 'textarea', v: 'Isi bawaan' },
    ...PENANDATANGAN
  ],
  isi: (d, no) => {
    return `${kop()}${judulTengah('SURAT TUGAS', no)}
      ${para(d.keperluan)}
      <div class="r" style="margin:10pt 0 0">${esc(KOPaktif().kota)}, ${tglPanjang(d.tanggal)}</div>${ttd(d, { tanpaTanggal: true })}`;
  }
},
```

## Aturan main (cukup ingat 5 ini)

1. `id` harus unik, huruf kecil tanpa spasi (mis. `'pemberitahuan'`).
2. `kode` ikut Pedoman penomoran (UND, ST, SK, PB, BA, dst). Kalau jenis baru, tambahkan dulu ke daftar `JENIS` di `index.html` + tab Pedoman.
3. `kat` = kode kategori (MNJ, KOR, ASR, LIS, TUK, ASM, MUT, SKM).
4. `surat: true` kalau bernomor resmi (masuk agenda surat), `false` kalau arsip biasa.
5. `...PENANDATANGAN` wajib ada di akhir `fields` supaya nama ketua/NIP otomatis ikut data sheet.

## Jenis field formulir

- Teks pendek: `{ k: 'tempat', l: 'Tempat', v: 'Isi bawaan' }`
- Tanggal: `{ k: 'tanggal', l: 'Tanggal surat', t: 'date' }`
- Paragraf: `{ k: 'isi', l: 'Isi surat', t: 'textarea' }`
- Satu item per baris (jadi daftar bernomor otomatis): pakai `lines(d.isi)` di `isi()`, contoh: `${ol(lines(d.isi))}`
- Tabel Nama | Ket: pakai `rows(d.tabel)`, contoh: `${rows(d.tabel).map((r,i) => ...)}`
- Judul arsip otomatis: `judul: (d) => ...` (ini yang tampil di daftar dokumen).

## Fungsi bantu yang sudah tersedia (tinggal pakai)

- `${kop()}` — kop surat + logo (wajib di awal).
- `${judulTengah('JUDUL', no)}` — judul tengah + nomor.
- `${para(d.teks)}` — tiap baris jadi paragraf rata kanan-kiri.
- `${ol(lines(d.teks))}` — tiap baris jadi daftar bernomor.
- `${meta([['Label', d.nilai]])}` — tabel label : isi (Untuk, Hari, Waktu, Tempat).
- `${ttd(d, { tanpaTanggal: true })}` — blok tanda tangan ketua (nama/NIP ikut sheet).
- `${tglPanjang(d.tanggal)}` → "10 Oktober 2026"; `${hariTgl(d.tgl)}` → "Jumat, 10 Oktober 2026".

## Pola tanggal-bawah (seperti Surat tugas sekarang)

Kalau tanggal mau di bawah (di atas tanda tangan), pakai pola ini di akhir `isi()`:

```js
${para(d.penutup)}<div class="r" style="margin:10pt 0 0">${esc(KOPaktif().kota)}, ${tglPanjang(d.tanggal)}</div>${ttd(d, { tanpaTanggal: true })}
```

dan jangan taruh tanggal di atas (hapus `<div class="r" ...>` yang di atas judul).

## Cara pasang

1. Buka `templat.js`, cari `const TEMPLAT = [`, copy satu blok yang paling mirip, tempel di bawahnya, ubah `id/nama/fields/isi`.
2. Cek: `node --check templat.js` (harus tanpa error).
3. Di `index.html` naikkan `templat.js?v=3` jadi `?v=4` supaya browser langsung ambil versi baru.
4. Commit + push. Tunggu ~1 menit, buka halaman arsip, templat baru langsung muncul di daftar.

Kalau ragu, kirim draf isi suratnya ke saya — saya yang buatkan bloknya, Pak Boss tinggal tempel.
