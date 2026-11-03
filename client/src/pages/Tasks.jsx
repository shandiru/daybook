import { useEffect, useState } from "react";
import { api, todayStr } from "../api.js";

const to12 = (t) => {
  if (!t) return "Anytime";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};
const shift = (d, n) => {
  const x = new Date(d + "T00:00"); x.setDate(x.getDate() + n);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

export default function Tasks() {
  const [date, setDate] = useState(todayStr());
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [filter, setFilter] = useState("all");
  const [err, setErr] = useState("");

  const load = () => api.tasks(date).then((d) => setItems(d.sort((a, b) => (a.time || "99").localeCompare(b.time || "99")))).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [date]);

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
      <div className="flex items-center justify-between gap-2">
        <button className="btn !px-3" onClick={() => setDate(shift(date, -1))} aria-label="Previous day">‹</button>
        <input type="date" className="field !w-auto flex-1 text-center" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <button className="btn !px-3" onClick={() => setDate(shift(date, 1))} aria-label="Next day">›</button>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">{date === todayStr() ? "Today's list" : "List for this day"}</h2>
          <p className="text-sm text-ink/60">{done} of {items.length} done</p>
        </div>
        <div className="mt-2 h-2 rounded-full bg-ink/10"><div className="h-2 rounded-full bg-teal transition-all" style={{ width: pct + "%" }} /></div>
      </div>

      <form onSubmit={add} className="grid grid-cols-[1fr_auto] gap-2 rounded-2xl bg-white p-3 shadow-sm sm:grid-cols-[1fr_9rem_auto]">
        <input className="field col-span-2 sm:col-span-1" placeholder="What do you need to do?" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} />
        <button className="btn">Add task</button>
      </form>
      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="flex gap-2">
        {[["all", "All"], ["pending", "Pending"], ["done", "Done"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${filter === k ? "bg-ink text-white" : "bg-white text-ink/70"}`}>{l}</button>
        ))}
      </div>

      <ul className="space-y-2">
        {shown.map((t) => {
          const late = !t.done && date === todayStr() && t.time && t.time < nowHM;
          return (
            <li key={t._id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
              <button onClick={() => toggle(t)} aria-label="Mark done"
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 ${t.done ? "border-teal bg-teal text-white" : "border-ink/30"}`}>
                {t.done && "✓"}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`break-words font-medium ${t.done ? "text-ink/40 line-through" : ""}`}>{t.title}</p>
                <p className={`text-sm ${late ? "font-semibold text-red-600" : "text-teal"}`}>{to12(t.time)}{late && " · time passed"}</p>
              </div>
              <button onClick={() => remove(t)} className="px-2 text-sm text-red-600">Delete</button>
            </li>
          );
        })}
      </ul>
      {!shown.length && <p className="py-8 text-center text-ink/50">{items.length ? "Nothing in this filter." : "Add your first task with a time above."}</p>}
    </section>
  );
}
