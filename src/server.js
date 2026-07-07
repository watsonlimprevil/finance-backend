import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRouter from './routes/auth.js';
import transactionsRouter from './routes/transactions.js';

dotenv.config();

const app = express();

// ⭐ GLOBAL CORS — MUST be first
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://finance-frontend-sandy-gamma.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ⭐ GLOBAL REQUEST LOGGER — tells us if ANY request reaches Express
app.use((req, res, next) => {
  console.log("REQUEST:", req.method, req.url);
  next();
});

// ⭐ JSON parser
app.use(express.json());

// ⭐ ROUTES
app.use('/auth', authRouter);
app.use('/transactions', transactionsRouter);

// ⭐ PORT
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Finance backend running on port ${PORT}`);
});
