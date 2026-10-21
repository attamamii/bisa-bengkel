# BISA — Bengkel Integrated Service Application

Aplikasi web (SPA) untuk bengkel kendaraan: pelanggan mendeskripsikan keluhan, sistem
mengestimasi kerusakan + biaya, mekanik mengerjakan tiket, dan admin mengelola stok,
pegawai, kasir, sampai laporan pendapatan.

Tugas Besar mata kuliah **IPPL** — Semester 5.

- **Backend**: Python 3.12 + Flask 3.1 + SQLAlchemy (MariaDB/MySQL, SQLite untuk dev)
- **Frontend**: SPA vanilla JavaScript (ES Modules, hash router, tanpa framework)
- **Auth**: JWT (HS256) + Bcrypt (12 rounds)
- **UI**: neo-brutalism (border hitam 4px, hard shadow, krem `#FFFDF5`, font Space Grotesk)
- **Total API**: 42 endpoint, semuanya terdokumentasi otomatis di Swagger UI

---

## 1. Cara Menjalankan

### A. Cara tercepat (Windows)

Double-click **`Jalankan BISA.bat`** — skrip ini menyalakan server lalu membuka browser.
Pastikan dependensi sudah terpasang sekali saja:

```powershell
pip install -r requirements.txt
```

### B. Manual

```powershell
python run.py
```

Buka <http://127.0.0.1:5000>.

### C. Mode basis data

| Mode | Konfigurasi `.env` | Kapan dipakai |
| --- | --- | --- |
| **MariaDB/MySQL** (sesuai SRS) | `DB_ENGINE=mysql` + `DB_HOST/PORT/NAME/USER/PASSWORD` | Demo & penilaian |
| **SQLite** (praktis) | `DB_ENGINE=sqlite` | Ngoding cepat, tanpa server DB |

Salin `.env.example` menjadi `.env` lalu isi `SECRET_KEY` dan `JWT_SECRET` dengan string acak.
Data master (jasa, sparepart) dan akun demo dibuat otomatis saat database masih kosong
(`AUTO_SEED=true`).

Untuk menyiapkan database MySQL dari nol:

```powershell
mysql -u root -p -e "CREATE DATABASE bisa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
python run.py
```

`schema_mysql.sql` tersedia sebagai rujukan struktur 8 tabel bila dosen meminta DDL eksplisit.

### Akun demo

| Peran | Email | Password |
| --- | --- | --- |
| Admin | `admin@bisa.id` | `Admin#123` |
| Mekanik | `andi@bisa.id` | `Mekanik#123` |
| Customer | `budi@bisa.id` | `Customer#123` |

---

## 2. Alur Bisnis Singkat

```
Customer                    Mekanik                     Admin
────────                    ───────                     ─────
daftar kendaraan
ketik keluhan
  → estimasi AI   ─┐
  → buat tiket    ─┤
                   └→  tiket MASUK  →  klaim tiket
                                        kerjakan
                                        tambah sparepart ─┐
                                          → tiket MENUNGGU ═╡ customer
                                                             ║ setuju / tolak
                                        selesai kerja        ║
                                          → tiket SELESAI    ║
                                                             ║
                                                     kasir: bayar
                                                     status LUNAS
                                                     → nota digital
                                                     → stok terpotong
```

Inti nilai jualnya: **tidak ada tagihan kejutan**. Setiap sparepart tambahan wajib disetujui
customer dulu, dan tagihan akhir dihitung ulang otomatis berdasarkan keputusan itu.

---

## 3. Struktur Proyek

```
Tubes_ippl_bisa/
├─ run.py                    # entry point (python run.py)
├─ Jalankan BISA.bat         # launcher Windows
├─ requirements.txt
├─ schema_mysql.sql          # DDL 8 tabel (rujukan)
├─ .env.example
├─ app/
│  ├─ __init__.py            # app factory, error handler, SPA fallback
│  ├─ config.py              # konfigurasi + pemilihan engine DB
│  ├─ extensions.py          # instance SQLAlchemy
│  ├─ models.py              # User, Vehicle, Ticket, TicketItem, Part, TicketEvent, Analysis
│  ├─ security.py            # Bcrypt, JWT, guard per peran, ApiError
│  ├─ seed.py                # data master + akun demo
│  ├─ utils.py               # helper parsing/validasi
│  ├─ openapi.py             # spec OpenAPI otomatis + Swagger UI
│  ├─ ai/
│  │  ├─ engine.py           # klasifikasi keluhan → kerusakan → estimasi
│  │  └─ catalog.py          # kamus gejala, kerusakan, jasa, sparepart
│  └─ api/
│     ├─ auth.py             # RF-01..03
│     ├─ customer.py         # RF-04,05,06 (kendaraan, analisis, ringkasan)
│     ├─ tickets.py          # RF-06,10,15,16 (buat, tolak/setuju, nota, riwayat)
│     ├─ workshop.py         # RF-07,08,13,14 (antrean, klaim, tambah item, selesai)
│     ├─ admin.py            # RF-11,12,13,14,17 (master data, kasir, laporan, CSV)
│     └─ notifications.py    # RF-09 (polling kursor)
├─ static/
│  ├─ css/app.css            # design system + ornamen bengkel
│  └─ js/
│     ├─ app.js              # router, shell, polling notifikasi
│     ├─ api.js              # fetch wrapper + penyimpanan token
│     ├─ ui.js               # ikon, modal, toast, formatter, loading
│     └─ pages/              # landing, auth, customer, mechanic, admin, nota
├─ templates/index.html
└─ scripts/
   ├─ backup.py              # backup SQLite/MySQL harian (NFR-13)
   ├─ backup.bat
   └─ register_backup_task.ps1
```

---

## 4. Matriks Kepatuhan SRS

### 4.1 Kebutuhan Fungsional (17/17 terpenuhi)

| ID | Kebutuhan | Implementasi | Bukti |
| --- | --- | --- | --- |
| RF-01 | Registrasi pengguna | `POST /api/auth/register`, validasi email + nomor HP, cek duplikat | `app/api/auth.py` |
| RF-02 | Login & autentikasi per peran | `POST /api/auth/login` → JWT berisi `sub`, `role`, `exp` | `app/api/auth.py`, `app/security.py` |
| RF-03 | Logout | `POST /api/auth/logout`, token dibuang di klien, sesi dikosongkan | `app/api/auth.py`, `static/js/api.js` |
| RF-04 | Analisis keluhan | `POST /api/customer/analyze` → mesin inferensi gejala → kerusakan (rata-rata < 50 ms) | `app/ai/engine.py` |
| RF-05 | Estimasi biaya | Hasil analisis menyertakan rentang harga sparepart + jasa dari database | `app/ai/engine.py`, `app/models.py` |
| RF-06 | Membuat tiket servis | `POST /api/tickets` dari analisis atau pilih manual | `app/api/tickets.py` |
| RF-07 | Daftar antrean mekanik | `GET /api/workshop/board` dikelompokkan masuk/dikerjakan/selesai | `app/api/workshop.py`, `pages/mechanic.js` |
| RF-08 | Ajukan tambahan item | `POST /api/workshop/tickets/<id>/items` → tiket jadi `menunggu_approval` | `app/api/workshop.py` |
| RF-09 | Notifikasi approval | `GET /api/notifications?after=<kursor>` dipoll 8 detik; badge + toast + kartu "Butuh keputusanmu" | `app/api/notifications.py`, `static/js/app.js` |
| RF-10 | Respon setuju/tolak | `POST /api/tickets/<id>/decision` menghitung ulang total tagihan | `app/api/tickets.py` |
| RF-11 | Kelola sparepart (CRUD) | `GET/POST /api/admin/parts`, `PUT/DELETE /api/admin/parts/<id>` | `app/api/admin.py`, `pages/admin.js` |
| RF-12 | Kelola akun mekanik | `GET/POST /api/admin/mechanics`, `PUT /api/admin/mechanics/<id>` (aktif/nonaktif) | `app/api/admin.py` |
| RF-13 | Kasir / selesaikan transaksi | `GET /api/admin/cashier`, `POST /api/admin/cashier/<id>/pay` (tunai & non-tunai) | `app/api/admin.py` |
| RF-14 | Pembaruan stok otomatis | Stok dipotong saat pembayaran, dengan `SELECT … FOR UPDATE` agar aman dari race condition | `app/api/admin.py:289` |
| RF-15 | Nota digital | `GET /api/tickets/<id>/nota` + halaman `#/nota/<id>` siap cetak | `app/api/tickets.py`, `pages/nota.js` |
| RF-16 | Riwayat servis | `GET /api/customer/summary` + halaman `#/customer/riwayat` berisi total biaya per kendaraan | `pages/customer.js` |
| RF-17 | Laporan pendapatan | `GET /api/admin/dashboard?period=harian/bulanan` + ekspor `…/export.csv` | `app/api/admin.py`, `pages/admin.js` |

### 4.2 Kebutuhan Non-Fungsional (15/15)

| ID | Kebutuhan | Status | Catatan bukti |
| --- | --- | --- | --- |
| NFR-01 | Estimasi < 4 detik | ✅ | Mesin inferensi lokal, terukur ± 40–120 ms |
| NFR-02 | Cari/filter sparepart < 2 detik | ✅ | Filter di server + indeks pada kolom kunci |
| NFR-03 | Fallback bila AI timeout | ✅ | Analisis selalu lokal (tanpa API eksternal) + tersedia mode "Pilih Manual" di UI |
| NFR-04 | Uptime 24/7 | ⚠️ | Di luar kendali aplikasi — bergantung hosting; arsitektur stateless sudah siap |
| NFR-05 | Row-level locking inventaris | ✅ | `with_for_update()` pada transaksi pembayaran |
| NFR-06 | Validasi JWT di backend | ✅ | Dekorator `@require_auth` / `@require_role` |
| NFR-07 | Password Bcrypt | ✅ | `bcrypt.hashpw(..., rounds=12)` |
| NFR-08 | Masking nomor HP di layar mekanik | ✅ | `User.masked_phone` → `0812-****-1234` |
| NFR-09 | High contrast + tombol ≥ 44×44 px | ✅ | `.btn` `min-height: 48px`, `.btn--sm` & `.btn--icon` 44 px |
| NFR-10 | Tipografi notifikasi jelas | ✅ | Kartu approval font besar, tombol setuju/tolak kontras tinggi |
| NFR-11 | SPA responsif di mobile | ✅ | Layout adaptif < 720 px (tabel antrean jadi kartu), sudah diuji di viewport 390 px |
| NFR-12 | ≥ 50 koneksi bersamaan | ⚠️ | Flask dev server single-process; siap dijalankan di Waitress/Gunicorn untuk uji beban nyata |
| NFR-13 | Auto-backup 23:59 WITA | ✅ | `scripts/backup.py` + `register_backup_task.ps1` (Task Scheduler), retensi 14 hari |
| NFR-14 | Dokumentasi API otomatis | ✅ | Swagger UI di `/api/docs`, spec JSON di `/api/openapi.json` |
| NFR-15 | Pertukaran data JSON | ✅ | Seluruh endpoint mengembalikan `application/json`; harga selalu integer rupiah |

Keterangan: ✅ terpenuhi dan bisa dibuktikan saat demo · ⚠️ terpenuhi sebagian, alasannya dijelaskan jujur di bawah.

### 4.3 Deviasi & Trade-off (jujur, siap ditanya penguji)

1. **RF-04 "AI/NLP Machine Learning" → mesin inferensi rule-based.**
   Tidak memakai model terlatih karena tidak ada dataset keluhan berlabel. Pendekatan yang dipakai:
   tokenisasi teks → pencocokan kamus gejala (sinonim, bobot, ambang skor) → pemeringkatan
   kandidat kerusakan. Konsekuensinya deterministik dan tidak butuh GPU/API berbayar; untuk
   produksi jalur peningkatan berikutnya adalah mengganti `engine.py` dengan model klasifikasi
   (mis. TF-IDF + Naive Bayes) tanpa mengubah kontrak API.
2. **RF-14 "trigger/stored procedure database" → pemotongan stok di level aplikasi.**
   Alasan: dengan trigger DB ditambah pengurangan di aplikasi, stok bisa terpotong dua kali.
   Yang dipakai adalah transaksi tunggal + `SELECT … FOR UPDATE`, sehingga jaminan
   konsistensinya setara row-level locking yang diminta NFR-05.
3. **NFR-04 & NFR-12 adalah properti deployment, bukan kode.**
   Aplikasi sudah stateless (JWT, tanpa session server), jadi tinggal dijalankan di belakang
   Waitress/Gunicorn + Nginx untuk memenuhi konkurensi dan uptime.
4. **HTTPS tidak aktif di lingkungan lokal.** Untuk demo cukup `http://127.0.0.1:5000`; di produksi
   wajib TLS di reverse proxy.

---

## 5. Fitur Pendukung untuk Demo

| Fitur | Cara akses |
| --- | --- |
| Swagger UI | <http://127.0.0.1:5000/api/docs> |
| Spec OpenAPI JSON | <http://127.0.0.1:5000/api/openapi.json> |
| Health check | <http://127.0.0.1:5000/api/health> |
| Ekspor laporan CSV | Tombol **Unduh CSV** di dashboard admin, atau `GET /api/admin/dashboard/export.csv?period=bulanan` |
| Jejak aktivitas tiket | Kartu "Jejak aktivitas" di detail tiket customer & mekanik (model `TicketEvent`) |
| Notifikasi | Badge lonceng di navigasi + toast, polling 8 detik |

### Tema visual bengkel

Ornamen tidak berhenti di landing page — dipakai konsisten di dalam aplikasi:

| Lokasi | Ornamen |
| --- | --- |
| Navbar semua halaman | hazard tape tipis (kuning–hitam) di kaki navbar |
| Landing `#/` | marquee berjalan, ban berputar, cipratan oli, papan 6 layanan, hazard di atas footer |
| Login / Registrasi `#/login` | ban & cipratan oli versi latar gelap di panel kiri, hazard di dasarnya |
| Beranda customer `#/customer` | baris chip **keluhan cepat** berikon bengkel (oli, ban, rem, kelistrikan, AC, tune up) yang sekali klik mengisi kolom keluhan |
| Papan mekanik `#/mekanik` | hazard tape sebagai pembatas header papan tugas |
| Loading state | ban berputar, bukan spinner generik |

### Backup manual & penjadwalan

```powershell
python scripts\backup.py --keep 14     # buat backup, simpan 14 terakhir
python scripts\backup.py --list        # daftar backup yang ada
powershell -ExecutionPolicy Bypass -File scripts\register_backup_task.ps1   # daftar 23:59 harian
```

Hasil backup berupa `backups/bisa-YYYYMMDD-HHMMSS.sql.gz`
(SQLite memakai `sqlite3.backup()`, MySQL memakai `mysqldump`).

---

## 6. Daftar 42 Endpoint API

**Publik / auth**

```
POST   /api/auth/register        POST  /api/auth/login        POST /api/auth/logout
GET    /api/auth/me              GET   /api/health
GET    /api/openapi.json         GET   /api/docs
GET    /api/notifications
```

**Customer**

```
POST   /api/customer/analyze                 GET    /api/customer/analyses
DELETE /api/customer/analyses/<id>           GET    /api/customer/damage-options
GET    /api/customer/summary                 GET    /api/customer/vehicles
POST   /api/customer/vehicles                DELETE /api/customer/vehicles/<id>
GET    /api/tickets                          POST   /api/tickets
GET    /api/tickets/<id>                     POST   /api/tickets/<id>/decision
GET    /api/tickets/<id>/nota
```

**Mekanik**

```
GET    /api/workshop/board                   GET    /api/workshop/catalog/parts
GET    /api/workshop/catalog/services        POST   /api/workshop/tickets/<id>/claim
POST   /api/workshop/tickets/<id>/items      POST   /api/workshop/tickets/<id>/finish
```

**Admin**

```
GET    /api/admin/dashboard                  GET    /api/admin/dashboard/export.csv
GET    /api/admin/cashier                    POST   /api/admin/cashier/<id>/pay
GET    /api/admin/parts                      POST   /api/admin/parts
PUT    /api/admin/parts/<id>                 DELETE /api/admin/parts/<id>
GET    /api/admin/services                   POST   /api/admin/services
PUT    /api/admin/services/<id>              GET    /api/admin/mechanics
POST   /api/admin/mechanics                  PUT    /api/admin/mechanics/<id>
GET    /api/admin/customers
```

---

## 7. Panduan Demo / Presentasi (7–8 menit)

Siapkan dua jendela browser: satu **mode normal**, satu **mode incognito** (untuk pindah peran
tanpa logout berulang).

| Waktu | Adegan | Yang ditunjukkan |
| --- | --- | --- |
| 0:00 | Landing page `#/` | Ornamen bengkel (ban berputar, cipratan oli, hazard tape), papan layanan, marquee, nilai "tanpa drama" |
| 0:40 | Daftar akun customer baru | RF-01, validasi form + pesan error per field |
| 1:10 | Customer: tambah kendaraan → ketik keluhan "rem bunyi berdecit saat ngerem" | RF-04, RF-05: estimasi muncul seketika beserta rincian harga |
| 2:00 | Buat tiket dari hasil analisis | RF-06, tiket jadi `MASUK` |
| 2:20 | Pindah ke incognito, login mekanik | RF-02, NFR-08: nomor HP pelanggan sudah ter-mask |
| 2:50 | Mekanik klaim tiket → tambah sparepart | RF-07, RF-08, tiket masuk `MENUNGGU APPROVAL` |
| 3:20 | Kembali ke customer | **RF-09**: badge lonceng + toast muncul < 10 detik; kartu "Butuh keputusanmu" |
| 3:50 | Customer tekan **Setuju** | RF-10: total tagihan berubah otomatis, tampil bedanya |
| 4:20 | Mekanik tandai selesai | RF-13 alur status |
| 4:40 | Login admin → Kasir → bayar | RF-13 + RF-14: stok sparepart berkurang di menu Inventaris |
| 5:20 | Buka nota digital, tekan Cetak | RF-15 |
| 5:50 | Dashboard: periode harian/bulanan → **Unduh CSV** | RF-17 |
| 6:20 | Buka `/api/docs` | NFR-14: 42 endpoint terdokumentasi otomatis |
| 6:40 | Detail tiket → "Jejak aktivitas" | Audit trail seluruh transisi status |
| 7:00 | Jalankan `scripts\backup.py` di terminal | NFR-13: file `.sql.gz` terbentuk |
| 7:30 | Persempit jendela ke lebar HP | NFR-11: layout tetap rapi, tabel antrean jadi kartu |

### Pertanyaan yang sering muncul

- **"AI-nya beneran machine learning?"** → Jujur: rule-based + kamus gejala. Jelaskan alasannya
  (tanpa dataset berlabel) dan tunjukkan titik penggantiannya di `app/ai/engine.py`.
- **"Kenapa stok tidak pakai trigger DB?"** → Hindari pemotongan ganda; gantinya transaksi +
  `SELECT … FOR UPDATE` yang setara row-level locking.
- **"Kenapa notifikasinya polling, bukan WebSocket?"** → Tanpa broker tambahan, cukup untuk beban
  bengkel, dan tetap near-real-time (8 detik). Jalur peningkatan: SSE/WebSocket.
- **"Data uji di mana?"** → `app/seed.py` mengisi jasa, sparepart, akun demo, dan beberapa tiket historis.

---

## 8. Troubleshooting

| Gejala | Penyebab & solusi |
| --- | --- |
| `Can't connect to MySQL` | MariaDB/MySQL belum jalan, atau kredensial `.env` salah. Untuk demo cepat: `DB_ENGINE=sqlite` |
| Halaman putih / 404 aset | Server dijalankan dari folder lain. Jalankan `python run.py` dari root proyek |
| Login gagal padahal password benar | Database lama dari skema sebelumnya. Hapus `bisa.db` (mode SQLite), jalankan ulang agar seed baru dibuat |
| Notifikasi tidak muncul | Pastikan dua akun berbeda (customer & mekanik) aktif di dua jendela; polling berjalan 8 detik |
| `python` tidak dikenali | Gunakan `py run.py`, atau pastikan Python 3.12 masuk PATH |
| Port 5000 dipakai | Set `PORT=5001` di `.env` lalu buka port tersebut |

---

## 9. Catatan Keamanan

- `.env` berisi `SECRET_KEY` dan `JWT_SECRET` — **jangan** di-commit/di-zip ke publik.
- `JWT_EXPIRES_HOURS` default 12 jam; token disimpan di `localStorage` dan dikirim sebagai
  header `Authorization: Bearer <token>`.
- Semua endpoint non-publik melewati guard peran; percobaan akses lintas peran menghasilkan 403.
- Ekspor CSV hanya untuk admin (403 untuk peran lain).
