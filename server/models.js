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
