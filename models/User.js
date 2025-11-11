const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  username: { type: String, required: false},
  password: { type: String, required: true },
phone_number: { type: Number, unique: false, required:false },
  image: { type: String, required: false },
   isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model("User", userSchema);
