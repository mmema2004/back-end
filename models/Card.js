const mongoose = require("mongoose");

const cardSchema = new mongoose.Schema({
  bankName: {type:String, require:true},
  type: {type:String, require:true},
  branchName: {type:String, require:true},
  accountNumber: {type: String, require:true , unique:true},
  balance: {type:Number, require:true},
   currencyId: { type: mongoose.Schema.Types.ObjectId, ref: "Currency", required: true },
   clientId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  isActive: {type:Boolean ,require:true}



})

module.exports = mongoose.model("Card" , cardSchema)