const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS quizzes (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        quiz_id INT REFERENCES quizzes(id) ON DELETE CASCADE,
        order_num INT NOT NULL,
        text TEXT NOT NULL,
        type TEXT DEFAULT 'choice',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS choices (
        id SERIAL PRIMARY KEY,
        question_id INT REFERENCES questions(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        text TEXT NOT NULL,
        media_url TEXT,
        media_type TEXT DEFAULT 'video',
        is_correct BOOLEAN DEFAULT false,
        order_num INT DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS responses (
        id SERIAL PRIMARY KEY,
        quiz_id INT,
        question_id INT,
        choice_id INT,
        session_id TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('DB 테이블 초기화 완료');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
