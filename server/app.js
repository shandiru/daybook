import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { Task, Expense } from "./models.js";

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
  try { jwt.verify((req.headers.authorization || "").replace("Bearer ", ""), process.env.JWT_SECRET); next(); }
  catch { res.status(401).json({ error: "Please log in again" }); }
}

app.get("/api/health", (_q, r) => r.json({ ok: true }));

// Single personal account, credentials come from .env (APP_USER / APP_PASS)
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username !== process.env.APP_USER || password !== process.env.APP_PASS)
    return res.status(400).json({ error: "Wrong username or password" });
  res.json({ token: jwt.sign({ me: true }, process.env.JWT_SECRET, { expiresIn: "365d" }), user: { name: username } });
});

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
