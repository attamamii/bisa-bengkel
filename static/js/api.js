/* =========================================================================
   API client + penyimpanan sesi
   ========================================================================= */

const TOKEN_KEY = "bisa.token";
const USER_KEY = "bisa.user";

export const session = {
  token: localStorage.getItem(TOKEN_KEY) || null,
  user: JSON.parse(localStorage.getItem(USER_KEY) || "null"),
};

export function setSession(token, user) {
  session.token = token;
  session.user = user;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  session.token = null;
  session.user = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export class ApiError extends Error {
  constructor(message, status, fields = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export async function api(path, options = {}) {
  const { method = "GET", body, auth = true } = options;
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth && session.token) headers.Authorization = `Bearer ${session.token}`;

  let response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw new ApiError("Tidak dapat terhubung ke server. Periksa koneksi Anda.", 0);
  }

  let payload = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text };
    }
  }

  if (!response.ok) {
    if (response.status === 401 && auth && session.token) {
      clearSession();
      if (!location.hash.startsWith("#/login")) {
        location.hash = "#/login";
      }
    }
    throw new ApiError(
      (payload && payload.error) || "Terjadi kesalahan tak terduga.",
      response.status,
      (payload && payload.fields) || {},
    );
  }

  return payload;
}
