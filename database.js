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
        time_limit INT DEFAULT 300,
        twist_enabled BOOLEAN DEFAULT false,
        twist_message TEXT DEFAULT '문제를 전부 다 풀었습니다\n수고하셨습니',
        twist_pause_ms INT DEFAULT 2000,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        quiz_id INT REFERENCES quizzes(id) ON DELETE CASCADE,
        order_num INT NOT NULL,
        text TEXT NOT NULL,
        type TEXT DEFAULT 'choice',
        is_twist BOOLEAN DEFAULT false,
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

      -- 기존 테이블에 새 컬럼 추가 (이미 있으면 무시)
      DO $$ BEGIN
        ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS time_limit INT DEFAULT 300;
        ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS twist_enabled BOOLEAN DEFAULT false;
        ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS twist_message TEXT DEFAULT '문제를 전부 다 풀었습니다\n수고하셨습니';
        ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS twist_pause_ms INT DEFAULT 2000;
        ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_twist BOOLEAN DEFAULT false;
        ALTER TABLE responses ADD COLUMN IF NOT EXISTS text_answer TEXT;
      END $$;
    `);
    console.log('DB 테이블 초기화 완료');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
