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
Username, password, dan kode akses di file ini hanya contoh (tabel akun demo di bawah, dan `C40-MIRAL6-X7K2`).

## Peran & nominal (prototype)

Login admin: **satu gerbang, username + password pribadi** (tidak ada lagi password global + PIN). Akun demo:

| Username | Password | Peran | Proyek |
|---|---|---|---|
| `owner` | `owner123` | Owner | semua |
| `produksi` | `produksi123` | Produksi | semua |
| `vendor` | `vendor123` | Produksi (vendor luar) | hanya C40 |

- **Owner**: lihat semua, plus tab *Keuangan & termin* dan tab *Pengguna & akses* di daftar proyek (buat akun, atur peran, centang proyek yang boleh dibuka, reset password, nonaktifkan).
- **Produksi**: hanya harga produksi; harga jual, termin, margin, akses klien tidak tampil. Proyek yang terlihat mengikuti centang akses.
- Password sementara dari Owner wajib diganti saat login pertama. Salah 5 kali, akun terkunci 1 menit.
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
