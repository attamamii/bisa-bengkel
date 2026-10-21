/* Halaman login & registrasi. */

import { ApiError, api, session, setSession } from "../api.js";
import { esc, fillErrors, formValues, icon, toast } from "../ui.js";

const ROLE_HOME = { customer: "#/customer", mekanik: "#/mekanik", admin: "#/admin" };

const DEMO = [
  { role: "Customer", email: "budi@bisa.id", password: "Customer#123", tone: "var(--violet)" },
  { role: "Mekanik", email: "andi@bisa.id", password: "Mekanik#123", tone: "var(--yellow)" },
  { role: "Admin", email: "admin@bisa.id", password: "Admin#123", tone: "var(--red)" },
];

function aside() {
  return `
    <aside class="auth__aside">
      <div class="deco-tire deco-tire--dark" aria-hidden="true"></div>
      <div class="deco-oil deco-oil--dark" aria-hidden="true"></div>
      <div class="stack-sm">
        <span class="eyebrow" style="color:var(--yellow)">BISA · Akses Sistem</span>
        <h1 class="display" style="font-size:clamp(2.2rem,4vw,3.4rem)">
          Servis<br />tanpa<br /><span style="color:var(--violet)">drama.</span>
        </h1>
        <p class="lead" style="opacity:.8;max-width:34ch">
          Masuk untuk memantau tiket, menyetujui biaya tambahan, dan mengunduh nota digital.
        </p>
      </div>

      <div class="stack-sm">
        <p class="eyebrow" style="opacity:.7">Akun demo</p>
        <div class="demo-list">
          ${DEMO.map(
            (item) => `
            <button class="demo-item" type="button" data-demo="${esc(item.email)}"
              data-password="${esc(item.password)}" style="cursor:pointer;text-align:left">
              <span class="badge" style="background:${item.tone};color:#000">${item.role}</span>
              <span><code>${item.email}</code><br /><code style="opacity:.7">${item.password}</code></span>
              ${icon("arrow", 16)}
            </button>`,
          ).join("")}
        </div>
        <p class="small" style="opacity:.6">Klik salah satu akun untuk mengisi form otomatis.</p>
      </div>
      <div class="hazard hazard--aside" aria-hidden="true"></div>
    </aside>`;
}

export async function renderLogin(root) {
  if (session.user) {
    location.hash = ROLE_HOME[session.user.role] || "#/";
    return;
  }

  root.innerHTML = `
    <div class="auth">
      ${aside()}
      <div class="auth__panel">
        <div class="auth__card card">
          <div class="row-between" style="margin-bottom:var(--s4)">
            <div class="stack-sm">
              <span class="eyebrow">Masuk</span>
              <h2 class="h2" style="font-size:1.8rem">Halo lagi.</h2>
            </div>
            <span class="badge badge--yellow">${icon("lock", 14)} Aman</span>
          </div>

          <form id="loginForm" class="stack" novalidate>
            <div class="field">
              <label class="label" for="email">Email</label>
              <input class="input" id="email" name="email" type="email" autocomplete="email"
                placeholder="nama@email.com" required />
            </div>
            <div class="field">
              <label class="label" for="password">Kata sandi</label>
              <input class="input" id="password" name="password" type="password"
                autocomplete="current-password" placeholder="••••••••" required />
            </div>
            <button class="btn btn--primary btn--block btn--lg" type="submit" id="loginBtn">
              ${icon("arrow", 18)} Masuk
            </button>
          </form>

          <div class="inline-sep" style="margin-block:var(--s4)">atau</div>

          <a class="btn btn--block" href="#/register">${icon("plus", 16)} Buat akun customer</a>
          <p class="hint text-center mt-4">
            Akun mekanik dibuat oleh admin bengkel melalui menu Manajemen Pegawai.
          </p>
        </div>
      </div>
    </div>`;

  const form = document.getElementById("loginForm");
  const button = document.getElementById("loginBtn");

  root.querySelectorAll("[data-demo]").forEach((item) => {
    item.addEventListener("click", () => {
      form.email.value = item.dataset.demo;
      form.password.value = item.dataset.password;
      form.email.focus();
      toast(`Akun demo ${item.dataset.demo} siap dipakai.`, "success");
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    fillErrors(form, {});
    const values = formValues(form);

    if (!values.email || !values.password) {
      fillErrors(form, {
        email: values.email ? "" : "Email wajib diisi.",
        password: values.password ? "" : "Kata sandi wajib diisi.",
      });
      return;
    }

    button.disabled = true;
    button.innerHTML = `${icon("clock", 18)} Memeriksa…`;

    try {
      const data = await api("/api/auth/login", { method: "POST", body: values, auth: false });
      setSession(data.token, data.user);
      toast(`Selamat datang, ${data.user.name.split(" ")[0]}!`, "success");
      location.hash = ROLE_HOME[data.user.role] || "#/";
    } catch (error) {
      const errors = error instanceof ApiError ? error.fields : {};
      fillErrors(form, errors);
      toast(error.message, "error");
      button.disabled = false;
      button.innerHTML = `${icon("arrow", 18)} Masuk`;
    }
  });
}

export async function renderRegister(root) {
  if (session.user) {
    location.hash = ROLE_HOME[session.user.role] || "#/";
    return;
  }

  root.innerHTML = `
    <div class="auth">
      <aside class="auth__aside">
        <div class="stack-sm">
          <span class="eyebrow" style="color:var(--yellow)">Registrasi · UC-01</span>
          <h1 class="display" style="font-size:clamp(2.2rem,4vw,3.4rem)">
            Mulai<br />dari<br /><span style="color:var(--violet)">sini.</span>
          </h1>
          <p class="lead" style="opacity:.8;max-width:34ch">
            Satu akun untuk menyimpan kendaraan, riwayat servis, dan seluruh nota digital Anda.
          </p>
        </div>
        <div class="stack-sm">
          <p class="eyebrow" style="opacity:.7">Yang Anda dapat</p>
          <ul class="stack-sm" style="font-size:.86rem;font-weight:700">
            <li>${icon("check", 16)} Estimasi biaya transparan</li>
            <li>${icon("check", 16)} Persetujuan biaya tambahan</li>
            <li>${icon("check", 16)} Riwayat & nota digital</li>
          </ul>
        </div>
      </aside>

      <div class="auth__panel">
        <div class="auth__card card">
          <div class="stack-sm" style="margin-bottom:var(--s4)">
            <span class="eyebrow">Daftar akun</span>
            <h2 class="h2" style="font-size:1.8rem">Buat akun baru.</h2>
          </div>

          <form id="registerForm" class="stack" novalidate>
            <div class="field">
              <label class="label" for="name">Nama lengkap</label>
              <input class="input" id="name" name="name" type="text" autocomplete="name"
                placeholder="Nama sesuai identitas" required />
            </div>
            <div class="field">
              <label class="label" for="email">Email</label>
              <input class="input" id="email" name="email" type="email" autocomplete="email"
                placeholder="nama@email.com" required />
            </div>
            <div class="field">
              <label class="label" for="phone">Nomor HP</label>
              <input class="input" id="phone" name="phone" type="tel" autocomplete="tel"
                placeholder="08xxxxxxxxxx" />
            </div>
            <div class="field">
              <label class="label" for="password">Kata sandi</label>
              <input class="input" id="password" name="password" type="password"
                autocomplete="new-password" placeholder="Minimal 8 karakter" required />
              <span class="hint">Gunakan kombinasi huruf besar, kecil, dan angka.</span>
            </div>
            <div class="field">
              <label class="label" for="confirm">Ulangi kata sandi</label>
              <input class="input" id="confirm" name="confirm" type="password"
                autocomplete="new-password" placeholder="Ulangi kata sandi" required />
            </div>
            <button class="btn btn--primary btn--block btn--lg" type="submit" id="registerBtn">
              ${icon("check", 18)} Daftar
            </button>
          </form>

          <div class="inline-sep" style="margin-block:var(--s4)">sudah punya akun?</div>
          <a class="btn btn--block" href="#/login">${icon("arrow", 16)} Masuk di sini</a>
        </div>
      </div>
    </div>`;

  const form = document.getElementById("registerForm");
  const button = document.getElementById("registerBtn");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    fillErrors(form, {});
    const values = formValues(form);

    const errors = {};
    if (values.name.length < 3) errors.name = "Nama minimal 3 karakter.";
    if (!/^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/.test(values.email)) errors.email = "Format email tidak valid.";
    if (values.phone && !/^[0-9+\-\s]{8,20}$/.test(values.phone)) errors.phone = "Nomor HP tidak valid.";
    if (values.password.length < 8) errors.password = "Kata sandi minimal 8 karakter.";
    if (values.password !== values.confirm) errors.confirm = "Kata sandi tidak sama.";

    if (Object.keys(errors).length) {
      fillErrors(form, errors);
      return;
    }

    button.disabled = true;
    button.innerHTML = `${icon("clock", 18)} Memproses…`;

    try {
      await api("/api/auth/register", {
        method: "POST",
        auth: false,
        body: {
          name: values.name,
          email: values.email,
          phone: values.phone,
          password: values.password,
        },
      });
      toast("Akun berhasil dibuat. Silakan login.", "success");
      location.hash = "#/login";
    } catch (error) {
      fillErrors(form, error instanceof ApiError ? error.fields : {});
      toast(error.message, "error");
      button.disabled = false;
      button.innerHTML = `${icon("check", 18)} Daftar`;
    }
  });
}
