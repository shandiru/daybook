import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";

export default function GameHistory({ type }) {
  const [history, setHistory] = useState({ wins: [], matches: [] });
  const load = useCallback(async () => {
    try { setHistory(await api.gameHistory(type)); } catch { /* Keep the last loaded history visible. */ }
  }, [type]);
  useEffect(() => {
    load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") load(); }, 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  return <section className="rounded-2xl border border-ink/5 bg-white p-4 shadow-sm" aria-label="Game history">
    <div className="flex items-baseline justify-between gap-2"><div><p className="game-kicker">Past matches</p><h3 className="text-lg font-bold">Win history</h3></div><span className="text-xs text-ink/50">Latest 50 matches</span></div>
    {history.wins.length > 0 ? <div className="mt-3 grid grid-cols-2 gap-2">
      {history.wins.map(({ player, count }) => <div key={player} className="rounded-xl bg-teal-soft p-3"><p className="truncate text-sm font-semibold">{player}</p><p className="text-xl font-extrabold text-teal-dark">{count} {count === 1 ? "win" : "wins"}</p></div>)}
    </div> : <p className="mt-3 text-sm text-ink/55">No completed matches yet.</p>}
    {history.matches.length > 0 && <ul className="mt-3 divide-y divide-ink/10">
      {history.matches.slice(0, 10).map((match) => <li key={match.matchId} className="flex items-center justify-between gap-3 py-2 text-sm">
        <span className="min-w-0 truncate">{match.winner ? <><strong>{match.winner}</strong> won</> : "Draw"}<span className="text-ink/50"> · {match.players.join(" vs ")}</span></span>
        <time className="shrink-0 text-xs text-ink/50" dateTime={match.createdAt}>{new Intl.DateTimeFormat("en-LK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(match.createdAt))}</time>
      </li>)}
    </ul>}
  </section>;
}
