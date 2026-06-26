const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const dotenv = require('dotenv');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const ssmClient = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' });

// ---- SSM Helper ----
const getSSMParameter = async (name) => {
  const command = new GetParameterCommand({ Name: name, WithDecryption: true });
  const response = await ssmClient.send(command);
  return response.Parameter.Value;
};

let db;
let dbConfig = {};

// ---- Step 1: Load credentials from SSM ----
const loadConfig = async () => {
  const [host, database, password, user] = await Promise.all([
    getSSMParameter('/myapp/db/host'),
    getSSMParameter('/myapp/db/name'),
    getSSMParameter('/myapp/db/password'),
    getSSMParameter('/myapp/db/user'),
  ]);
  console.log('✅ SSM parameters loaded successfully');
  dbConfig = { host, database };
  return { host, database, password, user };
};

// ---- Step 2: Create the database schema if it doesn't exist ----
const ensureDatabase = async ({ host, user, password, database }) => {
  const conn = await mysql.createConnection({ host, user, password });
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
  await conn.end();
  console.log(`✅ Database '${database}' ready`);
};

// ---- Step 3: Connect pool with retry ----
const connectWithRetry = async ({ host, user, password, database }, retries = 10, delay = 3000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const pool = await mysql.createPool({
        host,
        user,
        password,
        database,
        waitForConnections: true,
        connectionLimit: 10,
      });
      await pool.query('SELECT 1');
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

// ---- Step 4: Create tables ----
const ensureTables = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS task (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      title       VARCHAR(255)  NOT NULL,
      description TEXT,
      due_date    DATE,
      completed   TINYINT(1)    NOT NULL DEFAULT 0,
      created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Tables ensured (task)');
};

// ---- Bootstrap ----
(async () => {
  try {
    const creds = await loadConfig();
    await ensureDatabase(creds);
    db = await connectWithRetry(creds);
    await ensureTables();

    process.on('unhandledRejection', (reason) => {
      console.error('Unhandled Rejection:', reason);
    });

    process.on('SIGINT', async () => {
      console.log('\n🛑 Closing MySQL pool...');
      await db.end();
      process.exit(0);
    });

    // ================================================================
    // HEALTH ROUTES
    // ================================================================

    app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'ok',
        service: 'task-manager-backend',
        uptime: process.uptime(),
      });
    });

    app.get('/health/db', async (req, res) => {
      try {
        const [rows] = await db.query('SELECT 1 AS db_up');
        res.status(200).json({
          status: 'ok',
          database: 'connected',
          host: dbConfig.host,
          database_name: dbConfig.database,
          result: rows[0],
        });
      } catch (error) {
        res.status(500).json({ status: 'error', database: 'down', error: error.message });
      }
    });

    // ================================================================
    // TASK ROUTES
    // ================================================================

    // GET all tasks
    app.get('/tasks', async (req, res) => {
      try {
        const [rows] = await db.query('SELECT * FROM task ORDER BY created_at DESC');
        res.json(rows);
      } catch (error) {
        console.error('GET /tasks error:', error.message);
        res.status(500).json({ error: 'Failed to fetch tasks' });
      }
    });

    // GET single task
    app.get('/tasks/:id', async (req, res) => {
      try {
        const [rows] = await db.query('SELECT * FROM task WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Task not found' });
        res.json(rows[0]);
      } catch (error) {
        console.error('GET /tasks/:id error:', error.message);
        res.status(500).json({ error: 'Failed to fetch task' });
      }
    });

    // POST create task
    app.post('/tasks', async (req, res) => {
      try {
        const { title, description, due_date } = req.body;
        if (!title || !title.trim()) {
          return res.status(400).json({ error: 'Title is required' });
        }
        const [result] = await db.query(
          'INSERT INTO task (title, description, due_date) VALUES (?, ?, ?)',
          [title.trim(), description || null, due_date || null]
        );
        const [rows] = await db.query('SELECT * FROM task WHERE id = ?', [result.insertId]);
        res.status(201).json({ message: 'Task created successfully', task: rows[0] });
      } catch (error) {
        console.error('POST /tasks error:', error.message);
        res.status(500).json({ error: 'Failed to create task' });
      }
    });

    // PATCH update task
    app.patch('/tasks/:id', async (req, res) => {
      try {
        const { title, description, due_date, completed } = req.body;
        const fields = [];
        const values = [];

        if (title !== undefined) {
          if (!title.trim()) return res.status(400).json({ error: 'Title cannot be empty' });
          fields.push('title = ?');
          values.push(title.trim());
        }
        if (description !== undefined) { fields.push('description = ?'); values.push(description); }
        if (due_date     !== undefined) { fields.push('due_date = ?');    values.push(due_date);    }
        if (completed    !== undefined) { fields.push('completed = ?');   values.push(completed ? 1 : 0); }

        if (fields.length === 0) {
          return res.status(400).json({ error: 'No fields provided to update' });
        }

        values.push(req.params.id);
        const [result] = await db.query(
          `UPDATE task SET ${fields.join(', ')} WHERE id = ?`,
          values
        );
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Task not found' });

        const [rows] = await db.query('SELECT * FROM task WHERE id = ?', [req.params.id]);
        res.json({ message: 'Task updated successfully', task: rows[0] });
      } catch (error) {
        console.error('PATCH /tasks/:id error:', error.message);
        res.status(500).json({ error: 'Failed to update task' });
      }
    });

    // PATCH toggle completion
    app.patch('/tasks/:id/toggle', async (req, res) => {
      try {
        const [rows] = await db.query('SELECT completed FROM task WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Task not found' });

        const newCompleted = rows[0].completed ? 0 : 1;
        await db.query('UPDATE task SET completed = ? WHERE id = ?', [newCompleted, req.params.id]);

        const [updated] = await db.query('SELECT * FROM task WHERE id = ?', [req.params.id]);
        res.json({ message: 'Task toggled successfully', task: updated[0] });
      } catch (error) {
        console.error('PATCH /tasks/:id/toggle error:', error.message);
        res.status(500).json({ error: 'Failed to toggle task' });
      }
    });

    // DELETE task
    app.delete('/tasks/:id', async (req, res) => {
      try {
        const [result] = await db.query('DELETE FROM task WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Task not found' });
        res.json({ message: 'Task deleted successfully' });
      } catch (error) {
        console.error('DELETE /tasks/:id error:', error.message);
        res.status(500).json({ error: 'Failed to delete task' });
      }
    });

    // ================================================================
    // START SERVER
    // ================================================================
    app.listen(3500, () => {
      console.log('🚀 Task Manager server running on port 3500');
    });

  } catch (error) {
    console.error('❌ Fatal startup error:', error.message);
    process.exit(1);
  }
})();