import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const poolConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      user: process.env.PGUSER || 'postgres',
      host: process.env.PGHOST || 'localhost',
      database: process.env.PGDATABASE || 'jagobridge',
      password: process.env.PGPASSWORD || 'postgres',
      port: Number(process.env.PGPORT) || 5432,
    };

export const pool = new Pool(poolConfig);

// Test database connection
export const checkDbConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, current_database() as database_name');
    client.release();
    return {
      connected: true,
      time: result.rows[0].current_time,
      database: result.rows[0].database_name,
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message,
    };
  }
};

export const query = (text, params) => pool.query(text, params);
