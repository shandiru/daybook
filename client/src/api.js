const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const session = {
  get token() { return localStorage.getItem("token"); },
  get user() { try { return JSON.parse(localStorage.getItem("user")); } catch { return null; } },
  save(t, u) { localStorage.setItem("token", t); localStorage.setItem("user", JSON.stringify(u)); },
  clear() { localStorage.removeItem("token"); localStorage.removeItem("user"); },
};

async function req(path, method = "GET", body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(session.token && { Authorization: `Bearer ${session.token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && session.token) { session.clear(); location.reload(); }
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

export const api = {
  login: (b) => req("/api/auth/login", "POST", b),
  tasks: (date) => req(`/api/tasks?date=${date}`),
  addTask: (b) => req("/api/tasks", "POST", b),
  patchTask: (id, b) => req(`/api/tasks/${id}`, "PATCH", b),
  delTask: (id) => req(`/api/tasks/${id}`, "DELETE"),
  expenses: (year) => req(`/api/expenses?year=${year}`),
  addExpense: (b) => req("/api/expenses", "POST", b),
  delExpense: (id) => req(`/api/expenses/${id}`, "DELETE"),
  chat: (channel = "general") => req(`/api/chat?channel=${encodeURIComponent(channel)}`),
  sendChat: (text, channel = "general") => req("/api/chat", "POST", { text, channel }),
  chatUnread: () => req("/api/chat/unread"),
  markChatSeen: (channel = "general") => req("/api/chat/seen", "PUT", { channel }),
  setTyping: (typing, channel = "general") => req("/api/chat/typing", "PUT", { typing, channel }),
  typingUsers: (channel = "general") => req(`/api/chat/typing?channel=${encodeURIComponent(channel)}`),
  game: () => req("/api/game"),
  memoryHint: () => req("/api/game/hint", "POST", {}),
  joinGame: () => req("/api/game/join", "POST", {}),
  flipMemoryCard: (index) => req("/api/game/flip", "POST", { index }),
  resolveMemoryTurn: () => req("/api/game/resolve", "POST", {}),
  restartMemoryGame: () => req("/api/game/restart", "POST", {}),
  gameRematch: () => req("/api/game/rematch", "POST", {}),
  gameHistory: (type) => req(`/api/game/history?type=${encodeURIComponent(type)}`),
  ludo: () => req("/api/game/ludo"),
  joinLudo: () => req("/api/game/ludo/join", "POST", {}),
  rollLudo: () => req("/api/game/ludo/roll", "POST", {}),
  moveLudo: (token) => req("/api/game/ludo/move", "POST", { token }),
  rematchLudo: () => req("/api/game/ludo/rematch", "POST", {}),
  connectFour: () => req("/api/game/connect-four"),
  joinConnectFour: () => req("/api/game/connect-four/join", "POST", {}),
  dropConnectFour: (column) => req("/api/game/connect-four/drop", "POST", { column }),
  rematchConnectFour: () => req("/api/game/connect-four/rematch", "POST", {}),
};

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const fmtMoney = (n) => new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 0 }).format(Number(n || 0));
export const fmtShort = (n) => (n >= 1000000 ? (n / 1000000).toFixed(1) + "M" : n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(Math.round(n)));
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
