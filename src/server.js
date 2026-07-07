import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRouter from './routes/auth.js';
import transactionsRouter from './routes/transactions.js';

dotenv.config();

const app = express();

app.use(cors({
  origin:[
    'http://localhost:5173',
    'https://finance-frontend-sandy-gamma.vercel.app'
  ],

  credentials:true
}));

app.use(express.json());

// AUTH ROUTES
app.use('/auth', authRouter);

// TRANSACTION ROUTES
app.use('/transactions', transactionsRouter);

const Port = process.env.PORT || 5000;

app.listen(PORT, () =>{
  console.log(`Fimance backend running on port ${Port}`)
})

console.log("JWT_SECRET:", process.env.JWT_SECRET);
