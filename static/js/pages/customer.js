/* Halaman sisi Customer. */

import { api, session } from "../api.js";
import {
  badge,
  confirmDialog,
  dateID,
  emptyState,
  esc,
  fillErrors,
  formValues,
  icon,
  openModal,
  closeModal,
  rupiah,
  statusBadge,
  timeAgo,
  toast,
} from "../ui.js";

/* --------------------------------------------------------------- Helper */

/* Contoh keluhan cepat bertema bengkel: sekali klik langsung mengisi textarea. */
const QUICK_COMPLAINTS = [
  { iconName: "oil", label: "Ganti oli", text: "sudah waktunya ganti oli, mesin terasa kasar dan tarikan berat" },
  { iconName: "tire", label: "Ban & balancing", text: "ban terasa goyang dan aus sebelah saat kecepatan tinggi" },
  { iconName: "wrench", label: "Rem", text: "rem bunyi berdecit dan pedal terasa blong saat mengerem" },
  { iconName: "bolt", label: "Kelistrikan", text: "mesin susah distarter dan lampu depan terasa redup" },
  { iconName: "shield", label: "AC & radiator", text: "AC tidak dingin dan ada bau tidak sedap, suhu mesin cepat naik" },
  { iconName: "gauge", label: "Tune up", text: "mesin idle tidak stabil dan konsumsi bensin jadi boros" },
];

function pageHead(eyebrow, title, description, actions = "") {
  return `
    <div class="row-between" style="align-items:flex-end;gap:var(--s5)">
      <div class="stack-sm">
        <span class="eyebrow">${esc(eyebrow)}</span>
        <h1 class="h2">${title}</h1>
        ${description ? `<p class="lead muted" style="max-width:56ch">${esc(description)}</p>` : ""}
      </div>
      ${actions ? `<div class="btn-row">${actions}</div>` : ""}
    </div>`;
}

function statCard(label, value, tone = "") {
  return `
    <div class="stat ${tone}">
      <span class="stat__label">${esc(label)}</span>
      <span class="stat__value">${value}</span>
    </div>`;
}

function vehicleLabel(ticket) {
  return ticket.vehicle ? ticket.vehicle.label : "Kendaraan";
}

function timeline(status) {
  const steps = [
    { key: "menunggu", label: "Tiket dibuat", hint: "Menunggu mekanik mengambil tiket" },
    { key: "dikerjakan", label: "Sedang dikerjakan", hint: "Mekanik memeriksa kendaraan" },
    { key: "selesai_pengerjaan", label: "Pengerjaan selesai", hint: "Menunggu pembayaran di kasir" },
    { key: "selesai", label: "Lunas", hint: "Nota digital tersedia" },
  ];
  const order = steps.map((step) => step.key);
  const activeIndex = Math.max(0, order.indexOf(status));

  return `
    <div class="timeline">
      ${steps
        .map((step, index) => {
          const done = index <= activeIndex;
          return `
          <div class="timeline__item">
            <span class="timeline__dot" style="${done ? "background:var(--red)" : "background:var(--white)"}"></span>
            <div>
              <p class="small" style="text-transform:uppercase;letter-spacing:.08em;${done ? "" : "opacity:.45"}">${step.label}</p>
              <p class="hint" style="${done ? "" : "opacity:.45"}">${step.hint}</p>
            </div>
          </div>`;
        })
        .join("")}
    </div>`;
}

function activityFeed(events) {
  if (!events || !events.length) {
    return `<p class="hint">Belum ada aktivitas tercatat.</p>`;
  }
  return `
    <ul class="feed">
      ${events
        .slice()
        .reverse()
        .map(
          (event, index) => `
        <li class="feed__item ${index === 0 ? "feed__item--latest" : ""}">
          <span class="feed__dot"></span>
          <div>
            <p class="feed__msg">${esc(event.message)}</p>
            <p class="feed__meta">${esc(event.actor)} · ${dateID(event.created_at)}</p>
          </div>
        </li>`,
        )
        .join("")}
    </ul>`;
}

function ticketCard(ticket) {
  return `
    <a class="card card--hover card--tight" href="#/customer/tiket/${ticket.id}" style="display:block">
      <div class="row-between" style="margin-bottom:10px">
        <span class="small" style="letter-spacing:.08em">${esc(ticket.code)}</span>
        ${statusBadge(ticket.status, ticket.status_label)}
      </div>
      <p class="small" style="margin-bottom:6px">${esc(vehicleLabel(ticket))}</p>
      <p style="font-size:.95rem;font-weight:700;line-height:1.35;margin-bottom:12px;
        display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">
        ${esc(ticket.complaint)}
      </p>
      <div class="row-between">
        <span class="small muted">${timeAgo(ticket.created_at)}</span>
        <strong class="small">${rupiah(ticket.total_amount)}</strong>
      </div>
      ${
        ticket.pending_count
          ? `<div class="warn-box" style="margin-top:10px">${icon("alert", 16)} ${ticket.pending_count} item butuh persetujuan Anda</div>`
          : ""
      }
    </a>`;
}

function vehicleSelect(vehicles, selectedId) {
  return `
    <select class="select" name="vehicle_id" required>
      <option value="">Pilih kendaraan…</option>
      ${vehicles
        .map(
          (vehicle) =>
            `<option value="${vehicle.id}" ${String(vehicle.id) === String(selectedId) ? "selected" : ""}>
              ${esc(vehicle.label)}
            </option>`,
        )
        .join("")}
    </select>`;
}

/* ---------------------------------------------------------- Beranda utama */

export async function renderCustomerHome(root) {
  const [summaryRes, vehiclesRes, ticketsRes, analysesRes, optionsRes] = await Promise.all([
    api("/api/customer/summary"),
    api("/api/customer/vehicles"),
    api("/api/tickets"),
    api("/api/customer/analyses"),
    api("/api/customer/damage-options"),
  ]);

  const summary = summaryRes.summary;
  const vehicles = vehiclesRes.vehicles;
  const tickets = ticketsRes.tickets;
  const analyses = analysesRes.analyses;
  const options = optionsRes.options;

  const pendingTickets = tickets.filter((ticket) => ticket.pending_count > 0);
  const pendingDetails = await Promise.all(
    pendingTickets.map((ticket) => api(`/api/tickets/${ticket.id}`).then((r) => r.ticket)),
  );
  const pendingItems = pendingDetails.flatMap((ticket) =>
    ticket.items
      .filter((item) => item.approval_status === "pending")
      .map((item) => ({ ticket, item })),
  );

  const activeTickets = tickets.filter((ticket) => !["selesai", "dibatalkan"].includes(ticket.status));
  const firstName = session.user.name.split(" ")[0];

  root.innerHTML = `
    <section class="container section stack" style="gap:var(--s6)">
      ${pageHead(
        `Halo, ${firstName}`,
        "Apa yang terasa<br />aneh hari ini?",
        "Ceritakan keluhan kendaraanmu dengan bahasa sehari-hari. Sistem akan menyiapkan estimasi awal sebelum kamu datang ke bengkel.",
        `<button class="btn" id="addVehicleBtn">${icon("plus", 16)} Tambah kendaraan</button>
         <a class="btn btn--dark" href="#/customer/riwayat">${icon("clock", 16)} Riwayat</a>`,
      )}

      <div class="grid grid-4">
        ${statCard("Tiket aktif", summary.active_tickets, "stat--yellow")}
        ${statCard("Butuh persetujuan", summary.pending_approvals, summary.pending_approvals ? "stat--red" : "")}
        ${statCard("Kendaraan", summary.vehicles, "stat--violet")}
        ${statCard("Total servis lunas", rupiah(summary.spent_total))}
      </div>

      ${pendingItems.length ? renderPendingPanel(pendingItems) : ""}

      <div class="split">
        <form class="complaint-box" id="analyzeForm" novalidate>
          <div class="stack-sm">
            <span class="eyebrow">AI Diagnostic Assistant</span>
            <h2 class="h2" style="font-size:1.9rem">Ceritakan keluhannya.</h2>
            <p class="small" style="font-weight:500;opacity:.8">
              Contoh: "rem depan bunyi berdecit dan pedal terasa blong saat mengerem"
            </p>
          </div>

          <div class="field">
            <label class="label" for="vehicle">Kendaraan</label>
            ${vehicleSelect(vehicles)}
            ${
              vehicles.length
                ? ""
                : `<span class="hint" style="color:#7a0000">Belum ada kendaraan. Tambahkan dulu lewat tombol di atas.</span>`
            }
          </div>

          <div class="field">
            <label class="label" for="complaint">Keluhan</label>
            <textarea class="textarea" id="complaint" name="complaint"
              placeholder="Tulis sedetail mungkin: kapan muncul, bunyi seperti apa, bagian mana yang terasa aneh…"
              maxlength="1000"></textarea>
            <div class="row-between">
              <span class="hint">Minimal 3 karakter agar bisa dianalisis.</span>
              <span class="hint" id="charCount">0 / 1000</span>
            </div>
            <div class="quick-fill" role="group" aria-label="Contoh keluhan cepat">
              <span class="quick-fill__label">${icon("wrench", 13)} Cepat</span>
              ${QUICK_COMPLAINTS.map(
                (item) => `<button class="quick-chip" type="button"
                  data-quick="${esc(item.text)}">${icon(item.iconName, 13)} ${esc(item.label)}</button>`,
              ).join("")}
            </div>
          </div>

          <div class="field">
            <label class="label" for="manual">Atau pilih jenis kerusakan manual</label>
            <select class="select" id="manual" name="manual_code">
              <option value="">Biarkan AI menganalisis</option>
              ${options
                .map((option) => `<option value="${option.code}">${esc(option.name)}</option>`)
                .join("")}
            </select>
          </div>

          <button class="btn btn--dark btn--lg btn--block" type="submit" id="analyzeBtn">
            ${icon("search", 18)} Cek Estimasi
          </button>
        </form>

        <div class="stack">
          <article class="card card--flat">
            <div class="row" style="gap:12px;margin-bottom:10px">
              <span class="empty__icon" style="width:44px;height:44px">${icon("shield", 22)}</span>
              <h3 class="h3">Cara kami menjaga harga</h3>
            </div>
            <p class="lead" style="font-size:.9rem">
              Estimasi dihitung dari master harga bengkel, bukan tebakan. Apa pun yang
              ditambahkan mekanik di luar estimasi wajib kamu setujui lebih dulu.
            </p>
          </article>

          ${
            summary.latest_ticket
              ? `<article class="card card--flat">
                   <span class="eyebrow">Tiket terakhir</span>
                   <p class="h3 mt-4" style="font-size:1.1rem">${esc(summary.latest_ticket.code)}</p>
                   <p class="small muted">${esc(vehicleLabel(summary.latest_ticket))}</p>
                   <div class="row mt-4">
                     ${statusBadge(summary.latest_ticket.status, summary.latest_ticket.status_label)}
                     <span class="small">${rupiah(summary.latest_ticket.total_amount)}</span>
                   </div>
                   <a class="btn btn--sm mt-4" href="#/customer/tiket/${summary.latest_ticket.id}">
                     Lihat tiket ${icon("arrow", 14)}
                   </a>
                 </article>`
              : `<article class="card card--flat">
                   <span class="eyebrow">Belum ada tiket</span>
                   <p class="lead mt-4">Analisis keluhan pertamamu, lalu buat tiket servis dari hasilnya.</p>
                 </article>`
          }

          ${
            vehicles.length
              ? `<article class="card card--flat">
                   <span class="eyebrow">Kendaraan terdaftar</span>
                   <div class="stack-sm mt-4">
                     ${vehicles
                       .map(
                         (vehicle) => `
                       <div class="row-between" style="border-bottom:2px dashed rgba(0,0,0,.2);padding-bottom:8px">
                         <div>
                           <p class="small">${esc(vehicle.plate_number)}</p>
                           <p class="hint">${esc([vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(" "))}</p>
                         </div>
                         ${icon("car", 18)}
                       </div>`,
                       )
                       .join("")}
                   </div>
                 </article>`
              : ""
          }
        </div>
      </div>

      <div id="analysisResult"></div>

      <section class="stack">
        <div class="row-between">
          <h2 class="h3">Tiket aktif</h2>
          <a class="btn btn--sm" href="#/customer/tiket">Semua tiket ${icon("arrow", 14)}</a>
        </div>
        ${
          activeTickets.length
            ? `<div class="grid grid-3">${activeTickets.slice(0, 3).map(ticketCard).join("")}</div>`
            : emptyState({
                iconName: "receipt",
                title: "Belum ada tiket aktif",
                text: "Tiket akan muncul di sini setelah kamu membuatnya dari hasil analisis.",
              })
        }
      </section>

      ${
        analyses.length
          ? `<section class="stack">
               <div class="row-between">
                 <h2 class="h3">Riwayat analisis terakhir</h2>
                 <span class="badge badge--outline">${analyses.length} tercatat</span>
               </div>
               <div class="grid grid-3">
                 ${analyses.slice(0, 3).map(analysisCard).join("")}
               </div>
             </section>`
          : ""
      }
    </section>`;

  bindHome(root, { vehicles, options, pendingItems });
}

function analysisCard(analysis) {
  return `
    <article class="card card--tight">
      <div class="row-between" style="margin-bottom:8px">
        <span class="badge badge--violet badge--sm">AI</span>
        <span class="hint">${timeAgo(analysis.created_at)}</span>
      </div>
      <p class="small" style="margin-bottom:8px;line-height:1.4">${esc(analysis.complaint)}</p>
      <div class="row-between">
        <span class="small muted">${esc(analysis.summary || "Analisis")}</span>
        <strong class="small">${rupiah(analysis.estimate_min)}–${rupiah(analysis.estimate_max)}</strong>
      </div>
    </article>`;
}

function renderPendingPanel(pendingItems) {
  return `
    <section class="card" style="background:var(--yellow)">
      <div class="row-between" style="margin-bottom:var(--s4)">
        <div class="row" style="gap:12px">
          <span class="empty__icon" style="width:44px;height:44px;background:var(--white)">${icon("alert", 22)}</span>
          <div>
            <span class="eyebrow">Butuh keputusanmu</span>
            <h2 class="h3">${pendingItems.length} item tambahan menunggu persetujuan</h2>
          </div>
        </div>
        <span class="badge badge--dark">Total ${rupiah(
          pendingItems.reduce((sum, entry) => sum + entry.item.subtotal, 0),
        )}</span>
      </div>

      <div class="stack-sm">
        ${pendingItems
          .map(
            ({ ticket, item }) => `
          <div class="card card--tight" style="box-shadow:var(--shadow-xs)">
            <div class="row-between">
              <div class="stack-sm" style="gap:2px">
                <span class="small">${esc(item.name)} · ${item.qty}×</span>
                <span class="hint">${esc(item.reason || "Tambahan dari mekanik")}</span>
                <span class="hint">Tiket ${esc(ticket.code)} · ${esc(vehicleLabel(ticket))}</span>
              </div>
              <div class="row">
                <strong class="small nowrap">${rupiah(item.subtotal)}</strong>
                <button class="btn btn--sm" data-reject="${item.id}" data-ticket="${ticket.id}">
                  ${icon("x", 14)} Tolak
                </button>
                <button class="btn btn--sm btn--primary" data-approve="${item.id}" data-ticket="${ticket.id}">
                  ${icon("check", 14)} Setuju
                </button>
              </div>
            </div>
          </div>`,
          )
          .join("")}
      </div>
    </section>`;
}

function bindHome(root, ctx) {
  const form = document.getElementById("analyzeForm");
  const textarea = document.getElementById("complaint");
  const counter = document.getElementById("charCount");
  const resultHost = document.getElementById("analysisResult");
  let lastResult = null;

  textarea?.addEventListener("input", () => {
    counter.textContent = `${textarea.value.length} / 1000`;
  });

  /* Chip "Cepat": isi keluhan contoh sesuai kategori bengkel. */
  root.querySelectorAll("[data-quick]").forEach((chip) => {
    chip.addEventListener("click", () => {
      if (!textarea) return;
      textarea.value = chip.dataset.quick;
      textarea.dispatchEvent(new Event("input"));
      textarea.focus();
    });
  });

  document.getElementById("addVehicleBtn")?.addEventListener("click", () => {
    openVehicleModal(() => renderCustomerHome(root));
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    fillErrors(form, {});

    const values = formValues(form);
    const button = document.getElementById("analyzeBtn");

    if (!values.complaint && !values.manual_code) {
      fillErrors(form, { complaint: "Harap ketikkan detail keluhan kendaraan Anda." });
      textarea.focus();
      return;
    }
    if (!values.vehicle_id) {
      const select = form.querySelector('[name="vehicle_id"]');
      select.classList.add("input--error");
      toast("Pilih kendaraan terlebih dahulu.", "error");
      return;
    }

    button.disabled = true;
    button.innerHTML = `${icon("clock", 18)} Menganalisis…`;

    try {
      const data = await api("/api/customer/analyze", {
        method: "POST",
        body: {
          complaint: values.complaint,
          manual_code: values.manual_code || null,
          vehicle_id: values.vehicle_id,
        },
      });
      lastResult = data.result;
      resultHost.innerHTML = renderAnalysisResult(data.result);
      resultHost.scrollIntoView({ behavior: "smooth", block: "start" });
      bindResultActions(resultHost, lastResult, values.vehicle_id);
      toast("Estimasi berhasil dibuat.", "success");
    } catch (error) {
      fillErrors(form, error.fields || {});
      toast(error.message, "error");
    } finally {
      button.disabled = false;
      button.innerHTML = `${icon("search", 18)} Cek Estimasi`;
    }
  });

  root.querySelectorAll("[data-approve], [data-reject]").forEach((button) => {
    button.addEventListener("click", async () => {
      const decision = button.dataset.approve ? "approved" : "rejected";
      const itemId = button.dataset.approve || button.dataset.reject;
      const ticketId = button.dataset.ticket;

      button.disabled = true;
      try {
        const data = await api(`/api/tickets/${ticketId}/decision`, {
          method: "POST",
          body: { item_id: Number(itemId), decision },
        });
        toast(data.message, "success");
        await renderCustomerHome(root);
      } catch (error) {
        toast(error.message, "error");
        button.disabled = false;
      }
    });
  });
}

function renderAnalysisResult(result) {
  const hasMissing = result.missing_prices && result.missing_prices.length;

  return `
    <section class="stack" id="resultSection">
      <div class="row-between">
        <div class="stack-sm">
          <span class="eyebrow">Hasil analisis</span>
          <h2 class="h2" style="font-size:1.7rem">${esc(result.summary || "Estimasi awal")}</h2>
        </div>
        <span class="badge ${result.fallback ? "badge--outline" : "badge--violet"}">
          ${result.fallback ? "Belum terpetakan" : `${result.damages.length} indikasi`}
        </span>
      </div>

      ${
        result.fallback
          ? `<div class="warn-box">${icon("alert", 18)}
               Keluhan belum dikenali otomatis. Kamu bisa memilih jenis kerusakan secara manual,
               atau lanjut dengan inspeksi menyeluruh oleh mekanik.</div>`
          : ""
      }

      <div class="grid grid-2">
        <div class="stack-sm">
          ${result.damages
            .map(
              (damage) => `
            <article class="card card--tight">
              <div class="row-between" style="margin-bottom:10px">
                <h3 class="h3" style="font-size:1rem">${esc(damage.name)}</h3>
                ${badge(`Risiko ${damage.severity}`, damage.severity === "Tinggi" ? "badge--red" : damage.severity === "Sedang" ? "badge--yellow" : "badge--outline")}
              </div>
              <p class="small" style="font-weight:500;line-height:1.45;margin-bottom:10px">${esc(damage.advice)}</p>
              <div class="row-between" style="margin-bottom:6px">
                <span class="hint">Keyakinan sistem</span>
                <span class="small">${damage.confidence}%</span>
              </div>
              <div class="confidence"><div class="confidence__fill" style="width:${damage.confidence}%"></div></div>
            </article>`,
            )
            .join("")}
        </div>

        <div class="stack-sm">
          <article class="card card--flat">
            <div class="row-between" style="margin-bottom:var(--s3)">
              <h3 class="h3" style="font-size:1rem">Rincian estimasi</h3>
              <span class="badge badge--sm">${result.items.length} item</span>
            </div>

            ${result.items
              .map(
                (item) => `
              <div class="result-item">
                <div>
                  <p class="small">${esc(item.name)}</p>
                  <p class="hint">${item.kind === "part" ? "Sparepart" : "Jasa"}${item.qty > 1 ? ` · ${item.qty}×` : ""}</p>
                </div>
                <strong class="small nowrap">${rupiah(item.unit_price * item.qty)}</strong>
              </div>`,
              )
              .join("")}

            ${
              hasMissing
                ? `<div class="warn-box" style="margin-top:12px">${icon("alert", 16)}
                     Harga belum tersedia, akan diestimasi langsung oleh mekanik.</div>`
                : ""
            }

            <div class="range-box" style="margin-top:var(--s4)">
              <span class="eyebrow" style="opacity:.75">Rentang estimasi</span>
              <span class="range-box__value">${rupiah(result.estimate_min)} – ${rupiah(result.estimate_max)}</span>
              <span class="hint" style="color:rgba(255,255,255,.7)">Harga final ditentukan setelah inspeksi mekanik.</span>
            </div>

            <button class="btn btn--primary btn--block btn--lg mt-4" id="createTicketBtn">
              ${icon("receipt", 18)} Buat Tiket Servis
            </button>
            <p class="hint text-center mt-4">${esc(result.note)}</p>
          </article>
        </div>
      </div>
    </section>`;
}

function bindResultActions(host, result, vehicleId) {
  const button = document.getElementById("createTicketBtn");
  if (!button) return;

  button.addEventListener("click", async () => {
    button.disabled = true;
    button.innerHTML = `${icon("clock", 18)} Membuat tiket…`;

    try {
      const data = await api("/api/tickets", {
        method: "POST",
        body: {
          vehicle_id: Number(vehicleId),
          complaint: result.complaint,
          items: result.items,
          estimate_min: result.estimate_min,
          estimate_max: result.estimate_max,
        },
      });
      toast(data.message, "success");
      location.hash = `#/customer/tiket/${data.ticket.id}`;
    } catch (error) {
      toast(error.message, "error");
      button.disabled = false;
      button.innerHTML = `${icon("receipt", 18)} Buat Tiket Servis`;
    }
  });
}

/* ------------------------------------------------------------ Modal kendaraan */

function openVehicleModal(onDone) {
  const overlay = openModal({
    title: "Tambah kendaraan",
    body: `
      <form id="vehicleForm" class="stack" novalidate>
        <div class="field">
          <label class="label" for="plate">Plat nomor</label>
          <input class="input" id="plate" name="plate_number" placeholder="DD 1234 AB" required />
        </div>
        <div class="grid grid-2" style="gap:var(--s3)">
          <div class="field">
            <label class="label" for="brand">Merek</label>
            <input class="input" id="brand" name="brand" placeholder="Toyota" />
          </div>
          <div class="field">
            <label class="label" for="model">Model</label>
            <input class="input" id="model" name="model" placeholder="Avanza" />
          </div>
        </div>
        <div class="field">
          <label class="label" for="year">Tahun</label>
          <input class="input" id="year" name="year" type="number" min="1980" max="2100" placeholder="2019" />
        </div>
      </form>`,
    footer: `
      <button class="btn" data-modal-close>Batal</button>
      <button class="btn btn--primary" id="saveVehicle">${icon("check", 16)} Simpan</button>`,
  });

  const form = overlay.querySelector("#vehicleForm");

  overlay.querySelector("#saveVehicle").addEventListener("click", async () => {
    fillErrors(form, {});
    const values = formValues(form);

    if (!values.plate_number) {
      fillErrors(form, { plate_number: "Plat nomor wajib diisi." });
      return;
    }

    try {
      await api("/api/customer/vehicles", {
        method: "POST",
        body: {
          plate_number: values.plate_number,
          brand: values.brand,
          model: values.model,
          year: values.year || null,
        },
      });
      closeModal();
      toast("Kendaraan berhasil ditambahkan.", "success");
      onDone();
    } catch (error) {
      fillErrors(form, error.fields || {});
      toast(error.message, "error");
    }
  });
}

/* ------------------------------------------------------------- Daftar tiket */

export async function renderCustomerTickets(root) {
  const { tickets } = await api("/api/tickets");

  root.innerHTML = `
    <section class="container section stack">
      ${pageHead("Tiket servis", "Semua tiket.", "Pantau status pengerjaan dan riwayat persetujuan biaya.", `
        <a class="btn btn--dark" href="#/customer">${icon("plus", 16)} Tiket baru</a>
      `)}

      <div class="row" id="filterRow">
        ${[
          ["all", "Semua"],
          ["active", "Aktif"],
          ["selesai", "Selesai"],
        ]
          .map(
            ([key, label], index) => `
          <button class="btn btn--sm ${index === 0 ? "btn--secondary" : ""}" data-filter="${key}">
            ${label}
          </button>`,
          )
          .join("")}
      </div>

      <div id="ticketList"></div>
    </section>`;

  const list = document.getElementById("ticketList");

  const draw = (filter) => {
    const filtered = tickets.filter((ticket) => {
      if (filter === "active") return !["selesai", "dibatalkan"].includes(ticket.status);
      if (filter === "selesai") return ticket.status === "selesai";
      return true;
    });

    list.innerHTML = filtered.length
      ? `<div class="grid grid-3">${filtered.map(ticketCard).join("")}</div>`
      : emptyState({
          iconName: "receipt",
          title: "Tidak ada tiket di kategori ini",
          text: "Coba filter lain atau buat tiket baru dari hasil analisis.",
        });
  };

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-filter]").forEach((other) => other.classList.remove("btn--secondary"));
      button.classList.add("btn--secondary");
      draw(button.dataset.filter);
    });
  });

  draw("all");
}

/* ------------------------------------------------------------ Detail tiket */

export async function renderCustomerTicket(root, params) {
  const ticketId = params[0];
  const { ticket } = await api(`/api/tickets/${ticketId}`);

  const canApprove = !["selesai", "dibatalkan"].includes(ticket.status);
  const pending = ticket.items.filter((item) => item.approval_status === "pending");

  root.innerHTML = `
    <section class="container section stack">
      <a class="btn btn--sm btn--ghost" href="#/customer/tiket" style="align-self:flex-start">
        ${icon("arrow", 14)} Kembali ke daftar
      </a>

      <div class="row-between" style="align-items:flex-start">
        <div class="stack-sm">
          <span class="eyebrow">${esc(ticket.code)}</span>
          <h1 class="h2">${esc(vehicleLabel(ticket))}</h1>
          <p class="small muted">Dibuat ${dateID(ticket.created_at)} · Mekanik: ${esc(ticket.mechanic?.name || "belum ditugaskan")}</p>
        </div>
        <div class="row">
          ${statusBadge(ticket.status, ticket.status_label)}
          ${
            ticket.status === "selesai"
              ? `<a class="btn btn--sm btn--dark" href="#/nota/${ticket.id}">${icon("print", 14)} Nota</a>`
              : ""
          }
        </div>
      </div>

      <div class="grid grid-3" style="align-items:start">
        <div class="stack" style="grid-column:span 2">
          <article class="card">
            <div class="card__header card__header--violet">
              <span class="eyebrow">Keluhan pelanggan</span>
              ${badge(`${ticket.items.length} item`, "badge--dark badge--sm")}
            </div>
            <p class="lead">${esc(ticket.complaint)}</p>
          </article>

          <article class="card card--flat">
            <div class="row-between" style="margin-bottom:var(--s4)">
              <h3 class="h3">Rincian biaya</h3>
              <span class="small muted">${rupiah(ticket.estimate_min)} – ${rupiah(ticket.estimate_max)} (estimasi awal)</span>
            </div>

            <div class="table-wrap" style="box-shadow:none">
              <table class="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Sumber</th>
                    <th class="num">Harga</th>
                    <th>Status</th>
                    ${canApprove ? "<th></th>" : ""}
                  </tr>
                </thead>
                <tbody>
                  ${ticket.items
                    .map(
                      (item) => `
                    <tr>
                      <td>
                        <span class="small">${esc(item.name)}</span>
                        ${item.reason ? `<p class="hint">${esc(item.reason)}</p>` : ""}
                      </td>
                      <td><span class="hint">${item.source === "tambahan" ? "Tambahan" : "Estimasi"}</span></td>
                      <td class="num">${rupiah(item.subtotal)}</td>
                      <td>${statusBadge(item.approval_status)}</td>
                      ${
                        canApprove
                          ? `<td class="num">
                              ${
                                item.approval_status === "pending"
                                  ? `<div class="row" style="justify-content:flex-end;gap:6px">
                                       <button class="btn btn--sm" data-reject="${item.id}">${icon("x", 12)}</button>
                                       <button class="btn btn--sm btn--primary" data-approve="${item.id}">${icon("check", 12)}</button>
                                     </div>`
                                  : ""
                              }
                            </td>`
                          : ""
                      }
                    </tr>`,
                    )
                    .join("")}
                </tbody>
              </table>
            </div>

            <div class="row-between mt-4" style="align-items:flex-end">
              <div>
                <p class="hint">Total disetujui</p>
                <p class="h2" style="font-size:1.6rem">${rupiah(ticket.total_amount)}</p>
              </div>
              ${
                ticket.pending_total
                  ? `<span class="badge badge--red">Menunggu persetujuan ${rupiah(ticket.pending_total)}</span>`
                  : ""
              }
            </div>
          </article>
        </div>

        <div class="stack">
          <article class="card card--flat">
            <span class="eyebrow">Status perjalanan</span>
            <div class="mt-4">${timeline(ticket.status)}</div>
          </article>

          ${
            pending.length
              ? `<article class="card" style="background:var(--yellow)">
                   <div class="row" style="gap:10px;margin-bottom:8px">${icon("alert", 20)}
                     <h3 class="h3" style="font-size:1rem">Butuh keputusanmu</h3>
                   </div>
                   <p class="small" style="font-weight:500">
                     Mekanik menemukan kerusakan tambahan. Setujui atau tolak sebelum pengerjaan dilanjutkan.
                   </p>
                 </article>`
              : ""
          }

          <article class="card card--flat">
            <span class="eyebrow">Pembayaran</span>
            <p class="h3 mt-4" style="font-size:1.1rem">
              ${ticket.status === "selesai" ? "Lunas" : "Belum dibayar"}
            </p>
            ${
              ticket.status === "selesai"
                ? `<p class="hint mt-4">Metode: ${esc(ticket.payment_method || "-")} · ${dateID(ticket.paid_at)}</p>
                   <p class="hint">Invoice: ${esc(ticket.invoice_number || "-")}</p>
                   <a class="btn btn--block mt-4" href="#/nota/${ticket.id}">${icon("print", 16)} Lihat nota</a>`
                : `<p class="hint mt-4">Pembayaran dilakukan di kasir setelah pengerjaan selesai.</p>`
            }
          </article>

          <article class="card card--flat">
            <div class="row-between" style="margin-bottom:var(--s4)">
              <span class="eyebrow">Jejak aktivitas</span>
              ${badge(`${(ticket.events || []).length} langkah`, "badge--outline badge--sm")}
            </div>
            ${activityFeed(ticket.events)}
          </article>
        </div>
      </div>
    </section>`;

  const decide = async (itemId, decision) => {
    try {
      const data = await api(`/api/tickets/${ticket.id}/decision`, {
        method: "POST",
        body: { item_id: Number(itemId), decision },
      });
      toast(data.message, "success");
      await renderCustomerTicket(root, params);
    } catch (error) {
      toast(error.message, "error");
    }
  };

  root.querySelectorAll("[data-approve]").forEach((button) => {
    button.addEventListener("click", () => decide(button.dataset.approve, "approved"));
  });
  root.querySelectorAll("[data-reject]").forEach((button) => {
    button.addEventListener("click", async () => {
      const ok = await confirmDialog({
        title: "Tolak item tambahan?",
        message: "Item ini tidak akan masuk ke tagihan. Mekanik akan diberi tahu.",
        confirmLabel: "Ya, tolak",
        danger: true,
      });
      if (ok) decide(button.dataset.reject, "rejected");
    });
  });
}

/* ----------------------------------------------------------- Riwayat servis */

export async function renderCustomerHistory(root) {
  const [ticketRes, analysisRes] = await Promise.all([
    api("/api/tickets"),
    api("/api/customer/analyses"),
  ]);

  const completed = ticketRes.tickets.filter((ticket) => ticket.status === "selesai");
  const analyses = analysisRes.analyses;
  const totalSpent = completed.reduce((sum, ticket) => sum + ticket.total_amount, 0);

  root.innerHTML = `
    <section class="container section stack">
      ${pageHead("Rekam jejak", "Riwayat servis.", "Semua perawatan yang sudah lunas, lengkap dengan nota digitalnya.", `
        <a class="btn btn--dark" href="#/customer">${icon("plus", 16)} Analisis baru</a>
      `)}

      <div class="grid grid-3">
        ${statCard("Total servis", completed.length, "stat--yellow")}
        ${statCard("Total pengeluaran", rupiah(totalSpent), "stat--violet")}
        ${statCard("Rata-rata", rupiah(completed.length ? totalSpent / completed.length : 0))}
      </div>

      <section class="stack">
        <h2 class="h3">Servis selesai</h2>
        ${
          completed.length
            ? `<div class="grid grid-2">
                 ${completed
                   .map(
                     (ticket) => `
                   <article class="card card--hover card--tight">
                     <div class="row-between" style="margin-bottom:10px">
                       <span class="small">${esc(ticket.code)}</span>
                       ${badge("Lunas", "badge--dark badge--sm")}
                     </div>
                     <p class="small">${esc(vehicleLabel(ticket))}</p>
                     <p class="hint" style="margin-bottom:10px">${dateID(ticket.created_at)}</p>
                     <p class="small" style="font-weight:500;line-height:1.4;margin-bottom:12px">${esc(ticket.complaint)}</p>
                     <div class="row-between">
                       <strong>${rupiah(ticket.total_amount)}</strong>
                       <div class="row">
                         <a class="btn btn--sm" href="#/customer/tiket/${ticket.id}">Detail</a>
                         <a class="btn btn--sm btn--dark" href="#/nota/${ticket.id}">${icon("print", 14)} Nota</a>
                       </div>
                     </div>
                   </article>`,
                   )
                   .join("")}
               </div>`
            : emptyState({
                iconName: "clock",
                title: "Anda belum memiliki riwayat servis",
                text: "Riwayat akan muncul setelah transaksi pertama selesai dibayar.",
              })
        }
      </section>

      <section class="stack">
        <div class="row-between">
          <h2 class="h3">Riwayat analisis AI</h2>
          <span class="badge badge--outline">${analyses.length} entri</span>
        </div>
        ${
          analyses.length
            ? `<div class="stack-sm">
                 ${analyses
                   .map(
                     (analysis) => `
                   <div class="card card--tight" style="box-shadow:var(--shadow-xs)">
                     <div class="row-between">
                       <div class="stack-sm" style="gap:2px">
                         <span class="small">${esc(analysis.complaint)}</span>
                         <span class="hint">${esc(analysis.summary || "Analisis")} · ${timeAgo(analysis.created_at)}</span>
                       </div>
                       <div class="row">
                         <strong class="small nowrap">${rupiah(analysis.estimate_min)}–${rupiah(analysis.estimate_max)}</strong>
                         <button class="btn btn--sm btn--icon" data-delete-analysis="${analysis.id}" aria-label="Hapus riwayat">
                           ${icon("trash", 14)}
                         </button>
                       </div>
                     </div>
                   </div>`,
                   )
                   .join("")}
               </div>`
            : emptyState({
                iconName: "bot",
                title: "Belum ada analisis",
                text: "Riwayat analisis AI akan tersimpan otomatis di sini.",
              })
        }
      </section>
    </section>`;

  root.querySelectorAll("[data-delete-analysis]").forEach((button) => {
    button.addEventListener("click", async () => {
      const ok = await confirmDialog({
        title: "Hapus riwayat analisis?",
        message: "Data analisis ini akan dihapus permanen. Tiket yang sudah dibuat tidak terpengaruh.",
        confirmLabel: "Hapus",
        danger: true,
      });
      if (!ok) return;
      try {
        await api(`/api/customer/analyses/${button.dataset.deleteAnalysis}`, { method: "DELETE" });
        toast("Riwayat dihapus.", "success");
        await renderCustomerHistory(root);
      } catch (error) {
        toast(error.message, "error");
      }
    });
  });
}
