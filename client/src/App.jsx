import { useCallback, useEffect, useRef, useState } from "react";
import { api, session } from "./api.js";
import Login from "./pages/Login.jsx";
import Tasks from "./pages/Tasks.jsx";
import Expenses from "./pages/Expenses.jsx";
import Chat from "./pages/Chat.jsx";
import Game from "./pages/Game.jsx";

export default function App() {
  const [user, setUser] = useState(session.user);
  const [tab, setTab] = useState("tasks");
  const [installPrompt, setInstallPrompt] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [unread, setUnread] = useState({ general: 0, ludo: 0 });
  const [toast, setToast] = useState(null);
  const latestMessage = useRef(undefined);

  const refreshUnread = useCallback(async () => {
    if (!session.token) return;
    try {
      const result = await api.chatUnread();
      setUnread(result.counts);
      if (latestMessage.current !== undefined && result.latest?._id && result.latest._id !== latestMessage.current) {
        const channelName = result.latest.channel === "ludo" ? "Ludo Chat" : "Chat";
        setToast({ title: `${result.latest.sender} · ${channelName}`, text: result.latest.text });
        window.setTimeout(() => setToast(null), 4500);
        if (document.visibilityState !== "visible" && typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(`${result.latest.sender} sent a message`, { body: result.latest.text, icon: "/icon-192.png", tag: `chat-${result.latest._id}` });
      }
      latestMessage.current = result.latest?._id || null;
    } catch { /* Keep the current badge when temporarily offline. */ }
  }, []);

  useEffect(() => {
    const install = (event) => { event.preventDefault(); setInstallPrompt(event); };
    const onlineChange = () => setOnline(navigator.onLine);
    window.addEventListener("beforeinstallprompt", install);
    window.addEventListener("online", onlineChange);
    window.addEventListener("offline", onlineChange);
    return () => {
      window.removeEventListener("beforeinstallprompt", install);
      window.removeEventListener("online", onlineChange);
      window.removeEventListener("offline", onlineChange);
    };
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    refreshUnread();
    const timer = window.setInterval(refreshUnread, 3000);
    window.addEventListener("chat-seen", refreshUnread);
    return () => { window.clearInterval(timer); window.removeEventListener("chat-seen", refreshUnread); };
  }, [user, refreshUnread]);

  if (!session.token || !user) return <Login onDone={setUser} />;
  const tabs = [["tasks", "My day"], ["money", "Spending"], ["chat", "Chat"], ["game", "Game"]];
  const today = new Intl.DateTimeFormat("en-LK", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  return (
    <div className="app-shell mx-auto flex min-h-screen max-w-2xl flex-col">
      <header className="px-5 pb-5 pt-7 sm:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="brand-mark">d</div>
            <div><p className="text-xl font-extrabold tracking-tight">daybook<span className="text-teal">.</span></p><p className="text-xs font-medium text-ink/50">A little more in control</p></div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`status-pill ${online ? "is-online" : "is-offline"}`}><span className="status-dot" />{online ? "Online" : "Offline"}</span>
            {typeof Notification !== "undefined" && Notification.permission !== "granted" && <button className="notification-button" title="Enable message notifications" onClick={() => Notification.requestPermission().then(() => refreshUnread())}>🔔</button>}
            {installPrompt && <button className="install-button" onClick={async () => { await installPrompt.prompt(); setInstallPrompt(null); }}>Install</button>}
            <button className="avatar-button" title={`Log out ${user.name}`} onClick={() => { session.clear(); setUser(null); }}>{(user.name || "U").charAt(0).toUpperCase()}</button>
          </div>
        </div>
        <div className="mt-8"><p className="eyebrow">{today}</p><h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">{tab === "tasks" ? "Make today count." : tab === "game" ? "Play together." : tab === "chat" ? "Stay in touch." : "Know where it goes."}</h1><p className="mt-2 text-sm text-ink/55">{tab === "tasks" ? "One thing at a time." : tab === "game" ? "Two games for two players." : tab === "chat" ? "A shared conversation." : "Your spending, in Sri Lankan rupees."}</p></div>
      </header>

      <main className="flex-1 px-5 pb-28 sm:px-8">{tab === "tasks" ? <Tasks /> : tab === "money" ? <Expenses /> : tab === "chat" ? <Chat /> : <Game />}</main>

      {toast && <button className="message-toast" onClick={() => { setTab(toast.title.includes("Ludo") ? "game" : "chat"); setToast(null); }}><strong>{toast.title}</strong><span>{toast.text}</span></button>}

      <nav className="bottom-nav fixed inset-x-0 bottom-0" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-auto grid max-w-2xl grid-cols-4 px-5 py-2 sm:px-8">
          {tabs.map(([key, label]) => { const count = key === "chat" ? unread.general : key === "game" ? unread.ludo : 0; return <button key={key} onClick={() => setTab(key)} className={`nav-item ${tab === key ? "active" : ""}`}><span>{label}</span>{count > 0 && <b className="nav-badge">{count > 99 ? "99+" : count}</b>}</button>; })}
        </div>
      </nav>
    </div>
  );
}
