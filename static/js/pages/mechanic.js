/* Halaman sisi Mekanik. */

import { api, session } from "../api.js";
import {
  badge,
  closeModal,
  dateID,
  emptyState,
  esc,
  fillErrors,
  formValues,
  icon,
  openModal,
  rupiah,
  statusBadge,
  timeAgo,
  toast,
} from "../ui.js";

const COLUMNS = [
  { key: "menunggu", title: "Menunggu", tone: "var(--yellow)", hint: "Belum diambil" },
  { key: "dikerjakan", title: "Dikerjakan", tone: "var(--violet)", hint: "Sedang di tangan mekanik" },
  { key: "selesai_pengerjaan", title: "Selesai Pengerjaan", tone: "var(--red)", hint: "Menunggu kasir" },
];

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

function plate(ticket) {  return ticket.vehicle ? ticket.vehicle.plate_number : "—";
}

function ticketCard(ticket) {
  return `
    <a class="ticket-card" href="#/mekanik/tiket/${ticket.id}">
      <span class="ticket-card__plate">${esc(plate(ticket))}</span>
      <p class="ticket-card__title">${esc(ticket.complaint)}</p>
      <p class="ticket-card__meta">${esc(ticket.code)} · ${timeAgo(ticket.created_at)}</p>
      <div class="row" style="margin-top:8px;gap:6px">
        <span class="badge badge--sm badge--outline">${esc(ticket.customer?.name || "-")}</span>
        ${
          ticket.pending_count
            ? `<span class="badge badge--sm badge--red">${ticket.pending_count} approval</span>`
            : ""
        }
        ${ticket.mechanic ? `<span class="badge badge--sm">${esc(ticket.mechanic.name.split(" ")[0])}</span>` : ""}
      </div>
    </a>`;
}

export async function renderMechanicBoard(root) {
  const { buckets, stats } = await api("/api/workshop/board");

  root.innerHTML = `
    <section class="container section stack">
      <div class="row-between" style="align-items:flex-end">
        <div class="stack-sm">
          <span class="eyebrow">Papan tugas</span>
          <h1 class="h2">Antrean bengkel.</h1>
          <p class="lead muted" style="max-width:56ch">
            Ambil tiket, kerjakan, lalu ajukan tambahan sparepart bila menemukan kerusakan sekunder.
          </p>
        </div>
        <button class="btn btn--dark" id="refreshBoard">${icon("refresh", 16)} Muat ulang</button>
      </div>

      <div class="hazard" style="border-inline:0" aria-hidden="true"></div>

      <div class="grid grid-3">
        <div class="stat stat--yellow">
          <span class="stat__label">Menunggu</span>
          <span class="stat__value">${stats.menunggu}</span>
        </div>
        <div class="stat stat--violet">
          <span class="stat__label">Dikerjakan</span>
          <span class="stat__value">${stats.dikerjakan}</span>
        </div>
        <div class="stat stat--red">
          <span class="stat__label">Menunggu kasir</span>
          <span class="stat__value">${stats.selesai_pengerjaan}</span>
        </div>
      </div>

      <div class="kanban">
        ${COLUMNS.map(
          (column) => `
          <section class="kanban__col" style="border-top:8px solid ${column.tone}">
            <header class="kanban__head">
              <div>
                <p class="kanban__title">${column.title}</p>
                <p class="hint">${column.hint}</p>
              </div>
              <span class="badge badge--dark">${buckets[column.key].length}</span>
            </header>
            ${
              buckets[column.key].length
                ? buckets[column.key].map(ticketCard).join("")
                : `<p class="hint" style="padding:12px 0">Belum ada tiket di kolom ini.</p>`
            }
          </section>`,
        ).join("")}
      </div>
    </section>`;

  document.getElementById("refreshBoard")?.addEventListener("click", () => renderMechanicBoard(root));
}

export async function renderMechanicTicket(root, params) {
  const ticketId = params[0];
  const { ticket } = await api(`/api/tickets/${ticketId}`);
  const isMine = ticket.mechanic && ticket.mechanic.id === session.user.id;
  const canWork = ticket.status === "dikerjakan" && (isMine || session.user.role === "admin");
  const pending = ticket.items.filter((item) => item.approval_status === "pending");

  root.innerHTML = `
    <section class="container section stack">
      <a class="btn btn--sm btn--ghost" href="#/mekanik" style="align-self:flex-start">
        ${icon("arrow", 14)} Kembali ke antrean
      </a>

      <div class="row-between" style="align-items:flex-start">
        <div class="stack-sm">
          <span class="eyebrow">${esc(ticket.code)}</span>
          <h1 class="h2">${esc(ticket.vehicle?.label || "Kendaraan")}</h1>
          <p class="small muted">
            Customer: ${esc(ticket.customer?.name || "-")} · ${esc(ticket.customer?.phone || "-")}
          </p>
        </div>
        ${statusBadge(ticket.status, ticket.status_label)}
      </div>

      <div class="grid grid-3" style="align-items:start">
        <div class="stack" style="grid-column:span 2">
          <article class="card">
            <div class="card__header">
              <span class="eyebrow">Keluhan & hasil diagnosis</span>
              <span class="badge badge--dark badge--sm">${rupiah(ticket.estimate_min)} – ${rupiah(ticket.estimate_max)}</span>
            </div>
            <p class="lead">${esc(ticket.complaint)}</p>
          </article>

          <article class="card card--flat">
            <div class="row-between" style="margin-bottom:var(--s4)">
              <h3 class="h3">Item pada tiket</h3>
              <span class="small muted">Total disetujui: <strong>${rupiah(ticket.total_amount)}</strong></span>
            </div>

            <div class="table-wrap" style="box-shadow:none">
              <table class="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Jenis</th>
                    <th class="num">Qty</th>
                    <th class="num">Subtotal</th>
                    <th>Approval</th>
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
                      <td><span class="hint">${item.kind === "part" ? "Sparepart" : "Jasa"}</span></td>
                      <td class="num">${item.qty}</td>
                      <td class="num">${rupiah(item.subtotal)}</td>
                      <td>${statusBadge(item.approval_status)}</td>
                    </tr>`,
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          </article>

          ${
            pending.length
              ? `<div class="warn-box">${icon("alert", 18)}
                   <span><strong>${pending.length} item</strong> masih menunggu persetujuan pelanggan.
                   Pengerjaan tidak bisa ditutup sebelum pelanggan merespons.</span></div>`
              : ""
          }
        </div>

        <div class="stack">
          <article class="card card--flat">
            <span class="eyebrow">Aksi mekanik</span>
            <div class="stack-sm mt-4">
              ${
                ticket.status === "menunggu"
                  ? `<button class="btn btn--primary btn--block btn--lg" id="claimBtn">
                       ${icon("wrench", 18)} Ambil Tiket
                     </button>`
                  : ""
              }

              ${
                canWork
                  ? `<button class="btn btn--secondary btn--block" id="addItemBtn">
                       ${icon("plus", 16)} Tambah Sparepart / Jasa
                     </button>
                     <button class="btn btn--dark btn--block" id="finishBtn">
                       ${icon("check", 16)} Selesaikan Pengerjaan
                     </button>`
                  : ""
              }

              ${
                ticket.status === "selesai_pengerjaan"
                  ? `<p class="hint">Pengerjaan selesai. Tiket sudah masuk meja kasir admin.</p>`
                  : ""
              }
              ${
                ticket.status === "selesai"
                  ? `<p class="hint">Transaksi sudah lunas dan tiket ditutup.</p>`
                  : ""
              }
            </div>
          </article>

          <article class="card card--flat">
            <span class="eyebrow">Informasi</span>
            <div class="stack-sm mt-4">
              <div class="row-between"><span class="hint">Dibuat</span><span class="small">${dateID(ticket.created_at)}</span></div>
              <div class="row-between"><span class="hint">Mekanik</span><span class="small">${esc(ticket.mechanic?.name || "Belum diambil")}</span></div>
              <div class="row-between"><span class="hint">Estimasi awal</span><span class="small">${rupiah(ticket.estimate_min)}</span></div>
              <div class="row-between"><span class="hint">Total saat ini</span><span class="small">${rupiah(ticket.total_amount)}</span></div>
            </div>
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

  document.getElementById("claimBtn")?.addEventListener("click", async (event) => {
    event.target.disabled = true;
    try {
      await api(`/api/workshop/tickets/${ticket.id}/claim`, { method: "POST" });
      toast("Tiket berhasil diambil.", "success");
      await renderMechanicTicket(root, params);
    } catch (error) {
      toast(error.message, "error");
      event.target.disabled = false;
    }
  });

  document.getElementById("addItemBtn")?.addEventListener("click", () => {
    openAddItemModal(ticket.id, async () => {
      toast("Item tambahan diajukan.", "success");
      await renderMechanicTicket(root, params);
    });
  });

  document.getElementById("finishBtn")?.addEventListener("click", async (event) => {
    event.target.disabled = true;
    try {
      const data = await api(`/api/workshop/tickets/${ticket.id}/finish`, { method: "POST" });
      toast(data.message, "success");
      await renderMechanicTicket(root, params);
    } catch (error) {
      toast(error.message, "error");
      event.target.disabled = false;
    }
  });
}

/* ---------------------------------------------------- Modal tambah item */

function openAddItemModal(ticketId, onDone) {
  const overlay = openModal({
    title: "Ajukan tambahan item",
    tone: "card__header--violet",
    body: `
      <form id="addItemForm" class="stack" novalidate>
        <div class="row" role="tablist" aria-label="Jenis item">
          <button type="button" class="btn btn--sm btn--secondary" data-kind="part">Sparepart</button>
          <button type="button" class="btn btn--sm" data-kind="service">Jasa</button>
        </div>

        <input type="hidden" name="kind" value="part" />
        <input type="hidden" name="part_id" value="" />
        <input type="hidden" name="service_id" value="" />

        <div class="field">
          <label class="label" for="itemSearch">Cari item</label>
          <input class="input" id="itemSearch" placeholder="Ketik nama atau kode…" autocomplete="off" />
          <span class="hint" id="selectedHint">Belum ada item dipilih.</span>
        </div>

        <div id="itemResults" class="stack-sm" style="max-height:220px;overflow-y:auto"></div>

        <div class="grid grid-2" style="gap:var(--s3)">
          <div class="field">
            <label class="label" for="qty">Jumlah</label>
            <input class="input" id="qty" name="qty" type="number" min="1" value="1" />
          </div>
          <div class="field">
            <label class="label" for="pricePreview">Harga satuan</label>
            <input class="input" id="pricePreview" value="—" disabled />
          </div>
        </div>

        <div class="field">
          <label class="label" for="reason">Alasan penambahan</label>
          <textarea class="textarea" id="reason" name="reason" style="min-height:90px"
            placeholder="Contoh: kampas rem aus tidak rata saat dibongkar"></textarea>
          <span class="hint">Alasan ini akan dibaca pelanggan sebelum menyetujui.</span>
        </div>
      </form>`,
    footer: `
      <button class="btn" data-modal-close>Batal</button>
      <button class="btn btn--primary" id="submitItem">${icon("check", 16)} Ajukan Persetujuan</button>`,
  });

  const form = overlay.querySelector("#addItemForm");
  const search = overlay.querySelector("#itemSearch");
  const results = overlay.querySelector("#itemResults");
  const hint = overlay.querySelector("#selectedHint");
  const price = overlay.querySelector("#pricePreview");
  let kind = "part";
  let selected = null;
  let timer = null;

  const load = async (query = "") => {
    try {
      const data = await api(`/api/workshop/catalog/${kind === "part" ? "parts" : "services"}?q=${encodeURIComponent(query)}`);
      const list = kind === "part" ? data.parts : data.services;
      results.innerHTML = list.length
        ? list
            .map(
              (item) => `
          <button type="button" class="btn btn--sm" data-pick="${item.id}"
            data-name="${esc(item.name)}" data-price="${item.price}"
            data-stock="${item.stock ?? ""}"
            style="justify-content:space-between;text-align:left;white-space:normal">
            <span>${esc(item.name)}${kind === "part" ? ` <span class="hint">stok ${item.stock}</span>` : ""}</span>
            <strong class="nowrap">${rupiah(item.price)}</strong>
          </button>`,
            )
            .join("")
        : `<p class="hint">Tidak ada item yang cocok.</p>`;

      results.querySelectorAll("[data-pick]").forEach((button) => {
        button.addEventListener("click", () => {
          selected = {
            id: Number(button.dataset.pick),
            name: button.dataset.name,
            price: Number(button.dataset.price),
          };
          form.querySelector(kind === "part" ? '[name="part_id"]' : '[name="service_id"]').value = selected.id;
          form.querySelector(kind === "part" ? '[name="service_id"]' : '[name="part_id"]').value = "";
          hint.textContent = `Dipilih: ${selected.name}`;
          price.value = rupiah(selected.price);
          results.querySelectorAll("[data-pick]").forEach((other) => other.classList.remove("btn--secondary"));
          button.classList.add("btn--secondary");
        });
      });
    } catch (error) {
      results.innerHTML = `<p class="hint">${esc(error.message)}</p>`;
    }
  };

  overlay.querySelectorAll("[data-kind]").forEach((button) => {
    button.addEventListener("click", () => {
      kind = button.dataset.kind;
      form.querySelector('[name="kind"]').value = kind;
      form.querySelector('[name="part_id"]').value = "";
      form.querySelector('[name="service_id"]').value = "";
      selected = null;
      hint.textContent = "Belum ada item dipilih.";
      price.value = "—";
      overlay.querySelectorAll("[data-kind]").forEach((other) => other.classList.remove("btn--secondary"));
      button.classList.add("btn--secondary");
      load(search.value);
    });
  });

  search.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => load(search.value), 220);
  });

  overlay.querySelector("#submitItem").addEventListener("click", async () => {
    fillErrors(form, {});
    const values = formValues(form);

    if (!selected) {
      toast("Pilih item terlebih dahulu.", "error");
      return;
    }
    if (!values.reason || values.reason.length < 5) {
      fillErrors(form, { reason: "Alasan minimal 5 karakter." });
      return;
    }

    const button = overlay.querySelector("#submitItem");
    button.disabled = true;

    try {
      await api(`/api/workshop/tickets/${ticketId}/items`, {
        method: "POST",
        body: {
          kind,
          part_id: kind === "part" ? selected.id : null,
          service_id: kind === "service" ? selected.id : null,
          qty: Number(values.qty || 1),
          reason: values.reason,
        },
      });
      closeModal();
      onDone();
    } catch (error) {
      fillErrors(form, error.fields || {});
      toast(error.message, "error");
      button.disabled = false;
    }
  });

  load("");
}
