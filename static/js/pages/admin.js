/* Halaman sisi Admin. */

import { api, session } from "../api.js";
import {
  badge,
  closeModal,
  confirmDialog,
  dateID,
  emptyState,
  esc,
  fillErrors,
  formValues,
  icon,
  openModal,
  rupiah,
  shortRupiah,
  statusBadge,
  timeAgo,
  toast,
} from "../ui.js";

async function downloadReport(period) {
  try {
    const response = await fetch(`/api/admin/dashboard/export.csv?period=${period}`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    if (!response.ok) {
      throw new Error("Gagal mengunduh laporan. Coba lagi.");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `laporan-bisa-${period}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast("Laporan CSV berhasil diunduh.", "success");
  } catch (error) {
    toast(error.message || "Gagal mengunduh laporan.", "error");
  }
}

function adminHead(eyebrow, title, description, actions = "") {
  return `
    <div class="row-between" style="align-items:flex-end;gap:var(--s5)">
      <div class="stack-sm">
        <span class="eyebrow">${esc(eyebrow)}</span>
        <h1 class="h2">${title}</h1>
        <p class="lead muted" style="max-width:58ch">${esc(description)}</p>
      </div>
      ${actions ? `<div class="btn-row">${actions}</div>` : ""}
    </div>`;
}

/* ------------------------------------------------------------- Dashboard */

export async function renderAdminDashboard(root, _params, period = "today") {
  const data = await api(`/api/admin/dashboard?period=${period}`);
  const { stats, series, top_items: topItems, recent } = data;

  const maxSeries = Math.max(...series.map((point) => point.total), 1);
  const dayLabels = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

  root.innerHTML = `
    <section class="container section stack">
      ${adminHead(
        "Dashboard admin",
        "Laporan pendapatan.",
        "Rekap omzet, transaksi, dan kondisi inventaris bengkel dalam satu layar.",
        `<button class="btn" id="exportCsv">${icon("download", 16)} Unduh CSV</button>
         <button class="btn" id="refreshDash">${icon("refresh", 16)} Segarkan</button>
         <a class="btn btn--primary" href="#/admin/kasir">${icon("wallet", 16)} Buka kasir</a>`,
      )}

      <div class="row" id="periodRow">
        ${[
          ["today", "Hari ini"],
          ["week", "7 hari"],
          ["month", "Bulan ini"],
        ]
          .map(
            ([key, label]) => `
          <button class="btn btn--sm ${key === period ? "btn--secondary" : ""}" data-period="${key}">
            ${label}
          </button>`,
          )
          .join("")}
      </div>

      <div class="grid grid-4">
        <div class="stat stat--dark">
          <span class="stat__label">Omzet periode</span>
          <span class="stat__value">${rupiah(stats.revenue)}</span>
        </div>
        <div class="stat stat--yellow">
          <span class="stat__label">Transaksi lunas</span>
          <span class="stat__value">${stats.tickets}</span>
        </div>
        <div class="stat stat--violet">
          <span class="stat__label">Kendaraan diservis</span>
          <span class="stat__value">${stats.vehicles}</span>
        </div>
        <div class="stat">
          <span class="stat__label">Rata-rata / transaksi</span>
          <span class="stat__value">${rupiah(stats.average)}</span>
        </div>
      </div>

      ${
        stats.pending_approvals || stats.low_stock
          ? `<div class="row" style="gap:var(--s3)">
               ${
                 stats.pending_approvals
                   ? `<span class="badge badge--red">${stats.pending_approvals} item menunggu approval customer</span>`
                   : ""
               }
               ${
                 stats.low_stock
                   ? `<a class="badge badge--yellow" href="#/admin/inventaris">${stats.low_stock} sparepart stok menipis</a>`
                   : ""
               }
             </div>`
          : ""
      }

      <div class="split" style="grid-template-columns:1.3fr 1fr">
        <article class="card">
          <div class="card__header">
            <span class="eyebrow">Tren 7 hari terakhir</span>
            <span class="badge badge--dark badge--sm">${shortRupiah(series.reduce((s, p) => s + p.total, 0))}</span>
          </div>

          <div class="bar-chart" role="img" aria-label="Grafik pendapatan tujuh hari terakhir">
            ${series
              .map((point) => {
                const date = new Date(point.date + "T00:00:00");
                const height = Math.max(3, Math.round((point.total / maxSeries) * 100));
                return `
                <div class="bar-chart__col" title="${point.date}: ${rupiah(point.total)}">
                  <span class="hint" style="text-align:center">${point.total ? shortRupiah(point.total) : ""}</span>
                  <div class="bar-chart__bar ${point.total === maxSeries ? "bar-chart__bar--hot" : ""}"
                       style="height:${height}%"></div>
                  <span class="bar-chart__label">${dayLabels[date.getDay()]}</span>
                </div>`;
              })
              .join("")}
          </div>
        </article>

        <article class="card">
          <div class="card__header card__header--violet">
            <span class="eyebrow">Status tiket</span>
          </div>
          <div class="stack-sm">
            ${[
              ["Menunggu", stats.status_counts.menunggu, "badge--yellow"],
              ["Dikerjakan", stats.status_counts.dikerjakan, "badge--violet"],
              ["Menunggu kasir", stats.status_counts.selesai_pengerjaan, "badge--red"],
              ["Selesai", stats.status_counts.selesai, "badge--dark"],
            ]
              .map(
                ([label, value, tone]) => `
              <div class="row-between">
                <span class="small">${label}</span>
                <span class="badge ${tone}">${value}</span>
              </div>`,
              )
              .join("")}
          </div>
          <hr class="divider" style="margin-block:var(--s4)" />
          <div class="row-between">
            <span class="small">Item approval tertunda</span>
            <strong>${stats.pending_approvals}</strong>
          </div>
          <div class="row-between mt-4">
            <span class="small">Stok menipis</span>
            <strong>${stats.low_stock}</strong>
          </div>
        </article>
      </div>

      <div class="grid grid-2" style="align-items:start">
        <article class="card card--flat">
          <div class="row-between" style="margin-bottom:var(--s3)">
            <h2 class="h3">Item terlaris</h2>
            <span class="hint">periode ini</span>
          </div>
          ${
            topItems.length
              ? topItems
                  .map(
                    (item, index) => `
                <div class="result-item">
                  <div class="row" style="gap:10px">
                    <span class="badge badge--dark badge--sm">${index + 1}</span>
                    <span class="small">${esc(item.name)}</span>
                  </div>
                  <div style="text-align:right">
                    <p class="small">${rupiah(item.total)}</p>
                    <p class="hint">${item.qty} terjual</p>
                  </div>
                </div>`,
                  )
                  .join("")
              : `<p class="hint">Belum ada transaksi pada periode ini.</p>`
          }
        </article>

        <article class="card card--flat">
          <div class="row-between" style="margin-bottom:var(--s3)">
            <h2 class="h3">Transaksi terakhir</h2>
            <a class="btn btn--sm" href="#/admin/kasir">Kasir ${icon("arrow", 14)}</a>
          </div>
          ${
            recent.length
              ? `<div class="stack-sm">
                   ${recent
                     .map(
                       (ticket) => `
                     <div class="row-between" style="border-bottom:2px dashed rgba(0,0,0,.2);padding-bottom:8px">
                       <div>
                         <p class="small">${esc(ticket.vehicle?.plate_number || "-")}</p>
                         <p class="hint">${esc(ticket.invoice_number || ticket.code)} · ${dateID(ticket.paid_at || ticket.updated_at, false)}</p>
                       </div>
                       <strong class="small nowrap">${rupiah(ticket.total_amount)}</strong>
                     </div>`,
                     )
                     .join("")}
                 </div>`
              : `<p class="hint">Belum ada transaksi lunas.</p>`
          }
        </article>
      </div>
    </section>`;

  document.querySelectorAll("[data-period]").forEach((button) => {
    button.addEventListener("click", () => renderAdminDashboard(root, [], button.dataset.period));
  });
  document.getElementById("refreshDash")?.addEventListener("click", () => renderAdminDashboard(root, [], period));
  document.getElementById("exportCsv")?.addEventListener("click", () => downloadReport(period));
}

/* ------------------------------------------------------------- Inventaris */

export async function renderAdminInventory(root) {
  const { parts } = await api("/api/admin/parts");

  const draw = (query = "") => {
    const term = query.toLowerCase();
    const rows = parts.filter(
      (part) =>
        !term ||
        part.name.toLowerCase().includes(term) ||
        part.code.toLowerCase().includes(term) ||
        part.category.toLowerCase().includes(term),
    );

    document.getElementById("partRows").innerHTML = rows.length
      ? rows
          .map(
            (part) => `
        <tr>
          <td><span class="badge badge--outline badge--sm">${esc(part.code)}</span></td>
          <td>
            <span class="small">${esc(part.name)}</span>
            ${part.is_active ? "" : `<span class="badge badge--sm">nonaktif</span>`}
          </td>
          <td><span class="hint">${esc(part.category)}</span></td>
          <td class="num">${rupiah(part.price)}</td>
          <td class="num">
            <span class="badge ${part.low_stock ? "badge--red" : "badge--yellow"} badge--sm">
              ${part.stock} ${esc(part.unit)}
            </span>
          </td>
          <td class="num">
            <div class="row" style="justify-content:flex-end;gap:6px">
              <button class="btn btn--sm btn--icon" data-edit="${part.id}" aria-label="Edit ${esc(part.name)}">
                ${icon("edit", 14)}
              </button>
              <button class="btn btn--sm btn--icon" data-delete="${part.id}" aria-label="Hapus ${esc(part.name)}">
                ${icon("trash", 14)}
              </button>
            </div>
          </td>
        </tr>`,
          )
          .join("")
      : `<tr><td colspan="6"><p class="hint">Tidak ada barang yang cocok.</p></td></tr>`;

    document.querySelectorAll("[data-edit]").forEach((button) => {
      button.addEventListener("click", () => {
        const part = parts.find((item) => item.id === Number(button.dataset.edit));
        openPartModal(part, () => renderAdminInventory(root));
      });
    });

    document.querySelectorAll("[data-delete]").forEach((button) => {
      button.addEventListener("click", async () => {
        const part = parts.find((item) => item.id === Number(button.dataset.delete));
        const ok = await confirmDialog({
          title: "Hapus barang?",
          message: `${part.name} akan dihapus dari master inventaris.`,
          confirmLabel: "Hapus",
          danger: true,
        });
        if (!ok) return;
        try {
          const data = await api(`/api/admin/parts/${part.id}`, { method: "DELETE" });
          toast(data.message, "success");
          await renderAdminInventory(root);
        } catch (error) {
          toast(error.message, "error");
        }
      });
    });
  };

  root.innerHTML = `
    <section class="container section stack">
      ${adminHead(
        "Master data",
        "Inventaris sparepart.",
        "Kelola nama barang, kategori, harga jual, dan stok. Perubahan langsung memengaruhi estimasi AI dan kasir.",
        `<button class="btn btn--primary" id="addPart">${icon("plus", 16)} Tambah barang</button>`,
      )}

      <div class="row">
        <div class="field grow" style="max-width:420px">
          <input class="input" id="partSearch" placeholder="Cari nama, kode, atau kategori…" />
        </div>
        <span class="badge badge--outline">${parts.length} barang</span>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Kode</th>
              <th>Nama barang</th>
              <th>Kategori</th>
              <th class="num">Harga</th>
              <th class="num">Stok</th>
              <th class="num">Aksi</th>
            </tr>
          </thead>
          <tbody id="partRows"></tbody>
        </table>
      </div>
    </section>`;

  draw("");
  document.getElementById("partSearch").addEventListener("input", (event) => draw(event.target.value));
  document.getElementById("addPart").addEventListener("click", () => openPartModal(null, () => renderAdminInventory(root)));
}

function openPartModal(part, onDone) {
  const editing = Boolean(part);
  const overlay = openModal({
    title: editing ? "Edit barang" : "Tambah barang",
    body: `
      <form id="partForm" class="stack" novalidate>
        <div class="grid grid-2" style="gap:var(--s3)">
          <div class="field">
            <label class="label" for="code">Kode barang</label>
            <input class="input" id="code" name="code" value="${editing ? esc(part.code) : ""}"
              ${editing ? "disabled" : ""} placeholder="BRK-05" />
          </div>
          <div class="field">
            <label class="label" for="category">Kategori</label>
            <input class="input" id="category" name="category" value="${editing ? esc(part.category) : ""}" placeholder="Rem" />
          </div>
        </div>
        <div class="field">
          <label class="label" for="name">Nama barang</label>
          <input class="input" id="name" name="name" value="${editing ? esc(part.name) : ""}" placeholder="Kampas Rem Depan" />
        </div>
        <div class="grid grid-3" style="gap:var(--s3)">
          <div class="field">
            <label class="label" for="price">Harga jual</label>
            <input class="input" id="price" name="price" type="number" min="0" value="${editing ? part.price : ""}" placeholder="185000" />
          </div>
          <div class="field">
            <label class="label" for="stock">Stok</label>
            <input class="input" id="stock" name="stock" type="number" min="0" value="${editing ? part.stock : 0}" />
          </div>
          <div class="field">
            <label class="label" for="min_stock">Stok min.</label>
            <input class="input" id="min_stock" name="min_stock" type="number" min="0" value="${editing ? part.min_stock : 3}" />
          </div>
        </div>
        <div class="field">
          <label class="label" for="unit">Satuan</label>
          <input class="input" id="unit" name="unit" value="${editing ? esc(part.unit) : "pcs"}" placeholder="pcs" />
        </div>
      </form>`,
    footer: `
      <button class="btn" data-modal-close>Batal</button>
      <button class="btn btn--primary" id="savePart">${icon("check", 16)} Simpan</button>`,
  });

  const form = overlay.querySelector("#partForm");
  overlay.querySelector("#savePart").addEventListener("click", async () => {
    fillErrors(form, {});
    const values = formValues(form);
    const errors = {};
    if (!editing && !values.code) errors.code = "Kode wajib diisi.";
    if (!values.name) errors.name = "Nama wajib diisi.";
    if (values.price === "") errors.price = "Harga wajib diisi.";
    if (Object.keys(errors).length) {
      fillErrors(form, errors);
      return;
    }

    try {
      if (editing) {
        await api(`/api/admin/parts/${part.id}`, {
          method: "PUT",
          body: {
            name: values.name,
            category: values.category,
            price: Number(values.price),
            stock: Number(values.stock),
            min_stock: Number(values.min_stock),
            unit: values.unit,
          },
        });
        toast("Data barang diperbarui.", "success");
      } else {
        await api("/api/admin/parts", {
          method: "POST",
          body: {
            code: values.code,
            name: values.name,
            category: values.category,
            price: Number(values.price),
            stock: Number(values.stock),
            min_stock: Number(values.min_stock),
            unit: values.unit,
          },
        });
        toast("Barang berhasil ditambahkan.", "success");
      }
      closeModal();
      onDone();
    } catch (error) {
      fillErrors(form, error.fields || {});
      toast(error.message, "error");
    }
  });
}

/* ------------------------------------------------------------------- Jasa */

export async function renderAdminServices(root) {
  const { services } = await api("/api/admin/services");

  root.innerHTML = `
    <section class="container section stack">
      ${adminHead(
        "Master data",
        "Ongkos jasa.",
        "Tarif jasa dipakai bersama sparepart saat menghitung estimasi biaya dan tagihan kasir.",
        `<button class="btn btn--primary" id="addService">${icon("plus", 16)} Tambah jasa</button>`,
      )}

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Kode</th>
              <th>Nama jasa</th>
              <th>Kategori</th>
              <th class="num">Tarif</th>
              <th class="num">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${services
              .map(
                (service) => `
              <tr>
                <td><span class="badge badge--outline badge--sm">${esc(service.code)}</span></td>
                <td><span class="small">${esc(service.name)}</span></td>
                <td><span class="hint">${esc(service.category)}</span></td>
                <td class="num">${rupiah(service.price)}</td>
                <td class="num">
                  <button class="btn btn--sm btn--icon" data-edit-service="${service.id}" aria-label="Edit ${esc(service.name)}">
                    ${icon("edit", 14)}
                  </button>
                </td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>`;

  document.getElementById("addService").addEventListener("click", () => openServiceModal(null, () => renderAdminServices(root)));
  document.querySelectorAll("[data-edit-service]").forEach((button) => {
    button.addEventListener("click", () => {
      const service = services.find((item) => item.id === Number(button.dataset.editService));
      openServiceModal(service, () => renderAdminServices(root));
    });
  });
}

function openServiceModal(service, onDone) {
  const editing = Boolean(service);
  const overlay = openModal({
    title: editing ? "Edit jasa" : "Tambah jasa",
    body: `
      <form id="serviceForm" class="stack" novalidate>
        <div class="grid grid-2" style="gap:var(--s3)">
          <div class="field">
            <label class="label" for="code">Kode jasa</label>
            <input class="input" id="code" name="code" value="${editing ? esc(service.code) : ""}"
              ${editing ? "disabled" : ""} placeholder="JSR-14" />
          </div>
          <div class="field">
            <label class="label" for="category">Kategori</label>
            <input class="input" id="category" name="category" value="${editing ? esc(service.category) : ""}" placeholder="Rem" />
          </div>
        </div>
        <div class="field">
          <label class="label" for="name">Nama jasa</label>
          <input class="input" id="name" name="name" value="${editing ? esc(service.name) : ""}" placeholder="Jasa Ganti Kampas Rem" />
        </div>
        <div class="field">
          <label class="label" for="price">Tarif</label>
          <input class="input" id="price" name="price" type="number" min="0" value="${editing ? service.price : ""}" placeholder="75000" />
        </div>
      </form>`,
    footer: `
      <button class="btn" data-modal-close>Batal</button>
      <button class="btn btn--primary" id="saveService">${icon("check", 16)} Simpan</button>`,
  });

  const form = overlay.querySelector("#serviceForm");
  overlay.querySelector("#saveService").addEventListener("click", async () => {
    fillErrors(form, {});
    const values = formValues(form);
    try {
      if (editing) {
        await api(`/api/admin/services/${service.id}`, {
          method: "PUT",
          body: { name: values.name, category: values.category, price: Number(values.price) },
        });
        toast("Data jasa diperbarui.", "success");
      } else {
        await api("/api/admin/services", {
          method: "POST",
          body: {
            code: values.code,
            name: values.name,
            category: values.category,
            price: Number(values.price),
          },
        });
        toast("Jasa berhasil ditambahkan.", "success");
      }
      closeModal();
      onDone();
    } catch (error) {
      fillErrors(form, error.fields || {});
      toast(error.message, "error");
    }
  });
}

/* ---------------------------------------------------------------- Pegawai */

export async function renderAdminStaff(root) {
  const { mechanics } = await api("/api/admin/mechanics");

  root.innerHTML = `
    <section class="container section stack">
      ${adminHead(
        "Manajemen pegawai",
        "Akun mekanik.",
        "Hanya akun aktif yang bisa menerima tiket. Nonaktifkan akun saat mekanik berhenti bekerja.",
        `<button class="btn btn--primary" id="addMech">${icon("plus", 16)} Tambah pegawai</button>`,
      )}

      <div class="grid grid-3">
        ${mechanics
          .map(
            (mech) => `
          <article class="card card--flat">
            <div class="row-between" style="margin-bottom:var(--s3)">
              <div class="row" style="gap:10px">
                <span class="avatar">${esc(mech.name.slice(0, 1))}</span>
                <div>
                  <p class="small">${esc(mech.name)}</p>
                  <p class="hint">${esc(mech.email)}</p>
                </div>
              </div>
              ${badge(mech.is_active ? "Aktif" : "Nonaktif", mech.is_active ? "badge--yellow" : "badge--outline")}
            </div>
            <div class="row-between">
              <span class="hint">${esc(mech.phone || "-")}</span>
              <span class="badge badge--outline badge--sm">${mech.active_tickets} tiket aktif</span>
            </div>
            <hr class="divider" style="margin-block:var(--s3)" />
            <div class="row">
              <button class="btn btn--sm" data-edit-mech="${mech.id}">${icon("edit", 14)} Edit</button>
              <button class="btn btn--sm ${mech.is_active ? "" : "btn--secondary"}" data-toggle-mech="${mech.id}">
                ${mech.is_active ? "Nonaktifkan" : "Aktifkan"}
              </button>
            </div>
          </article>`,
          )
          .join("")}
      </div>
    </section>`;

  document.getElementById("addMech").addEventListener("click", () => openMechanicModal(null, () => renderAdminStaff(root)));

  document.querySelectorAll("[data-edit-mech]").forEach((button) => {
    button.addEventListener("click", () => {
      const mech = mechanics.find((item) => item.id === Number(button.dataset.editMech));
      openMechanicModal(mech, () => renderAdminStaff(root));
    });
  });

  document.querySelectorAll("[data-toggle-mech]").forEach((button) => {
    button.addEventListener("click", async () => {
      const mech = mechanics.find((item) => item.id === Number(button.dataset.toggleMech));
      const ok = await confirmDialog({
        title: mech.is_active ? "Nonaktifkan akun?" : "Aktifkan akun?",
        message: mech.is_active
          ? `${mech.name} tidak akan bisa login sampai diaktifkan kembali.`
          : `${mech.name} akan bisa login dan menerima tiket lagi.`,
        confirmLabel: mech.is_active ? "Nonaktifkan" : "Aktifkan",
        danger: mech.is_active,
      });
      if (!ok) return;
      try {
        await api(`/api/admin/mechanics/${mech.id}`, {
          method: "PUT",
          body: { is_active: !mech.is_active },
        });
        toast("Status akun diperbarui.", "success");
        await renderAdminStaff(root);
      } catch (error) {
        toast(error.message, "error");
      }
    });
  });
}

function openMechanicModal(mech, onDone) {
  const editing = Boolean(mech);
  const overlay = openModal({
    title: editing ? "Edit akun mekanik" : "Tambah akun mekanik",
    body: `
      <form id="mechForm" class="stack" novalidate>
        <div class="field">
          <label class="label" for="name">Nama lengkap</label>
          <input class="input" id="name" name="name" value="${editing ? esc(mech.name) : ""}" placeholder="Nama mekanik" />
        </div>
        <div class="field">
          <label class="label" for="email">Email</label>
          <input class="input" id="email" name="email" type="email"
            value="${editing ? esc(mech.email) : ""}" ${editing ? "disabled" : ""} placeholder="nama@bisa.id" />
        </div>
        <div class="field">
          <label class="label" for="phone">Nomor HP</label>
          <input class="input" id="phone" name="phone" value="${editing && mech.phone ? esc(mech.phone) : ""}" placeholder="08xxxxxxxxxx" />
        </div>
        <div class="field">
          <label class="label" for="password">${editing ? "Kata sandi baru (opsional)" : "Kata sandi"}</label>
          <input class="input" id="password" name="password" type="password"
            placeholder="${editing ? "Biarkan kosong bila tidak diubah" : "Minimal 8 karakter"}" />
        </div>
      </form>`,
    footer: `
      <button class="btn" data-modal-close>Batal</button>
      <button class="btn btn--primary" id="saveMech">${icon("check", 16)} Simpan</button>`,
  });

  const form = overlay.querySelector("#mechForm");
  overlay.querySelector("#saveMech").addEventListener("click", async () => {
    fillErrors(form, {});
    const values = formValues(form);

    const errors = {};
    if (!values.name || values.name.length < 3) errors.name = "Nama minimal 3 karakter.";
    if (!editing && !/^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/.test(values.email)) errors.email = "Email tidak valid.";
    if (!editing && values.password.length < 8) errors.password = "Minimal 8 karakter.";
    if (editing && values.password && values.password.length < 8) errors.password = "Minimal 8 karakter.";
    if (Object.keys(errors).length) {
      fillErrors(form, errors);
      return;
    }

    try {
      if (editing) {
        const body = { name: values.name, phone: values.phone };
        if (values.password) body.password = values.password;
        await api(`/api/admin/mechanics/${mech.id}`, { method: "PUT", body });
        toast("Akun mekanik diperbarui.", "success");
      } else {
        await api("/api/admin/mechanics", {
          method: "POST",
          body: {
            name: values.name,
            email: values.email,
            phone: values.phone,
            password: values.password,
          },
        });
        toast("Akun mekanik dibuat.", "success");
      }
      closeModal();
      onDone();
    } catch (error) {
      fillErrors(form, error.fields || {});
      toast(error.message, "error");
    }
  });
}

/* ------------------------------------------------------------------ Kasir */

export async function renderAdminCashier(root) {
  const { tickets } = await api("/api/admin/cashier");

  root.innerHTML = `
    <section class="container section stack">
      ${adminHead(
        "Kasir",
        "Siap dibayar.",
        "Tiket yang sudah selesai dikerjakan. Proses pembayaran akan memotong stok dan menerbitkan nota digital.",
        `<button class="btn" id="refreshCashier">${icon("refresh", 16)} Segarkan</button>`,
      )}

      ${
        tickets.length
          ? `<div class="grid grid-2">
               ${tickets
                 .map(
                   (ticket) => `
                 <article class="card card--flat">
                   <div class="row-between" style="margin-bottom:10px">
                     <span class="badge badge--dark">${esc(ticket.code)}</span>
                     ${badge(ticket.vehicle?.plate_number || "-", "badge--outline badge--sm")}
                   </div>
                   <p class="small">${esc(ticket.customer?.name || "-")} · ${esc(ticket.vehicle?.label || "")}</p>
                   <p class="hint" style="margin-bottom:12px">${esc(ticket.complaint)}</p>
                   <div class="row-between">
                     <div>
                       <p class="hint">Total tagihan</p>
                       <p class="h3" style="font-size:1.2rem">${rupiah(ticket.total_amount)}</p>
                     </div>
                     <button class="btn btn--primary" data-pay="${ticket.id}">
                       ${icon("wallet", 16)} Proses Bayar
                     </button>
                   </div>
                   ${
                     ticket.pending_count
                       ? `<div class="warn-box" style="margin-top:12px">${icon("alert", 16)}
                            ${ticket.pending_count} item masih menunggu approval customer.</div>`
                       : ""
                   }
                 </article>`,
                 )
                 .join("")}
             </div>`
          : emptyState({
              iconName: "wallet",
              title: "Belum ada tiket siap bayar",
              text: "Tiket muncul setelah mekanik menyelesaikan pengerjaan.",
            })
      }
    </section>`;

  document.getElementById("refreshCashier").addEventListener("click", () => renderAdminCashier(root));

  document.querySelectorAll("[data-pay]").forEach((button) => {
    button.addEventListener("click", () => {
      const ticket = tickets.find((item) => item.id === Number(button.dataset.pay));
      openPayModal(ticket, () => renderAdminCashier(root));
    });
  });
}

function openPayModal(ticket, onDone) {
  const approved = ticket.items.filter((item) => item.approval_status === "approved");
  const pending = ticket.items.filter((item) => item.approval_status === "pending");

  const overlay = openModal({
    title: `Kasir · ${ticket.code}`,
    body: `
      <div class="stack">
        <div class="row-between">
          <div>
            <p class="small">${esc(ticket.vehicle?.label || "-")}</p>
            <p class="hint">${esc(ticket.customer?.name || "-")}</p>
          </div>
          <span class="badge badge--dark">${esc(ticket.code)}</span>
        </div>

        <div class="stack-sm">
          ${approved
            .map(
              (item) => `
            <div class="result-item">
              <span class="small">${esc(item.name)} · ${item.qty}×</span>
              <strong class="small">${rupiah(item.subtotal)}</strong>
            </div>`,
            )
            .join("")}
        </div>

        ${
          pending.length
            ? `<div class="warn-box">${icon("alert", 16)}
                 <span>${pending.length} item masih menunggu approval. Pembayaran diblokir sampai
                 pelanggan merespons.</span></div>`
            : ""
        }

        <div class="range-box">
          <span class="eyebrow" style="opacity:.7">Total dibayar</span>
          <span class="range-box__value">${rupiah(ticket.total_amount)}</span>
        </div>

        <div class="field">
          <label class="label" for="method">Metode pembayaran</label>
          <select class="select" id="method" name="method">
            <option value="tunai">Tunai</option>
            <option value="qris">QRIS</option>
          </select>
        </div>
      </div>`,
    footer: `
      <button class="btn" data-modal-close>Batal</button>
      <button class="btn btn--primary" id="payBtn" ${pending.length ? "disabled" : ""}>
        ${icon("check", 16)} Selesaikan Transaksi
      </button>`,
  });

  overlay.querySelector("#payBtn")?.addEventListener("click", async (event) => {
    event.target.disabled = true;
    const method = overlay.querySelector("#method").value;

    try {
      const data = await api(`/api/admin/cashier/${ticket.id}/pay`, {
        method: "POST",
        body: { method },
      });
      closeModal();
      toast(data.message, "success");
      onDone();
    } catch (error) {
      toast(error.message, "error");
      event.target.disabled = false;
    }
  });
}

/* -------------------------------------------------------------- Pelanggan */

export async function renderAdminCustomers(root) {
  const { customers } = await api("/api/admin/customers");

  root.innerHTML = `
    <section class="container section stack">
      ${adminHead(
        "Basis pelanggan",
        "Data pelanggan.",
        "Riwayat kunjungan dan total belanja tiap pelanggan untuk kebutuhan pelayanan.",
      )}

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Kontak</th>
              <th class="num">Kendaraan</th>
              <th class="num">Tiket</th>
              <th class="num">Total belanja</th>
            </tr>
          </thead>
          <tbody>
            ${customers
              .map(
                (customer) => `
              <tr>
                <td>
                  <span class="small">${esc(customer.name)}</span>
                  <p class="hint">Bergabung ${dateID(customer.created_at, false)}</p>
                </td>
                <td>
                  <span class="small">${esc(customer.email)}</span>
                  <p class="hint">${esc(customer.phone || "-")}</p>
                </td>
                <td class="num">${customer.vehicle_count}</td>
                <td class="num">${customer.ticket_count}</td>
                <td class="num">${rupiah(customer.total_spent)}</td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>`;
}
