import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { Task, Expense, ChatMessage, ChatPresence, GameRoom } from "./models.js";

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL?.split(",") || true }));
app.use(express.json());

// Reuse the DB connection between serverless calls on Vercel
let conn;
app.use(async (_req, res, next) => {
  try { conn ||= mongoose.connect(process.env.MONGODB_URI); await conn; next(); }
  catch { conn = null; res.status(500).json({ error: "Database connection failed" }); }
});

const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => res.status(400).json({ error: e.message }));

function auth(req, res, next) {
  try { req.user = jwt.verify((req.headers.authorization || "").replace("Bearer ", ""), process.env.JWT_SECRET); next(); }
  catch { res.status(401).json({ error: "Please log in again" }); }
}

app.get("/api/health", (_q, r) => r.json({ ok: true }));

// Credentials come from .env (APP_USER / APP_PASS and APP_USER2 / APP_PASS2)
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  const valid = (username === process.env.APP_USER && password === process.env.APP_PASS)
    || (username === process.env.APP_USER2 && password === process.env.APP_PASS2);
  if (!valid)
    return res.status(400).json({ error: "Wrong username or password" });
  res.json({ token: jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: "365d" }), user: { name: username } });
});

app.get("/api/chat", auth, wrap(async (_req, res) => {
  res.json(await ChatMessage.find().sort({ createdAt: 1 }).limit(300));
}));
app.post("/api/chat", auth, wrap(async (req, res) => {
  const text = String(req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "Message cannot be empty" });
  res.status(201).json(await ChatMessage.create({ sender: req.user.username, text }));
}));
app.put("/api/chat/typing", auth, wrap(async (req, res) => {
  await ChatPresence.findOneAndUpdate({ username: req.user.username },
    { typingUntil: req.body?.typing ? new Date(Date.now() + 4000) : null }, { upsert: true, new: true });
  res.json({ ok: true });
}));
app.get("/api/chat/typing", auth, wrap(async (req, res) => {
  const rows = await ChatPresence.find({ username: { $ne: req.user.username }, typingUntil: { $gt: new Date() } });
  res.json(rows.map((row) => row.username));
}));

const winningLines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const gameKinds = ["tictactoe", "connect4", "rps", "highcard"];
const validKind = (kind) => gameKinds.includes(kind);
const getRoom = async (kind) => {
  const game = await GameRoom.findOneAndUpdate({ room: kind }, { $setOnInsert: { room: kind } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  if (kind === "connect4" && game.board.length !== 42) { game.board = Array(42).fill(""); await game.save(); }
  return game;
};
const rpsWinner = (a, b) => a === b ? "" : ((a === "rock" && b === "scissors") || (a === "paper" && b === "rock") || (a === "scissors" && b === "paper") ? "first" : "second");

app.get("/api/games/:kind", auth, wrap(async (req, res) => {
  if (!validKind(req.params.kind)) return res.status(404).json({ error: "Game not found." });
  res.json(await getRoom(req.params.kind));
}));
app.post("/api/games/:kind/join", auth, wrap(async (req, res) => {
  if (!validKind(req.params.kind)) return res.status(404).json({ error: "Game not found." });
  const game = await getRoom(req.params.kind);
  if (game.status === "finished") return res.status(409).json({ error: "This round is over. Start a rematch first." });
  if (!game.players.includes(req.user.username)) {
    if (game.players.length >= 2) return res.status(409).json({ error: "This game already has two players." });
    game.players.push(req.user.username);
    if (game.players.length === 2) { game.status = "playing"; game.turn = game.players[0]; }
    await game.save();
  }
  res.json(game);
}));
app.post("/api/games/:kind/move", auth, wrap(async (req, res) => {
  const { kind } = req.params;
  if (!validKind(kind)) return res.status(404).json({ error: "Game not found." });
  const game = await getRoom(kind);
  if (game.status !== "playing") return res.status(409).json({ error: "The game is not ready for a move." });
  const playerIndex = game.players.indexOf(req.user.username);
  if (playerIndex < 0) return res.status(403).json({ error: "Join the game before playing." });
  if (kind === "rps" || kind === "highcard") {
    const choice = String(req.body?.choice || "");
    if (kind === "rps" && !["rock", "paper", "scissors"].includes(choice)) return res.status(400).json({ error: "Choose rock, paper, or scissors." });
    if (kind === "highcard" && (!Number.isInteger(Number(choice)) || Number(choice) < 1 || Number(choice) > 13)) return res.status(400).json({ error: "Pick a card from 1 to 13." });
    if (game.choices[playerIndex]) return res.status(409).json({ error: "Your choice is locked in. Waiting for the other player." });
    game.choices[playerIndex] = choice;
    if (game.choices.every(Boolean)) {
      const result = kind === "rps" ? rpsWinner(game.choices[0], game.choices[1]) : Number(game.choices[0]) === Number(game.choices[1]) ? "" : Number(game.choices[0]) > Number(game.choices[1]) ? "first" : "second";
      if (result) { const scoreIndex = result === "first" ? 0 : 1; game.winner = game.players[scoreIndex]; game.scores[scoreIndex] += 1; }
      game.status = "finished";
    }
    await game.save(); res.json(game); return;
  }
  if (kind === "tictactoe") {
    const index = Number(req.body?.index);
    if (game.turn !== req.user.username) return res.status(409).json({ error: "Wait for your turn." });
    if (!Number.isInteger(index) || index < 0 || index > 8 || game.board[index]) return res.status(400).json({ error: "That square is not available." });
    game.board[index] = playerIndex === 0 ? "X" : "O";
    if (winningLines.some(([a,b,c]) => game.board[a] && game.board[a] === game.board[b] && game.board[a] === game.board[c])) { game.winner = req.user.username; game.status = "finished"; }
    else if (game.board.every(Boolean)) game.status = "finished";
    else game.turn = game.players[1 - playerIndex];
  } else {
    const col = Number(req.body?.column);
    if (!Number.isInteger(col) || col < 0 || col > 6) return res.status(400).json({ error: "Choose a valid column." });
    let row = 5;
    while (row >= 0 && game.board[row * 7 + col]) row--;
    if (row < 0) return res.status(400).json({ error: "That column is full." });
    const mark = playerIndex === 0 ? "X" : "O";
    game.board[row * 7 + col] = mark;
    let won = false;
    for (const [dr, dc] of [[0,1],[1,0],[1,1],[1,-1]]) {
      let count = 1;
      for (const sign of [-1, 1]) { let rr = row + dr * sign, cc = col + dc * sign; while (rr >= 0 && rr < 6 && cc >= 0 && cc < 7 && game.board[rr * 7 + cc] === mark) { count++; rr += dr * sign; cc += dc * sign; } }
      if (count >= 4) won = true;
    }
    if (won) { game.winner = req.user.username; game.status = "finished"; }
    else if (game.board.every(Boolean)) game.status = "finished";
    else game.turn = game.players[1 - playerIndex];
  }
  await game.save(); res.json(game);
}));
app.post("/api/games/:kind/rematch", auth, wrap(async (req, res) => {
  const { kind } = req.params;
  if (!validKind(kind)) return res.status(404).json({ error: "Game not found." });
  const game = await getRoom(kind);
  if (game.status !== "finished") return res.status(409).json({ error: "Finish the current round before starting a rematch." });
  if (!game.players.includes(req.user.username)) return res.status(403).json({ error: "Only a player can start a rematch." });
  game.board = Array(kind === "connect4" ? 42 : 9).fill(""); game.choices = ["", ""]; game.winner = ""; game.turn = ""; game.status = "waiting"; game.players = [req.user.username];
  await game.save(); res.json(game);
}));

const getGame = () => GameRoom.findOneAndUpdate({ room: "daybook" }, { $setOnInsert: { room: "daybook" } }, { upsert: true, new: true, setDefaultsOnInsert: true });
app.get("/api/game", auth, wrap(async (_req, res) => res.json(await getGame())));
app.post("/api/game/join", auth, wrap(async (req, res) => {
  const game = await getGame();
  if (game.status === "finished") return res.status(409).json({ error: "This round is over. Start a rematch first." });
  if (!game.players.includes(req.user.username)) {
    if (game.players.length >= 2) return res.status(409).json({ error: "This game already has two players." });
    game.players.push(req.user.username);
    if (game.players.length === 2) { game.status = "playing"; game.turn = game.players[0]; }
    await game.save();
  }
  res.json(game);
}));
app.post("/api/game/move", auth, wrap(async (req, res) => {
  const game = await getGame();
  const index = Number(req.body?.index);
  if (game.status !== "playing") return res.status(409).json({ error: "The game is not ready for a move." });
  if (!game.players.includes(req.user.username)) return res.status(403).json({ error: "Join the game before playing." });
  if (game.turn !== req.user.username) return res.status(409).json({ error: "Wait for your turn." });
  if (!Number.isInteger(index) || index < 0 || index > 8 || game.board[index]) return res.status(400).json({ error: "That square is not available." });
  const mark = game.players[0] === req.user.username ? "X" : "O";
  game.board[index] = mark;
  if (winningLines.some(([a,b,c]) => game.board[a] && game.board[a] === game.board[b] && game.board[a] === game.board[c])) {
    game.winner = req.user.username; game.status = "finished";
  } else if (game.board.every(Boolean)) { game.status = "finished"; }
  else game.turn = game.players.find((player) => player !== req.user.username);
  await game.save();
  res.json(game);
}));
app.post("/api/game/rematch", auth, wrap(async (req, res) => {
  const game = await getGame();
  if (game.status !== "finished") return res.status(409).json({ error: "Finish the current round before starting a rematch." });
  if (!game.players.includes(req.user.username)) return res.status(403).json({ error: "Only a player can start a rematch." });
  game.board = Array(9).fill(""); game.winner = ""; game.turn = ""; game.status = "waiting"; game.players = [req.user.username];
  await game.save();
  res.json(game);
}));

function crud(path, Model, fields, listFilter) {
  const pick = (b) => Object.fromEntries(fields.filter((f) => b[f] !== undefined).map((f) => [f, b[f]]));
  app.get(path, auth, wrap(async (req, res) =>
    res.json(await Model.find(listFilter(req.query)).sort({ date: 1, time: 1, createdAt: 1 }))));
  app.post(path, auth, wrap(async (req, res) => res.status(201).json(await Model.create(pick(req.body)))));
  app.patch(`${path}/:id`, auth, wrap(async (req, res) =>
    res.json(await Model.findByIdAndUpdate(req.params.id, pick(req.body), { new: true }))));
  app.delete(`${path}/:id`, auth, wrap(async (req, res) => { await Model.findByIdAndDelete(req.params.id); res.json({ ok: true }); }));
}

crud("/api/tasks", Task, ["title", "date", "time", "done"], (q) => (q.date ? { date: q.date } : {}));
// ?year=YYYY -> that year's expenses; no query -> everything
crud("/api/expenses", Expense, ["title", "amount", "category", "date"],
  (q) => (q.year ? { date: { $regex: `^${q.year}` } } : {}));

export default app;
