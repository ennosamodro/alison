# CLAUDE.md — Dashboard Progres Proyek Konstruksi (Alison)

Catatan arahan untuk Claude Code. Baca sampai habis sebelum nulis kode Apps Script.
Pemilik repo: Lenno (freelancer, Surabaya). Bahasa kerja: Indonesia informal.

## Tujuan

Klien (perusahaan konstruksi, brand merah "Alisons") dulu bikin laporan progres mingguan pakai Excel lalu kirim PDF
(contoh: laporan Miral 6 Residence Blok C40). Kita pindahkan ke sistem:

1. **Dashboard admin** — tim klien input progres mingguan, kelola proyek, kelola akses klien.
2. **Dashboard klien (read-only)** — pemilik proyek buka pakai link + kode akses, lihat progres proyeknya saja.
3. **Google Sheets = database/sumber kebenaran.** Apps Script Web App = satu-satunya gerbang. HTML statis di Vercel.

Yang ditampilkan ke klien = setara halaman 2-3 PDF (rekap per kategori) dan halaman 10 (kurva S / time schedule),
plus foto & aktivitas minggu itu. Logika hitung detail di PDF lainnya tetap di sisi admin/Sheets.

## Status sekarang

Dua prototype HTML dengan **data dummy di memori browser** (belum nyambung ke Sheets):

- `admin-dashboard-konstruksi.html` — gate password global → PIN admin → landing (daftar proyek, cari, buat proyek) →
  workspace per proyek dengan tab: Ringkasan (kurva S Chart.js), Setup RAB, Input mingguan, Edit detail, Akses klien.
- `klien-dashboard-konstruksi.html` — gate kode akses (auto-isi dari `?kode=`), pilih minggu, kartu ringkasan,
  kurva S, rekap kategori (klik baris → detail item), galeri foto, aktivitas & rencana minggu depan.

**Semua validasi di prototype (password, PIN, kode) hanya dummy di JS browser.** Di produksi WAJIB di server (Apps Script).
Jangan pernah kirim data proyek ke browser sebelum kode divalidasi server.

## Arsitektur

```
Browser (HTML statis, Vercel)  ──fetch──▶  Apps Script Web App (doGet/doPost)  ──▶  Google Sheets (private)
                                                         └────────────────────────▶  Google Drive (foto)
```

- Web App: *Execute as: Me*, *Who has access: Anyone*. Sheets tetap private; hanya script yang membacanya.
  Execute-as hanya soal siapa yang menjalankan script. Kepemilikan Sheets tidak berpindah.
  Folder/file **baru** yang dibuat script dimiliki akun eksekutor.
- Semua request lewat satu endpoint dengan parameter `action`. Respon JSON.
- Frontend deploy via GitHub → Vercel auto-deploy. Password global disimpan di Vercel env var, bukan di HTML.
- Aturan performa & reliabilitas GAS: ikuti skill `gas-performance`. Pola stack ini: skill `gas-sheets-vercel-dashboard`.
  Baca dan tulis Sheets per batch (`getValues`/`setValues`), jangan per sel. Cache hasil baca (CacheService) bila perlu.

## Struktur Google Sheets (satu file)

**Tab konfigurasi (tetap):**

| Tab | Kolom |
|---|---|
| `Config Proyek` | Project ID, Nama Proyek, Folder ID Drive induk, Tanggal Mulai |
| `Akses Klien` | Project ID, Kode Akses, Status (aktif/nonaktif), Terakhir Diganti |
| `Admin PIN` | PIN, Nama, Role (Owner/Pengawas), Status |

**Satu tab per Project ID** (dibuat otomatis oleh script saat proyek baru). Nama tab = Project ID yang sudah di-sanitasi,
unik, valid sebagai nama tab. Isi tab proyek:

- **Master item (flat):** `Kode | Kategori | Lokasi | Nama Item | Volume | Satuan | Bobot`
  - Kategori utama (mis. Pekerjaan Beton) → Lokasi/bagian bangunan (mis. Lantai Dasar; boleh kosong) → Item (mis. Beton Kolom K1).
  - Item bisa berubah selama proyek jalan → edit lewat dashboard admin (Setup RAB / Edit detail), bukan langsung di Sheets.
- **Log progres mingguan (format long):**
  `Timestamp | Project ID | Minggu ke- | Kode Item | Volume realisasi | Progress % | Periode mulai | Periode akhir | Folder ID foto minggu itu | Diisi oleh`
  - Satu baris per item per minggu. Baris dibuat otomatis saat admin submit.
  - Letak log (per-proyek vs satu tab bersama) **belum diputuskan**, lihat "Keputusan terbuka".

**Rumus:**
- bobot tertimbang = bobot item × progress %
- progres kategori = SUM bobot tertimbang item dalam kategori (SUMIF / QUERY group by Kategori)
- kumulatif = kumulatif lalu + periode ini
- deviasi = realisasi − rencana

## Model akses: tiga lapis independen

1. **Password global** — gerbang awal dashboard admin; disimpan di Vercel env var.
2. **PIN admin personal** — identitas (kolom "Diisi oleh" untuk audit), bisa dicabut per orang. Ganti token statis.
   Role Owner vs Pengawas; hanya Owner mengelola PIN (masih keputusan terbuka).
3. **Kode akses klien per proyek** — acak, mis. `C40-MIRAL6-X7K2`. Bisa di-regenerate, bisa aktif/nonaktif.
   Divalidasi di server. Link `?kode=` berperan seperti password, jadi jangan samakan format link dengan kode
   mentah di URL publik tanpa sadar. Link mengacu ke Project ID, kode ada terpisah.

Aturan keras:
- Setiap endpoint admin: cek PIN di server + catat siapa yang menulis.
- Endpoint klien: cek kode (aktif) → kembalikan **hanya** data proyek milik kode itu.
- Jangan hardcode Folder ID, Sheet ID, atau rahasia di HTML. Folder ID hanya hidup di Sheets.
- Jangan commit rahasia asli ke repo ini (repo public).

## Google Drive (foto)

- Klien membuat folder induk di Drive mereka dan share **Editor** ke akun Lenno. ID-nya masuk `Config Proyek`.
- Script `createFolder()` membuat folder proyek, lalu subfolder per minggu. ID subfolder disimpan di baris log minggu itu.
- Set sharing folder: `ANYONE_WITH_LINK` + `VIEW`.
- Foto ditarik script: `getFiles()` difilter `mimeType` diawali `image/`, lalu bentuk URL thumbnail. Dashboard cuma menampilkan.
- Satu proyek punya banyak folder (satu per minggu). Admin buka folder minggu itu lewat tombol di tab Input mingguan.
  Tidak ada upload langsung dari dashboard; admin unggah ke Drive.
- Catatan kuota: file hasil unggahan manual dihitung ke kuota pengunggah.

## Konsep minggu

- "Minggu ke-N" = nomor urut laporan, bukan minggu kalender. Tanggal periode disarankan otomatis (7 hari) tapi **bisa diedit**
  (PDF asli kadang 8 hari). Tandai "saran otomatis" vs "manual".
- Klien boleh pilih minggu sebelumnya (riwayat) di dashboard.
- Admin bisa isi/koreksi minggu apa pun.

## Peran & keuangan (hasil diskusi dengan Alison, 2026-11-23)

**Login admin (diputuskan 2026-11-23): satu gerbang, username + password per orang.** Password global + PIN dibuang
(login pribadi sudah memberi gerbang sekaligus identitas untuk kolom "Diisi oleh").
- Tab `Pengguna` di Sheets: username, nama, peran, hash password + salt, status, proyek yang boleh dibuka (atau `semua`), wajib ganti password.
- Apps Script: cek hash, buat token bersesi berumur terbatas, tiap request cek token + peran + proyek. Kunci akun sementara setelah 5x salah.
  Pesan galat sama untuk username salah dan password salah. Hash di Apps Script memakai `Utilities.computeDigest` SHA-256 + salt acak per akun.
- **Ganti password sendiri**: tiap akun bisa mengganti passwordnya kapan saja (tombol "Ganti password": password lama + baru 2x, min. 8 karakter, tidak boleh sama
  dengan yang lama, kunci 1 menit setelah 5x salah password lama). Dicatat di riwayat sebagai "Ganti password" tanpa isi password. Reset oleh Owner tetap ada untuk yang lupa.
- Dikelola Owner di tab **Pengguna & akses** pada halaman daftar proyek (bukan di dalam workspace satu proyek): buat akun (password sementara
  wajib diganti saat login pertama), edit peran, centang proyek, reset password, nonaktifkan.
- **Akses per proyek**: Owner dan akun bertanda "semua proyek" melihat semuanya; akun terbatas (mis. vendor luar) hanya proyek yang dicentang.
  Proyek baru TIDAK otomatis terbuka untuk akun terbatas. Alasannya: vendor tidak boleh melihat harga produksi proyek lain.
- Guard: tidak bisa menonaktifkan akun sendiri atau Owner aktif terakhir, tidak bisa menurunkan peran Owner terakhir.
- Terbuka: vendor luar di proyeknya tetap melihat harga produksi proyek itu. Kalau itu tidak boleh, perlu peran ketiga "input progres saja" tanpa harga.

**Riwayat perubahan (audit, 2026-11-23):** akun per orang (bukan per jabatan) supaya setiap perubahan bisa ditelusuri. Tab Sheets `Riwayat Perubahan`
(waktu, username, proyek, aksi, rincian lama→baru), ditulis Apps Script dengan nama dari token sesi (bukan dari browser), tidak ada fitur ubah/hapus
dari dashboard, hanya Owner yang membaca. Dicatat: submit laporan mingguan, ubah/tambah/hapus item RAB (termasuk harga), penyesuaian, termin,
tandai selesai/buka kembali, akses klien, serta buat/ubah/reset/nonaktifkan akun. Jangan pernah mencatat password atau kode akses.
Kolom "Diisi oleh" di log progres tetap ada. Akun demo: gilang (Owner), budi.mandor (Produksi), vendor.besi (Produksi, hanya C40).

**Proyek selesai (arsip, diputuskan 2026-11-23):** jumlah proyek bersamaan di Alison sekitar 3 sampai 5, jadi tidak perlu pengelompokan per klien
atau akses per grup. Cukup: field `selesai` + `selesaiTanggal` per proyek, tombol **Tandai selesai / Buka kembali** (khusus Owner) di sidebar proyek,
dan sub-tab **Berjalan | Selesai** di daftar proyek. Proyek selesai keluar dari statistik dan "Perlu perhatian", datanya tidak dihapus.
Dashboard klien proyek selesai **tetap terbuka** dengan banner "Proyek selesai"; mematikannya lewat tombol Akses klien yang sudah ada (per proyek).
Jika proyek bersamaan jadi jauh lebih banyak: tambah isian Klien/perumahan untuk pengelompokan, chip + pencarian untuk akses, akses per grup.

**Peran admin: dua saja.**
- **Owner** (= Admin): lihat semua. Harga produksi, harga jual, margin, termin, kode akses klien.
- **Produksi** (menggantikan "Pengawas"): input progres + lihat **harga produksi saja**. Harga jual, termin, margin, tab Akses klien disembunyikan.
- Penyaringan WAJIB di Apps Script: untuk peran Produksi server tidak mengirim `hargaJual`, termin, margin, kode klien.
  Menyembunyikan di CSS/JS tidak cukup (data tetap terkirim ke browser). Prototype sekarang hanya tidak me-render-nya ke DOM.
- Sheets hanya dibuka Owner/Lenno; tim lain lewat dashboard. Kalau perlu isolasi lebih kuat: pisah harga produksi dan harga jual ke dua file Sheets.

**Dashboard klien menampilkan nominal (harga jual, per KATEGORI, bukan per item):**
- Nilai kontrak berlaku = kontrak awal + penyesuaian (tambah/kurang pekerjaan).
- Pekerjaan terealisasi (Rp) = % realisasi × nilai kontrak berlaku.
- Pembayaran masuk = jumlah termin yang sudah dibayar. Selisih = terealisasi − terbayar.
- Label netral, toleransi ±2% nilai kontrak: *sejalan* / *pekerjaan lebih dulu dari pembayaran* / *pembayaran lebih dulu dari pekerjaan*.
- **Termin berbasis milestone**: tiap termin punya persen, syarat progres (%), minggu dibayar. Status: dibayar / syarat tercapai / belum jatuh tempo.
- **Penyesuaian kontrak** (tambah/kurang pekerjaan): tiap baris punya **jenis, kategori wajib, dua harga** (nilai jual dan nilai produksi), minggu berlaku.
  - Tambah: item baru di kategori terpilih, atau kategori "Pekerjaan tambah". Punya progres sendiri (%).
  - Kurang: mengurangi pekerjaan yang sudah ada di RAB awal (hapus item, kurangi volume, ganti spek yang hasilnya minus), menunjuk kategori terdampak.
  - Nilai jual masuk ke nilai kategori di dashboard klien; nilai produksi menambah/mengurangi anggaran produksi → margin dihitung ulang.
  - Klien hanya menerima nilai jual. Produksi hanya melihat nilai produksi. Owner melihat keduanya + margin per penyesuaian.
  - Terealisasi = progres RAB awal × kontrak awal + progres pekerjaan tambah × nilai jualnya (item "kurang" dianggap belum dikerjakan; kasus sudah terlanjur dikerjakan sebagian: tanyakan Alison).
  - Belum ada alur persetujuan addendum lengkap.
- Harga produksi TIDAK PERNAH ada di respons endpoint klien.

**Tambahan tab Sheets:** `Termin` (Project ID, No, Milestone, Persen, Syarat progres, Minggu dibayar) dan
`Penyesuaian Kontrak` (Project ID, Minggu, Keterangan, Nilai). Master item bertambah kolom `Harga Produksi` dan `Harga Jual` (per satuan).
Nilai kontrak awal & anggaran produksi per proyek masuk `Config Proyek`.

**Impor RAB dari Excel (rencana):** kotak "Tempel dari Excel" di Setup RAB, format datar
`Kode | Kategori | Lokasi | Nama Item | Volume | Satuan | Harga Produksi | Harga Jual`. Bobot dihitung dari nilai item, bukan diketik.

## Keputusan terbuka (tanya Lenno sebelum mengunci)

0. Bobot progres dihitung dari harga produksi atau harga jual? (prototype: bobot manual, nominal klien pakai % × nilai kontrak jual)

1. **Rencana per minggu:** PDF hanya punya rencana bulanan per kategori. Interpolasi ke mingguan, atau rencana per item?
   Prototype pakai interpolasi dummy.
2. **Letak log progres:** per-proyek (satu tab tiap proyek) atau satu tab bersama dengan kolom Project ID?
3. **Role admin:** apakah Owner vs Pengawas dengan hak berbeda, siapa yang boleh kelola PIN?
4. **QR code:** sekarang pakai `api.qrserver.com` (butuh internet, URL keluar dari browser). Usul: ganti `qrcode.js` lokal.
5. **Notifikasi email ke klien** tiap minggu selesai diisi (MailApp dari Apps Script): mau dinyalakan?

## Urutan kerja yang disarankan

1. Rancang kontrak API (action, parameter, bentuk JSON) dan tulis di `docs/api.md`.
2. Script setup: buat tab konfigurasi, fungsi buat proyek baru (tab + folder Drive + kode akses).
3. Auth: cek password/PIN/kode di server, audit "Diisi oleh".
4. Endpoint baca: daftar proyek, detail proyek, riwayat minggu, foto minggu.
5. Endpoint tulis: setup RAB, edit item, submit minggu, regenerate/toggle kode.
6. Sambungkan HTML (ganti data dummy dengan `fetch`). Tambah loading state; Apps Script lambat saat cold start.
7. Uji dengan data C40 dummy sampai angka cocok dengan PDF (rekap kategori & kurva S).
8. Deploy Vercel, isi env var, pasang password gerbang.

## Desain

- Palet merah Alisons: `--accent #B23A2E`, `--accent-dark #7A231C`, `--paper #F6F4EF`, `--ink #2A2420`.
- Perubahan visual: konfirmasi ke Lenno dulu. Desktop dan mobile harus sama-sama nyaman.
- Kurva S pakai Chart.js; di klien, minggu terpilih disorot.

## Gaya kerja

- Jawab dalam bahasa Indonesia informal, singkat, langsung ke inti.
- Jangan klaim sudah jadi sebelum diuji; sebut jelas bagian yang masih dummy.
- Data di repo ini dummy/anonim. Jangan masukkan data klien asli, nama orang asli, atau info komersial ke repo public.
