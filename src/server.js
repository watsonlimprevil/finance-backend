import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRouter from './routes/auth.js';
import transactionsRouter from './routes/transactions.js';


dotenv.config();


const app = express();
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      "http://localhost:5173",
      /\.vercel\.app$/   // allow ANY Vercel deployment
    ];

    if (!origin) {
      return callback(null, true);
    }

    const isAllowed = allowed.some(rule => {
      if (rule instanceof RegExp) return rule.test(origin);
      return rule === origin;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
// AUTH ROUTES
app.use('/auth', authRouter);

// TRANSACTION ROUTES
app.use('/transactions', transactionsRouter);

app.listen(5000, () => {
  console.log('Finance backend running on port 5000');
});


console.log("JWT_SECRET:", process.env.JWT_SECRET);
