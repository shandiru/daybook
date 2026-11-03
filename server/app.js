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

const boxEdges = (box) => {
  const row = Math.floor(box / 3), col = box % 3;
  return [row * 3 + col, (row + 1) * 3 + col, 12 + row * 4 + col, 12 + row * 4 + col + 1];
};
const emptyDotsGame = () => ({ room: "dots", players: [], board: Array(24).fill(""), boxes: Array(9).fill(""), scores: [0, 0], turn: "", winner: "", status: "waiting" });
const getDotsGame = () => GameRoom.findOneAndUpdate(
  { room: "dots" }, { $setOnInsert: { room: "dots" } }, { upsert: true, new: true, setDefaultsOnInsert: true }
);
app.get("/api/game", auth, wrap(async (_req, res) => {
  const game = await GameRoom.findOne({ room: "dots" });
  res.json(game || emptyDotsGame());
}));
app.post("/api/game/join", auth, wrap(async (req, res) => {
  const game = await getDotsGame();
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
  const game = await getDotsGame();
  if (game.status !== "playing") return res.status(409).json({ error: "The game is not ready for a move." });
  const playerIndex = game.players.indexOf(req.user.username);
  if (playerIndex < 0) return res.status(403).json({ error: "Join the game before playing." });
  if (game.turn !== req.user.username) return res.status(409).json({ error: "Wait for your turn." });
  const edgeType = req.body?.edgeType;
  const edge = Number(req.body?.edge);
  const valid = edgeType === "h" ? Number.isInteger(edge) && edge >= 0 && edge < 12 : edgeType === "v" && Number.isInteger(edge) && edge >= 12 && edge < 24;
  if (!valid || game.board[edge]) return res.status(400).json({ error: "That line is not available." });
  game.board[edge] = req.user.username;
  let captured = 0;
  for (let box = 0; box < 9; box++) {
    if (!game.boxes[box] && boxEdges(box).every((side) => game.board[side])) {
      game.boxes[box] = req.user.username;
      captured++;
    }
  }
  game.scores[playerIndex] += captured;
  if (game.boxes.every(Boolean)) {
    game.status = "finished";
    game.winner = game.scores[0] === game.scores[1] ? "" : game.players[game.scores[0] > game.scores[1] ? 0 : 1];
  } else if (!captured) game.turn = game.players[1 - playerIndex];
  await game.save();
  res.json(game);
}));
app.post("/api/game/rematch", auth, wrap(async (req, res) => {
  const game = await getDotsGame();
  if (game.status !== "finished") return res.status(409).json({ error: "Finish the current round before starting a rematch." });
  if (!game.players.includes(req.user.username)) return res.status(403).json({ error: "Only a player can start a rematch." });
  game.board = Array(24).fill(""); game.boxes = Array(9).fill(""); game.scores = [0, 0]; game.winner = ""; game.turn = ""; game.status = "waiting"; game.players = [req.user.username];
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
