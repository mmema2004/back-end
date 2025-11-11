const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  bankId: { type: mongoose.Schema.Types.ObjectId, ref: "Card", required: false },
  item: { type: String, required: true },
  shopName: { type: String, default: "Bill (Unpaid)" }, 
  date: { type: Date, required: true },
  transactionType: { type: String, enum: ["income", "expense"], required: true },
  amount: { type: Number, required: true },
  currencyId: { type: mongoose.Schema.Types.ObjectId, ref: "Currency", required: true },
  paymentMethod: { type: String, required: false }, 
  receipt: { type: String, required: false },       
  isActive: { type: Boolean, default: true },
  status: { type: String, enum: ["pending", "paid"], default: "pending" } 
}, { timestamps: true });

module.exports = mongoose.model("Transaction", transactionSchema);
