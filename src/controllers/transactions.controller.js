import pool from "../db.js";

// GET /transactions (only this user's transactions)
export async function getTransactions(req, res) {
  try {
    const userId = req.user.userId; // comes from JWT

    const result = await pool.query(
      'SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC',
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
}

// POST /transactions (create a transaction for this user)
export async function addTransactions(req,res){
  const userId = req.user.userId;
  const{amount, type, category, date , description} = req.body;

  if(!amount || isNaN(amount)){
    return res.status(400).json({error: 'Amount must be a number'})
  }

  if(amount <=0){
    return res.status(400).json({error: 'Amount must be greater than Zero'})
  }

  if(!type || (type !=='income' && type !=='expense')){
    return res.status(400).json({error: 'Type must income or expense'})
  }

  if(!category || category.trim() === ''){
    return res.status(400).json({error: 'category is required'})
  }

  if(!date || isNaN(Date.parse(date))){
    return res.status(400).json({error: 'Invalid date format'})
  }
  if(!description || description.trim()===''){
    return res.status(400).json({error: 'Description is required'})
  }
  try{
const result = await pool.query(
  `INSERT INTO transactions (amount, type , category, date, description, user_id)
  VALUES($1, $2, $3 , $4, $5, $6)
  RETURNING *
  `, [amount, type, category , date , description, userId]
)
return res.status(201).json(result.rows[0])
  }catch(error){
console.error(error)
return res.status(500).json({error: 'Failed to add transaction'})
  }
}