const mongoose = require("mongoose");

const billSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  description: { type: String },
  amount: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  lastCharge: { type: Date },
  currencyId: { type: mongoose.Schema.Types.ObjectId, ref: "Currency", required: true },
  isPaid: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  frequency: { type: String, enum: ["monthly", "yearly"], default: "monthly" }
}, { timestamps: true });

module.exports = mongoose.model("Bill", billSchema);
