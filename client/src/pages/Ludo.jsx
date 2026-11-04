import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, session } from "../api.js";
import GameHistory from "../components/GameHistory.jsx";

const TRACK_LENGTH = 52;
const HOME_END = 57;
const PLAYER_COLORS = ["green", "yellow"];
const PLAYER_OFFSETS = [0, 26];
const SAFE_SQUARES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

const TRACK = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [7, 14],
  [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], [7, 0], [6, 0],
];

const HOME_LANES = [
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
];

const keyFor = ([row, column]) => `${row}-${column}`;

function Dice({ value, rolling }) {
  return <span className={`ludo-die ${rolling ? "is-rolling" : ""}`} aria-hidden="true">
    {value ? Array.from({ length: 9 }, (_, index) => <i key={index} className={`pip pip-${value}-${index}`} />) : <b>?</b>}
  </span>;
}

function Token({ owner, token, canMove, busy, onMove }) {
  const color = PLAYER_COLORS[owner];
  return <button type="button" disabled={busy || !canMove} onClick={() => onMove(token)} className={`ludo-piece ludo-${color} ${canMove ? "can-move" : ""}`} aria-label={`Player ${owner + 1} piece ${token + 1}${canMove ? ", move this piece" : ""}`}><span /></button>;
}

export default function Ludo() {
  const [game, setGame] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [rollingFace, setRollingFace] = useState(1);
  const previousTurn = useRef("");
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

  useEffect(() => {
    if (previousTurn.current && previousTurn.current !== game?.turn && game?.turn === me && navigator.vibrate) navigator.vibrate(80);
    previousTurn.current = game?.turn || "";
  }, [game?.turn, me]);

  async function act(action) {
    setBusy(true); setError("");
    try { setGame(await action()); } catch (e) { setError(e.message); await refresh(); }
    finally { setBusy(false); }
  }

  async function rollDice() {
    setRolling(true);
    const animation = window.setInterval(() => setRollingFace(Math.floor(Math.random() * 6) + 1), 75);
    await new Promise((resolve) => setTimeout(resolve, 525));
    window.clearInterval(animation);
    try { await act(api.rollLudo); }
    finally { setRolling(false); }
  }

  const joined = game?.players?.includes(me);
  const playerIndex = joined ? game.players.indexOf(me) : -1;
  const isTurn = game?.status === "playing" && game.turn === me;
  const legalTokens = new Set(game?.legalMoves || []);
  const fallbackLegal = (position) => Boolean(game?.dice) && (position === -1 ? game.dice === 6 : position < HOME_END && position + game.dice <= HOME_END);
  const canMove = (owner, token, position) => isTurn && owner === playerIndex && (game?.legalMoves ? legalTokens.has(token) : fallbackLegal(position));

  const piecesByCell = useMemo(() => {
    const cells = new Map();
    (game?.positions || []).forEach((positions, owner) => positions.forEach((position, token) => {
      if (position < 0) return;
      const coordinate = position < TRACK_LENGTH ? TRACK[(position + PLAYER_OFFSETS[owner]) % TRACK_LENGTH] : HOME_LANES[owner]?.[position - TRACK_LENGTH];
      if (!coordinate) return;
      const key = keyFor(coordinate);
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push({ owner, token, position });
    }));
    return cells;
  }, [game?.positions]);

  const boardCells = useMemo(() => {
    const cells = new Map();
    TRACK.forEach((coordinate, trackIndex) => cells.set(keyFor(coordinate), { coordinate, trackIndex, type: "track" }));
    HOME_LANES.forEach((lane, owner) => lane.forEach((coordinate) => cells.set(keyFor(coordinate), { coordinate, owner, type: "lane" })));
    return [...cells.values()];
  }, []);

  const status = !game ? "Loading Ludo…" : game.status === "waiting"
    ? joined ? "Waiting for Player 2 to join" : game.players?.length ? `${game.players[0]} is waiting for you` : "Start a new two-player Ludo match"
    : game.status === "finished" ? `${game.winner} is the Ludo champion!`
    : isTurn ? game.dice ? `You rolled ${game.dice} — choose a glowing piece` : "Your turn — roll the dice"
    : `${game.turn}'s turn`;

  return <div className="space-y-3"><section className="game-panel ludo-game-panel">
    <div className="game-heading ludo-heading"><div><span className="game-kicker">Classic board · Two players</span><h2 className="text-2xl font-extrabold tracking-tight">Ludo</h2><p className="mt-1 text-sm text-ink/55">Race all four pieces from your yard to the centre.</p></div><span className="game-emoji" aria-hidden="true">🎲</span></div>
    <div className="ludo-scorebar">
      {[0, 1].map((index) => {
        const color = PLAYER_COLORS[index];
        const active = game?.turn === game?.players?.[index] && game?.status === "playing";
        const home = game?.positions?.[index]?.filter((position) => position === HOME_END).length || 0;
        return <div key={index} className={`ludo-player-card ${active ? "active" : ""} ${color}`}><span className={`memory-avatar ludo-${color}`}>{game?.players?.[index]?.slice(0, 1).toUpperCase() || index + 1}</span><span><strong>{game?.players?.[index] || `Player ${index + 1}`}</strong><small>{home}/4 home</small></span>{active && <i className="turn-flag">TURN</i>}</div>;
      })}
    </div>
    <div className="game-status" aria-live="polite"><span className={`game-status-dot ${game?.status === "playing" ? "live" : ""}`} />{status}</div>
    <div className="ludo-play-area">
      <div className="classic-ludo-board" role="grid" aria-label="Classic Ludo board">
        <div className="ludo-home-base base-green" aria-label="Green yard"><div className="yard-inner">
          {[0, 1, 2, 3].map((token) => { const position = game?.positions?.[0]?.[token] ?? -1; return <span className="yard-spot" key={token}>{position === -1 && <Token owner={0} token={token} canMove={canMove(0, token, position)} busy={busy} onMove={(piece) => act(() => api.moveLudo(piece))} />}</span>; })}
        </div></div>
        <div className="ludo-home-base base-red" aria-hidden="true"><div className="yard-inner decorative-yard"><span /><span /><span /><span /></div></div>
        <div className="ludo-home-base base-blue" aria-hidden="true"><div className="yard-inner decorative-yard"><span /><span /><span /><span /></div></div>
        <div className="ludo-home-base base-yellow" aria-label="Yellow yard"><div className="yard-inner">
          {[0, 1, 2, 3].map((token) => { const position = game?.positions?.[1]?.[token] ?? -1; return <span className="yard-spot" key={token}>{position === -1 && <Token owner={1} token={token} canMove={canMove(1, token, position)} busy={busy} onMove={(piece) => act(() => api.moveLudo(piece))} />}</span>; })}
        </div></div>
        {boardCells.map(({ coordinate, trackIndex, type, owner }) => {
          const key = keyFor(coordinate);
          const pieces = piecesByCell.get(key) || [];
          const safe = type === "track" && SAFE_SQUARES.has(trackIndex);
          const startColor = trackIndex === 0 ? "green" : trackIndex === 13 ? "red" : trackIndex === 26 ? "yellow" : trackIndex === 39 ? "blue" : "";
          return <div key={key} role="gridcell" style={{ gridRow: coordinate[0] + 1, gridColumn: coordinate[1] + 1 }} className={`classic-cell ${type === "lane" ? `home-lane lane-${PLAYER_COLORS[owner]}` : "track-cell"} ${safe ? "safe-cell" : ""} ${startColor ? `start-${startColor}` : ""}`}>
            {safe && <span className="safe-star" aria-hidden="true">★</span>}
            <div className={`ludo-stack ${pieces.length > 1 ? "is-stacked" : ""} ${pieces.length > 4 ? "is-crowded" : ""}`}>{pieces.map(({ owner: pieceOwner, token, position }) => <Token key={`${pieceOwner}-${token}`} owner={pieceOwner} token={token} canMove={canMove(pieceOwner, token, position)} busy={busy} onMove={(piece) => act(() => api.moveLudo(piece))} />)}</div>
          </div>;
        })}
        <div className="ludo-finish" aria-label="Home">
          <span className="finish-label">HOME</span>
          <div className="finish-pieces">{(game?.positions || []).flatMap((positions, owner) => positions.map((position, token) => position === HOME_END ? <Token key={`${owner}-${token}`} owner={owner} token={token} canMove={false} busy onMove={() => {}} /> : null))}</div>
        </div>
      </div>
      <div className="ludo-controls">
        <div className="ludo-dice-copy"><p className="control-label">{isTurn ? game?.dice ? "MOVE A PIECE" : "YOUR TURN" : "LAST ROLL"}</p><strong>{rolling ? "Rolling…" : game?.dice ? `You rolled ${game.dice}` : isTurn ? "Tap the dice" : game?.lastRoll ? `${game.turn}'s turn` : "Waiting to start"}</strong></div>
        <button type="button" className="ludo-dice-button" disabled={busy || rolling || !isTurn || Boolean(game?.dice)} onClick={rollDice} aria-label={rolling ? "Rolling dice" : game?.dice ? `Dice shows ${game.dice}; move a piece` : isTurn ? "Roll dice" : `Dice shows ${game?.lastRoll || 0}`}>
          <Dice value={rolling ? rollingFace : (game?.dice || game?.lastRoll || 0)} rolling={rolling} />
          <span>{rolling ? "ROLLING" : game?.dice ? "CHOOSE TOKEN" : isTurn ? "ROLL" : "WAIT"}</span>
        </button>
        <div className="ludo-rule-tip"><span>★</span><p><strong>Safe square</strong>Your piece cannot be captured here.</p></div>
        <div className="ludo-mini-progress">{[0, 1].map((owner) => <div key={owner}><span className={`dot ${PLAYER_COLORS[owner]}`} /><b>{game?.positions?.[owner]?.filter((position) => position === HOME_END).length || 0}/4</b><small>home</small></div>)}</div>
      </div>
    </div>
    {error && <p className="game-error" role="alert">{error}</p>}
    <div className="game-footer ludo-footer">
      {game?.status === "waiting" && !joined && <button className="btn game-action" disabled={busy} onClick={() => act(api.joinLudo)}>{game.players?.length ? "Join Ludo" : "Start Ludo"}</button>}
      {game?.status === "waiting" && joined && <span className="game-you-play">You’re in — Player 2 can join now.</span>}
      {game?.status === "playing" && joined && <span className="game-you-play"><b>Roll 6</b> to leave the yard · Capture, reach home, or roll 6 to play again · Exact roll to finish</span>}
      {game?.status === "finished" && joined && <button className="btn game-action" disabled={busy} onClick={() => act(api.rematchLudo)}>Play again</button>}
      {game?.status === "finished" && !joined && <span className="game-you-play">The match is over. A player can start the next round.</span>}
    </div>
  </section><GameHistory type="ludo" /></div>;
}
