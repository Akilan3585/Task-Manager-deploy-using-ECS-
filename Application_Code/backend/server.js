const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

let db;

// 🔁 MySQL Connection with Retry Logic
const connectWithRetry = async (retries = 10, delay = 3000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const pool = await mysql.createPool({
        host: process.env.host,
        user: process.env.user,
        password: process.env.password,
        database: process.env.database,
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

// 🧱 Ensure Required Tables Exist
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

    console.log("✅ Tables ensured successfully (tasks)");
  } catch (error) {
    console.error("❌ Error ensuring tables:", error);
    throw error;
  }
};

// 🌐 Initialize Database Connection Before Starting Server
(async () => {
  try {
    db = await connectWithRetry();
    await ensureTables(db);
    // Seed sample tasks if table is empty
    const seedSampleTasks = async () => {
      try {
        const [rows] = await db.query('SELECT COUNT(*) as cnt FROM tasks');
        const count = rows[0].cnt || 0;
        if (count === 0) {
          console.log('Seeding sample tasks...');
          const sample = [
            ['Buy groceries', 'Milk, eggs, bread', 'todo', null],
            ['Finish report', 'Finalize quarterly report', 'inprogress', null],
            ['Call Alice', 'Discuss project roadmap', 'todo', null],
          ];
          for (const s of sample) {
            await db.query('INSERT INTO tasks (title, description, status, due_date) VALUES (?, ?, ?, ?)', s);
          }
          console.log('Sample tasks inserted');
        }
      } catch (err) {
        console.error('Error seeding tasks:', err.message);
      }
    };

    await seedSampleTasks();

    // 💥 Global unhandled promise rejection handler
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log("\n🛑 Closing MySQL pool...");
      await db.end();
      process.exit(0);
    });

    // ---- Utility Functions ----

    // (Tasks use AUTO_INCREMENT; helper to fetch a single task)
    const getTaskById = async (id) => {
      const [rows] = await db.query('SELECT * FROM tasks WHERE id = ?', [id]);
      return rows[0] || null;
    };

    // ---- Health Check Routes ----

    // Basic health (for ALB target group)
    app.get('/health', (req, res) => {
      return res.status(200).json({
        status: 'ok',
        service: 'backend',
        uptime: process.uptime()
      });
    });

    // DB health (for debugging only)
    app.get('/health/db', async (req, res) => {
      try {
        const [rows] = await db.query('SELECT 1 as db_up');

        return res.status(200).json({
          status: 'ok',
          database: 'connected',
          host: process.env.host,
          database_name: process.env.database,
          result: rows[0]
        });

      } catch (error) {
        console.error('DB health check failed:', error.message);

        return res.status(500).json({
          status: 'error',
          database: 'down',
          error: error.message
        });
      }
    });

    // ---- Task Routes (Task Manager) ----

    app.get('/', async (req, res) => {
      try {
        const [data] = await db.query('SELECT * FROM tasks ORDER BY id');
        return res.json({ message: 'Task Manager Backend', tasks: data });
      } catch (error) {
        console.error('Error fetching tasks:', error);
        return res.status(500).json({ error: 'Error fetching tasks' });
      }
    });

    // List tasks
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
      const id = req.params.id;
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
        const [result] = await db.query(
          'INSERT INTO tasks (title, description, status, due_date) VALUES (?, ?, ?, ?)',
          [title, description, status, due_date]
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
      const id = req.params.id;
      try {
        const { title, description, status, due_date } = req.body;
        const existing = await getTaskById(id);
        if (!existing) return res.status(404).json({ error: 'Task not found' });
        await db.query(
          'UPDATE tasks SET title = ?, description = ?, status = ?, due_date = ? WHERE id = ?',
          [title ?? existing.title, description ?? existing.description, status ?? existing.status, due_date ?? existing.due_date, id]
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
      const id = req.params.id;
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

    // ---- Start Server After DB Ready ----
    app.listen(3500, () => {
      console.log("🚀 Server running on port 3500");
    });

  } catch (error) {
    console.error("❌ Fatal: Could not start server. DB connection failed.", error);
    process.exit(1);
  }
})();

