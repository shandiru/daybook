import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { Task, Expense, ChatMessage, ChatPresence, GameRoom, TicTacToeRoom } from "./models.js";

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL?.split(",") || true }));
app.use(express.json());

// Reuse the DB connection between serverless calls on Vercel
let conn;
app.use(async (req, res, next) => {
  if (req.path === "/api/health" || req.path === "/api/auth/login") return next();
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

const memoryFaces = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
const shuffledMemoryBoard = () => {
  const cards = [...memoryFaces, ...memoryFaces];
  for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  return cards;
};
const emptyMemoryGame = () => ({ room: "memory", players: [], board: Array(24).fill(""), matched: [], flipped: [], flipper: "", matchPending: false, scores: [0, 0], turn: "", winner: "", status: "waiting" });
const getMemoryGame = async () => {
  const game = await GameRoom.findOneAndUpdate(
    { room: "memory" }, { $setOnInsert: { room: "memory" } }, { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  if (game.board.length !== 24) {
    game.players = []; game.board = Array(24).fill(""); game.matched = []; game.flipped = [];
    game.flipper = ""; game.matchPending = false; game.scores = [0, 0]; game.turn = ""; game.winner = ""; game.status = "waiting";
    await game.save();
  }
  return game;
};
const gameView = (game) => {
  const view = game.toObject ? game.toObject() : { ...game };
  const visible = new Set([...(view.flipped || []), ...(view.matched || [])]);
  view.board = (view.board || []).map((face, index) => visible.has(index) ? face : "");
  return view;
};
app.get("/api/game", auth, wrap(async (_req, res) => {
  res.json(gameView(await getMemoryGame()));
}));
app.post("/api/game/join", auth, wrap(async (req, res) => {
  const game = await getMemoryGame();
  if (game.status === "finished") return res.status(409).json({ error: "This game is over. Start a rematch first." });
  if (!game.players.includes(req.user.username)) {
    if (game.players.length >= 2) return res.status(409).json({ error: "This game already has two players." });
    game.players.push(req.user.username);
    if (game.players.length === 2) {
      game.board = shuffledMemoryBoard(); game.matched = []; game.flipped = []; game.scores = [0, 0];
      game.flipper = ""; game.matchPending = false; game.status = "playing"; game.turn = game.players[0];
    }
    await game.save();
  }
  res.json(gameView(game));
}));
app.post("/api/game/flip", auth, wrap(async (req, res) => {
  const game = await getMemoryGame();
  const index = Number(req.body?.index);
  if (game.status !== "playing") return res.status(409).json({ error: "The game is not ready for a move." });
  if (!game.players.includes(req.user.username)) return res.status(403).json({ error: "Join the game before playing." });
  if (game.turn !== req.user.username) return res.status(409).json({ error: "Wait for your turn." });
  if (!Number.isInteger(index) || index < 0 || index >= 16 || game.matched.includes(index) || game.flipped.includes(index)) return res.status(400).json({ error: "That card is not available." });
  if (game.flipped.length === 0) {
    game.flipped = [index]; game.flipper = req.user.username; game.matchPending = false;
  } else {
    if (game.flipper !== req.user.username) return res.status(409).json({ error: "The other player is finishing their turn." });
    game.flipped.push(index);
    game.matchPending = game.board[game.flipped[0]] === game.board[index];
  }
  await game.save();
  res.json(gameView(game));
}));
app.post("/api/game/resolve", auth, wrap(async (req, res) => {
  const game = await getMemoryGame();
  if (game.status !== "playing" || game.flipped.length !== 2) return res.json(gameView(game));
  if (!game.players.includes(req.user.username)) return res.status(403).json({ error: "Join the game before playing." });
  const playerIndex = game.players.indexOf(game.flipper);
  if (playerIndex < 0) return res.status(409).json({ error: "The current turn could not be resolved." });
  if (game.matchPending) {
    game.matched.push(...game.flipped); game.scores[playerIndex] += 1;
    if (game.matched.length === game.board.length) {
      game.status = "finished";
      game.winner = game.scores[0] === game.scores[1] ? "" : game.players[game.scores[0] > game.scores[1] ? 0 : 1];
    }
  } else game.turn = game.players[1 - playerIndex];
  game.flipped = []; game.flipper = ""; game.matchPending = false;
  await game.save();
  res.json(gameView(game));
}));
app.post("/api/game/rematch", auth, wrap(async (req, res) => {
  const game = await getMemoryGame();
  if (game.status !== "finished") return res.status(409).json({ error: "Finish the game before starting a rematch." });
  if (!game.players.includes(req.user.username)) return res.status(403).json({ error: "Only a player can start a rematch." });
  game.players = [req.user.username]; game.board = Array(24).fill(""); game.matched = []; game.flipped = [];
  game.flipper = ""; game.matchPending = false; game.scores = [0, 0]; game.winner = ""; game.turn = ""; game.status = "waiting";
  await game.save();
  res.json(gameView(game));
}));

const emptyTicTacToe = () => ({ room: "tic-tac-toe", players: [], board: Array(9).fill(""), turn: "", winner: "", status: "waiting" });
const getTicTacToe = () => TicTacToeRoom.findOneAndUpdate({ room: "tic-tac-toe" }, { $setOnInsert: { room: "tic-tac-toe" } }, { upsert: true, new: true, setDefaultsOnInsert: true });
const ticTacToeView = (room) => room || emptyTicTacToe();
app.get("/api/game/tic-tac-toe", auth, wrap(async (_req, res) => res.json(ticTacToeView(await TicTacToeRoom.findOne({ room: "tic-tac-toe" })))));
app.post("/api/game/tic-tac-toe/join", auth, wrap(async (req, res) => {
  const room = await getTicTacToe();
  if (room.status === "finished") return res.status(409).json({ error: "This game is over. Start a rematch first." });
  if (!room.players.includes(req.user.username)) {
    if (room.players.length >= 2) return res.status(409).json({ error: "This game already has two players." });
    room.players.push(req.user.username);
    if (room.players.length === 2) { room.status = "playing"; room.turn = room.players[0]; }
    await room.save();
  }
  res.json(room);
}));
app.post("/api/game/tic-tac-toe/move", auth, wrap(async (req, res) => {
  const room = await getTicTacToe();
  const index = Number(req.body?.index);
  if (room.status !== "playing" || room.turn !== req.user.username) return res.status(409).json({ error: "Wait for your turn." });
  if (!Number.isInteger(index) || index < 0 || index > 8 || room.board[index]) return res.status(400).json({ error: "That square is not available." });
  room.board.set(index, room.players.indexOf(req.user.username) === 0 ? "X" : "O");
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  if (lines.some(([a,b,c]) => room.board[a] && room.board[a] === room.board[b] && room.board[b] === room.board[c])) { room.status = "finished"; room.winner = req.user.username; }
  else if (room.board.every(Boolean)) room.status = "finished";
  else room.turn = room.players.find((player) => player !== req.user.username);
  await room.save(); res.json(room);
}));
app.post("/api/game/tic-tac-toe/rematch", auth, wrap(async (req, res) => {
  const room = await getTicTacToe();
  if (room.status !== "finished" || !room.players.includes(req.user.username)) return res.status(409).json({ error: "A player must finish the game before a rematch." });
  room.players = [req.user.username]; room.board = Array(9).fill(""); room.turn = ""; room.winner = ""; room.status = "waiting";
  await room.save(); res.json(room);
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
