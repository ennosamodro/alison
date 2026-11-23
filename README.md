# Alison — Dashboard Progres Proyek Konstruksi

Prototype dashboard progres mingguan proyek konstruksi: admin input + klien read-only.
Rencana backend: Google Sheets + Apps Script Web App; frontend statis di Vercel.

| File | Fungsi |
|---|---|
| `admin-dashboard-konstruksi.html` | Dashboard admin (input progres, setup RAB, akses klien) |
| `klien-dashboard-konstruksi.html` | Dashboard klien read-only (rekap kategori, kurva S, foto) |
| `demo-guide.js` | Mode demo: arahan saat mouse mendekati titik penting + auto-isi password (hapus saat produksi) |
| `CLAUDE.md` | Catatan arahan lengkap untuk Claude Code |

## Status

Prototype dengan data dummy. Belum terhubung ke Sheets/Apps Script.
Password, PIN, dan kode akses di file ini hanya contoh (`demo123`, `1234`, `C40-MIRAL6-X7K2`).

## Peran & nominal (prototype)

- **Owner** (PIN `1234`): lihat semua, plus tab *Keuangan & termin* (kontrak, penyesuaian, termin milestone, margin).
- **Produksi** (PIN `5678`): hanya harga produksi; harga jual, termin, margin, akses klien tidak tampil.
- **Klien**: nilai per kategori (Rp), pekerjaan terealisasi vs pembayaran masuk, termin per milestone, kurva S + garis pembayaran.
  Contoh C40 = pekerjaan lebih dulu dari pembayaran; D12 = pembayaran (uang muka) lebih dulu.

Di produksi penyaringan peran harus dilakukan Apps Script, bukan di browser. Detail di CLAUDE.md.

## Mode demo (untuk presentasi)

`demo-guide.js` menambah dua hal di kedua dashboard:

- **Arahan saat mouse mendekati titik penting**: tidak ada kursor palsu. Balon penjelasan baru muncul ketika mouse (atau jari) kamu mengarah ke titik itu, dan hilang saat menjauh.
- **Auto-isi password / PIN / kode**: ketik apa saja di kolomnya, otomatis terisi nilai demo yang benar (atau klik kotak merah muda di bawah kolom).

Tombol pojok kiri bawah: **Mode demo ON/OFF**. Bisa juga dimatikan lewat `?demo=0` di URL.

**Saat disambung ke Apps Script: hapus tag `<script src="demo-guide.js">` dan blok `window.DEMO_GUIDE` di kedua HTML**,
karena auto-isi membuka password ke siapa pun yang membuka halaman.

## Coba lokal

Buka file HTML langsung di browser. Kode klien contoh: `C40-MIRAL6-X7K2`.

Detail arsitektur, struktur Sheets, dan langkah build ada di [CLAUDE.md](CLAUDE.md).
