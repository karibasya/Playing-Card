/*
  App wiring: UI interactions, form handlers, and live updates integration.
  - Reads and persists backend URL
  - Optionally connects to WebSocket for live scan events
  - Updates UI for card details, history, and actions
*/

(() => {
  const els = {
    backendUrl: document.getElementById("backendUrl"),
    saveBackendBtn: document.getElementById("saveBackendBtn"),
    connStatus: document.getElementById("connStatus"),
    scanStatus: document.getElementById("scanStatus"),
    connectWsBtn: document.getElementById("connectWsBtn"),
    disconnectWsBtn: document.getElementById("disconnectWsBtn"),

    // details
    cardId: document.getElementById("cardId"),
    playerName: document.getElementById("playerName"),
    balance: document.getElementById("balance"),
    cardState: document.getElementById("cardState"),

    // forms
    rechargeForm: document.getElementById("rechargeForm"),
    rechargeAmount: document.getElementById("rechargeAmount"),
    deductForm: document.getElementById("deductForm"),
    deductAmount: document.getElementById("deductAmount"),
    playerForm: document.getElementById("playerForm"),
    playerNameInput: document.getElementById("playerNameInput"),
    playerPhoneInput: document.getElementById("playerPhoneInput"),
    playerNotesInput: document.getElementById("playerNotesInput"),

    historyList: document.getElementById("historyList"),
    historyItemTemplate: document.getElementById("historyItemTemplate"),
  };

  let currentCardId = null;
  let wsDisconnect = null;

  function setStatus(text, type = "") {
    els.scanStatus.textContent = text;
    els.scanStatus.dataset.type = type;
  }

  function setConnection(connected) {
    els.connStatus.textContent = connected ? "Connected" : "Disconnected";
    els.connStatus.style.color = connected ? "#4cd380" : "#aab3c5";
  }

  function renderDetails(card) {
    if (!card) {
      els.cardId.textContent = "—";
      els.playerName.textContent = "—";
      els.balance.textContent = "—";
      els.cardState.textContent = "—";
      return;
    }
    currentCardId = card.id;
    els.cardId.textContent = card.id;
    els.playerName.textContent = card.player?.name || "Unknown";
    els.balance.textContent = typeof card.balance === "number" ? `₹ ${card.balance}` : "—";
    els.cardState.textContent = card.status || "active";
    // prefill player form
    els.playerNameInput.value = card.player?.name || "";
    els.playerPhoneInput.value = card.player?.phone || "";
    els.playerNotesInput.value = card.player?.notes || "";
  }

  function addHistory(item) {
    const tpl = els.historyItemTemplate.content.cloneNode(true);
    tpl.querySelector(".title").textContent = item.title || "Event";
    tpl.querySelector(".meta").textContent = item.meta || new Date().toLocaleString();
    tpl.querySelector(".amount").textContent = item.amount ?? "";
    els.historyList.prepend(tpl);
  }

  async function loadCard(cardId) {
    try {
      setStatus(`Loading card ${cardId}...`);
      const card = await window.PlayCardAPI.getCard(cardId);
      renderDetails(card);
      setStatus(`Card ${cardId} ready.`);
      const history = await window.PlayCardAPI.getHistory(cardId).catch(() => []);
      els.historyList.innerHTML = "";
      (history || []).forEach(addHistory);
    } catch (err) {
      setStatus(err.message || "Failed to load card", "error");
    }
  }

  function handleScanEvent(payload) {
    // payload shape example: { type: 'scan', data: { cardId: 'ABC123' } }
    const cardId = payload?.data?.cardId || payload?.cardId || payload?.id;
    if (!cardId) return;
    loadCard(cardId);
  }

  function connectWebSocket() {
    const base = window.PlayCardAPI.getBaseUrl();
    if (!base) return alert("Set Backend URL first.");
    const url = base.replace(/^http/, "ws") + "/ws";
    try {
      window.PlayCardWS.on("open", () => {
        setStatus("Live connected. Scan a card.");
        els.connectWsBtn.disabled = true;
        els.disconnectWsBtn.disabled = false;
      });
      window.PlayCardWS.on("close", () => {
        setStatus("Live disconnected.");
        els.connectWsBtn.disabled = false;
        els.disconnectWsBtn.disabled = true;
      });
      window.PlayCardWS.on("error", () => setStatus("Live error.", "error"));
      window.PlayCardWS.on("message", (msg) => {
        if (msg?.type === "scan") handleScanEvent(msg);
        if (msg?.type === "update") {
          if (msg.data?.card) renderDetails(msg.data.card);
          if (msg.data?.historyItem) addHistory(msg.data.historyItem);
        }
      });
      window.PlayCardWS.connect(url);
      wsDisconnect = () => window.PlayCardWS.disconnect();
    } catch (e) {
      alert(e.message);
    }
  }

  function disconnectWebSocket() {
    if (wsDisconnect) wsDisconnect();
  }

  // Form handlers
  els.rechargeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentCardId) return alert("Scan a card first.");
    const amount = parseInt(els.rechargeAmount.value, 10);
    if (!Number.isFinite(amount) || amount <= 0) return alert("Enter a valid amount.");
    try {
      await window.PlayCardAPI.recharge(currentCardId, amount);
      addHistory({ title: "Recharge", meta: new Date().toLocaleString(), amount: `+₹ ${amount}` });
      await loadCard(currentCardId);
      els.rechargeAmount.value = "";
    } catch (err) { alert(err.message || "Recharge failed"); }
  });

  els.deductForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentCardId) return alert("Scan a card first.");
    const amount = parseInt(els.deductAmount.value, 10);
    if (!Number.isFinite(amount) || amount <= 0) return alert("Enter a valid amount.");
    try {
      await window.PlayCardAPI.deduct(currentCardId, amount);
      addHistory({ title: "Deduct", meta: new Date().toLocaleString(), amount: `-₹ ${amount}` });
      await loadCard(currentCardId);
      els.deductAmount.value = "";
    } catch (err) { alert(err.message || "Deduct failed"); }
  });

  els.playerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentCardId) return alert("Scan a card first.");
    const payload = {
      name: els.playerNameInput.value.trim(),
      phone: els.playerPhoneInput.value.trim(),
      notes: els.playerNotesInput.value.trim(),
    };
    if (!payload.name) return alert("Player name is required.");
    try {
      await window.PlayCardAPI.updatePlayer(currentCardId, payload);
      addHistory({ title: "Player updated", meta: new Date().toLocaleString(), amount: "" });
      await loadCard(currentCardId);
    } catch (err) { alert(err.message || "Update failed"); }
  });

  // Backend URL setup
  els.saveBackendBtn.addEventListener("click", () => {
    const url = els.backendUrl.value.trim();
    try {
      window.PlayCardAPI.setBaseUrl(url);
      setConnection(true);
    } catch (e) { alert(e.message); }
  });

  els.connectWsBtn.addEventListener("click", connectWebSocket);
  els.disconnectWsBtn.addEventListener("click", disconnectWebSocket);

  // Init
  (function init() {
    const url = window.PlayCardAPI.getBaseUrl();
    if (url) {
      els.backendUrl.value = url;
      setConnection(true);
      // optional: check health
      window.PlayCardAPI.getHealth().then(() => setConnection(true)).catch(() => setConnection(false));
    }
  })();
})();


