import { useCallback, useEffect, useState } from "react";
import { api, session } from "../api.js";

export default function TicTacToe() {
  const [game, setGame] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const me = session.user?.name;
  const refresh = useCallback(async () => {
    try { setGame(await api.ticTacToe()); setError(""); }
    catch (e) { setError(e.message); }
  }, []);
  useEffect(() => {
    refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 3000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  async function act(action) {
    setBusy(true); setError("");
    try { setGame(await action()); } catch (e) { setError(e.message); refresh(); }
    finally { setBusy(false); }
  }
  const joined = game?.players?.includes(me);
  const message = !game ? "Loading the game..." : game.status === "waiting"
    ? joined ? "Waiting for the other player to join..." : game.players?.length ? `${game.players[0]} is waiting for you.` : "Join and challenge the other player."
    : game.status === "finished" ? game.winner ? `${game.winner} wins the round.` : "The board is full. The game is a draw."
    : game.turn === me ? "Your turn. Choose an empty square." : `${game.turn} is choosing a square.`;
  return <section className="game-panel">
    <div className="game-heading"><div><span className="game-kicker">Plan your next move</span><h2 className="text-2xl font-extrabold tracking-tight">Tic Tac Toe</h2><p className="mt-1 text-sm text-ink/55">A quick strategy match for two players.</p></div><span className="game-emoji" aria-hidden="true">X / O</span></div>
    <div className="memory-scorebar">
      <div className="memory-player"><span className="memory-avatar first-player">X</span><span><strong>{game?.players?.[0] || "Player 1"}</strong><small>Player 1</small></span></div>
      <span className="game-vs">VS</span>
      <div className="memory-player right"><span><strong>{game?.players?.[1] || "Player 2"}</strong><small>{game?.players?.[1] ? "Player 2" : "Waiting"}</small></span><span className="memory-avatar second-player">O</span></div>
    </div>
    <div className="game-status" aria-live="polite"><span className={`game-status-dot ${game?.status === "playing" ? "live" : ""}`} />{message}</div>
    <div className="tic-board" role="grid" aria-label="Tic Tac Toe board">
      {(game?.board || Array(9).fill("")).map((cell, index) => <button key={index} role="gridcell" aria-label={`Square ${index + 1}${cell ? `: ${cell}` : ": empty"}`} className="tic-cell" disabled={busy || game?.status !== "playing" || game.turn !== me || Boolean(cell)} onClick={() => act(() => api.moveTicTacToe(index))}>{cell}</button>)}
    </div>
    {error && <p className="game-error" role="alert">{error}</p>}
    <div className="game-footer">
      {game?.status === "waiting" && !joined && <button className="btn game-action" disabled={busy} onClick={() => act(api.joinTicTacToe)}>{game.players?.length ? "Join the challenge" : "Start a game"}</button>}
      {game?.status === "waiting" && joined && <span className="game-you-play">You’re in. The other player can join now.</span>}
      {game?.status === "playing" && joined && <span className="game-you-play">{game.turn === me ? "Your turn" : "Opponent's turn"}</span>}
      {game?.status === "finished" && joined && <button className="btn game-action" disabled={busy} onClick={() => act(api.rematchTicTacToe)}>Play again</button>}
      {game?.status === "finished" && !joined && <span className="game-you-play">A player can start another round.</span>}
    </div>
  </section>;
}
