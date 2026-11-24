const BASE = import.meta.env.VITE_API || "http://localhost:8000";

export const getToken = () => localStorage.getItem("token");

async function req(path, method = "GET", body) {
  const headers = { "Content-Type": "application/json" };
  const t = getToken();
  if (t) headers.Authorization = "Bearer " + t;
  const r = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401) window.dispatchEvent(new Event("haat-logout"));
    throw new Error(typeof data.detail === "string" ? data.detail : "Invalid input");
  }
  return data;
}

export const api = {
  get: (p) => req(p),
  post: (p, b) => req(p, "POST", b || {}),
};