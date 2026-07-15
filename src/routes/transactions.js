import { Router } from "express";
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
  const userId = req.user.userId; // from JWT

  try {
    const result = await pool.query(
      `INSERT INTO transactions (amount, type, category, date, description, user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [amount, type, category, date, description, userId]
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
  const userId = req.user.userId;

  try {
    // 1. Total income + expenses
    const totalsQuery = `
      SELECT 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expenses
      FROM transactions
      WHERE user_id = $1
    `;
    const totals = await pool.query(totalsQuery, [userId]);
    const income = Number(totals.rows[0].income) || 0;
    const expenses = Number(totals.rows[0].expenses) || 0;

    // 2. Category breakdown
    const categoryQuery = `
      SELECT category, SUM(amount) AS total
      FROM transactions
      WHERE user_id = $1
      GROUP BY category
      ORDER BY total DESC
    `;
    const byCategory = await pool.query(categoryQuery, [userId]);

    // 3. This month summary
    const thisMonthQuery = `
      SELECT
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expenses
      FROM transactions
      WHERE user_id = $1
      AND date >= date_trunc('month', CURRENT_DATE)
    `;
    const thisMonth = await pool.query(thisMonthQuery, [userId]);
    const thisMonthIncome = Number(thisMonth.rows[0].income) || 0;
    const thisMonthExpenses = Number(thisMonth.rows[0].expenses) || 0;

    // 4. Last 30 days summary
    const last30Query = `
      SELECT
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expenses
      FROM transactions
      WHERE user_id = $1
      AND date >= CURRENT_DATE - INTERVAL '30 days'
    `;
    const last30 = await pool.query(last30Query, [userId]);
    const last30Income = Number(last30.rows[0].income) || 0;
    const last30Expenses = Number(last30.rows[0].expenses) || 0;

    res.json({
      income,
      expenses,
      net: income - expenses,
      byCategory: byCategory.rows.map(c => ({
        category: c.category,
        total: Number(c.total)
      })),
      thisMonth: {
        income: thisMonthIncome,
        expenses: thisMonthExpenses,
        net: thisMonthIncome - thisMonthExpenses
      },
      last30Days: {
        income: last30Income,
        expenses: last30Expenses,
        net: last30Income - last30Expenses
      }
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
      ORDER BY month ASC
      `,
      [userId]
    );

    res.json({ trends: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get('/search', requireAuth, async (req, res) => {
  const userId = req.user.userId;
  const { q } = req.query;

  if (!q || q.trim() === '') {
    return res.json({ results: [] });
  }

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM transactions
      WHERE user_id = $1
      AND (
        LOWER(description) LIKE LOWER($2)
        OR LOWER(category) LIKE LOWER($2)
      )
      ORDER BY date DESC
      `,
      [userId, `%${q}%`]
    );

    res.json({ results: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/budgets' , requireAuth , async(req,res)=>{
  const userId = req.user.userId;
  try{
const result = await pool.query(
  `SELECT * FROM budgets 
  WHERE user_id =$1 
  ORDER BY category ASC` ,
  [userId]
)
res.json({budgets: result.rows});
  }catch(error){
console.error(error)
res.status(500).json({error: 'Server error'})
  }
})

router.post('/budgets' , requireAuth , async(req, res)=>{
  const userId = req.user.userId;
  const{category , amount} = req.body;
  if(!amount || amount <=0){
    return res.status(400).json({error: 'Invalid budget'})
  }

  try{
const result = await pool.query(
  `INSERT INTO budgets (user_id , category, amount) 
  VALUES ($1 , $2 , $3) 
  RETURNING *` ,
  [userId , category || null , amount]
)

res.json({budget: result.rows[0]})
  }catch(err){
console.error(err);
res.status(500).json({error: 'Server error'})
  }
})

router.put('/budgets/:id' , requireAuth , async(req,res)=>{
  const userId = req.user.userId;
  const {id} = req.params;
  const {amount} = req.body;
  if(!amount || amount <=0){
    return res.status(400).json({error: 'Invalid budget data'})
  }

  try{
const result = await pool.query(
  `UPDATE budgets 
  SET amount = $1 
  WHERE id=$2 AND user_id =$3 
  RETURNING *` , [amount , id , userId]
)

res.json({budget : result.rows[0]})
  }catch(err){
console.error(err)
res.status(500).json({error : 'Server error'})
  }
})


router.delete('/budgets/:id' , requireAuth , async(req,res)=>{
  const userId = req.user.userId;
  const {id} = req.params;

  try{
await pool.query(
  `DELETE FROM budgets 
  WHERE id=$1 AND user_id = $2`,
  [id, userId]
)
res.json({success: true});
  }catch(error){
console.error(error);
res.status(500).json({error: 'Server error'})
  }
})

router.get('/budgets/progress', requireAuth, async (req, res) => {
  const userId = req.user.userId;

  try {
    // 1. Fetch all budgets
    const budgetsRes = await pool.query(
      `SELECT * FROM budgets WHERE user_id = $1`,
      [userId]
    );
    const budgets = budgetsRes.rows;

    // Separate monthly budget (category = null)
    const monthlyBudget = budgets.find(b => b.category === null);

    // 2. Calculate total expenses for the current month
    const expensesRes = await pool.query(
      `
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM transactions
      WHERE user_id = $1
      AND type = 'expense'
      AND date >= date_trunc('month', CURRENT_DATE)
      `,
      [userId]
    );
    const monthlyExpenses = Number(expensesRes.rows[0].total);

    // 3. Calculate category expenses for the current month
    const categoryRes = await pool.query(
      `
      SELECT category, COALESCE(SUM(amount), 0) AS total
      FROM transactions
      WHERE user_id = $1
      AND type = 'expense'
      AND date >= date_trunc('month', CURRENT_DATE)
      GROUP BY category
      `,
      [userId]
    );
    const categoryTotals = categoryRes.rows;

    // 4. Build progress results
    const progress = {
      monthly: null,
      categories: []
    };

    // Monthly budget progress
    if (monthlyBudget) {
      const amount = Number(monthlyBudget.amount);
      const percent = amount === 0 ? 0 : Math.min((monthlyExpenses / amount) * 100, 100);

      progress.monthly = {
        budget: amount,
        spent: monthlyExpenses,
        remaining: Math.max(amount - monthlyExpenses, 0),
        percent: percent,
        exceeded: monthlyExpenses > amount
      };
    }

    // Category budget progress
    for (const b of budgets) {
      if (!b.category) continue; // skip monthly budget

      const amount = Number(b.amount);
      const categoryTotal = categoryTotals.find(c => c.category === b.category);
      const spent = categoryTotal ? Number(categoryTotal.total) : 0;

      const percent = amount === 0 ? 0 : Math.min((spent / amount) * 100, 100);

      progress.categories.push({
        category: b.category,
        budget: amount,
        spent,
        remaining: Math.max(amount - spent, 0),
        percent,
        exceeded: spent > amount
      });
    }

    res.json({ progress });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete('/reset' , async(req,res) =>{
  try{
   await pool.query("DELETE FROM transactions");
   await pool.query("DELETE FROM category_budgets")
   await pool.query("DELETE FROM monthly_budget")
    res.json({message : 'All data has been reset.'})
  }catch(error){
    console.error(error);
    res.status(500).json({error : 'Failed to reset data '})

  }
})

router.patch('/budgets/monthly' ,requireAuth, async(req,res)=>{
  try{
    const userId = req.user.userId
    const {budget} = req.body;
    if(!budget || isNaN(budget)){
      return res.status(400).json({error: 'invalid budget number'})
    }
    await pool.query(
      'UPDATE monthly_budget SET amount = $1 WHERE id = $2' ,
      [budget , userId]
    )
  }catch(error){
    console.error(error);
    res.status(500).json({error: 'Failed to update monthly budget'})
  }
})

export default router;
