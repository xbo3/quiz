const express = require('express');
const cors = require('cors');
const path = require('path');
const { pool, initDB } = require('./database');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// 퀴즈 관리 API (어드민)
// ============================================

// 퀴즈 목록
app.get('/api/quizzes', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM quizzes ORDER BY created_at DESC'
  );
  res.json(rows);
});

// 퀴즈 생성
app.post('/api/quizzes', async (req, res) => {
  const { title, description } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO quizzes (title, description) VALUES ($1, $2) RETURNING *',
    [title, description || '']
  );
  res.json(rows[0]);
});

// 퀴즈 상세 (문제+선택지 포함)
app.get('/api/quizzes/:id', async (req, res) => {
  const { id } = req.params;
  const quiz = await pool.query('SELECT * FROM quizzes WHERE id = $1', [id]);
  if (quiz.rows.length === 0) return res.status(404).json({ error: '퀴즈 없음' });

  const questions = await pool.query(
    'SELECT * FROM questions WHERE quiz_id = $1 ORDER BY order_num', [id]
  );

  const qIds = questions.rows.map(q => q.id);
  let choices = [];
  if (qIds.length > 0) {
    const result = await pool.query(
      'SELECT * FROM choices WHERE question_id = ANY($1) ORDER BY order_num', [qIds]
    );
    choices = result.rows;
  }

  const data = {
    ...quiz.rows[0],
    questions: questions.rows.map(q => ({
      ...q,
      choices: choices.filter(c => c.question_id === q.id)
    }))
  };
  res.json(data);
});

// 퀴즈 수정
app.put('/api/quizzes/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, is_active, time_limit, twist_enabled, twist_message, twist_pause_ms } = req.body;
  const { rows } = await pool.query(
    `UPDATE quizzes SET title=COALESCE($1,title), description=COALESCE($2,description),
     is_active=COALESCE($3,is_active), time_limit=COALESCE($4,time_limit),
     twist_enabled=COALESCE($5,twist_enabled), twist_message=COALESCE($6,twist_message),
     twist_pause_ms=COALESCE($7,twist_pause_ms) WHERE id=$8 RETURNING *`,
    [title, description, is_active, time_limit, twist_enabled, twist_message, twist_pause_ms, id]
  );
  res.json(rows[0]);
});

// 퀴즈 삭제
app.delete('/api/quizzes/:id', async (req, res) => {
  await pool.query('DELETE FROM quizzes WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ============================================
// 문제 API
// ============================================

app.post('/api/questions', async (req, res) => {
  const { quiz_id, text, type, order_num, is_twist } = req.body;
  const ord = order_num ?? (await pool.query(
    'SELECT COALESCE(MAX(order_num), 0) + 1 as next FROM questions WHERE quiz_id = $1', [quiz_id]
  )).rows[0].next;
  const { rows } = await pool.query(
    'INSERT INTO questions (quiz_id, order_num, text, type, is_twist) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [quiz_id, ord, text, type || 'choice', is_twist || false]
  );
  res.json(rows[0]);
});

app.put('/api/questions/:id', async (req, res) => {
  const { text, type, order_num, is_twist } = req.body;
  const { rows } = await pool.query(
    'UPDATE questions SET text=COALESCE($1,text), type=COALESCE($2,type), order_num=COALESCE($3,order_num), is_twist=COALESCE($4,is_twist) WHERE id=$5 RETURNING *',
    [text, type, order_num, is_twist, req.params.id]
  );
  res.json(rows[0]);
});

app.delete('/api/questions/:id', async (req, res) => {
  await pool.query('DELETE FROM questions WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ============================================
// 선택지 API
// ============================================

app.post('/api/choices', async (req, res) => {
  const { question_id, label, text, media_url, media_type, is_correct, order_num } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO choices (question_id, label, text, media_url, media_type, is_correct, order_num) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [question_id, label, text, media_url || null, media_type || 'video', is_correct || false, order_num || 0]
  );
  res.json(rows[0]);
});

app.put('/api/choices/:id', async (req, res) => {
  const { label, text, media_url, media_type, is_correct, order_num } = req.body;
  const { rows } = await pool.query(
    'UPDATE choices SET label=COALESCE($1,label), text=COALESCE($2,text), media_url=COALESCE($3,media_url), media_type=COALESCE($4,media_type), is_correct=COALESCE($5,is_correct), order_num=COALESCE($6,order_num) WHERE id=$7 RETURNING *',
    [label, text, media_url, media_type, is_correct, order_num, req.params.id]
  );
  res.json(rows[0]);
});

app.delete('/api/choices/:id', async (req, res) => {
  await pool.query('DELETE FROM choices WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ============================================
// 퀴즈 플레이 API (사용자용)
// ============================================

app.get('/api/play/:quiz_id', async (req, res) => {
  const { quiz_id } = req.params;
  const quiz = await pool.query(
    'SELECT * FROM quizzes WHERE id = $1 AND is_active = true', [quiz_id]
  );
  if (quiz.rows.length === 0) return res.status(404).json({ error: '퀴즈 없음' });

  const questions = await pool.query(
    'SELECT id, order_num, text, type, is_twist FROM questions WHERE quiz_id = $1 ORDER BY order_num', [quiz_id]
  );

  const qIds = questions.rows.map(q => q.id);
  let choices = [];
  if (qIds.length > 0) {
    const result = await pool.query(
      'SELECT id, question_id, label, text, media_url, media_type, order_num FROM choices WHERE question_id = ANY($1) ORDER BY order_num',
      [qIds]
    );
    choices = result.rows;
  }

  res.json({
    ...quiz.rows[0],
    questions: questions.rows.map(q => ({
      ...q,
      choices: choices.filter(c => c.question_id === q.id)
    }))
  });
});

// 답 제출 (참여 기록)
app.post('/api/play/:quiz_id/answer', async (req, res) => {
  const { quiz_id } = req.params;
  const { question_id, choice_id, session_id, text_answer } = req.body;
  await pool.query(
    'INSERT INTO responses (quiz_id, question_id, choice_id, session_id, text_answer) VALUES ($1,$2,$3,$4,$5)',
    [quiz_id, question_id, choice_id || null, session_id, text_answer || null]
  );
  res.json({ ok: true });
});

// ============================================
// embed 라우트
// ============================================

app.get('/embed/:quiz_id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// 서버 시작
// ============================================

const PORT = process.env.PORT || 3000;

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`퀴즈 서버 실행 중: http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('DB 초기화 실패:', err);
  process.exit(1);
});
