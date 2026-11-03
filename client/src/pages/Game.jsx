import { useCallback, useEffect, useRef, useState } from "react";
import { api, session } from "../api.js";

const lineIndex = (row, col) => row % 2 === 0
  ? (row / 2) * 3 + Math.floor(col / 2)
  : 12 + Math.floor(row / 2) * 4 + Math.floor(col / 2);

export default function Game() {
  const [game, setGame] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [celebration, setCelebration] = useState(false);
  const previousStatus = useRef(null);
  const me = session.user?.name;
  const refresh = useCallback(async () => {
    try {
      const next = await api.game();
      if (previousStatus.current === "playing" && next.status === "finished" && next.winner === me) setCelebration(true);
      previousStatus.current = next.status;
      setGame(next); setError("");
    } catch (e) { setError(e.message); }
  }, [me]);

  useEffect(() => {
    previousStatus.current = null;
    refresh();
    const timer = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 3000);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [refresh]);

  async function act(action) {
    setBusy(true); setError("");
    try {
      const next = await action();
      if (previousStatus.current === "playing" && next.status === "finished" && next.winner === me) setCelebration(true);
      previousStatus.current = next.status; setGame(next);
    } catch (e) { setError(e.message); refresh(); }
    finally { setBusy(false); }
  }

  const joined = game?.players?.includes(me);
  const playerIndex = joined ? game.players.indexOf(me) : -1;
  const isTurn = game?.status === "playing" && game.turn === me;
  const score = game?.scores || [0, 0];
  const message = !game ? "Loading the game…" : game.status === "waiting"
    ? joined ? "Waiting for the other player to join…" : game.players[0] ? `${game.players[0]} is waiting for you.` : "Start a game and challenge your person."
    : game.status === "playing" ? isTurn ? "Your turn — draw a line. Complete a box to go again!" : `${game.turn} is drawing a line…`
    : game.winner ? game.winner === me ? "You own this board! Brilliant strategy!" : `${game.winner} wins this round!` : "It's a draw — every box is claimed!";

  function edgeButton(edgeType, index, gridRow, gridCol) {
    const owner = game?.board?.[index] || "";
    const validTurn = joined && isTurn && !owner;
    return <button key={`${edgeType}-${index}`} className={`dots-edge ${edgeType === "h" ? "horizontal" : "vertical"} ${owner ? "drawn" : ""} ${validTurn ? "can-draw" : ""} ${owner ? game.players.indexOf(owner) === 0 ? "first-player" : "second-player" : ""}`} style={{ gridRow: gridRow + 1, gridColumn: gridCol + 1 }} aria-label={`${edgeType === "h" ? "Horizontal" : "Vertical"} line ${index + 1}${owner ? ` drawn by ${owner}` : ""}`} disabled={busy || !validTurn} onClick={() => act(() => api.gameMove({ edgeType, edge: index }))} />;
  }

  return <section className="game-panel">
    <div className="game-heading"><div><span className="game-kicker">Think ahead. Steal a square.</span><h2 className="text-2xl font-extrabold tracking-tight">Dots &amp; Boxes</h2><p className="mt-1 text-sm text-ink/55">Take turns drawing lines. Claim the most boxes to win.</p></div><span className="game-emoji" aria-hidden="true">▦</span></div>
    <div className="dots-scorebar">
      <div className={`dots-player ${game?.turn === game?.players?.[0] && game?.status === "playing" ? "active" : ""}`}><span className="player-swatch first-player" /><span><strong>{game?.players?.[0] || "Player 1"}</strong><small>Player 1</small></span><b>{score[0]}</b></div>
      <span className="game-vs">VS</span>
      <div className={`dots-player right ${game?.turn === game?.players?.[1] && game?.status === "playing" ? "active" : ""}`}><b>{score[1]}</b><span><strong>{game?.players?.[1] || "Player 2"}</strong><small>{game?.players?.[1] ? "Player 2" : "Waiting to join"}</small></span><span className="player-swatch second-player" /></div>
    </div>
    <div className="game-status" aria-live="polite"><span className={`game-status-dot ${game?.status === "playing" ? "live" : ""}`} />{message}</div>
    <div className="dots-grid" role="grid" aria-label="Dots and Boxes game board">
      {Array.from({ length: 7 }, (_, row) => Array.from({ length: 7 }, (_, col) => {
        if (row % 2 === 0 && col % 2 === 0) return <span key={`${row}-${col}`} className="dots-point" style={{ gridRow: row + 1, gridColumn: col + 1 }} />;
        if (row % 2 !== col % 2) {
          const box = Math.floor(row / 2) * 3 + Math.floor(col / 2);
          const owner = game?.boxes?.[box] || "";
          return <span key={`${row}-${col}`} className={`dots-box ${owner ? game.players.indexOf(owner) === 0 ? "first-fill" : "second-fill" : ""}`} style={{ gridRow: row + 1, gridColumn: col + 1 }}>{owner ? owner.slice(0, 1).toUpperCase() : ""}</span>;
        }
        const edgeType = row % 2 === 0 ? "h" : "v";
        return edgeButton(edgeType, lineIndex(row, col), row, col);
      }))}
    </div>
    {error && <p className="game-error" role="alert">{error}</p>}
    <div className="game-footer">
      {game?.status === "waiting" && !joined && <button className="btn game-action" disabled={busy || Boolean(game.players?.length && game.players.length >= 2)} onClick={() => act(api.joinGame)}>{game.players?.length ? "Join the challenge" : "Start a game"}</button>}
      {game?.status === "finished" && joined && <button className="btn game-action" disabled={busy} onClick={() => act(api.gameRematch)}>Play again</button>}
      {game?.status === "playing" && joined && <span className="game-you-play">Your colour <span className={`player-swatch inline-swatch ${playerIndex === 0 ? "first-player" : "second-player"}`} /></span>}
      {game?.status === "waiting" && joined && <span className="game-you-play">Waiting for player 2 to join.</span>}
      {game?.status === "finished" && !joined && <span className="game-you-play">A new round is ready to start.</span>}
    </div>
    {celebration && <div className="win-celebration" role="dialog" aria-modal="true" aria-label="Winner celebration"><div className="win-confetti" aria-hidden="true">🎉 ✨ 🎊 ✨ 🎉</div><div className="win-trophy" aria-hidden="true">🏆</div><p className="game-kicker">What a champion!</p><h3>{game?.winner} wins!</h3><p>You played brilliantly. Ready for a rematch?</p><button className="btn game-action" onClick={() => setCelebration(false)}>Let’s go!</button><button className="celebration-close" onClick={() => setCelebration(false)} aria-label="Close celebration">×</button></div>}
  </section>;
}
