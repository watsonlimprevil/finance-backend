import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRouter from './routes/auth.js';
import transactionsRouter from './routes/transactions.js';

dotenv.config();

const app = express();

// FIXED CORS
app.use(cors({
    origin: [
        'http://localhost:5173',
        'https://finance-frontend-sandy-gamma.vercel.app'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// ROUTES
app.use('/auth', authRouter);
app.use('/transactions', transactionsRouter);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () =>{
    console.log(`Finance backend running on port ${PORT}`)
});

console.log("JWT_SECRET:", process.env.JWT_SECRET);
