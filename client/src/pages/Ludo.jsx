import { useCallback, useEffect, useState } from "react";
import { api, session } from "../api.js";
import GameHistory from "../components/GameHistory.jsx";

const TRACK_LENGTH = 28;
const SAFE_SQUARES = new Set([0, 7, 14, 21]);
const COLORS = ["green", "orange"];
const trackCell = (index) => {
  if (index < 8) return { gridRow: 1, gridColumn: index + 1 };
  if (index < 14) return { gridRow: index - 6, gridColumn: 8 };
  if (index < 22) return { gridRow: 8, gridColumn: 22 - index };
  return { gridRow: 29 - index, gridColumn: 1 };
};

export default function Ludo() {
  const [game, setGame] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const me = session.user?.name;
  const refresh = useCallback(async () => {
    try { setGame(await api.ludo()); setError(""); } catch (e) { setError(e.message); }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 2500);
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", visible);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [refresh]);

  async function act(action) {
    setBusy(true); setError("");
    try { setGame(await action()); } catch (e) { setError(e.message); refresh(); }
    finally { setBusy(false); }
  }

  const joined = game?.players?.includes(me);
  const playerIndex = joined ? game.players.indexOf(me) : -1;
  const isTurn = game?.status === "playing" && game.turn === me;
  const legal = (position) => game?.dice && (position === -1 ? game.dice === 6 : position < TRACK_LENGTH && position + game.dice <= TRACK_LENGTH);
  const piecesAt = (square) => (game?.positions || []).flatMap((positions, owner) => positions.map((position, token) => ({ position, token, owner })))
    .filter(({ position, owner }) => position >= 0 && position < TRACK_LENGTH && (position + owner * 14) % TRACK_LENGTH === square);
  const status = !game ? "Loading Ludo…" : game.status === "waiting"
    ? joined ? "Waiting for player 2 to join." : game.players?.length ? `${game.players[0]} is waiting for you.` : "Start a new two-player Ludo match."
    : game.status === "finished" ? `${game.winner} brought every piece home!`
    : isTurn ? game.dice ? `You rolled ${game.dice}. Choose a highlighted piece.` : "Your turn — roll the dice." : `${game.turn}'s turn.`;

  return <div className="space-y-3"><section className="game-panel">
    <div className="game-heading"><div><span className="game-kicker">Roll. Race. Capture.</span><h2 className="text-2xl font-extrabold tracking-tight">Ludo</h2><p className="mt-1 text-sm text-ink/55">Bring all four pieces home before your opponent.</p></div><span className="game-emoji" aria-hidden="true">🎲</span></div>
    <div className="memory-scorebar">
      {[0, 1].map((index) => <div key={index} className={`memory-player ${index === 1 ? "right" : ""} ${game?.turn === game?.players?.[index] && game?.status === "playing" ? "active" : ""}`}><span className={`memory-avatar ludo-${COLORS[index]}`}>{game?.players?.[index]?.slice(0, 1).toUpperCase() || index + 1}</span><span><strong>{game?.players?.[index] || `Player ${index + 1}`}</strong><small>{game?.positions?.[index]?.filter((p) => p === 28).length || 0} / 4 home</small></span></div>)}
    </div>
    <div className="game-status" aria-live="polite"><span className={`game-status-dot ${game?.status === "playing" ? "live" : ""}`} />{status}</div>
    <div className="ludo-board" role="grid" aria-label="Ludo board">
      {Array.from({ length: TRACK_LENGTH }, (_, index) => <div key={index} role="gridcell" style={trackCell(index)} className={`ludo-track ${SAFE_SQUARES.has(index) ? "safe" : ""}`}><small>{SAFE_SQUARES.has(index) ? "★" : ""}</small><div className="ludo-stack">{piecesAt(index).map(({ token, owner, position }) => {
        const canMove = isTurn && owner === playerIndex && legal(position);
        return <button key={`${owner}-${token}`} disabled={busy || !canMove} onClick={() => act(() => api.moveLudo(token))} className={`ludo-piece ludo-${COLORS[owner]} ${canMove ? "can-move" : ""}`} aria-label={`${game.players[owner]} piece ${token + 1}${canMove ? ", move this piece" : ""}`}>{token + 1}</button>;
      })}</div></div>)}
      <div className="ludo-center">
        <div className="ludo-yard ludo-green-soft"><strong>{game?.players?.[0] || "Player 1"}</strong><div>{(game?.positions?.[0] || Array(4).fill(-1)).map((position, token) => position === -1 && <button key={token} disabled={busy || !(isTurn && playerIndex === 0 && legal(position))} onClick={() => act(() => api.moveLudo(token))} className={`ludo-piece ludo-green ${isTurn && playerIndex === 0 && legal(position) ? "can-move" : ""}`}>{token + 1}</button>)}</div></div>
        <div className="ludo-dice-area"><span className={`ludo-die face-${game?.dice || 0}`}>{game?.dice || "–"}</span><button className="btn" disabled={busy || !isTurn || Boolean(game?.dice)} onClick={() => act(api.rollLudo)}>Roll dice</button></div>
        <div className="ludo-yard ludo-orange-soft"><strong>{game?.players?.[1] || "Player 2"}</strong><div>{(game?.positions?.[1] || Array(4).fill(-1)).map((position, token) => position === -1 && <button key={token} disabled={busy || !(isTurn && playerIndex === 1 && legal(position))} onClick={() => act(() => api.moveLudo(token))} className={`ludo-piece ludo-orange ${isTurn && playerIndex === 1 && legal(position) ? "can-move" : ""}`}>{token + 1}</button>)}</div></div>
      </div>
    </div>
    <div className="ludo-home-row"><span className="ludo-green-soft">Green home: {game?.positions?.[0]?.filter((p) => p === 28).length || 0}</span><span className="ludo-orange-soft">Orange home: {game?.positions?.[1]?.filter((p) => p === 28).length || 0}</span></div>
    {error && <p className="game-error" role="alert">{error}</p>}
    <div className="game-footer">
      {game?.status === "waiting" && !joined && <button className="btn game-action" disabled={busy} onClick={() => act(api.joinLudo)}>{game.players?.length ? "Join Ludo" : "Start Ludo"}</button>}
      {game?.status === "waiting" && joined && <span className="game-you-play">You’re in — the other player can join now.</span>}
      {game?.status === "playing" && joined && <span className="game-you-play">Roll a 6 to leave the yard. Safe stars cannot be captured.</span>}
      {game?.status === "finished" && joined && <button className="btn game-action" disabled={busy} onClick={() => act(api.rematchLudo)}>Play again</button>}
    </div>
  </section><GameHistory type="ludo" /></div>;
}
