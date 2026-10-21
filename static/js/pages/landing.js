/* Halaman publik / landing. */

import { session } from "../api.js";
import { icon, rupiah } from "../ui.js";

const ROLE_HOME = { customer: "#/customer", mekanik: "#/mekanik", admin: "#/admin" };

export async function renderLanding(root) {
  const user = session.user;
  const primaryHref = user ? ROLE_HOME[user.role] || "#/login" : "#/register";
  const primaryLabel = user ? "Buka Dashboard" : "Coba Sekarang";

  root.innerHTML = `
    <div class="marquee" aria-hidden="true">
      <div class="marquee__track">
        ${Array.from({ length: 2 })
          .map(
            () => `
          <span class="marquee__item">${icon("bot", 14)} Diagnosis AI</span>
          <span class="marquee__item">${icon("oil", 14)} Ganti Oli</span>
          <span class="marquee__item">${icon("tire", 14)} Ban & Balancing</span>
          <span class="marquee__item">${icon("check", 14)} Approval Real-time</span>
          <span class="marquee__item">${icon("print", 14)} Nota Digital</span>
          <span class="marquee__item">${icon("package", 14)} Stok Otomatis</span>`,
          )
          .join("")}
      </div>
    </div>

    <section class="hero">
      <div class="grid-overlay" aria-hidden="true"></div>
      <div class="deco-oil" aria-hidden="true"></div>
      <div class="deco-tire" aria-hidden="true"></div>
      <div class="container hero__grid">
        <div class="stack">
          <span class="hero__sticker">Bengkel Integrated Service Application</span>
          <h1 class="display hero__title">
            <span>Bengkel</span>
            <span>Tanpa</span>
            <span class="display--stroke">Drama.</span>
          </h1>
          <p class="lead" style="max-width:52ch">
            Ketik keluhan kendaraanmu, dapatkan estimasi biaya dalam hitungan detik.
            Setiap tambahan sparepart harus kamu setujui dulu — tidak ada tagihan kejutan
            saat mengambil mobil.
          </p>
          <div class="btn-row">
            <a class="btn btn--primary btn--lg" href="${primaryHref}">
              ${icon("bot", 20)} ${primaryLabel}
            </a>
            <a class="btn btn--lg" href="#alur">${icon("arrow", 18)} Lihat Alur</a>
          </div>
          <div class="row" style="gap:10px">
            <span class="chip">${icon("shield", 14)} Tanpa biaya tersembunyi</span>
            <span class="chip">${icon("clock", 14)} Estimasi &lt; 4 detik</span>
            <span class="chip">${icon("car", 14)} Mobil & motor</span>
          </div>
        </div>

        <div class="hero__art">
          <span class="floating-badge" style="top:-18px;right:8px;background:var(--red)">AI ON</span>
          <span class="floating-badge" style="bottom:120px;left:-18px;background:var(--yellow)">ESTIMASI AWAL</span>

          <article class="card hero__card">
            <div class="row-between" style="margin-bottom:14px">
              <span class="badge badge--dark">HASIL DIAGNOSIS</span>
              <span class="badge badge--yellow badge--pill">98% cocok</span>
            </div>
            <h3 class="h3" style="margin-bottom:4px">Sistem Rem</h3>
            <p class="small muted" style="margin-bottom:16px">Keluhan: "rem bunyi berdecit saat ngerem"</p>
            <div class="result-item">
              <span class="small">Kampas Rem Depan</span>
              <strong class="small">${rupiah(185000)}</strong>
            </div>
            <div class="result-item">
              <span class="small">Minyak Rem DOT 4</span>
              <strong class="small">${rupiah(45000)}</strong>
            </div>
            <div class="result-item">
              <span class="small">Jasa Ganti Kampas</span>
              <strong class="small">${rupiah(75000)}</strong>
            </div>
            <div class="range-box" style="margin-top:16px">
              <span class="eyebrow" style="opacity:.75">Rentang estimasi</span>
              <span class="range-box__value">${rupiah(290000)} – ${rupiah(350000)}</span>
            </div>
          </article>

          <article class="card card--flat hero__card--alt" style="background:var(--yellow)">
            <div class="row" style="gap:12px">
              <span class="empty__icon" style="width:44px;height:44px;background:var(--white)">${icon("wrench", 22)}</span>
              <div>
                <p class="small" style="letter-spacing:.14em">TAMBAHAN DIAJUKAN</p>
                <p class="h3" style="font-size:1rem">Filter kabin — ${rupiah(75000)}</p>
              </div>
            </div>
            <div class="btn-row" style="margin-top:12px">
              <span class="btn btn--sm btn--secondary">${icon("check", 14)} Setuju</span>
              <span class="btn btn--sm">${icon("x", 14)} Tolak</span>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section class="garage-bar" aria-label="Layanan bengkel yang ditangani">
      <div class="container garage-bar__inner">
        <span class="garage-bar__label">${icon("wrench", 16)} Ditangani</span>
        <div class="garage-tags">
          <span class="garage-tag">${icon("oil", 14)} Ganti Oli</span>
          <span class="garage-tag">${icon("tire", 14)} Ban &amp; Balancing</span>
          <span class="garage-tag">${icon("wrench", 14)} Sistem Rem</span>
          <span class="garage-tag">${icon("gauge", 14)} Tune Up</span>
          <span class="garage-tag">${icon("bolt", 14)} Kelistrikan</span>
          <span class="garage-tag">${icon("shield", 14)} AC &amp; Radiator</span>
        </div>
      </div>
    </section>

    <section class="section" id="alur">
      <div class="container stack">
        <div class="row-between">
          <div class="stack-sm">
            <span class="eyebrow">Cara kerja</span>
            <h2 class="h2">Tiga langkah,<br />nol drama.</h2>
          </div>
          <p class="lead muted" style="max-width:38ch">
            Alur yang sama dipakai pelanggan, mekanik, dan admin — semua tercatat
            dalam satu tiket servis.
          </p>
        </div>

        <div class="grid grid-3">
          <article class="card card--hover">
            <div class="step">
              <span class="step__num">01</span>
              <div class="stack-sm">
                <h3 class="h3">Ceritakan keluhan</h3>
                <p class="lead">Tulis keluhan dengan bahasa sehari-hari. AI memetakan ke komponen yang paling mungkin bermasalah.</p>
              </div>
            </div>
          </article>
          <article class="card card--hover" style="background:var(--violet)">
            <div class="step">
              <span class="step__num" style="background:var(--white)">02</span>
              <div class="stack-sm">
                <h3 class="h3">Lihat estimasi</h3>
                <p class="lead">Rentang harga sparepart dan ongkos jasa muncul transparan, lengkap dengan tingkat keyakinan.</p>
              </div>
            </div>
          </article>
          <article class="card card--hover">
            <div class="step">
              <span class="step__num">03</span>
              <div class="stack-sm">
                <h3 class="h3">Setujui & bayar</h3>
                <p class="lead">Tambahan biaya butuh persetujuanmu. Setelah lunas, nota digital langsung bisa diunduh.</p>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section class="section" style="border-block:4px solid #000;background:var(--paper)">
      <div class="container stack">
        <span class="eyebrow">Untuk semua pihak</span>
        <h2 class="h2">Satu sistem,<br />tiga sudut pandang.</h2>

        <div class="grid grid-3">
          <article class="card card--hover">
            <span class="badge badge--violet">Customer</span>
            <h3 class="h3 mt-4">Pegang kendali biaya</h3>
            <ul class="stack-sm mt-4" style="font-weight:500;line-height:1.5">
              <li>Diagnosis keluhan berbasis teks</li>
              <li>Riwayat servis & nota digital</li>
              <li>Setuju/tolak tambahan biaya</li>
            </ul>
          </article>
          <article class="card card--hover">
            <span class="badge badge--yellow">Mekanik</span>
            <h3 class="h3 mt-4">Kerja tanpa ribet</h3>
            <ul class="stack-sm mt-4" style="font-weight:500;line-height:1.5">
              <li>Papan antrean Kanban</li>
              <li>Tombol besar, kontras tinggi</li>
              <li>Ajukan tambahan dengan alasan</li>
            </ul>
          </article>
          <article class="card card--hover">
            <span class="badge badge--red">Admin</span>
            <h3 class="h3 mt-4">Kontrol penuh bengkel</h3>
            <ul class="stack-sm mt-4" style="font-weight:500;line-height:1.5">
              <li>Kasir & pemotongan stok otomatis</li>
              <li>Master sparepart dan jasa</li>
              <li>Laporan pendapatan harian</li>
            </ul>
          </article>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="card card--dark" style="padding:var(--s7)">
          <div class="row-between" style="align-items:flex-end">
            <div class="stack-sm">
              <span class="eyebrow" style="color:var(--yellow)">Mulai sekarang</span>
              <h2 class="display" style="font-size:clamp(2rem,5vw,4rem)">Servis tanpa<br /><span style="color:var(--yellow)">kaget harga.</span></h2>
            </div>
            <div class="stack-sm" style="max-width:32ch">
              <p class="lead">Buat akun customer gratis, atau masuk dengan akun demo untuk melihat sisi mekanik dan admin.</p>
              <div class="btn-row">
                <a class="btn btn--secondary" href="${primaryHref}">${icon("arrow", 18)} ${primaryLabel}</a>
                <a class="btn" href="#/login">Akun demo</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="hazard hazard--footer" aria-hidden="true"></div>
    <footer style="border-top:4px solid #000;background:var(--yellow);padding-block:32px">      <div class="container row-between">
        <div class="row">
          <span class="brand__mark" style="background:var(--white)">B</span>
          <div>
            <p class="h3">BISA</p>
            <p class="small muted">Bengkel Integrated Service Application</p>
          </div>
        </div>
        <p class="small">Proyek IPPL · ${new Date().getFullYear()}</p>
      </div>
    </footer>`;
}
