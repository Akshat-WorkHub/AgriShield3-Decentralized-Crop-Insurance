const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const text = await res.text();

  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    throw new Error(
      data?.error || `Request failed: ${res.status} ${res.statusText}`
    );
  }

  return data;
}

export const api = {
  health: () => request("/health"),

  listProducts: () => request("/products"),
  getProduct: (id) => request(`/products/${id}`),
  createProduct: (payload) => request("/products", { method: "POST", body: JSON.stringify(payload) }),
  setProductActive: (id, active) => request(`/products/${id}/status`, { method: "PATCH", body: JSON.stringify({ active }) }),

  enrollProduct: (payload) => request("/policies/enroll", { method: "POST", body: JSON.stringify(payload) }),

  registerPolicy: (payload) =>
    request("/policies", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listPolicies: (farmer) =>
    request(
      `/policies${farmer ? `?farmer=${encodeURIComponent(farmer)}` : ""}`
    ),

  getPolicy: (id) => request(`/policies/${id}`),

  evaluatePolicy: (id, scenario) =>
    request(`/oracle/${id}/evaluate`, {
      method: "POST",
      body: JSON.stringify({ scenario }),
    }),

  getReadings: (lat, lon) =>
    request(`/oracle/readings?lat=${lat}&lon=${lon}`),

  getReserve: () => request("/vault/reserve"),

  topUpReserve: (amountEth) =>
    request("/vault/topup", {
      method: "POST",
      body: JSON.stringify({ amountEth }),
    }),

  getEvents: (limit = 30) => request(`/vault/events?limit=${limit}`),

  monitorStatus: () => request("/oracle/monitor/status"),
  startMonitoring: () => request("/oracle/monitor/start", { method: "POST" }),
  stopMonitoring: () => request("/oracle/monitor/stop", { method: "POST" }),
  runMonitoringCycle: () => request("/oracle/monitor/run", { method: "POST" }),

  evaluateLivePolicy: (id) =>
    request(`/oracle/${id}/evaluate`, {
      method: "POST",
      body: JSON.stringify({ live: true }),
    }),
};