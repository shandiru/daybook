import { useCallback, useEffect, useRef, useState } from "react";
import { api, session } from "../api.js";
import GameHistory from "../components/GameHistory.jsx";

export default function ConnectFour() {
  const [game, setGame] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const interaction = useRef(false);
  const me = session.user?.name;
  const refresh = useCallback(async () => {
    if (interaction.current) return;
    try { setGame(await api.connectFour()); setError(""); } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => {
    refresh();
    const timer = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 2500);
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", visible);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [refresh]);
  async function act(action) {
    interaction.current = true;
    setBusy(true); setError("");
    try { setGame(await action()); } catch (e) { setError(e.message); try { setGame(await api.connectFour()); } catch { /* Keep the last board visible. */ } }
    finally { interaction.current = false; setBusy(false); }
  }
  const joined = game?.players?.includes(me);
  const isTurn = game?.status === "playing" && game.turn === me;
  const playerIndex = joined ? game.players.indexOf(me) : -1;
  const status = !game ? "Loading Connect Four…" : game.status === "waiting"
    ? joined ? "Waiting for Player 2 to join" : game.players?.[0] ? `${game.players[0]} is waiting for you` : "Start a new two-player match"
    : game.status === "finished" ? game.winner ? `${game.winner} wins!` : "It's a draw!"
    : isTurn ? "Your turn — choose a column" : `${game.turn}'s turn`;

  return <div className="space-y-3"><section className="game-panel">
    <div className="game-heading"><div><span className="game-kicker">Drop four in a row · Two players</span><h2 className="text-2xl font-extrabold tracking-tight">Connect Four</h2><p className="mt-1 text-sm text-ink/55">Drop a disc into a column. Connect four to win.</p></div><span className="game-emoji" aria-hidden="true">🔴</span></div>
    <div className="memory-scorebar"><div className={`memory-player ${game?.turn === game?.players?.[0] && game?.status === "playing" ? "active" : ""}`}><span className="memory-avatar first-player">R</span><span><strong>{game?.players?.[0] || "Player 1"}</strong><small>Player 1 · Red</small></span></div><span className="game-vs">VS</span><div className={`memory-player right ${game?.turn === game?.players?.[1] && game?.status === "playing" ? "active" : ""}`}><span><strong>{game?.players?.[1] || "Player 2"}</strong><small>Player 2 · Yellow</small></span><span className="memory-avatar second-player">Y</span></div></div>
    <div className="game-status" aria-live="polite"><span className={`game-status-dot ${game?.status === "playing" ? "live" : ""}`} />{status}</div>
    <div className="connect-four-board" role="grid" aria-label="Connect Four board">{Array.from({ length: 7 }, (_, column) => <button type="button" className="connect-four-column" key={column} role="row" aria-label={`Drop into column ${column + 1}`} disabled={busy || !isTurn || game?.board?.[column]} onClick={() => act(() => api.dropConnectFour(column))}>{Array.from({ length: 6 }, (_, row) => { const mark = game?.board?.[row * 7 + column] || ""; return <span key={row} role="gridcell" aria-label={`Row ${row + 1}, column ${column + 1}${mark ? `: ${mark === "R" ? "red" : "yellow"}` : ", empty"}`} className={`connect-four-slot ${mark ? `disc-${mark.toLowerCase()}` : ""}`} />; })}</button>)}</div>
    {error && <p className="game-error" role="alert">{error}</p>}
    <div className="game-footer">
      {game?.status === "waiting" && !joined && <button className="btn game-action" disabled={busy} onClick={() => act(api.joinConnectFour)}>{game.players?.length ? "Join Connect Four" : "Start Connect Four"}</button>}
      {game?.status === "waiting" && joined && <span className="game-you-play">You’re in — Player 2 can join now.</span>}
      {game?.status === "finished" && joined && <button className="btn game-action" disabled={busy} onClick={() => act(api.rematchConnectFour)}>Play again</button>}
      {game?.status === "playing" && joined && <span className="game-you-play">You are {playerIndex === 0 ? "Red" : "Yellow"} · {isTurn ? "Your turn" : "Wait for your turn"}</span>}
    </div>
  </section><GameHistory type="connect-four" /></div>;
}
