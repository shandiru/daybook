import mongoose from "mongoose";
const { Schema, model, models } = mongoose;

// date = "YYYY-MM-DD", time = "HH:mm"
export const Task = models.Task || model("Task", new Schema({
  title: { type: String, required: true, trim: true },
  date: { type: String, required: true, index: true },
  time: { type: String, default: "" },
  done: { type: Boolean, default: false },
}, { timestamps: true }));

export const Expense = models.Expense || model("Expense", new Schema({
  title: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  category: { type: String, default: "Other" },
  date: { type: String, required: true, index: true },
}, { timestamps: true }));

export const ChatMessage = models.ChatMessage || model("ChatMessage", new Schema({
  sender: { type: String, required: true, index: true },
  text: { type: String, required: true, trim: true, maxlength: 2000 },
  channel: { type: String, enum: ["general"], default: "general", index: true },
  seenBy: { type: [String], default: [] },
}, { timestamps: true }));

export const ChatPresence = models.ChatPresence || model("ChatPresence", new Schema({
  username: { type: String, required: true, unique: true },
  typingUntil: { type: Date, default: null },
  channel: { type: String, enum: ["general"], default: "general" },
}, { timestamps: true }));

export const GameRoom = models.GameRoom || model("GameRoom", new Schema({
  room: { type: String, default: "memory", unique: true },
  matchId: { type: String, default: "" },
  players: { type: [String], default: [] },
  board: { type: [String], default: () => Array(24).fill("") },
  matched: { type: [Number], default: [] },
  flipped: { type: [Number], default: [] },
  flipper: { type: String, default: "" },
  matchPending: { type: Boolean, default: false },
  scores: { type: [Number], default: () => [0, 0] },
  turn: { type: String, default: "" },
  winner: { type: String, default: "" },
  status: { type: String, enum: ["waiting", "playing", "finished"], default: "waiting" },
}, { timestamps: true }));

export const LudoRoom = models.LudoRoom || model("LudoRoom", new Schema({
  room: { type: String, default: "ludo", unique: true },
  matchId: { type: String, default: "" },
  players: { type: [String], default: [] },
  positions: { type: Schema.Types.Mixed, default: () => [Array(4).fill(-1), Array(4).fill(-1)] },
  turn: { type: String, default: "" },
  dice: { type: Number, default: 0 },
  winner: { type: String, default: "" },
  status: { type: String, enum: ["waiting", "playing", "finished"], default: "waiting" },
}, { timestamps: true }));

export const GameHistory = models.GameHistory || model("GameHistory", new Schema({
  matchId: { type: String, required: true, unique: true },
  game: { type: String, enum: ["memory", "ludo"], required: true, index: true },
  players: { type: [String], default: [] },
  winner: { type: String, default: "" },
}, { timestamps: true }));
