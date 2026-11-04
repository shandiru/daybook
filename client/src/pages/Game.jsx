import { useCallback, useEffect, useRef, useState } from "react";
import { api, session } from "../api.js";
import TicTacToe from "./TicTacToe.jsx";
import GameHistory from "../components/GameHistory.jsx";
import Chat from "./Chat.jsx";

export default function Game() {
  const [game, setGame] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [celebration, setCelebration] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState("memory");
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

  useEffect(() => {
    if (game?.status !== "playing" || game.flipped?.length !== 2) return undefined;
    const timer = setTimeout(async () => {
      try {
        const next = await api.resolveMemoryTurn();
        if (previousStatus.current === "playing" && next.status === "finished" && next.winner === me) setCelebration(true);
        previousStatus.current = next.status; setGame(next);
      } catch (e) { setError(e.message); }
    }, 950);
    return () => clearTimeout(timer);
  }, [game, me]);

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
  const scores = game?.scores || [0, 0];
  const message = !game ? "Loading the game…" : game.status === "waiting"
    ? joined ? "Waiting for the other player to join..." : game.players?.[0] ? `${game.players[0]} is waiting for you.` : "Find the pairs before your opponent does!"
    : game.status === "finished" ? game.winner ? game.winner === me ? "You found more pairs! Amazing memory!" : `${game.winner} wins this memory match!` : "It's a draw â€” you found the same number of pairs!"
    : game.flipped?.length === 2 ? game.matchPending ? "A match! Nice one!" : "No match â€” remember those cards!" : isTurn ? "Your turn â€” flip two cards." : `${game.turn} is remembering the cards...`;

  return <div className="space-y-3">
    <div className="grid grid-cols-2 rounded-xl bg-ink/10 p-1">
      {[ ["memory", "Memory Match"], ["tic", "Tic Tac Toe"] ].map(([key, label]) => <button key={key} className={`rounded-lg py-3 text-sm font-semibold ${selectedGame === key ? "bg-white shadow-sm" : "text-ink/60"}`} onClick={() => setSelectedGame(key)}>{label}</button>)}
    </div>
    {selectedGame === "tic" ? <TicTacToe /> : <><section className="game-panel">
    <div className="game-heading"><div><span className="game-kicker">Flip. Remember. Match.</span><h2 className="text-2xl font-extrabold tracking-tight">Fruit & Animal Match</h2><p className="mt-1 text-sm text-ink/55">Find pairs to score. Match a pair and go again!</p></div><span className="game-emoji" aria-hidden="true">🍎</span></div>
    <div className="memory-scorebar">
      <div className={`memory-player ${game?.turn === game?.players?.[0] && game?.status === "playing" ? "active" : ""}`}><span className="memory-avatar first-player">{game?.players?.[0]?.slice(0, 1).toUpperCase() || "1"}</span><span><strong>{game?.players?.[0] || "Player 1"}</strong><small>Player 1</small></span><b>{scores[0]}</b></div>
      <span className="game-vs">VS</span>
      <div className={`memory-player right ${game?.turn === game?.players?.[1] && game?.status === "playing" ? "active" : ""}`}><b>{scores[1]}</b><span><strong>{game?.players?.[1] || "Player 2"}</strong><small>{game?.players?.[1] ? "Player 2" : "Waiting"}</small></span><span className="memory-avatar second-player">{game?.players?.[1]?.slice(0, 1).toUpperCase() || "2"}</span></div>
    </div>
    <div className="game-status" aria-live="polite"><span className={`game-status-dot ${game?.status === "playing" ? "live" : ""}`} />{message}</div>
    <div className="memory-board" role="grid" aria-label="Memory match cards">
      {(game?.board?.length === 24 ? game.board : Array(24).fill("")).map((face, index) => {
        const open = Boolean(face);
        const matched = game?.matched?.includes(index);
        return <button key={index} role="gridcell" aria-label={open ? `Card ${index + 1}: ${face}${matched ? ", matched" : ""}` : `Card ${index + 1}, face down`} className={`memory-card ${open ? "is-open" : ""} ${matched ? "is-matched" : ""}`} disabled={busy || !isTurn || open || game?.flipped?.length === 2} onClick={() => act(() => api.flipMemoryCard(index))}>{open ? face : <span aria-hidden="true">?</span>}</button>;
      })}
    </div>
    {error && <p className="game-error" role="alert">{error}</p>}
    <div className="game-footer">
      {game?.status === "waiting" && !joined && <button className="btn game-action" disabled={busy} onClick={() => act(api.joinGame)}>{game.players?.length ? "Join the challenge" : "Start a game"}</button>}
      {game?.status === "waiting" && joined && <span className="game-you-play">Youâ€™re in â€” player 2 can join now.</span>}
      {game?.status === "playing" && joined && <span className="game-you-play">{isTurn ? "Your turn" : "Your opponent's turn"} - collect matching pairs</span>}
      {game?.status === "finished" && joined && <button className="btn game-action" disabled={busy} onClick={() => act(api.gameRematch)}>Play again</button>}
      {game?.status === "finished" && !joined && <span className="game-you-play">Ask a player to start another round.</span>}
    </div>
    {celebration && <div className="win-celebration" role="dialog" aria-modal="true" aria-label="Winner celebration"><p className="game-kicker">What a champion!</p><h3>{game?.winner} wins!</h3><p>Your memory is unmatched!</p><button className="btn game-action" onClick={() => setCelebration(false)}>Play again</button><button className="celebration-close" onClick={() => setCelebration(false)} aria-label="Close celebration">x</button></div>}
  </section><div className="game-chat-dock">{chatOpen && <div className="game-chat-popover"><button className="game-chat-close" onClick={() => setChatOpen(false)} aria-label="Close chat">×</button><Chat compact /></div>}<button className="game-chat-toggle" onClick={() => setChatOpen((open) => !open)} aria-expanded={chatOpen}>💬 Chat</button></div><GameHistory type="memory" /></>}
  </div>;
}
