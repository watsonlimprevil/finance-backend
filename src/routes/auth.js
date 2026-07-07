import express from 'express';
import bcrypt from 'bcrypt';
import pool from '../db.js';
import cors from 'cors'
const router = express.Router();


router.use(cors({
  origin: [
    "http://localhost:5173",
    "https://finance-frontend-sandy-gamma.vercel.app"
  ],
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
// REGISTER
router.post('/register', async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Check if user exists
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    // 2. Hash password
    const hash = await bcrypt.hash(password, 10);

    // 3. Insert user
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, hash]
    );

    // 4. Return user
    res.status(201).json({ user: result.rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

import jwt from 'jsonwebtoken';

// LOGIN
router.post('/login', async (req, res) => {
  console.log("LOGIN ROUTE HIT");

  const { email, password } = req.body;

  try {
    // 1. Find user
    const result = await pool.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // 2. Compare password 
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // 3. Create JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 4. Return token + user
    res.json({
      token,
      user: { id: user.id, email: user.email }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


export default router;
