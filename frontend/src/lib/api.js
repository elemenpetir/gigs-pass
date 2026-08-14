const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

export { BASE_URL };

const TOKEN_KEY = "gigs_pass_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function request(path, { method = "GET", body, headers = {}, auth = true } = {}) {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const options = { method, headers: { ...headers } };

  if (!isFormData) options.headers["Content-Type"] = "application/json";

  if (auth) {
    const token = getToken();
    if (token) options.headers.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) options.body = isFormData ? body : JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, options);

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const message = payload?.message || `Request failed (${res.status})`;
    throw new ApiError(message, res.status, payload?.data);
  }

  return payload?.data ?? payload;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: "GET" }),
  post: (path, body, opts) => request(path, { ...opts, method: "POST", body }),
  put: (path, body, opts) => request(path, { ...opts, method: "PUT", body }),
  upload: (path, formData, opts) => request(path, { ...opts, method: "POST", body: formData }),
};

export { ApiError };