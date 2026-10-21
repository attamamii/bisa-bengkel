/* Nota digital (UC-13) — pratinjau cetak / unduh PDF via dialog print. */

import { api } from "../api.js";
import { dateID, esc, icon, rupiah } from "../ui.js";

export async function renderNota(root, params) {
  const { nota } = await api(`/api/tickets/${params[0]}/nota`);

  root.innerHTML = `
    <section class="container section no-print">
      <div class="row-between">
        <a class="btn btn--sm btn--ghost" href="javascript:history.back()">${icon("arrow", 14)} Kembali</a>
        <div class="btn-row">
          <button class="btn btn--dark" id="printBtn">${icon("print", 16)} Cetak / Simpan PDF</button>
        </div>
      </div>
    </section>

    <section class="container" style="padding-bottom:var(--s7)">
      <article class="card nota-sheet" style="max-width:760px;margin-inline:auto">
        <header class="row-between" style="border-bottom:4px solid #000;padding-bottom:var(--s4);margin-bottom:var(--s4)">
          <div class="row" style="gap:12px">
            <span class="brand__mark">B</span>
            <div>
              <p class="h3">BISA</p>
              <p class="hint">Bengkel Integrated Service Application</p>
            </div>
          </div>
          <div style="text-align:right">
            <p class="eyebrow">Nota digital</p>
            <p class="small">${esc(nota.invoice_number || "-")}</p>
          </div>
        </header>

        <div class="grid grid-2" style="margin-bottom:var(--s4)">
          <div class="stack-sm">
            <p class="eyebrow">Ditagihkan kepada</p>
            <p class="small">${esc(nota.customer.name)}</p>
            <p class="hint">${esc(nota.customer.email)}</p>
            <p class="hint">${esc(nota.customer.phone || "-")}</p>
          </div>
          <div class="stack-sm">
            <p class="eyebrow">Kendaraan</p>
            <p class="small">${esc(nota.vehicle.label)}</p>
            <p class="hint">Tiket ${esc(nota.ticket_code)} · ${dateID(nota.issued_at)}</p>
            <p class="hint">Mekanik: ${esc(nota.mechanic)}</p>
          </div>
        </div>

        <div class="table-wrap" style="box-shadow:none;margin-bottom:var(--s4)">
          <table class="table" style="min-width:100%">
            <thead>
              <tr>
                <th>Deskripsi</th>
                <th class="num">Qty</th>
                <th class="num">Harga</th>
                <th class="num">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${nota.items
                .map(
                  (item) => `
                <tr>
                  <td>
                    <span class="small">${esc(item.name)}</span>
                    <p class="hint">${item.kind === "part" ? "Sparepart" : "Jasa"}</p>
                  </td>
                  <td class="num">${item.qty}</td>
                  <td class="num">${rupiah(item.unit_price)}</td>
                  <td class="num">${rupiah(item.subtotal)}</td>
                </tr>`,
                )
                .join("")}
            </tbody>
          </table>
        </div>

        <div class="row-between" style="align-items:flex-end">
          <div class="stack-sm">
            <p class="eyebrow">Keluhan awal</p>
            <p class="hint" style="max-width:38ch">${esc(nota.complaint)}</p>
          </div>
          <div style="text-align:right">
            <p class="hint">Estimasi awal ${rupiah(nota.estimate_min)} – ${rupiah(nota.estimate_max)}</p>
            <p class="eyebrow" style="margin-top:10px">Total dibayar</p>
            <p class="h2" style="font-size:1.9rem">${rupiah(nota.total)}</p>
            <p class="hint">Metode: ${esc(nota.payment_method || "-")} · Lunas</p>
          </div>
        </div>

        <footer style="margin-top:var(--s5);border-top:4px solid #000;padding-top:var(--s3)">
          <p class="hint">
            Nota ini diterbitkan otomatis oleh sistem BISA dan sah tanpa tanda tangan basah.
            Simpan sebagai bukti klaim garansi servis.
          </p>
        </footer>
      </article>
    </section>`;

  document.getElementById("printBtn").addEventListener("click", () => window.print());
}
