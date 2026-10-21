/* =========================================================================
   Router + shell aplikasi
   ========================================================================= */

import { api, clearSession, session } from "./api.js";
import { icon, initials, toast } from "./ui.js";
import { renderLanding } from "./pages/landing.js";
import { renderLogin, renderRegister } from "./pages/auth.js";
import { renderCustomerHome, renderCustomerTickets, renderCustomerTicket, renderCustomerHistory } from "./pages/customer.js";
import { renderMechanicBoard, renderMechanicTicket } from "./pages/mechanic.js";
import {
  renderAdminDashboard,
  renderAdminInventory,
  renderAdminServices,
  renderAdminStaff,
  renderAdminCashier,
  renderAdminCustomers,
} from "./pages/admin.js";
import { renderNota } from "./pages/nota.js";

const ROLE_HOME = {
  customer: "#/customer",
  mekanik: "#/mekanik",
  admin: "#/admin",
};

const ROLE_LABEL = {
  customer: "Customer",
  mekanik: "Mekanik",
  admin: "Admin Bengkel",
};

const NAV = {
  customer: [
    { path: "#/customer", label: "Beranda", iconName: "star" },
    { path: "#/customer/tiket", label: "Tiket Saya", iconName: "receipt" },
    { path: "#/customer/riwayat", label: "Riwayat", iconName: "clock" },
  ],
  mekanik: [
    { path: "#/mekanik", label: "Antrean", iconName: "wrench" },
  ],
  admin: [
    { path: "#/admin", label: "Laporan", iconName: "chart" },
    { path: "#/admin/kasir", label: "Kasir", iconName: "wallet" },
    { path: "#/admin/inventaris", label: "Inventaris", iconName: "package" },
    { path: "#/admin/jasa", label: "Jasa", iconName: "wrench" },
    { path: "#/admin/pegawai", label: "Pegawai", iconName: "users" },
    { path: "#/admin/pelanggan", label: "Pelanggan", iconName: "car" },
  ],
};

const ROUTES = [
  { path: "#/", title: "Beranda", render: renderLanding, public: true },
  { path: "#/login", title: "Masuk", render: renderLogin, public: true, guestOnly: true },
  { path: "#/register", title: "Daftar", render: renderRegister, public: true, guestOnly: true },
  { path: "#/customer", title: "Beranda Customer", render: renderCustomerHome, role: "customer" },
  { path: "#/customer/tiket", title: "Tiket Saya", render: renderCustomerTickets, role: "customer" },
  { path: "#/customer/tiket/", title: "Detail Tiket", render: renderCustomerTicket, role: "customer", dynamic: true },
  { path: "#/customer/riwayat", title: "Riwayat Servis", render: renderCustomerHistory, role: "customer" },
  { path: "#/mekanik", title: "Papan Antrean", render: renderMechanicBoard, role: "mekanik" },
  { path: "#/mekanik/tiket/", title: "Detail Pengerjaan", render: renderMechanicTicket, role: "mekanik", dynamic: true },
  { path: "#/admin", title: "Laporan Pendapatan", render: renderAdminDashboard, role: "admin" },
  { path: "#/admin/inventaris", title: "Master Inventaris", render: renderAdminInventory, role: "admin" },
  { path: "#/admin/jasa", title: "Master Jasa", render: renderAdminServices, role: "admin" },
  { path: "#/admin/pegawai", title: "Manajemen Pegawai", render: renderAdminStaff, role: "admin" },
  { path: "#/admin/kasir", title: "Kasir", render: renderAdminCashier, role: "admin" },
  { path: "#/admin/pelanggan", title: "Data Pelanggan", render: renderAdminCustomers, role: "admin" },
  { path: "#/nota/", title: "Nota Digital", render: renderNota, auth: true, dynamic: true },
];

const appEl = document.getElementById("app");

/* =========================================================================
   Notifikasi near-real-time (RF-09)
   Polling ringan memakai kursor id peristiwa. Latensi maksimum sebesar
   interval poll (8 detik) dan hanya peristiwa milik pengguna yang dikirim.
   ========================================================================= */

const NOTIF_INTERVAL_MS = 8000;
const REFRESHABLE_PREFIXES = ["#/customer/tiket", "#/mekanik", "#/admin/kasir"];

const notifState = { cursor: 0, ready: false, timer: null, unread: 0, pending: 0 };

function notifBadge(count, bump = false) {
  const el = document.getElementById("notifBadge");
  if (!el) return;
  const total = Number(count) || 0;
  el.textContent = total > 9 ? "9+" : String(total);
  el.classList.toggle("is-bump", bump && total > 0);
  el.style.display = total > 0 ? "inline-flex" : "none";
  el.setAttribute("aria-label", total > 0 ? `${total} notifikasi baru` : "Tidak ada notifikasi");
}

function notifMessage(event) {
  const labels = {
    created: `Tiket baru masuk antrean: ${event.ticket_code}`,
    claimed: `Tiket ${event.ticket_code} mulai dikerjakan`,
    item_requested: `Item tambahan menunggu persetujuan (${event.ticket_code})`,
    item_approved: `Item tambahan disetujui (${event.ticket_code})`,
    item_rejected: `Item tambahan ditolak (${event.ticket_code})`,
    finished: `Tiket ${event.ticket_code} siap dibayar`,
    paid: `Tiket ${event.ticket_code} sudah lunas`,
  };
  return labels[event.kind] || event.message;
}

function canSoftRefresh() {
  if (document.querySelector(".modal__panel")) return false;
  const active = document.activeElement;
  if (active && ["INPUT", "SELECT", "TEXTAREA"].includes(active.tagName)) return false;
  const path = currentPath();
  return REFRESHABLE_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function notifTarget() {
  const role = session.user && session.user.role;
  return { customer: "#/customer/tiket", mekanik: "#/mekanik", admin: "#/admin/kasir" }[role] || "#/";
}

async function pollNotifications() {
  if (!session.token || !session.user) return;

  let data;
  try {
    data = await api(`/api/notifications?after=${notifState.cursor}`);
  } catch {
    return; // diamkan; percobaan berikutnya mengulang otomatis
  }

  if (!notifState.ready) {
    // Muat pertama: sinkronkan kursor tanpa memunculkan toast riwayat lama.
    notifState.cursor = data.latest_id || 0;
    notifState.ready = true;
    notifState.pending = data.pending_count || 0;
    notifBadge(session.user.role === "customer" ? notifState.pending : 0);
    return;
  }

  notifState.cursor = data.cursor ?? notifState.cursor;
  notifState.pending = data.pending_count || 0;

  if (data.events.length) {
    notifState.unread += data.events.length;
    toast(notifMessage(data.events[data.events.length - 1]), "info");
    if (canSoftRefresh()) {
      await route();
      return;
    }
  }

  notifBadge(
    session.user.role === "customer" ? notifState.pending : notifState.unread,
    data.events.length > 0,
  );
}

function startNotifications() {
  if (!session.user || notifState.timer) return;
  notifState.timer = window.setInterval(pollNotifications, NOTIF_INTERVAL_MS);
  pollNotifications();
}

function stopNotifications() {
  if (notifState.timer) window.clearInterval(notifState.timer);
  notifState.timer = null;
  notifState.cursor = 0;
  notifState.ready = false;
  notifState.unread = 0;
  notifState.pending = 0;
  notifBadge(0);
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && session.user) pollNotifications();
});


function currentPath() {
  const hash = location.hash || "#/";
  return hash.split("?")[0];
}

function matchRoute(path) {
  const exact = ROUTES.find((route) => route.path === path);
  if (exact) return { route: exact, params: [] };

  const dynamic = ROUTES.filter((route) => route.dynamic)
    .sort((a, b) => b.path.length - a.path.length)
    .find((route) => path.startsWith(route.path));

  if (dynamic) {
    const rest = path.slice(dynamic.path.length);
    const params = rest.split("/").filter(Boolean);
    return { route: dynamic, params };
  }
  return { route: null, params: [] };
}

function homeFor(user) {
  return (user && ROLE_HOME[user.role]) || "#/login";
}

function navMarkup() {
  const user = session.user;
  const links = user ? NAV[user.role] || [] : [
    { path: "#/", label: "Beranda", iconName: "star" },
  ];

  const linksHtml = links
    .map(
      (link) => `<a class="nav__link" href="${link.path}" data-nav="${link.path}">
        ${icon(link.iconName, 16)}<span>${link.label}</span></a>`,
    )
    .join("");

  const right = user
    ? `<button class="nav__notif" id="notifBtn" type="button" title="Notifikasi"
               aria-label="Buka notifikasi">
         ${icon("bell", 18)}
         <span class="nav__badge" id="notifBadge" aria-live="polite"></span>
       </button>
       <div class="user-chip" title="${user.email}">
         <span class="user-chip__avatar">${initials(user.name)}</span>
         <span class="user-chip__meta">
           <span class="user-chip__name">${user.name.split(" ")[0]}</span>
           <span class="user-chip__role">${ROLE_LABEL[user.role] || user.role}</span>
         </span>
       </div>
       <button class="btn btn--sm" id="logoutBtn" aria-label="Keluar dari akun">
         ${icon("logout", 16)}<span class="logout-label">Keluar</span>
       </button>`
    : `<a class="btn btn--sm btn--ghost" href="#/login">Masuk</a>
       <a class="btn btn--sm btn--primary" href="#/register">Daftar</a>`;

  return `
    <header class="nav">
      <div class="container nav__inner">
        <a class="brand" href="${user ? homeFor(user) : "#/"}" aria-label="BISA — beranda">
          <span class="brand__mark">B</span>
          <span>
            <span class="brand__name">BISA<span>.</span></span>
            <span class="brand__sub">Bengkel Integrated Service</span>
          </span>
        </a>
        <nav class="nav__links" id="navLinks" aria-label="Navigasi utama">${linksHtml}</nav>
        <div class="nav__right">${right}</div>
        <button class="nav__toggle" id="navToggle" aria-label="Buka menu" aria-expanded="false">
          ${icon("menu", 22)}
        </button>
      </div>
      <div class="hazard hazard--nav" aria-hidden="true"></div>
    </header>`;
}

function bindShell() {
  const toggle = document.getElementById("navToggle");
  const links = document.getElementById("navLinks");
  if (toggle && links) {
    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  const notifBtn = document.getElementById("notifBtn");
  if (notifBtn) {
    notifBtn.addEventListener("click", () => {
      notifState.unread = 0;
      notifBadge(session.user && session.user.role === "customer" ? notifState.pending : 0);
      location.hash = notifTarget();
    });
  }

  const logout = document.getElementById("logoutBtn");
  if (logout) {
    logout.addEventListener("click", async () => {
      try {
        await api("/api/auth/logout", { method: "POST" });
      } catch {
        /* token tetap dibuang di sisi klien */
      }
      stopNotifications();
      clearSession();
      toast("Anda telah keluar.", "success");
      location.hash = "#/login";
    });
  }
}

function highlightNav(path) {
  document.querySelectorAll("[data-nav]").forEach((link) => {
    const target = link.getAttribute("data-nav");
    const active = path === target || (target !== "#/" && path.startsWith(target));
    link.classList.toggle("is-active", active);
  });
}

function renderNotFound() {
  return `
    <main class="container section">
      <div class="empty" style="max-width:560px;margin-inline:auto">
        <div class="empty__icon">${icon("alert", 32)}</div>
        <h1 class="h2">Halaman tidak ditemukan</h1>
        <p class="lead muted">Alamat yang Anda tuju tidak tersedia di aplikasi BISA.</p>
        <a class="btn btn--primary" href="${homeFor(session.user)}">Kembali ke beranda</a>
      </div>
    </main>`;
}

async function route() {
  const path = currentPath();
  const { route: match, params } = matchRoute(path);

  if (!match) {
    appEl.innerHTML = `${navMarkup()}${renderNotFound()}`;
    bindShell();
    return;
  }

  if (match.public === false || match.role) {
    if (!session.user) {
      location.hash = "#/login";
      return;
    }
  }

  if (match.role && session.user && session.user.role !== match.role) {
    toast("Halaman tersebut bukan untuk peran Anda.", "error");
    location.hash = homeFor(session.user);
    return;
  }

  if (match.auth && !session.user) {
    location.hash = "#/login";
    return;
  }

  if (match.guestOnly && session.user) {
    location.hash = homeFor(session.user);
    return;
  }

  document.title = `${match.title} · BISA`;

  const shell = match.public ? navMarkup() : navMarkup();
  appEl.innerHTML = `${shell}<main id="page" class="page-root"></main>`;
  bindShell();
  highlightNav(path);

  const mount = document.getElementById("page");
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });

  try {
    await match.render(mount, params);
    startNotifications();
  } catch (error) {
    console.error(error);
    mount.innerHTML = `
      <section class="container section">
        <div class="card">
          <h1 class="h2">Terjadi kesalahan</h1>
          <p class="lead">${error.message || "Silakan muat ulang halaman."}</p>
          <button class="btn btn--primary mt-4" onclick="location.reload()">Muat ulang</button>
        </div>
      </section>`;
  }
}

window.addEventListener("hashchange", route);
window.addEventListener("DOMContentLoaded", () => {
  if (!location.hash) location.hash = session.user ? homeFor(session.user) : "#/";
  route();
});
