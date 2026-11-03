import { useCallback, useEffect, useRef, useState } from "react";
import { api, session } from "../api.js";

const games = [
  { id: "tictactoe", name: "Tic-Tac-Toe", short: "Quick classic", icon: "✳" },
  { id: "connect4", name: "Connect Four", short: "Line up four", icon: "🔴" },
  { id: "rps", name: "Rock Paper Scissors", short: "Secret reveal", icon: "✊" },
  { id: "highcard", name: "High Card", short: "Pick a lucky card", icon: "🃏" },
];
const rps = [{ id: "rock", icon: "✊", name: "Rock" }, { id: "paper", icon: "✋", name: "Paper" }, { id: "scissors", icon: "✌️", name: "Scissors" }];

export default function Game() {
  const [kind, setKind] = useState("tictactoe");
  const [game, setGame] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [celebration, setCelebration] = useState(false);
  const previousStatus = useRef(null);
  const me = session.user?.name;
  const refresh = useCallback(async () => {
    try {
      const next = await api.multiplayerGame(kind);
      if (previousStatus.current === "playing" && next.status === "finished" && next.winner === me) setCelebration(true);
      previousStatus.current = next.status;
      setGame(next); setError("");
    } catch (e) { setError(e.message); }
  }, [kind, me]);
  useEffect(() => {
    previousStatus.current = null; setGame(null); setCelebration(false); refresh();
    const timer = setInterval(refresh, 1200);
    return () => clearInterval(timer);
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
  const myMark = playerIndex === 0 ? "X" : "O";
  const title = games.find((item) => item.id === kind)?.name;
  const statusText = !game ? "Loading your game…" : game.status === "waiting"
    ? joined ? "Waiting for the other player to join…" : `${game.players[0] || "A player"} is waiting for you.`
    : game.status === "playing"
      ? ["rps", "highcard"].includes(kind) ? game.choices[playerIndex] ? "Choice locked in! Waiting for the reveal…" : kind === "rps" ? "Pick your move — keep it secret!" : "Pick a card and see who draws higher!" : game.turn === me ? "Your turn — make your move!" : `${game.turn} is thinking…`
      : game.winner ? game.winner === me ? "You win! What a move!" : `${game.winner} wins this round!` : kind === "rps" ? "It's a draw — same move!" : kind === "highcard" ? "Same card! It's a draw." : "It's a draw! Good game.";
  const canMove = joined && game?.status === "playing" && (["rps", "highcard"].includes(kind) ? !game.choices[playerIndex] : game.turn === me);

  return <section className="game-panel">
    <div className="game-heading"><div><span className="game-kicker">Pick a game, challenge your person</span><h2 className="text-2xl font-extrabold tracking-tight">Game night</h2><p className="mt-1 text-sm text-ink/55">Four head-to-head games. Two players required.</p></div><span className="game-emoji" aria-hidden="true">🎮</span></div>
    <div className="game-picker" aria-label="Choose a game">{games.map((item) => <button key={item.id} className={`game-choice ${kind === item.id ? "selected" : ""}`} onClick={() => setKind(item.id)}><span className="choice-icon">{item.icon}</span><span className="choice-title">{item.name}</span><span className="choice-subtitle">{item.short}</span></button>)}</div>
    <div className="game-match-heading"><div><span className="game-kicker">Now playing</span><h3>{title}</h3></div>{["rps", "highcard"].includes(kind) && <span className="rps-score">{game?.scores?.[0] || 0} — {game?.scores?.[1] || 0}<small>score</small></span>}</div>
    <div className="game-score">
      <div className={`game-player ${game?.turn === game?.players?.[0] && game?.status === "playing" ? "is-turn" : ""}`}><span className="game-mark mark-x">{kind === "connect4" ? "🔴" : "X"}</span><span><strong>{game?.players?.[0] || "Player 1"}</strong><small>Player 1</small></span></div>
      <span className="game-vs">VS</span>
      <div className={`game-player right ${game?.turn === game?.players?.[1] && game?.status === "playing" ? "is-turn" : ""}`}><span className="game-mark mark-o">{kind === "connect4" ? "🟡" : "O"}</span><span><strong>{game?.players?.[1] || "Player 2"}</strong><small>{game?.players?.[1] ? "Player 2" : "Waiting to join"}</small></span></div>
    </div>
    <div className="game-status" aria-live="polite"><span className={`game-status-dot ${game?.status === "playing" ? "live" : ""}`} />{statusText}</div>
    {kind === "tictactoe" && <div className="game-board" role="grid" aria-label="Tic-Tac-Toe board">{(game?.board || Array(9).fill("")).map((mark, index) => <button key={index} role="gridcell" aria-label={`Square ${index + 1}${mark ? `: ${mark}` : ", empty"}`} className={`game-cell ${mark ? `has-${mark.toLowerCase()}` : ""}`} disabled={busy || !canMove || Boolean(mark)} onClick={() => act(() => api.multiplayerMove(kind, { index }))}>{mark || <span className="cell-number">{index + 1}</span>}</button>)}</div>}
    {kind === "connect4" && <div className="connect-board" role="grid" aria-label="Connect Four board">{Array.from({ length: 7 }, (_, col) => <button key={col} className="connect-column" disabled={busy || !canMove || game?.board?.[col]} aria-label={`Drop in column ${col + 1}`} onClick={() => act(() => api.multiplayerMove(kind, { column: col }))}><span className="drop-arrow">▼</span>{Array.from({ length: 6 }, (_, row) => { const mark = game?.board?.[row * 7 + col] || ""; return <span key={row} className={`connect-hole ${mark === "X" ? "red" : mark === "O" ? "yellow" : ""}`} />; })}</button>)}</div>}
    {kind === "rps" && <div className="rps-options">{rps.map((move) => <button key={move.id} className="rps-move" disabled={busy || !canMove} onClick={() => act(() => api.multiplayerMove(kind, { choice: move.id }))}><span>{move.icon}</span><b>{move.name}</b></button>)}{game?.status === "finished" && <div className="rps-reveal">{game.choices?.map((choice, i) => <span key={i}>{game.players?.[i]} chose <b>{rps.find((move) => move.id === choice)?.icon || "?"} {choice}</b></span>)}</div>}</div>}
    {kind === "highcard" && <div className="card-picks"><p>Choose a card. Higher number wins!</p><div>{Array.from({ length: 13 }, (_, i) => i + 1).map((number) => <button key={number} className={`playing-card ${game?.status === "finished" && Number(game.choices?.[playerIndex]) === number ? "picked" : ""}`} disabled={busy || !canMove} onClick={() => act(() => api.multiplayerMove(kind, { choice: String(number) }))}>{number}</button>)}</div>{game?.status === "finished" && <div className="rps-reveal">{game.choices?.map((choice, i) => <span key={i}>{game.players?.[i]} drew <b>{choice}</b></span>)}</div>}</div>}
    {error && <p className="game-error" role="alert">{error}</p>}
    <div className="game-footer">{game?.status === "waiting" && !joined && <button className="btn game-action" disabled={busy} onClick={() => act(() => api.joinMultiplayerGame(kind))}>Join {title}</button>}{game?.status === "finished" && joined && <button className="btn game-action" disabled={busy} onClick={() => act(() => api.multiplayerRematch(kind))}>Play again</button>}{game?.status === "playing" && joined && <span className="game-you-play">Playing as <b className={myMark === "X" ? "mark-x" : "mark-o"}>{kind === "connect4" ? myMark === "X" ? "🔴" : "🟡" : myMark}</b></span>}{game?.status === "waiting" && joined && <span className="game-you-play">You’re in — player 2 can join now.</span>}{game?.status === "finished" && !joined && <span className="game-you-play">A new round is ready to start.</span>}</div>
    {celebration && <div className="win-celebration" role="dialog" aria-modal="true" aria-label="Winner celebration"><div className="win-confetti" aria-hidden="true">🎉 ✨ 🎊 ✨ 🎉</div><div className="win-trophy" aria-hidden="true">🏆</div><p className="game-kicker">What a champion!</p><h3>{game?.winner} wins!</h3><p>You played brilliantly. Ready for a rematch?</p><button className="btn game-action" onClick={() => setCelebration(false)}>Let’s go!</button><button className="celebration-close" onClick={() => setCelebration(false)} aria-label="Close celebration">×</button></div>}
  </section>;
}
