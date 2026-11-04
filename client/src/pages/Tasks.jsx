import { useEffect, useRef, useState } from "react";
import { api, todayStr } from "../api.js";

const to12 = (t) => {
  if (!t) return "Anytime";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

export default function Tasks() {
  const [date, setDate] = useState(todayStr());
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [filter, setFilter] = useState("all");
  const [err, setErr] = useState("");
  const [permission, setPermission] = useState(() => "Notification" in window ? Notification.permission : "unsupported");
  const [reminders, setReminders] = useState(() => localStorage.getItem("daybook-reminders") === "on");
  const notified = useRef(new Set());

  const load = () => api.tasks(date).then((d) => setItems(d.sort((a, b) => (a.time || "99").localeCompare(b.time || "99")))).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, [date]);

  useEffect(() => {
    if (!reminders || permission !== "granted") return;
    const check = () => {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      for (const task of items) {
        const key = `${task._id}:${task.date}:${task.time}`;
        if (task.done || task.date !== today || !task.time || task.time !== now.toTimeString().slice(0, 5) || notified.current.has(key)) continue;
        notified.current.add(key);
        const options = { body: task.title, icon: "/icon-192.png", tag: `daybook-${task._id}`, data: { url: "/" } };
        if ("serviceWorker" in navigator) navigator.serviceWorker.ready.then((registration) => registration.showNotification("Task reminder", options)).catch(() => new Notification("Task reminder", options));
        else new Notification("Task reminder", options);
      }
    };
    check();
    const timer = window.setInterval(check, 15000);
    return () => window.clearInterval(timer);
  }, [items, reminders, permission]);

  async function enableReminders() {
    if (!("Notification" in window)) { setErr("Notifications are not supported in this browser."); return; }
    const result = await Notification.requestPermission();
    setPermission(result);
    const enabled = result === "granted";
    setReminders(enabled);
    localStorage.setItem("daybook-reminders", enabled ? "on" : "off");
    setErr(enabled ? "" : "Allow notifications in your browser settings to receive task reminders.");
  }

  async function add(e) {
    e.preventDefault();
    if (!title.trim()) return;
    try { await api.addTask({ title, time, date }); setTitle(""); setTime(""); load(); } catch (x) { setErr(x.message); }
  }
  const toggle = async (t) => { setItems(items.map((i) => (i._id === t._id ? { ...i, done: !i.done } : i))); await api.patchTask(t._id, { done: !t.done }); };
  const remove = async (t) => { setItems(items.filter((i) => i._id !== t._id)); await api.delTask(t._id); };

  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const shown = items.filter((i) => (filter === "all" ? true : filter === "done" ? i.done : !i.done));
  const nowHM = new Date().toTimeString().slice(0, 5);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
        <label htmlFor="task-date" className="shrink-0 text-sm font-bold text-ink/70">Day</label>
        <input id="task-date" type="date" className="field min-w-0 flex-1" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0"><p className="font-bold">Task reminders</p><p className="text-sm text-ink/55">Get a notification when a timed task is due.</p></div>
        <button type="button" onClick={enableReminders} disabled={reminders && permission === "granted"} className="btn min-h-11 w-full shrink-0 sm:w-auto">
          {permission === "unsupported" ? "Not supported" : permission === "denied" ? "Notifications blocked" : reminders && permission === "granted" ? "Reminders on" : "Enable reminders"}
        </button>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-baseline justify-between"><h2 className="text-lg font-bold">{date === todayStr() ? "Today's list" : "List for this day"}</h2><p className="text-sm text-ink/60">{done} of {items.length} done</p></div>
        <div className="mt-2 h-2 rounded-full bg-ink/10"><div className="h-2 rounded-full bg-teal transition-all" style={{ width: pct + "%" }} /></div>
      </div>

      <form onSubmit={add} className="grid grid-cols-1 gap-2 rounded-2xl bg-white p-3 shadow-sm sm:grid-cols-[1fr_9rem_auto]">
        <input className="field" placeholder="What do you need to do?" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} />
        <button className="btn min-h-12">Add task</button>
      </form>
      {err && <p className="text-sm text-red-600" role="status">{err}</p>}

      <div className="flex gap-2">
        {[['all', 'All'], ['pending', 'Pending'], ['done', 'Done']].map(([k, label]) => <button key={k} onClick={() => setFilter(k)} className={`min-h-11 rounded-full px-4 text-sm font-semibold ${filter === k ? "bg-ink text-white" : "bg-white text-ink/70"}`}>{label}</button>)}
      </div>

      <ul className="space-y-2">
        {shown.map((t) => {
          const late = !t.done && date === todayStr() && t.time && t.time < nowHM;
          return <li key={t._id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
            <button onClick={() => toggle(t)} aria-label={t.done ? "Mark not done" : "Mark done"} className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 ${t.done ? "border-teal bg-teal text-white" : "border-ink/30"}`}>{t.done && "✓"}</button>
            <div className="min-w-0 flex-1"><p className={`break-words font-medium ${t.done ? "text-ink/40 line-through" : ""}`}>{t.title}</p><p className={`text-sm ${late ? "font-semibold text-red-600" : "text-teal"}`}>{to12(t.time)}{late && " · time passed"}</p></div>
            <button onClick={() => remove(t)} className="min-h-11 shrink-0 px-2 text-sm text-red-600">Delete</button>
          </li>;
        })}
      </ul>
      {!shown.length && <p className="py-8 text-center text-ink/50">{items.length ? "Nothing in this filter." : "Add your first task with a time above."}</p>}
    </section>
  );
}
