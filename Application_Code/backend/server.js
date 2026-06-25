const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');

const app = express();
app.use(express.json());
app.use(cors());

let db;

const VALID_STATUSES = ['todo', 'inprogress', 'done'];

// ─────────────────────────────────────────────
// 🔐 Fetch Secrets from AWS SSM Parameter Store
// ─────────────────────────────────────────────
const ssmClient = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' });

const getSSMParameter = async (name) => {
  const command = new GetParameterCommand({ Name: name, WithDecryption: true });
  const response = await ssmClient.send(command);
  return response.Parameter.Value;
};

const loadDBConfig = async () => {
  console.log('🔐 Fetching DB config from SSM Parameter Store...');
  const [host, user, password, database] = await Promise.all([
    getSSMParameter('/myapp/db/host'),
    getSSMParameter('/myapp/db/name'),
    getSSMParameter('/myapp/db/password'),
    getSSMParameter('/myapp/db/user'),
  ]);
  console.log('✅ SSM parameters loaded successfully');
  return { host, user, password, database };
};

// ─────────────────────────────────────────────
// 🔁 MySQL Connection with Retry Logic
// ─────────────────────────────────────────────
const connectWithRetry = async (dbConfig, retries = 10, delay = 3000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const pool = await mysql.createPool({
        host: dbConfig.host,
        user: dbConfig.user,
        password: dbConfig.password,
        database: dbConfig.database,
        connectionLimit: 10,
        ssl: { rejectUnauthorized: false }
      });
      console.log(`✅ Connected to MySQL (Attempt ${attempt})`);
      return pool;
    } catch (error) {
      console.error(`❌ MySQL connection failed (Attempt ${attempt}/${retries}):`, error.message);
      if (attempt === retries) throw error;
      console.log(`Retrying in ${delay / 1000}s...`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
};

// ─────────────────────────────────────────────
// 🧱 Ensure Required Tables Exist
// ─────────────────────────────────────────────
const ensureTables = async (db) => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'todo',
        due_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tables ensured successfully (tasks)');
  } catch (error) {
    console.error('❌ Error ensuring tables:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────
// 🌱 Seed Sample Tasks
// ─────────────────────────────────────────────
const seedSampleTasks = async () => {
  try {
    const [rows] = await db.query('SELECT COUNT(*) as cnt FROM tasks');
    if ((rows[0].cnt || 0) === 0) {
      console.log('Seeding sample tasks...');
      const sample = [
        ['Buy groceries', 'Milk, eggs, bread', 'todo', null],
        ['Finish report', 'Finalize quarterly report', 'inprogress', null],
        ['Call Alice', 'Discuss project roadmap', 'todo', null],
      ];
      for (const s of sample) {
        await db.query(
          'INSERT INTO tasks (title, description, status, due_date) VALUES (?, ?, ?, ?)',
          s
        );
      }
      console.log('✅ Sample tasks inserted');
    }
  } catch (err) {
    console.error('Error seeding tasks:', err.message);
  }
};

// ─────────────────────────────────────────────
// 🔧 Utility
// ─────────────────────────────────────────────
const getTaskById = async (id) => {
  const [rows] = await db.query('SELECT * FROM tasks WHERE id = ?', [id]);
  return rows[0] || null;
};

const isValidId = (id) => !isNaN(id) && Number.isInteger(Number(id)) && Number(id) > 0;

// ─────────────────────────────────────────────
// ✅ Health Routes
// ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  return res.status(200).json({
    status: 'ok',
    service: 'backend',
    uptime: process.uptime()
  });
});

// DB health — no sensitive info exposed
app.get('/health/db', async (req, res) => {
  try {
    await db.query('SELECT 1');
    return res.status(200).json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('DB health check failed:', error.message);
    return res.status(500).json({ status: 'error', database: 'down' });
  }
});

// ─────────────────────────────────────────────
// 📋 Task Routes
// ─────────────────────────────────────────────

// Root info
app.get('/', async (req, res) => {
  try {
    const [data] = await db.query('SELECT * FROM tasks ORDER BY id');
    return res.json({ message: 'Task Manager Backend', tasks: data });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return res.status(500).json({ error: 'Error fetching tasks' });
  }
});

// List all tasks
app.get('/tasks', async (req, res) => {
  try {
    const [data] = await db.query('SELECT * FROM tasks ORDER BY id');
    return res.json(data);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Get single task
app.get('/tasks/:id', async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ error: 'Invalid task ID' });

  try {
    const task = await getTaskById(id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    return res.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    return res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// Create task
app.post('/tasks', async (req, res) => {
  try {
    const { title, description = null, status = 'todo', due_date = null } = req.body;

    // Validate title
    if (!title || typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Validate status
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const [result] = await db.query(
      'INSERT INTO tasks (title, description, status, due_date) VALUES (?, ?, ?, ?)',
      [title.trim(), description, status, due_date]
    );

    const inserted = await getTaskById(result.insertId);
    return res.status(201).json(inserted);
  } catch (error) {
    console.error('Error creating task:', error);
    return res.status(500).json({ error: 'Error creating task' });
  }
});

// Update task
app.put('/tasks/:id', async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ error: 'Invalid task ID' });

  try {
    const { title, description, status, due_date } = req.body;

    // Validate title if provided
    if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
      return res.status(400).json({ error: 'Title cannot be empty' });
    }

    // Validate status if provided
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const existing = await getTaskById(id);
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    await db.query(
      'UPDATE tasks SET title = ?, description = ?, status = ?, due_date = ? WHERE id = ?',
      [
        title !== undefined ? title.trim() : existing.title,
        description !== undefined ? description : existing.description,
        status !== undefined ? status : existing.status,
        due_date !== undefined ? due_date : existing.due_date, // allows clearing due_date with null
        id
      ]
    );

    const updated = await getTaskById(id);
    return res.json(updated);
  } catch (error) {
    console.error('Error updating task:', error);
    return res.status(500).json({ error: 'Error updating task' });
  }
});

// Delete task
app.delete('/tasks/:id', async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ error: 'Invalid task ID' });

  try {
    const existing = await getTaskById(id);
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    await db.query('DELETE FROM tasks WHERE id = ?', [id]);
    return res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    return res.status(500).json({ error: 'Error deleting task' });
  }
});

// ─────────────────────────────────────────────
// 🔴 404 & Global Error Handler
// ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─────────────────────────────────────────────
// 🚀 Bootstrap
// ─────────────────────────────────────────────
(async () => {
  try {
    const dbConfig = await loadDBConfig();
    db = await connectWithRetry(dbConfig);
    await ensureTables(db);
    await seedSampleTasks();

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    process.on('SIGINT', async () => {
      console.log('\n🛑 Closing MySQL pool...');
      await db.end();
      process.exit(0);
    });

    app.listen(3500, () => {
      console.log('🚀 Server running on port 3500');
    });

  } catch (error) {
    console.error('❌ Fatal: Could not start server. DB connection failed.', error);
    process.exit(1);
  }
})();