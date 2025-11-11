//IMPORTS
require("dotenv").config();
const express = require("express");
const cors = require("cors"); 
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const path = require("path");
const jwt = require("jsonwebtoken");
const connectDB = require("./db");
const User = require("./models/User");
const Card = require("./models/Card")
const Transaction = require("./models/Transaction")
const app = express();
const Currency = require("./models/Currency")
const Bill = require("./models/Bill");
const Expense = require("./models/Expense");
const Goal = require("./models/Goal");
const helmet = require("helmet");


app.use(helmet());
app.use(express.json());
connectDB();
//CRUD OPERATIONS
app.use(cors({
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization" , "token"]
}));
//SWAGGER 
const swaggerDocument = YAML.load(path.join(__dirname, "swagger.yaml"));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
//MIDDLEWARE , AUTHENTICATION WITH TOKEN
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};
// ==== Expense Auto-Categorizer ====
const expenseCategories = {
  food: ["mcdonalds", "restaurant", "pizza", "burger", "coffee", "cafe", "groceries"],
  transport: ["uber", "taxi", "bus", "train", "shell", "fuel", "gas"],
  shopping: ["amazon", "mall", "shop", "clothes", "shoes", "electronics"],
  entertainment: ["netflix", "spotify", "cinema", "theatre", "games"],
  bills: ["electricity", "water", "internet", "phone", "rent"],
};

function autoCategorize(description = "") {
  const text = description.toLowerCase();
  for (const [category, keywords] of Object.entries(expenseCategories)) {
    if (keywords.some((word) => text.includes(word))) {
      return category;
    }
  }
  return "other";
}


// GET USER
app.get("/user", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      username: user.username || null,
      phone_number: user.phone_number || null,
      image: user.image || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REGISTER USER
app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }
    
    const user = new User({
      name,
      email,
      password,           
    });

    await user.save();

    const formattedUser = {
      id: user._id,  
      name: user.name,
      email: user.email,
    };

    res.status(201).json(formattedUser);
  } catch (err) {
    console.error("Backend error:", err);
    res.status(500).json({ error: "Failed to register user" });
  }
});
// LOGIN USER
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.password !== password) {
      return res.status(401).json({ error: "Invalid password" });
    }
   


    //GENERATE A TOKEN WHEN LOG IN
    const token = jwt.sign(
      { 
        id: user._id, 
        email: user.email, 
        nonce: Math.random().toString(36).substring(2) 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      id: user._id,  
      name: user.name,
      email: user.email,
      phone_number: user.phone_number || null,
      image: user.image || null,
      token
    });

  } catch (err) {
    console.error("Backend error:", err);
    res.status(500).json({ error: err.message });
  }
});
// DEACTIVATE USER
app.patch("/user/deactivate", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.isActive = false;
    await user.save();

    res.json({ message: "User deactivated successfully" });
  } catch (err) {
    console.error("Backend error:", err);
    res.status(500).json({ error: err.message });
  }
});

//FORGOT PASSWORD
const nodemailer = require("nodemailer");
app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ error: "User not found" });

  const resetToken = jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );

  const resetLink = `http://localhost:5173/reset-password?token=${resetToken}`;

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com", 
    port: 587,                        
    secure: false,                    
    auth: {
      user: "megi.mema5@gmail.com",
      pass: process.env.email_password,   
    },
  });

  const mailOptions = {
    from: "megi.mema5@gmail.com",
    to: user.email,
    subject: "Password Reset",
    html: `<p>Click <a href="${resetLink}">here</a> to reset your password. This link expires in 15 minutes.</p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ message: "Password reset link sent to email", token: resetToken});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send email" });
  }
});
//RESET PASSWORD
app.put("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.password = newPassword; 
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    res.status(400).json({ error: "Invalid or expired token" });
  }
});
// UPDATE USER
app.put("/user", authMiddleware, async (req, res) => {
  const { name, email, username, phone_number, image, password } = req.body;

  try {
    const user = await User.findById(req.user.id); 

    if (!user) return res.status(404).json({ error: "User not found" });

    if (name) user.name = name;
    if (email) user.email = email;
    if (username) user.username = username;
    if (phone_number) user.phone_number = phone_number;
    if (image) user.image = image;
    if (password && password === user.password){
      return res.status(400).json({error:"Password should not be the same as the old password"});
    }
    if (password && password !== user.password) {
      user.password = password;
    }

    await user.save();

    res.json({ message: "User updated successfully", user });
  } catch (err) {
    res.status(400).json({ error: "Update failed" });
  }
});
// POST CURRENCY
app.post("/currency", authMiddleware, async (req, res) => {
  try {
    const { code, description, exchangeRate } = req.body;

    const existingCurrency = await Currency.findOne({ code });
    if (existingCurrency) return res.status(400).json({ error: "Currency already exists" });

    const currency = new Currency({ code, description, exchangeRate });
    await currency.save();

    res.status(201).json(currency);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to register currency" });
  }
});
// GET CURRENCY
app.get("/currency", authMiddleware, async (req, res) => {
  try {
    const currencies = await Currency.find();
    res.json(currencies);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch currencies" });
  }
});
// GET CURRENCY BY ID
app.get("/currency/:id", authMiddleware, async (req, res) => {
  try {
    const currency = await Currency.findById(req.params.id);
    if (!currency) return res.status(404).json({ error: "Currency not found" });
    res.json(currency);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch currency" });
  }
});
// PUT CURRENCY BY ID
app.put("/currency/:id", authMiddleware, async (req, res) => {
  try {
    const currency = await Currency.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!currency) return res.status(404).json({ error: "Currency not found" });
    res.json(currency);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update currency" });
  }
});
// DELETE CURRENCY BY ID
app.delete("/currency/:id", authMiddleware, async (req, res) => {
  try {
    const currency = await Currency.findByIdAndDelete(req.params.id);
    if (!currency) return res.status(404).json({ error: "Currency not found" });
    res.json({ message: "Currency deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete currency" });
  }
});
// POST BANK CARD
app.post("/bankaccount", authMiddleware, async (req, res) => {
  try {
    const { bankName, type, branchName, accountNumber, balance, currencyId, isActive } = req.body;

    const existingBank = await Card.findOne({ accountNumber, clientId: req.user.id });
    if (existingBank) return res.status(400).json({ error: "Bank account already exists" });

    const card = new Card({
      bankName,
      type,
      branchName,
      accountNumber,
      balance,
      currencyId,
      clientId: req.user.id,
      isActive
    });
    await card.save();

    await card.populate("currencyId");

    res.status(201).json(card);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to register card" });
  }
});
// GET ALL BANK CARDS
app.get("/bankaccount", authMiddleware, async (req, res) => {
  try {
    const cards = await Card.find({ clientId: req.user.id }).populate("currencyId");
    res.status(200).json(cards);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});
// GET BANK ACCOUNT BY ID
app.get("/bankaccount/:id", authMiddleware, async (req, res) => {
  try {
    const card = await Card.findOne({ _id: req.params.id, clientId: req.user.id }).populate("currencyId");
    if (!card) return res.status(404).json({ error: "Bank account not found" });
    res.json(card);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});
// PUT BANK ACCOUNT BY ID
app.put("/bankaccount/:id", authMiddleware, async (req, res) => {
  try {
    const card = await Card.findOneAndUpdate(
      { _id: req.params.id, clientId: req.user.id },
      req.body,
      { new: true }
    ).populate("currencyId");

    if (!card) return res.status(404).json({ error: "Bank account not found" });
    res.json(card);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message });
  }
});
// DELETE BANK ACCOUNT BY ID
app.delete("/bankaccount/:id", authMiddleware, async (req, res) => {
  try {
    const card = await Card.findOneAndDelete({ _id: req.params.id, clientId: req.user.id });
    if (!card) return res.status(404).json({ error: "Bank account not found" });
    res.json({ message: "Bank account deleted successfully" });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});
//POST TRANSFER

app.post("/transfer", authMiddleware, async (req, res) => {
  try {
    const { fromAccountNumber, toAccountNumber, amount } = req.body;

    // Find source card
    const fromCard = await Card.findOne({
      accountNumber: fromAccountNumber,
      clientId: req.user.id,
    });
    if (!fromCard)
      return res.status(400).json({ error: "Source bank account not found" });

    // Find destination card
    const toCard = await Card.findOne({
      accountNumber: toAccountNumber,
      clientId: req.user.id,
    });
    if (!toCard)
      return res
        .status(400)
        .json({ error: "Destination bank account not found" });

    // Check balance
    if (fromCard.balance < amount) {
      return res
        .status(400)
        .json({ error: "Insufficient funds in source account" });
    }

    // Get currencies
    const fromCurrency = await Currency.findById(fromCard.currencyId);
    const toCurrency = await Currency.findById(toCard.currencyId);

    if (!fromCurrency || !toCurrency) {
      return res.status(400).json({ error: "Invalid card currency" });
    }

    // Convert using (from amount * from exchangeRate) / to exchangeRate
    let convertedAmount = amount;
    if (fromCard.currencyId.toString() !== toCard.currencyId.toString()) {
      convertedAmount =
        (amount * fromCurrency.exchangeRate) / toCurrency.exchangeRate;
    }

    // Update balances
    fromCard.balance -= amount;
    toCard.balance += convertedAmount;

    await fromCard.save();
    await toCard.save();

    // Generate transactions
    const receipt =
      "TX-" + Math.random().toString(36).substring(2, 10).toUpperCase();

    const transaction = new Transaction({
      bankId: fromCard._id,
      item: "Transfer",
      shopName: "Transfer to " + toAccountNumber,
      date: new Date(),
      transactionType: "expense",
      amount,
      currencyId: fromCard.currencyId, // expense recorded in source currency
      paymentMethod: "transfer",
      receipt,
      isActive: true,
    });
    await transaction.save();

    const transactionTo = new Transaction({
      bankId: toCard._id,
      item: "Transfer",
      shopName: "Transfer from " + fromAccountNumber,
      date: new Date(),
      transactionType: "income",
      amount: convertedAmount,
      currencyId: toCard.currencyId, // income recorded in destination currency
      paymentMethod: "transfer",
      receipt,
      isActive: true,
    });
    await transactionTo.save();

    res.status(200).json({ message: "Transfer successful", fromCard, toCard });
  } catch (error) {
    console.error("Backend error:", error);
    res.status(500).json({ error: "Failed to process transfer" });
  }
});


// POST TRANSACTION
app.post("/transactions", authMiddleware, async (req, res) => {
  try {
    const { bankId, item, shopName, date, transactionType, amount, currencyId, paymentMethod, isActive } = req.body;

    const card = await Card.findOne({ _id: bankId, clientId: req.user.id });
    if (!card) return res.status(400).json({ error: "Invalid bankId" });

    const currencyInfo = await Currency.findById(currencyId);
    if (!currencyInfo) return res.status(400).json({ error: "Invalid currencyId" });

    const transactionDate = new Date(date);
    if (isNaN(transactionDate.getTime())) return res.status(400).json({ error: "Invalid date format" });

    const receipt = "RCPT-" + Math.random().toString(36).substring(2, 10).toUpperCase();

    const transaction = new Transaction({
      bankId: card._id,
      item,
      shopName,
      date: transactionDate,
      transactionType,
      amount,
      currencyId: currencyInfo._id,
      paymentMethod,
      receipt,
      isActive
    });
    await transaction.save();

    
    if (transactionType === "expense") card.balance -= amount * currencyInfo.exchangeRate;
    if (transactionType === "income") card.balance += amount * currencyInfo.exchangeRate;
    await card.save();

    

    await transaction.populate("currencyId");

    res.status(201).json(transaction);
  } catch (error) {
    console.error("Backend error:", error);
    res.status(500).json({ error: "Failed to register transaction" });
  }
});
// GET ALL TRANSACTIONS
app.get("/transactions", authMiddleware, async (req, res) => {
  try {
    const userCards = await Card.find({ clientId: req.user.id });
    const userCardsIds = userCards.map(card => card._id);

    const transactions = await Transaction.find({ bankId: { $in: userCardsIds } })
      .populate('currencyId')
      .sort({ createdAt: -1 }); 

    const formattedTransactions = transactions.map((transaction) => {
  const currencyInfo = transaction.currencyId;
  return {
    id: transaction._id,
    bankId: transaction.bankId,
    item: transaction.item,
    shopName: transaction.shopName,
    date: transaction.date,
    transactionType: transaction.transactionType,
    amount: transaction.amount,
    currency: currencyInfo
      ? {
          id: currencyInfo._id,
          code: currencyInfo.code,
          description: currencyInfo.description,
          exchangeRate: currencyInfo.exchangeRate
        }
      : null,  
    paymentMethod: transaction.paymentMethod,
    receipt: transaction.receipt,
    isActive: transaction.isActive
  };
});


    res.status(200).json(formattedTransactions);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: error.message });
  }
});
// Get ALL TRANSACTIONS BY BANK ID
app.get("/transactions/bank/:bankId", authMiddleware, async (req, res) => {
  try {
    const { bankId } = req.params;
    
    const card = await Card.findOne({ _id: bankId, clientId: req.user.id });
    if (!card) return res.status(400).json({ error: "Invalid bankId or access denied" });

    const transactions = await Transaction.find({ bankId: card._id })
      .populate("currencyId")
      .sort({ createdAt: -1 });

    const formatted = transactions.map((t) => ({
      id: t._id,
      bankId: t.bankId,
      item: t.item,
      shopName: t.shopName,
      date: t.date,
      transactionType: t.transactionType,
      amount: t.amount,
      currency: {
        id: t.currencyId._id,
        code: t.currencyId.code,
        description: t.currencyId.description,
        exchangeRate: t.currencyId.exchangeRate
      },
      paymentMethod: t.paymentMethod,
      receipt: t.receipt,
      isActive: t.isActive
    }));

    res.json(formatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});
// Get ALL TRANSACTIONS BY TRANSACTION TYPE INCOME OR EXPENSE
app.get("/transactions/type/:transactionType", authMiddleware, async (req, res) => {
  try {
    const { transactionType } = req.params;

    const userCards = await Card.find({ clientId: req.user.id });
    const userCardIds = userCards.map(c => c._id);

    const transactions = await Transaction.find({
      transactionType,
      bankId: { $in: userCardIds }
    })
      .populate("currencyId")
      .sort({ createdAt: -1 });

    const formatted = transactions.map((t) => ({
      id: t._id,
      bankId: t.bankId,
      item: t.item,
      shopName: t.shopName,
      date: t.date,
      transactionType: t.transactionType,
      amount: t.amount,
      currency: {
        id: t.currencyId._id,
        code: t.currencyId.code,
        description: t.currencyId.description,
        exchangeRate: t.currencyId.exchangeRate,
      },
      paymentMethod: t.paymentMethod,
      receipt: t.receipt,
      isActive: t.isActive,
    }));

    res.json(formatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});
app.get("/transactions/summary", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();

    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

   
    const cards = await Card.find({ clientId: userId });
    const cardIds = cards.map(c => c._id);

    
    const currentTransactions = await Transaction.find({
      bankId: { $in: cardIds },
      date: { $gte: currentMonthStart, $lt: currentMonthEnd },
    }).populate("currencyId");

   
    const lastTransactions = await Transaction.find({
      bankId: { $in: cardIds },
      date: { $gte: lastMonthStart, $lt: lastMonthEnd },
    }).populate("currencyId");

    
const summarize = (transactions) => {
  return transactions.reduce((acc, t) => {
    if (t.transactionType === "income") acc.income += t.amount;
    if (t.transactionType === "expense") acc.expense += t.amount;
    return acc;
  }, { income: 0, expense: 0 });
};

    res.json({
      currentMonth: summarize(currentTransactions),
      lastMonth: summarize(lastTransactions),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

app.get("/transactions/daily-summary", authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const summary = await Transaction.aggregate([
      { $match: { date: { $gte: startOfMonth, $lte: endOfMonth }, isActive: true } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          income: { $sum: { $cond: [{ $eq: ["$transactionType", "income"] }, "$amount", 0] } },
          expense: { $sum: { $cond: [{ $eq: ["$transactionType", "expense"] }, "$amount", 0] } },
        },
      },
      { $sort: { "_id": 1 } },
      { $project: { date: "$_id", income: 1, expense: 1, _id: 0 } },
    ]);

    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch daily summary" });
  }
});

// UPDATE TRANSACTION BY ID
app.put("/transactions/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { item, shopName, date, transactionType, amount, paymentMethod, isActive } = req.body;

    const transaction = await Transaction.findById(id);
    if (!transaction) return res.status(404).json({ error: "Transaction not found" });

    const card = await Card.findOne({ _id: transaction.bankId, clientId: req.user.id });
    if (!card) return res.status(403).json({ error: "Access denied" });

    
    if (transaction.transactionType === "expense") card.balance += transaction.amount;
    if (transaction.transactionType === "income") card.balance -= transaction.amount;

    
    Object.assign(transaction, { item, shopName, date, transactionType, amount, paymentMethod, isActive });
    await transaction.save();

    
    if (transaction.transactionType === "expense") card.balance -= transaction.amount;
    if (transaction.transactionType === "income") card.balance += transaction.amount;
    await card.save();

    
    if (transaction.transactionType === "expense") {
      await Expense.findOneAndUpdate(
        { transactionId: transaction._id },
        {
          category: transaction.item,
          amount: transaction.amount,
          description: `${transaction.shopName} - ${transaction.item}`,
          status: transaction.isActive ? "paid" : "pending",
          date: transaction.date,
          bankId: card._id
        }
      );
    }

    res.json(transaction);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update transaction" });
  }
});
// DELETE TRANSACTION BY ID
app.delete("/transactions/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await Transaction.findById(id);
    if (!transaction) return res.status(404).json({ error: "Transaction not found" });

    const card = await Card.findOne({ _id: transaction.bankId, clientId: req.user.id });
    if (!card) return res.status(403).json({ error: "Access denied" });

   
    await Expense.findOneAndDelete({ transactionId: transaction._id });

    await transaction.deleteOne();
    res.json({ message: "Transaction and linked expense deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete transaction" });
  }
});

const cron = require("node-cron");
const { sendBillReminderEmail } = require("./email/SendBillMailer"); 
 
cron.schedule("0 9 * * *", async () => {
  console.log("Running cron job to check bills due soon...");

  try {
    const billsDueSoon = await Bill.find({
      isPaid: false,
      dueDate: { $lte: new Date(new Date().getTime() + 24 * 60 * 60 * 1000) }, 
    });

    for (let bill of billsDueSoon) {
      const user = await User.findById(bill.userId); 
      if (user) {
        const result = await sendBillReminderEmail(user.email, user.name, bill);
        if (result.success) {
          console.log(`Reminder email sent for bill: ${bill.name}`);
        } else {
          console.error(`Failed to send email for bill: ${bill.name}`);
        }
      }
    }
  } catch (err) {
    console.error("Error in cron job: ", err);
  }
});


app.get("/bills-due-soon", authMiddleware, async (req, res) => {
  try {
    const bills = await Bill.find({ userId: req.user.id, isPaid: false }).sort({ dueDate: 1 });
    
    console.log(`Found ${bills.length} unpaid bills for user ${req.user.id}`);
    
    const now = new Date();
    const next24Hours = new Date(now.getTime() + (24 * 60 * 60 * 1000));
    
    console.log(`Current time: ${now.toISOString()}`);
    console.log(`24 hours from now: ${next24Hours.toISOString()}`);
    
    // Include overdue bills AND bills due within 24 hours
    const dueSoonBills = bills.filter(bill => {
      const dueDate = new Date(bill.dueDate);
      // Include bills that are overdue OR due within next 24 hours
      const isDueSoon = dueDate <= next24Hours;
      
      console.log(`Bill: ${bill.name}, Due: ${dueDate.toISOString()}, Is Due Soon: ${isDueSoon}`);
      
      return isDueSoon;
    });
    
    console.log(`Found ${dueSoonBills.length} bills due soon (including overdue)`);
    
    // CONSISTENT RESPONSE STRUCTURE - always return billsDueSoon array
    res.status(200).json({ 
      billsDueSoon: dueSoonBills, 
      message: dueSoonBills.length === 0 ? "No bills due soon." : `Found ${dueSoonBills.length} bills due soon`,
      debugInfo: {
        totalBills: bills.length,
        currentTime: now.toISOString(),
        next24Hours: next24Hours.toISOString(),
        allBills: bills.map(bill => ({
          name: bill.name,
          dueDate: bill.dueDate,
          dueDateFormatted: new Date(bill.dueDate).toISOString()
        }))
      }
    });
  } catch (err) {
    console.error("Error fetching bills:", err);
    res.status(500).json({ 
      error: "Failed to fetch bills due soon",
      billsDueSoon: [] // Always provide the expected structure
    });
  }
});
// POST BILLS
app.post("/bills", authMiddleware, async (req, res) => {
  try {
    const { 
      name, 
      description, 
      amount, 
      dueDate, 
      currencyId, 
      frequency, 
      isPaid, 
      lastCharge 
    } = req.body;

    const currencyInfo = await Currency.findById(currencyId);
    if (!currencyInfo) return res.status(400).json({ error: "Invalid currencyId" });

   
    const bill = new Bill({
      userId: req.user.id,
      name,
      description,
      amount,
      dueDate,
      currencyId,
      frequency,
      isPaid: isPaid ?? false,
      lastCharge: isPaid ? (lastCharge || new Date()) : null
    });

    await bill.save();

   
    const transaction = new Transaction({
      item: name,
      shopName: isPaid ? "Bill Payment" : "Bill (Unpaid)",
      date: isPaid ? (lastCharge || new Date()) : dueDate,
      transactionType: "expense",
      amount,
      currencyId,
      status: isPaid ? "paid" : "pending",
      ...(isPaid && {
        receipt: "RCPT-" + Math.random().toString(36).substring(2, 10).toUpperCase()
      })
    });

    await transaction.save();

    res.status(201).json({ bill, transaction });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// GET ALL BILLS
app.get("/bills", authMiddleware, async (req, res) => {
  try {
    const bills = await Bill.find({ userId: req.user.id }).sort({ dueDate: 1 });

    const now = new Date();
    const processedBills = bills.map(bill => {
      const isPaid = bill.lastCharge && now <= bill.dueDate;
      return { ...bill.toObject(), isPaid };
    });

    res.json(processedBills);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// UPDATE BILLS BY ID
app.put("/bills/:id", authMiddleware, async (req, res) => {
  try {
    const bill = await Bill.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, req.body, { new: true });
    if (!bill) return res.status(404).json({ error: "Bill not found" });
    res.json(bill);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// DELETE BILL BY ID
app.delete("/bills/:id", authMiddleware, async (req, res) => {
  try {
    const bill = await Bill.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!bill) return res.status(404).json({ error: "Bill not found" });
    res.json({ message: "Bill deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// PAY BILL WHEN ISPAID IS FALSE
app.put("/bills/:id/pay", authMiddleware, async (req, res) => {
  try {
    const { bankId, paymentMethod } = req.body;

    const bill = await Bill.findOne({ _id: req.params.id, userId: req.user.id });
    if (!bill) return res.status(404).json({ error: "Bill not found" });

    const card = await Card.findById(bankId);
    if (!card) return res.status(400).json({ error: "Invalid bankId" });

    const now = new Date();

    
    bill.lastCharge = now;

    
    if (bill.frequency === "monthly") {
      const nextDue = new Date(bill.dueDate);
      nextDue.setMonth(nextDue.getMonth() + 1);
      bill.dueDate = nextDue;
    }

    if (bill.frequency === "yearly") {
      const nextDue = new Date(bill.dueDate);
      nextDue.setFullYear(nextDue.getFullYear() + 1);
      bill.dueDate = nextDue;
    }

    await bill.save();

    const currencyInfo = await Currency.findById(bill.currencyId);
if (!currencyInfo) return res.status(400).json({ error: "Invalid currencyId" });

card.balance -= bill.amount * currencyInfo.exchangeRate;
await card.save();

   
    const transaction = await Transaction.findOneAndUpdate(
      { item: bill.name, status: "pending" },
      {
        bankId,
        shopName: "Bill Payment",
        date: now,
        paymentMethod,
        status: "paid",
        receipt: "RCPT-" + Math.random().toString(36).substring(2, 10).toUpperCase()
      },
      { new: true }
    );

    res.json({
      message: "Bill paid successfully",
      bill: { ...bill.toObject(), isPaid: true }, 
      transaction
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// POST EXPENSE
app.post("/expenses", authMiddleware, async (req, res) => {
   try {
    const { category, subcategory, amount, description, currencyId, date, bankId } = req.body;

    const expense = new Expense({
      userId: req.user.id,
      category,
      subcategory,
      amount,
      description,
      currencyId,
      date: date || new Date(),
      bankId: bankId || null
    });

    await expense.save();
    res.status(201).json(expense);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
//
// GET INSIGHTS
app.get("/insights", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const now = new Date();
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Expenses this month
    const thisMonthExpenses = await Expense.find({
      userId,
      date: { $gte: firstDayThisMonth },
    });

    // Expenses last month
    const lastMonthExpenses = await Expense.find({
      userId,
      date: { $gte: firstDayLastMonth, $lte: lastDayLastMonth },
    });

    const thisTotal = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
    const lastTotal = lastMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

    const insights = [];

    // Spending trend
    if (lastTotal > 0) {
      const diff = ((thisTotal - lastTotal) / lastTotal) * 100;
      if (diff > 0) {
        insights.push({
          type: "spending_trend",
          message: `Your expenses increased by ${diff.toFixed(1)}% compared to last month.`,
          severity: "warning",
        });
      } else {
        insights.push({
          type: "spending_trend",
          message: `Your expenses decreased by ${Math.abs(diff).toFixed(1)}% compared to last month.`,
          severity: "success",
        });
      }
    }

    // Top category this month
    const categoryTotals = {};
    thisMonthExpenses.forEach((e) => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });

    const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
    if (topCategory) {
      insights.push({
        type: "top_category",
        message: `Most of your spending this month was on ${topCategory[0]} ($${topCategory[1]}).`,
        severity: "info",
      });
    }

    // Top subcategory (optional, if you want deeper detail)
    const subcategoryTotals = {};
    thisMonthExpenses.forEach((e) => {
      if (e.subcategory) {
        subcategoryTotals[e.subcategory] = (subcategoryTotals[e.subcategory] || 0) + e.amount;
      }
    });

    const topSub = Object.entries(subcategoryTotals).sort((a, b) => b[1] - a[1])[0];
    if (topSub) {
      insights.push({
        type: "top_subcategory",
        message: `Within ${topCategory[0]}, most was spent on ${topSub[0]} ($${topSub[1]}).`,
        severity: "info",
      });
    }

    res.json({ insights });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET ALL EXPENSES
app.get("/expenses", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();

    // --- Date ranges ---
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfThisMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23, 59, 59, 999
    );

    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23, 59, 59, 999
    );

    // --- Fetch expenses only ---
    const fetchExpenses = async (start, end) =>
      Expense.find({
        userId,
        date: { $gte: start, $lte: end },
      });

    const [thisMonthExpenses, lastMonthExpenses] = await Promise.all([
      fetchExpenses(startOfThisMonth, endOfThisMonth),
      fetchExpenses(startOfLastMonth, endOfLastMonth),
    ]);

    // --- Group by category + subcategory ---
    const groupByCategory = (items) =>
      items.reduce((acc, t) => {
        const category = t.category || "Other";
        const subcategory = t.subcategory || "Uncategorized";

        if (!acc[category]) {
          acc[category] = { total: 0, subcategories: [] };
        }

        acc[category].total += t.amount;
        acc[category].subcategories.push({
          name: subcategory,
          amount: t.amount,
          date: t.date,
          description: t.description || "",
        });

        return acc;
      }, {});

    const thisMonthGrouped = groupByCategory(thisMonthExpenses);
    const lastMonthGrouped = groupByCategory(lastMonthExpenses);

    const uniqueCategories = [
      ...new Set([
        ...Object.keys(thisMonthGrouped),
        ...Object.keys(lastMonthGrouped),
      ]),
    ];

    // --- Build response ---
    const results = uniqueCategories.map((category) => {
      const thisMonthData =
        thisMonthGrouped[category] || { total: 0, subcategories: [] };
      const lastMonthData =
        lastMonthGrouped[category] || { total: 0, subcategories: [] };

      const percentChange =
        lastMonthData.total > 0
          ? ((thisMonthData.total - lastMonthData.total) /
              lastMonthData.total) *
            100
          : thisMonthData.total > 0
          ? 100
          : 0;

      return {
        category,
        thisMonthTotal: thisMonthData.total,
        lastMonthTotal: lastMonthData.total,
        percentChange: Math.round(percentChange),
        subcategories: thisMonthData.subcategories,
      };
    });

    res.json({
      thisMonthRange: { start: startOfThisMonth, end: endOfThisMonth },
      lastMonthRange: { start: startOfLastMonth, end: endOfLastMonth },
      expenses: results,
    });
  } catch (error) {
    console.error("Expenses error:", error);
    res.status(500).json({ error: "Failed to fetch expenses" });
  }
});
// UPDATE EXPENSES
app.put("/expenses/:id", authMiddleware, async (req, res) => {
  try {
    const updated = await Expense.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: "Expense not found" });

    // If linked to a transaction, update its isActive status
    if (updated.transactionId) {
      await Transaction.findByIdAndUpdate(
        updated.transactionId,
        { isActive: updated.status === "paid" }
      );
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// DELETE EXPENSES
app.delete("/expenses/:category", authMiddleware, async (req, res) => {
  try {
    const { category } = req.params;

    // Delete all expenses for this user with this category
    const deleted = await Expense.deleteMany({ category, userId: req.user.id });

    if (deleted.deletedCount === 0) {
      return res.status(404).json({ error: "No expenses found for this category" });
    }

    res.json({ message: `${deleted.deletedCount} expense(s) deleted for category "${category}"` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// POST GOAL
app.post("/goals", authMiddleware, async (req, res) => {
  try {
    const goal = new Goal({ ...req.body, userId: req.user.id });
    await goal.save();
    res.status(201).json(goal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// UPDATE GOAL BY ID
app.put("/goals/:id", authMiddleware, async (req, res) => {
  try {
    const updated = await Goal.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "Goal not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// GET GOALS BY CATEGORY
app.get("/goals/categories", authMiddleware, async (req, res) => {
  try {
    // Find all goals for the authenticated user
    const goals = await Goal.find({ userId: req.user.id });

    // Extract unique categories
    const categories = Array.from(new Set(goals.map((g) => g.category)));

    res.status(200).json({ categories });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// GET GOALS BY YEAR MONTH AND CATEGORY
app.get("/goals/:year/:month/:category", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { year, month, category } = req.params;

    // Build query
    const query = {
      userId,
      year: Number(year),
      month: Number(month)
    };

    if (category) {
      query.category = category; // filter by category if provided
    }

    const goals = await Goal.find(query).populate("currencyId");

    const formatted = goals.map(g => ({
      id: g._id,
      title: g.title,
      targetAmount: g.targetAmount,
      presentAmount: g.presentAmount,
      progress: Number(((g.presentAmount / g.targetAmount) * 100).toFixed(2)),
      currency: g.currencyId?.symbol || "USD",
      category: g.category || null
    }));

    res.json(formatted);
  } catch (error) {
    console.error("Goals error:", error);
    res.status(500).json({ error: "Failed to fetch goals" });
  }
});
// GET ALL GOALS
app.get("/goals", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch all user's goals
    const goals = await Goal.find({ userId }).populate("currencyId");

    // Group by year -> month
    const grouped = {};

    goals.forEach(g => {
      const year = g.year;
      const month = g.month; // 0 = Jan, 1 = Feb, etc.

      if (!grouped[year]) grouped[year] = {};
      if (!grouped[year][month]) grouped[year][month] = [];

      grouped[year][month].push({
        id: g._id,
        title: g.title,
        targetAmount: g.targetAmount,
        presentAmount: g.presentAmount,
        progress: Number(((g.presentAmount / g.targetAmount) * 100).toFixed(2)),
        currency: g.currencyId?.symbol || "USD",
        category: g.category || null
      });
    });

    res.json(grouped);
  } catch (error) {
    console.error("Goals error:", error);
    res.status(500).json({ error: "Failed to fetch goals" });
  }
});
// DELETE GOAL BY ID
app.delete("/goals/:id", authMiddleware, async (req, res) => {
  try {
    const deleted = await Goal.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!deleted) {
      return res.status(404).json({ error: "Goal not found" });
    }

    res.json({ message: "Goal deleted successfully" });
  } catch (error) {
    console.error("Delete goal error:", error);
    res.status(500).json({ error: "Failed to delete goal" });
  }
});



// SERVER START
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));