import { Router } from "express";
import { getTransactions, addTransactions } from "../controllers/transactions.controller.js";
import { requireAuth } from "../middleware/authe.js";
import pool from "../db.js";
const router = Router();

// PROTECTED ROUTES
router.get("/", requireAuth, async (req, res) => {
  const userId = req.user.userId;

  const { 
    type, 
    category, 
    sort, 
    order, 
    page = 1, 
    limit = 10,
    startDate,
    endDate
  } = req.query;

  const offset = (page - 1) * limit;

  // Base query
  let query = `SELECT * FROM transactions WHERE user_id = $1`;
  let params = [userId];

  // Filter by type
  if (type) {
    params.push(type);
    query += ` AND type = $${params.length}`;
  }

  // Filter by category
  if (category) {
    params.push(category);
    query += ` AND category = $${params.length}`;
  }

  // Filter by startDate
  if (startDate) {
    params.push(startDate);
    query += ` AND date >= $${params.length}`;
  }

  // Filter by endDate
  if (endDate) {
    params.push(endDate);
    query += ` AND date <= $${params.length}`;
  }

  // Sorting
  if (sort) {
    const validSort = ["date", "amount"];
    if (validSort.includes(sort)) {
      const direction = order === "asc" ? "ASC" : "DESC";
      query += ` ORDER BY ${sort} ${direction}`;
    }
  } else {
    query += ` ORDER BY date DESC`;
  }

  // Pagination
  params.push(limit, offset);
  query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

  try {
    const result = await pool.query(query, params);

    // Count query (must match filters)
    let countQuery = `SELECT COUNT(*) FROM transactions WHERE user_id = $1`;
    let countParams = [userId];

    if (type) {
      countParams.push(type);
      countQuery += ` AND type = $${countParams.length}`;
    }

    if (category) {
      countParams.push(category);
      countQuery += ` AND category = $${countParams.length}`;
    }

    if (startDate) {
      countParams.push(startDate);
      countQuery += ` AND date >= $${countParams.length}`;
    }

    if (endDate) {
      countParams.push(endDate);
      countQuery += ` AND date <= $${countParams.length}`;
    }

    const countResult = await pool.query(countQuery, countParams);

res.json({
  transactions: result.rows,
  total: Number(countResult.rows[0].count),
  page: Number(page),
  limit: Number(limit)
});

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});





router.post('/', requireAuth, async (req, res) => {
  const { amount, type, category, date, description } = req.body;
  const parsedDate = new Date(date);

  const userId = req.user.userId; // from JWT
  if(amount === undefined || amount === null || isNaN(amount)){
    return res.status(400).json({error: 'Amount must be a valid number'})
  }

  if(Number(amount)<=0){
    return res.status(400).json({error : 'Amount must be greater than zero'})
  }


if(!category || category.trim() === ''){
  return res.status(400).json({error : 'Category is required'})
}

if(!parsedDate || isNaN(parsedDate.getTime())){
  return res.status(400).json({error: 'Invalid date format'})
}

if(!description || description.trim() === ''){
  return res.status(400).json({error: 'description is required'})
}
if(!['income', 'expense'.includes(type)]){
  return res.status(400).json({error:'type must either be income or expense'})
}
  try {
    const result = await pool.query(
      `INSERT INTO transactions (amount, type, category, date, description, user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [amount, type, category, parsedDate, description, userId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;
console.log("DELETE route hit:", id, userId);
  try {
    const result = await pool.query(
      `DELETE FROM transactions
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put('/:id' , requireAuth, async(req, res)=>{
    const {id} = req.params;
    const userId = req.user.userId;
    const {amount , type , category , date , description, } = req.body;
    try{
    const result = await pool.query(
      `UPDATE transactions
       SET amount = $1, type = $2, category = $3, date = $4, description = $5
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [amount, type, category, date, description, id, userId]
    );

    if(result.rows.length === 0){
        return res.status(404).json({error: 'Transaction not found'})
    }
    res.json(result.rows[0])
    }catch(err){
console.error(err)
res.status(500).json({error: 'Server error'})
    }
})

router.get("/summary/monthly", requireAuth, async (req, res) => {
  const userId = req.user.userId;

  try {
    // Total income
    const income = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM transactions
       WHERE user_id = $1 AND type = 'income'
         AND date >= date_trunc('month', CURRENT_DATE)`,
      [userId]
    );

    // Total expenses
    const expense = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM transactions
       WHERE user_id = $1 AND type = 'expense'
         AND date >= date_trunc('month', CURRENT_DATE)`,
      [userId]
    );

    // Category breakdown
    const byCategory = await pool.query(
      `SELECT category, SUM(amount) AS total
       FROM transactions
       WHERE user_id = $1
         AND date >= date_trunc('month', CURRENT_DATE)
       GROUP BY category
       ORDER BY total DESC`,
      [userId]
    );

    res.json({
      income: Number(income.rows[0].total),
      expense: Number(expense.rows[0].total),
      net: Number(income.rows[0].total) - Number(expense.rows[0].total),
      byCategory: byCategory.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});
router.get("/summary", requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Fetch all transactions for this user
    const { rows: transactions } = await pool.query(
      "SELECT * FROM transactions WHERE user_id = $1 ORDER BY date ASC",
      [userId]
    );

    // Helper functions
    const sum = arr => arr.reduce((a, b) => a + Number(b), 0);

    const income = sum(transactions.filter(t => t.type === "income").map(t => t.amount));
    const expenses = sum(transactions.filter(t => t.type === "expense").map(t => t.amount));
    const net = income - expenses;

    // Date helpers
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // This month
    const thisMonthTx = transactions.filter(t => new Date(t.date) >= startOfMonth);
    const thisMonthIncome = sum(thisMonthTx.filter(t => t.type === "income").map(t => t.amount));
    const thisMonthExpenses = sum(thisMonthTx.filter(t => t.type === "expense").map(t => t.amount));

    // Last 30 days
    const last30Tx = transactions.filter(t => new Date(t.date) >= last30);
    const last30Income = sum(last30Tx.filter(t => t.type === "income").map(t => t.amount));
    const last30Expenses = sum(last30Tx.filter(t => t.type === "expense").map(t => t.amount));

    // Highest category
    const categoryTotals = {};
    for (const t of transactions) {
      if (!categoryTotals[t.category]) categoryTotals[t.category] = 0;
      categoryTotals[t.category] += Number(t.amount);
    }

    const highestCategoryEntry = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])[0];

    const highestCategory = highestCategoryEntry
      ? { category: highestCategoryEntry[0], total: highestCategoryEntry[1] }
      : { category: null, total: 0 };

    // Average daily spending (last 30 days)
    const avgDaily = last30Expenses / 30;

    // Category breakdown array
    const byCategory = Object.entries(categoryTotals).map(([category, total]) => ({
      category,
      total
    }));

    res.json({
      income,
      expenses,
      net,
      thisMonth: {
        income: thisMonthIncome,
        expenses: thisMonthExpenses,
        net: thisMonthIncome - thisMonthExpenses
      },
      last30Days: {
        income: last30Income,
        expenses: last30Expenses,
        net: last30Income - last30Expenses
      },
      highestCategory,
      averageDailySpending: Number(avgDaily.toFixed(2)),
      count: transactions.length,
      byCategory
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


router.get("/trends", requireAuth, async (req, res) => {
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      `
      SELECT 
        TO_CHAR(date, 'YYYY-MM') AS month,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expenses
      FROM transactions
      WHERE user_id = $1
      GROUP BY month
      ORDER BY month DESC
      LIMIT 6
      `,
      [userId]
    );

    const rows = result.rows.reverse(); // oldest → newest

    const trends = rows.map(r => ({
      month: r.month,
      income: Number(r.income),
      expenses: Number(r.expenses),
      net: Number(r.income) - Number(r.expenses)
    }));

    res.json({ trends });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
