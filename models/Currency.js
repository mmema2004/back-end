const mongoose = require("mongoose");

const currencySchema = mongoose.Schema({
  code : {type:String, required:true},
  description : {type:String, required:true},
  exchangeRate: {type:Number, required:true },

})

module.exports = mongoose.model("Currency" , currencySchema)