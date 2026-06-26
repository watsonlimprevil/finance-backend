import 'dotenv/config';
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
console.log("DATABASE_URL:", process.env.DATABASE_URL);
export default pool;
