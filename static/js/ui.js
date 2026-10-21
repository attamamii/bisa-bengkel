/* =========================================================================
   Komponen UI bersama: ikon, format, toast, modal, badge
   ========================================================================= */

const ICONS = {
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  car: '<path d="M5 17h14M6 17l-1-5 2-5h10l2 5-1 5M7 17a2 2 0 1 0 4 0M13 17a2 2 0 1 0 4 0"/>',
  bot: '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 4v4M9 14h.01M15 14h.01M9 18h6"/>',
  receipt: '<path d="M6 3v18l3-2 3 2 3-2 3 2V3H6z"/><path d="M9 8h6M9 12h6"/>',
  package: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 16v-5M12 16V7M17 16v-8"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  print: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/>',
  star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
  wallet: '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
  refresh: '<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  lock: '<rect x="5" y="11" width="14" height="10"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8L3 5z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  tire: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21M5.6 5.6l2.5 2.5M15.9 15.9l2.5 2.5M18.4 5.6l-2.5 2.5M8.1 15.9l-2.5 2.5"/>',
  oil: '<path d="M12 3s5 6 5 9.5a5 5 0 0 1-10 0C7 9 12 3 12 3z"/><path d="M9.5 13.5a2.5 2.5 0 0 0 2.5 2.5"/>',
  bolt: '<path d="M13 2 4.5 13.5H11l-1 8.5L19 10h-6.5z"/>',
  gauge: '<path d="M3.5 18a9 9 0 1 1 17 0"/><path d="M12 14l4.5-4.5"/><circle cx="12" cy="15" r="1.4"/>',
};

export function icon(name, size = 20, cls = "") {
  const body = ICONS[name] || ICONS.star;
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true">${body}</svg>`;
}

export function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function rupiah(value) {
  const number = Number(value || 0);
  return "Rp " + number.toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

export function shortRupiah(value) {
  const number = Number(value || 0);
  if (number >= 1_000_000) return "Rp " + (number / 1_000_000).toFixed(1).replace(".0", "") + " jt";
  if (number >= 1_000) return "Rp " + Math.round(number / 1_000) + " rb";
  return rupiah(number);
}

export function dateID(iso, withTime = true) {
  if (!iso) return "-";
  const date = new Date(iso.endsWith("Z") ? iso : iso + "Z");
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function timeAgo(iso) {
  if (!iso) return "-";
  const date = new Date(iso.endsWith("Z") ? iso : iso + "Z");
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return "baru saja";
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} hari lalu`;
  return dateID(iso, false);
}

export function initials(name) {
  return String(name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

/* ------------------------------------------------------------------ Toast */
export function toast(message, type = "info") {
  let host = document.querySelector(".toasts");
  if (!host) {
    host = document.createElement("div");
    host.className = "toasts";
    document.body.appendChild(host);
  }

  const node = document.createElement("div");
  node.className = `toast toast--${type}`;
  node.setAttribute("role", "status");
  const glyph = type === "error" ? "alert" : type === "success" ? "check" : "star";
  node.innerHTML = `<span class="toast__icon">${icon(glyph, 20)}</span><span>${esc(message)}</span>`;
  host.appendChild(node);

  setTimeout(() => {
    node.style.transition = "opacity 160ms linear, transform 160ms linear";
    node.style.opacity = "0";
    node.style.transform = "translateY(8px)";
    setTimeout(() => node.remove(), 180);
  }, 3800);
}

/* ------------------------------------------------------------------ Modal */
let activeModal = null;

export function closeModal() {
  if (!activeModal) return;
  activeModal.remove();
  activeModal = null;
  document.body.style.overflow = "";
}

export function openModal({ title, body, footer = "", tone = "" }) {
  closeModal();
  const overlay = document.createElement("div");
  overlay.className = "modal";
  overlay.innerHTML = `
    <div class="modal__panel" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal__head ${tone}">
        <h2 class="h3">${esc(title)}</h2>
        <button class="btn btn--icon btn--sm" data-modal-close aria-label="Tutup">${icon("x", 18)}</button>
      </div>
      <div class="modal__body">${body}</div>
      ${footer ? `<div class="modal__foot">${footer}</div>` : ""}
    </div>`;

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.closest("[data-modal-close]")) {
      closeModal();
    }
  });

  document.addEventListener("keydown", function onKey(event) {
    if (event.key === "Escape") {
      closeModal();
      document.removeEventListener("keydown", onKey);
    }
  });

  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";
  activeModal = overlay;

  const focusable = overlay.querySelector("input, select, textarea, button");
  if (focusable) focusable.focus();

  return overlay;
}

export function confirmDialog({ title, message, confirmLabel = "Ya, lanjutkan", danger = false }) {
  return new Promise((resolve) => {
    const overlay = openModal({
      title,
      body: `<p class="lead">${esc(message)}</p>`,
      footer: `
        <button class="btn" data-modal-close>Batal</button>
        <button class="btn ${danger ? "btn--primary" : "btn--secondary"}" data-confirm>${esc(confirmLabel)}</button>`,
    });

    overlay.querySelector("[data-confirm]").addEventListener("click", () => {
      closeModal();
      resolve(true);
    });
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay || event.target.closest("[data-modal-close]")) resolve(false);
    });
  });
}

/* --------------------------------------------------------------- Fragmen */
const STATUS_TONE = {
  menunggu: "badge--yellow",
  dikerjakan: "badge--violet",
  selesai_pengerjaan: "badge--red",
  selesai: "badge--dark",
  dibatalkan: "badge--outline",
  approved: "badge--yellow",
  pending: "badge--red",
  rejected: "badge--outline",
};

const STATUS_TEXT = {
  approved: "Disetujui",
  pending: "Menunggu",
  rejected: "Ditolak",
};

export function badge(label, tone = "", extraClass = "") {
  return `<span class="badge ${tone} ${extraClass}">${esc(label)}</span>`;
}

export function statusBadge(status, label) {
  const tone = STATUS_TONE[status] || "";
  const text = label || STATUS_TEXT[status] || status;
  return `<span class="badge ${tone}">${esc(text)}</span>`;
}

export function emptyState({ iconName = "package", title, text = "", action = "" }) {
  return `
    <div class="empty">
      <div class="empty__icon">${icon(iconName, 32)}</div>
      <h3 class="h3">${esc(title)}</h3>
      ${text ? `<p class="lead muted">${esc(text)}</p>` : ""}
      ${action}
    </div>`;
}

export function loadingBlock(text = "Memuat data…") {
  return `<div class="card card--flat loading-block">
    <span class="loading-tire" aria-hidden="true">${icon("tire", 26)}</span>
    <p class="lead">${esc(text)}</p>
  </div>`;
}

export function errorBlock(message, retryId = "") {
  return `
    <div class="card" style="border-color:#000">
      <div class="row-between">
        <div class="row">${icon("alert", 24)}<strong>${esc(message)}</strong></div>
        ${retryId ? `<button class="btn btn--sm" id="${retryId}">${icon("refresh", 16)} Coba lagi</button>` : ""}
      </div>
    </div>`;
}

export function fieldError(errors, name) {
  return errors && errors[name] ? `<span class="field__error">${esc(errors[name])}</span>` : "";
}

export function fillErrors(form, errors) {
  form.querySelectorAll(".field__error").forEach((el) => el.remove());
  form.querySelectorAll(".input--error").forEach((el) => el.classList.remove("input--error"));

  Object.entries(errors || {}).forEach(([name, message]) => {
    const input = form.querySelector(`[name="${name}"]`);
    if (!input) return;
    input.classList.add("input--error");
    const span = document.createElement("span");
    span.className = "field__error";
    span.textContent = message;
    input.closest(".field")?.appendChild(span);
  });
}

export function clearErrors(form) {
  form.querySelectorAll(".field__error").forEach((el) => el.remove());
  form.querySelectorAll(".input--error").forEach((el) => el.classList.remove("input--error"));
}

export function formValues(form) {
  const data = {};
  new FormData(form).forEach((value, key) => {
    data[key] = typeof value === "string" ? value.trim() : value;
  });
  form.querySelectorAll('input[type="checkbox"]').forEach((box) => {
    data[box.name] = box.checked;
  });
  return data;
}
