/*
  API Client: Configurable base URL and endpoints for PlayCard backend
  - Exposes setBaseUrl/getBaseUrl
  - Methods to fetch card by id, recharge, deduct, update player
  - Uses fetch with JSON; handles errors uniformly
*/

(() => {
  const BASE_URL_KEY = "playcard.baseUrl";

  function getBaseUrl() {
    return localStorage.getItem(BASE_URL_KEY) || "";
  }

  function setBaseUrl(url) {
    if (!/^https?:\/\//i.test(url)) {
      throw new Error("Base URL must start with http:// or https://");
    }
    localStorage.setItem(BASE_URL_KEY, url.replace(/\/$/, ""));
  }

  async function request(path, options = {}) {
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
      throw new Error("Backend URL not set");
    }
    const url = `${baseUrl}${path}`;
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const err = await res.json();
        message = err.message || message;
      } catch (_) {}
      const error = new Error(message);
      error.status = res.status;
      throw error;
    }
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) return res.json();
    return res.text();
  }

  // API methods (paths are placeholders; adjust to backend later)
  const api = {
    setBaseUrl,
    getBaseUrl,
    async getHealth() {
      return request("/health");
    },
    async getCard(cardId) {
      return request(`/cards/${encodeURIComponent(cardId)}`);
    },
    async recharge(cardId, amount) {
      return request(`/cards/${encodeURIComponent(cardId)}/recharge`, {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
    },
    async deduct(cardId, amount) {
      return request(`/cards/${encodeURIComponent(cardId)}/deduct`, {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
    },
    async updatePlayer(cardId, player) {
      return request(`/cards/${encodeURIComponent(cardId)}/player`, {
        method: "PUT",
        body: JSON.stringify(player),
      });
    },
    async getHistory(cardId) {
      return request(`/cards/${encodeURIComponent(cardId)}/history`);
    },
  };

  window.PlayCardAPI = api;
})();


