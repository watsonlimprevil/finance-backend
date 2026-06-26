import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRouter from './routes/auth.js';
import transactionsRouter from './routes/transactions.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// AUTH ROUTES
app.use('/auth', authRouter);

// TRANSACTION ROUTES
app.use('/transactions', transactionsRouter);

app.listen(5000, () => {
  console.log('Finance backend running on port 5000');
});


console.log("JWT_SECRET:", process.env.JWT_SECRET);
