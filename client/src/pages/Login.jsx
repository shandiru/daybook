import { useState } from "react";
import { api, session } from "../api.js";

export default function Login({ onDone }) {
  const [f, setF] = useState({ username: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try { const { token, user } = await api.login(f); session.save(token, user); onDone(user); }
    catch (x) { setErr(x.message); }
    setBusy(false);
  }
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5">
      <h1 className="text-4xl font-extrabold tracking-tight">Daybook</h1>
      <p className="mb-6 mt-1 text-ink/70">Your day, hour by hour. Your money, rupee by rupee.</p>
      <form onSubmit={submit} className="space-y-3">
        <input className="field" placeholder="Username" autoCapitalize="none" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} required />
        <input className="field" type="password" placeholder="Password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
        {err && <p className="text-sm font-medium text-red-600">{err}</p>}
        <button className="btn w-full" disabled={busy}>{busy ? "Please wait…" : "Log in"}</button>
      </form>
    </div>
  );
}
