import { useCallback, useEffect, useState } from "react";
import { api, session } from "../api.js";

export default function Game() {
  const [game, setGame] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const me = session.user?.name;
  const refresh = useCallback(async () => {
    try { setGame(await api.game()); setError(""); }
    catch (e) { setError(e.message); }
  }, []);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 1200);
    return () => clearInterval(timer);
  }, [refresh]);

  async function act(action) {
    setBusy(true); setError("");
    try { setGame(await action()); }
    catch (e) { setError(e.message); refresh(); }
    finally { setBusy(false); }
  }
  const joined = game?.players?.includes(me);
  const myMark = joined ? (game.players[0] === me ? "X" : "O") : "";
  let message = "Loading your game…";
  if (game) {
    if (game.status === "waiting") message = joined ? "Waiting for the other player to join…" : `${game.players[0] || "A player"} is waiting for you to join.`;
    else if (game.status === "playing") message = game.turn === me ? "Your turn — make your move!" : `${game.turn} is thinking…`;
    else if (game.winner) message = game.winner === me ? "You win! Nicely played 🎉" : `${game.winner} wins this round!`;
    else message = "It’s a draw! Good game.";
  }

  return <section className="game-panel">
    <div className="game-heading"><div><span className="game-kicker">A little friendly rivalry</span><h2 className="text-2xl font-extrabold tracking-tight">Tic-Tac-Toe</h2><p className="mt-1 text-sm text-ink/55">Two players. One shared board. Take turns.</p></div><span className="game-emoji" aria-hidden="true">✳</span></div>
    <div className="game-score">
      <div className={`game-player ${game?.turn === game?.players?.[0] && game?.status === "playing" ? "is-turn" : ""}`}><span className="game-mark mark-x">X</span><span><strong>{game?.players?.[0] || "Player 1"}</strong><small>Player 1</small></span></div>
      <span className="game-vs">VS</span>
      <div className={`game-player right ${game?.turn === game?.players?.[1] && game?.status === "playing" ? "is-turn" : ""}`}><span className="game-mark mark-o">O</span><span><strong>{game?.players?.[1] || "Player 2"}</strong><small>{game?.players?.[1] ? "Player 2" : "Waiting to join"}</small></span></div>
    </div>
    <div className="game-status" aria-live="polite"><span className={`game-status-dot ${game?.status === "playing" ? "live" : ""}`} />{message}</div>
    <div className="game-board" role="grid" aria-label="Tic-Tac-Toe board">
      {(game?.board || Array(9).fill("")).map((mark, index) => <button key={index} role="gridcell" aria-label={`Square ${index + 1}${mark ? `: ${mark}` : ", empty"}`} className={`game-cell ${mark ? `has-${mark.toLowerCase()}` : ""}`} disabled={busy || !joined || game?.status !== "playing" || game.turn !== me || Boolean(mark)} onClick={() => act(() => api.gameMove(index))}>{mark || <span className="cell-number">{index + 1}</span>}</button>)}
    </div>
    {error && <p className="game-error" role="alert">{error}</p>}
    <div className="game-footer">
      {game?.status === "waiting" && !joined && <button className="btn game-action" disabled={busy} onClick={() => act(api.joinGame)}>{busy ? "Joining…" : "Join the game"}</button>}
      {game?.status === "finished" && joined && <button className="btn game-action" disabled={busy} onClick={() => act(api.gameRematch)}>{busy ? "Starting…" : "Play again"}</button>}
      {game?.status === "playing" && joined && <span className="game-you-play">You’re playing as <b className={myMark === "X" ? "mark-x" : "mark-o"}>{myMark}</b></span>}
      {game?.status === "waiting" && joined && <span className="game-you-play">You’re in — share the app with player 2.</span>}
      {game?.status === "finished" && !joined && <span className="game-you-play">A new round is ready to start.</span>}
    </div>
  </section>;
}
