import { useEffect, useMemo, useState } from "react";
import { api, todayStr, fmtMoney, MONTHS } from "../api.js";
import BarChart from "../components/BarChart.jsx";

const CATS = ["Food", "Travel", "Bills", "Shopping", "Health", "Other"];
const sum = (a) => a.reduce((s, e) => s + e.amount, 0);

export default function Expenses() {
  const t = todayStr();
  const [view, setView] = useState("day");
  const [date, setDate] = useState(t);
  const [month, setMonth] = useState(t.slice(0, 7));
  const [year, setYear] = useState(t.slice(0, 4));
  const [all, setAll] = useState([]);
  const [f, setF] = useState({ title: "", amount: "", category: "Food", date: t });
  const [err, setErr] = useState("");

  const ykey = view === "day" ? date.slice(0, 4) : view === "month" ? month.slice(0, 4) : year;
  const load = () => api.expenses(ykey).then(setAll).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [ykey]);

  const scope = useMemo(() =>
    view === "day" ? all.filter((e) => e.date === date) : view === "month" ? all.filter((e) => e.date.startsWith(month)) : all,
    [all, view, date, month]);
  const total = sum(scope);

  // chart + stats
  const [yy, mm] = month.split("-").map(Number);
  const daysInMonth = new Date(yy, mm, 0).getDate();
  const perDay = Array.from({ length: daysInMonth }, (_, i) => {
    const d = `${month}-${String(i + 1).padStart(2, "0")}`;
    return { label: String(i + 1), full: `${i + 1} ${MONTHS[mm - 1]}`, value: sum(scope.filter((e) => e.date === d)), key: d };
  });
  const perMonth = MONTHS.map((m, i) => {
    const k = `${year}-${String(i + 1).padStart(2, "0")}`;
    const list = all.filter((e) => e.date.startsWith(k));
    return { label: m, full: `${m} ${year}`, value: sum(list), count: list.length, key: k };
  });
  const bars = view === "month" ? perDay : perMonth;
  const peak = [...bars].sort((a, b) => b.value - a.value)[0];
  const activeBars = bars.filter((b) => b.value > 0).length;

  const byCat = useMemo(() => {
    const m = {};
    scope.forEach((e) => (m[e.category] = (m[e.category] || 0) + e.amount));
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [scope]);

  const grouped = useMemo(() => {
    const m = {};
    scope.forEach((e) => (m[e.date] = [...(m[e.date] || []), e]));
    return Object.entries(m).sort((a, b) => b[0].localeCompare(a[0]));
  }, [scope]);

  async function add(e) {
    e.preventDefault();
    if (!f.title.trim() || !(+f.amount > 0)) return setErr("Enter a name and an amount above 0");
    setErr("");
    try {
      await api.addExpense({ ...f, amount: +f.amount });
      setF({ ...f, title: "", amount: "" });
      f.date.slice(0, 4) === ykey ? load() : null;
    } catch (x) { setErr(x.message); }
  }
  const remove = async (e) => { setAll(all.filter((i) => i._id !== e._id)); await api.delExpense(e._id); };

  const Row = ({ e }) => (
    <li className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
      <div className="min-w-0 flex-1"><p className="break-words font-medium">{e.title}</p><p className="text-sm text-ink/50">{e.category}</p></div>
      <p className="font-bold">{fmtMoney(e.amount)}</p>
      <button onClick={() => remove(e)} className="px-2 text-sm text-red-600">Delete</button>
    </li>
  );

  return (
    <section className="space-y-4">
      <form onSubmit={add} className="grid grid-cols-2 gap-2 rounded-3xl border border-ink/5 bg-white p-4 shadow-[0_8px_28px_rgba(18,38,58,.05)] sm:grid-cols-[1fr_7rem_8rem_auto]">
        <input className="field col-span-2 sm:col-span-1" placeholder="What did you spend on?" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <input className="field" type="number" inputMode="decimal" placeholder="Amount (LKR)" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <select className="field" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
        <input className="field" type="date" value={f.date} onChange={(e) => e.target.value && setF({ ...f, date: e.target.value })} />
        <button className="btn col-span-2 sm:col-span-4">Add expense</button>
      </form>
      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="grid grid-cols-3 rounded-xl bg-ink/10 p-1">
        {[["day", "Day"], ["month", "Month"], ["year", "Year"]].map(([k, l]) => (
          <button key={k} onClick={() => setView(k)} className={`rounded-lg py-2 text-sm font-semibold ${view === k ? "bg-white shadow-sm" : "text-ink/60"}`}>{l}</button>
        ))}
      </div>

      {view === "day" && <input type="date" className="field" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />}
      {view === "month" && <input type="month" className="field" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />}
      {view === "year" && (
        <div className="flex items-center gap-2">
          <button className="btn !px-3" onClick={() => setYear(String(+year - 1))}>‹</button>
          <p className="flex-1 text-center text-lg font-bold">{year}</p>
          <button className="btn !px-3" onClick={() => setYear(String(+year + 1))}>›</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-amber-soft p-4">
          <p className="text-sm text-ink/70">Total spent</p>
          <p className="text-2xl font-extrabold text-amber">{fmtMoney(total)}</p>
        </div>
        <div className="rounded-2xl bg-teal-soft p-4">
          {view === "day" && <><p className="text-sm text-ink/70">Entries</p><p className="text-2xl font-extrabold text-teal-dark">{scope.length}</p></>}
          {view === "month" && <><p className="text-sm text-ink/70">Average per day</p><p className="text-2xl font-extrabold text-teal-dark">{fmtMoney(Math.round(total / daysInMonth))}</p></>}
          {view === "year" && <><p className="text-sm text-ink/70">Average per month</p><p className="text-2xl font-extrabold text-teal-dark">{fmtMoney(Math.round(total / 12))}</p></>}
        </div>
      </div>
      {view !== "day" && peak?.value > 0 && (
        <p className="rounded-xl bg-white p-3 text-sm shadow-sm">
          Highest {view === "month" ? "day" : "month"}: <b>{peak.full}</b> with <b>{fmtMoney(peak.value)}</b>. Spent on {activeBars} {view === "month" ? "days" : "months"}.
        </p>
      )}

      {view !== "day" && (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h3 className="mb-2 font-bold">{view === "month" ? "Spending each day" : "Spending each month"}</h3>
          <BarChart data={bars} />
        </div>
      )}

      {byCat.length > 0 && (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-bold">By category</h3>
          <div className="space-y-3">
            {byCat.map(([c, v]) => (
              <div key={c}>
                <div className="flex justify-between text-sm"><span>{c}</span><span className="font-semibold">{fmtMoney(v)} · {Math.round((v / total) * 100)}%</span></div>
                <div className="mt-1 h-2 rounded-full bg-ink/10"><div className="h-2 rounded-full bg-amber" style={{ width: `${(v / total) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "day" && <ul className="space-y-2">{scope.map((e) => <Row key={e._id} e={e} />)}</ul>}

      {view === "month" && grouped.map(([d, list]) => (
        <div key={d}>
          <div className="mb-1 flex justify-between px-1 text-sm font-semibold text-ink/70"><span>{new Date(d + "T00:00").toDateString()}</span><span>{fmtMoney(sum(list))}</span></div>
          <ul className="space-y-2">{list.map((e) => <Row key={e._id} e={e} />)}</ul>
        </div>
      ))}

      {view === "year" && (
        <ul className="divide-y divide-ink/10 rounded-2xl bg-white shadow-sm">
          {perMonth.map((m) => (
            <li key={m.key}>
              <button className="flex w-full items-center justify-between px-4 py-3 text-left" onClick={() => { setMonth(m.key); setView("month"); }}>
                <span className="font-medium">{m.full}<span className="ml-2 text-sm text-ink/50">{m.count} entries</span></span>
                <span className="font-bold">{fmtMoney(m.value)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!scope.length && <p className="py-4 text-center text-ink/50">No spending recorded for this {view}.</p>}
    </section>
  );
}
