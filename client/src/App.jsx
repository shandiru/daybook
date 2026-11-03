import { useEffect, useState } from "react";
import { session } from "./api.js";
import Login from "./pages/Login.jsx";
import Tasks from "./pages/Tasks.jsx";
import Expenses from "./pages/Expenses.jsx";
import Chat from "./pages/Chat.jsx";

export default function App() {
  const [user, setUser] = useState(session.user);
  const [tab, setTab] = useState("tasks");
  const [installPrompt, setInstallPrompt] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);

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

  if (!session.token || !user) return <Login onDone={setUser} />;
  const tabs = [["tasks", "My day"], ["money", "Spending"], ["chat", "Chat"]];
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
            {installPrompt && <button className="install-button" onClick={async () => { await installPrompt.prompt(); setInstallPrompt(null); }}>Install</button>}
            <button className="avatar-button" title={`Log out ${user.name}`} onClick={() => { session.clear(); setUser(null); }}>{(user.name || "U").charAt(0).toUpperCase()}</button>
          </div>
        </div>
        <div className="mt-8"><p className="eyebrow">{today}</p><h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">{tab === "tasks" ? "Make today count." : "Know where it goes."}</h1><p className="mt-2 text-sm text-ink/55">{tab === "tasks" ? "One thing at a time. You’ve got this." : "Your spending, in Sri Lankan rupees."}</p></div>
      </header>

      <main className="flex-1 px-5 pb-28 sm:px-8">{tab === "tasks" ? <Tasks /> : tab === "money" ? <Expenses /> : <Chat />}</main>

      <nav className="bottom-nav fixed inset-x-0 bottom-0" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-auto grid max-w-2xl grid-cols-3 px-5 py-2 sm:px-8">
          {tabs.map(([key, label]) => <button key={key} onClick={() => setTab(key)} className={`nav-item ${tab === key ? "active" : ""}`}><span>{label}</span></button>)}
        </div>
      </nav>
    </div>
  );
}
