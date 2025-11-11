const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  category: { type: String, required: true },    
  subcategory: { type: String },               
  amount: { type: Number, required: true },
  description: { type: String },

  currencyId: { type: mongoose.Schema.Types.ObjectId, ref: "Currency", required: true },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("Expense", expenseSchema);
