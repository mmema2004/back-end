const mongoose = require("mongoose");

const goalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  targetAmount: { type: Number, required: true },
  presentAmount: { type: Number, default: 0 }, 
  currencyId: { type: mongoose.Schema.Types.ObjectId, ref: "Currency", required: true },
  category: { type: String },
  month: { type: Number, required: true }, 
  year: { type: Number, required: true }, 
}, { timestamps: true });

module.exports = mongoose.model("Goal", goalSchema);
