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
}, { timestamps: true }));

export const ChatPresence = models.ChatPresence || model("ChatPresence", new Schema({
  username: { type: String, required: true, unique: true },
  typingUntil: { type: Date, default: null },
}, { timestamps: true }));
