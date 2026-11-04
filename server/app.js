import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { Task, Expense, ChatMessage, ChatPresence, GameRoom, LudoRoom, GameHistory } from "./models.js";

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

const chatChannel = () => "general";
const chatChannelFilter = () => ({ channel: { $in: ["general", null] } });
app.get("/api/chat", auth, wrap(async (req, res) => {
  res.json(await ChatMessage.find(chatChannelFilter(chatChannel(req.query.channel))).sort({ createdAt: 1 }).limit(300));
}));
app.post("/api/chat", auth, wrap(async (req, res) => {
  const text = String(req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "Message cannot be empty" });
  res.status(201).json(await ChatMessage.create({ sender: req.user.username, text, channel: chatChannel(req.body?.channel), seenBy: [req.user.username] }));
}));
app.get("/api/chat/unread", auth, wrap(async (req, res) => {
  const rows = await ChatMessage.find({ sender: { $ne: req.user.username }, seenBy: { $ne: req.user.username } }).sort({ createdAt: -1 }).lean();
  const counts = { general: 0 };
  rows.forEach((message) => { counts[chatChannel(message.channel)] += 1; });
  res.json({ counts, latest: rows[0] || null });
}));
app.put("/api/chat/seen", auth, wrap(async (req, res) => {
  const channel = chatChannel(req.body?.channel);
  await ChatMessage.updateMany({ ...chatChannelFilter(channel), sender: { $ne: req.user.username }, seenBy: { $ne: req.user.username } }, { $addToSet: { seenBy: req.user.username } });
  res.json({ ok: true });
}));
app.put("/api/chat/typing", auth, wrap(async (req, res) => {
  await ChatPresence.findOneAndUpdate({ username: req.user.username },
    { typingUntil: req.body?.typing ? new Date(Date.now() + 4000) : null, channel: chatChannel(req.body?.channel) }, { upsert: true, new: true });
  res.json({ ok: true });
}));
app.get("/api/chat/typing", auth, wrap(async (req, res) => {
  const rows = await ChatPresence.find({ username: { $ne: req.user.username }, channel: chatChannel(req.query.channel), typingUntil: { $gt: new Date() } });
  res.json(rows.map((row) => row.username));
}));

const memoryFaces = ["🍎", "🍌", "🍇", "🍉", "🍍", "🥭", "🐘", "🦁", "🐒", "🦋", "🐢", "🐬"];
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
  if (game.board.length !== 24 || game.board.some((face) => face && !memoryFaces.includes(face))) {
    game.players = []; game.matchId = ""; game.board = Array(24).fill(""); game.matched = []; game.flipped = [];
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
app.post("/api/game/hint", auth, wrap(async (req, res) => {
  if (req.user.username !== "dirushan") return res.status(403).json({ error: "This hint is not available for this account." });
  const game = await getMemoryGame();
  if (game.status !== "waiting") return res.status(409).json({ error: "The hint is only available before the game starts." });
  if (!game.board.some(Boolean)) { game.board = shuffledMemoryBoard(); await game.save(); }
  res.json({ board: game.board, duration: 60 });
}));
app.get("/api/game/history", auth, wrap(async (req, res) => {
  const game = req.query.type === "ludo" ? "ludo" : "memory";
  const records = await GameHistory.find({ game }).sort({ createdAt: -1 }).limit(50).lean();
  const wins = await GameHistory.aggregate([
    { $match: { game, winner: { $ne: "" } } },
    { $group: { _id: "$winner", count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ]);
  res.json({ wins: wins.map(({ _id, count }) => ({ player: _id, count })), matches: records });
}));
app.post("/api/game/join", auth, wrap(async (req, res) => {
  const game = await getMemoryGame();
  if (game.status === "finished") return res.status(409).json({ error: "This game is over. Start a rematch first." });
  if (!game.players.includes(req.user.username)) {
    if (game.players.length >= 2) return res.status(409).json({ error: "This game already has two players." });
    game.players.push(req.user.username);
    if (game.players.length === 2) {
      if (!game.board.some(Boolean)) game.board = shuffledMemoryBoard();
      game.matched = []; game.flipped = []; game.scores = [0, 0];
      game.flipper = ""; game.matchPending = false; game.status = "playing"; game.turn = game.players[0]; game.matchId = randomUUID();
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
  if (!Number.isInteger(index) || index < 0 || index >= game.board.length || game.matched.includes(index) || game.flipped.includes(index)) return res.status(400).json({ error: "That card is not available." });
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
  if (game.status === "finished") await GameHistory.updateOne({ matchId: game.matchId }, { $setOnInsert: { game: "memory", players: game.players, winner: game.winner } }, { upsert: true });
  res.json(gameView(game));
}));
app.post("/api/game/rematch", auth, wrap(async (req, res) => {
  const game = await getMemoryGame();
  if (game.status !== "finished") return res.status(409).json({ error: "Finish the game before starting a rematch." });
  if (!game.players.includes(req.user.username)) return res.status(403).json({ error: "Only a player can start a rematch." });
  game.players = [req.user.username]; game.matchId = ""; game.board = Array(24).fill(""); game.matched = []; game.flipped = [];
  game.flipper = ""; game.matchPending = false; game.scores = [0, 0]; game.winner = ""; game.turn = ""; game.status = "waiting";
  await game.save();
  res.json(gameView(game));
}));

const LUDO_BOARD_VERSION = 2;
const LUDO_TRACK_LENGTH = 52;
const LUDO_HOME = 57;
const LUDO_OFFSETS = [0, 26];
const LUDO_SAFE_SQUARES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const freshLudoPositions = () => [Array(4).fill(-1), Array(4).fill(-1)];
const getLudo = async () => {
  const room = await LudoRoom.findOneAndUpdate({ room: "ludo" }, { $setOnInsert: { room: "ludo" } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  if (room.boardVersion !== LUDO_BOARD_VERSION) {
    room.boardVersion = LUDO_BOARD_VERSION;
    room.positions = freshLudoPositions(); room.dice = 0; room.lastRoll = 0; room.consecutiveSixes = 0; room.winner = "";
    if (room.players.length === 2) { room.status = "playing"; room.turn = room.players[0]; room.matchId = randomUUID(); }
    else { room.status = "waiting"; room.turn = ""; room.matchId = ""; }
    await room.save();
  }
  return room;
};
const ludoLegalMoves = (room, playerIndex, dice) => (room.positions[playerIndex] || [])
  .map((position, token) => ({ position, token }))
  .filter(({ position }) => (position === -1 ? dice === 6 : position < LUDO_HOME && position + dice <= LUDO_HOME))
  .map(({ token }) => token);
const ludoView = (room) => {
  const view = room.toObject ? room.toObject() : { ...room };
  const playerIndex = view.players.indexOf(view.turn);
  view.legalMoves = view.dice && playerIndex >= 0 ? ludoLegalMoves(view, playerIndex, view.dice) : [];
  return view;
};
app.get("/api/game/ludo", auth, wrap(async (_req, res) => res.json(ludoView(await getLudo()))));
app.post("/api/game/ludo/join", auth, wrap(async (req, res) => {
  const room = await getLudo();
  if (room.status === "finished") return res.status(409).json({ error: "This game is over. Start a rematch first." });
  if (!room.players.includes(req.user.username)) {
    if (room.players.length >= 2) return res.status(409).json({ error: "This game already has two players." });
    room.players.push(req.user.username);
    if (room.players.length === 2) { room.positions = freshLudoPositions(); room.status = "playing"; room.turn = room.players[0]; room.dice = 0; room.lastRoll = 0; room.consecutiveSixes = 0; room.matchId = randomUUID(); }
    await room.save();
  }
  res.json(ludoView(room));
}));
app.post("/api/game/ludo/roll", auth, wrap(async (req, res) => {
  const room = await getLudo();
  if (room.status !== "playing" || room.turn !== req.user.username) return res.status(409).json({ error: "Wait for your turn." });
  if (room.dice) return res.status(409).json({ error: "Move a piece before rolling again." });
  const playerIndex = room.players.indexOf(req.user.username);
  room.dice = Math.floor(Math.random() * 6) + 1;
  room.lastRoll = room.dice;
  room.consecutiveSixes = room.dice === 6 ? room.consecutiveSixes + 1 : 0;
  if (room.consecutiveSixes >= 3) {
    room.dice = 0; room.consecutiveSixes = 0; room.turn = room.players[1 - playerIndex];
  } else if (!ludoLegalMoves(room, playerIndex, room.dice).length) {
    const rolledSix = room.dice === 6;
    room.dice = 0;
    if (!rolledSix) room.turn = room.players[1 - playerIndex];
  }
  await room.save(); res.json(ludoView(room));
}));
app.post("/api/game/ludo/move", auth, wrap(async (req, res) => {
  const room = await getLudo();
  const token = Number(req.body?.token);
  const playerIndex = room.players.indexOf(req.user.username);
  if (room.status !== "playing" || room.turn !== req.user.username || !room.dice) return res.status(409).json({ error: "Roll the dice on your turn first." });
  if (!ludoLegalMoves(room, playerIndex, room.dice).includes(token)) return res.status(400).json({ error: "That piece cannot move with this roll." });
  const positions = room.positions.map((items) => [...items]);
  positions[playerIndex][token] = positions[playerIndex][token] === -1 ? 0 : positions[playerIndex][token] + room.dice;
  let captured = false;
  const moved = positions[playerIndex][token];
  if (moved < LUDO_TRACK_LENGTH) {
    const absolute = (moved + LUDO_OFFSETS[playerIndex]) % LUDO_TRACK_LENGTH;
    const safe = LUDO_SAFE_SQUARES.has(absolute);
    if (!safe) positions[1 - playerIndex] = positions[1 - playerIndex].map((position) => {
      if (position >= 0 && position < LUDO_TRACK_LENGTH && (position + LUDO_OFFSETS[1 - playerIndex]) % LUDO_TRACK_LENGTH === absolute) { captured = true; return -1; }
      return position;
    });
  }
  const rolledSix = room.dice === 6;
  room.positions = positions; room.dice = 0;
  if (positions[playerIndex].every((position) => position === LUDO_HOME)) { room.status = "finished"; room.winner = req.user.username; room.consecutiveSixes = 0; }
  else if (!rolledSix && !captured) { room.turn = room.players[1 - playerIndex]; room.consecutiveSixes = 0; }
  await room.save();
  if (room.status === "finished") await GameHistory.updateOne({ matchId: room.matchId }, { $setOnInsert: { game: "ludo", players: room.players, winner: room.winner } }, { upsert: true });
  res.json(ludoView(room));
}));
app.post("/api/game/ludo/rematch", auth, wrap(async (req, res) => {
  const room = await getLudo();
  if (room.status !== "finished" || !room.players.includes(req.user.username)) return res.status(409).json({ error: "A player must finish the game before a rematch." });
  room.players = [req.user.username]; room.matchId = ""; room.positions = freshLudoPositions(); room.turn = ""; room.dice = 0; room.lastRoll = 0; room.consecutiveSixes = 0; room.winner = ""; room.status = "waiting";
  await room.save(); res.json(ludoView(room));
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
