const mongoose = require("mongoose");

const uri = process.env.MongoDB_URI;
const connectDB = async () => {
  try {
    await mongoose.connect(uri);
    console.log("MongoDB connected");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
module.exports = connectDB;
