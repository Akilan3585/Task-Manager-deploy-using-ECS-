import { useState, useEffect } from "react";

const API_BASE = "http://13.219.88.39:3500";

const formatDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

const toInputDate = (ddmmyyyy) => {
  if (!ddmmyyyy) return "";
  const [dd, mm, yyyy] = ddmmyyyy.split("-");
  return `${yyyy}-${mm}-${dd}`;
};

export default function TaskManager() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dark, setDark] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState({});

  const theme = {
    bg: dark ? "#0f172a" : "#f1f5f9",
    card: dark ? "#1e293b" : "#ffffff",
    nav: dark ? "#1e293b" : "#ffffff",
    text: dark ? "#f8fafc" : "#0f172a",
    subtext: dark ? "#94a3b8" : "#64748b",
    border: dark ? "#334155" : "#e2e8f0",
    input: dark ? "#0f172a" : "#f8fafc",
    inputBorder: dark ? "#475569" : "#cbd5e1",
    accent: "#3b82f6",
    accentHover: "#2563eb",
    done: dark ? "#166534" : "#dcfce7",
    doneBorder: dark ? "#15803d" : "#86efac",
    doneText: dark ? "#86efac" : "#166534",
    danger: "#ef4444",
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/tasks`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setTasks(data);
    } catch {
      setError("Could not load tasks. Is the server running?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, []);

  const addTask = async () => {
    if (!title.trim()) { setError("Title is required."); return; }
    setError("");
    try {
      const res = await fetch(`${API_BASE}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description || null,
          due_date: dueDate ? toInputDate(dueDate) : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add task");
      }
      setTitle(""); setDescription(""); setDueDate("");
      fetchTasks();
    } catch (e) {
      setError(e.message);
    }
  };

  const toggleTask = async (id) => {
    try {
      await fetch(`${API_BASE}/tasks/${id}/toggle`, { method: "PATCH" });
      fetchTasks();
    } catch {
      setError("Failed to toggle task.");
    }
  };

  const deleteTask = async (id) => {
    try {
      await fetch(`${API_BASE}/tasks/${id}`, { method: "DELETE" });
      fetchTasks();
    } catch {
      setError("Failed to delete task.");
    }
  };

  const startEdit = (task) => {
    setEditingId(task.id);
    setEditFields({
      title: task.title,
      description: task.description || "",
      due_date: task.due_date ? formatDate(task.due_date) : "",
    });
  };

  const saveEdit = async (id) => {
    if (!editFields.title.trim()) { setError("Title cannot be empty."); return; }
    setError("");
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editFields.title.trim(),
          description: editFields.description || null,
          due_date: editFields.due_date ? toInputDate(editFields.due_date) : null,
        }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setEditingId(null);
      fetchTasks();
    } catch (e) {
      setError(e.message);
    }
  };

  const pending = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);

  const inputStyle = {
    background: theme.input,
    border: `1px solid ${theme.inputBorder}`,
    borderRadius: 8,
    color: theme.text,
    padding: "10px 12px",
    fontSize: 14,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  const TaskCard = ({ task }) => {
    const isEditing = editingId === task.id;
    const cardBg = task.completed ? theme.done : theme.card;
    const cardBorder = task.completed ? theme.doneBorder : theme.border;

    return (
      <div style={{
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        borderRadius: 10,
        padding: "14px 16px",
        marginBottom: 10,
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}>
        {/* Checkbox */}
        <button
          onClick={() => toggleTask(task.id)}
          style={{
            marginTop: 2,
            width: 20, height: 20,
            borderRadius: 6,
            border: `2px solid ${task.completed ? theme.doneText : theme.inputBorder}`,
            background: task.completed ? theme.doneText : "transparent",
            cursor: "pointer",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 12,
          }}
          title={task.completed ? "Mark incomplete" : "Mark complete"}
        >
          {task.completed ? "✓" : ""}
        </button>

        {/* Body */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {isEditing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                value={editFields.title}
                onChange={(e) => setEditFields({ ...editFields, title: e.target.value })}
                style={inputStyle}
                placeholder="Task title"
              />
              <textarea
                value={editFields.description}
                onChange={(e) => setEditFields({ ...editFields, description: e.target.value })}
                style={{ ...inputStyle, resize: "vertical", minHeight: 60 }}
                placeholder="Optional description"
              />
              <input
                type="text"
                value={editFields.due_date}
                onChange={(e) => setEditFields({ ...editFields, due_date: e.target.value })}
                style={inputStyle}
                placeholder="dd-mm-yyyy"
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => saveEdit(task.id)} style={{
                  background: theme.accent, color: "#fff", border: "none",
                  borderRadius: 7, padding: "7px 16px", cursor: "pointer", fontSize: 13,
                }}>Save</button>
                <button onClick={() => setEditingId(null)} style={{
                  background: "transparent", color: theme.subtext, border: `1px solid ${theme.border}`,
                  borderRadius: 7, padding: "7px 16px", cursor: "pointer", fontSize: 13,
                }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <p style={{
                margin: 0,
                fontWeight: 600,
                fontSize: 15,
                color: task.completed ? theme.doneText : theme.text,
                textDecoration: task.completed ? "line-through" : "none",
                wordBreak: "break-word",
              }}>{task.title}</p>
              {task.description && (
                <p style={{ margin: "4px 0 0", fontSize: 13, color: theme.subtext, wordBreak: "break-word" }}>
                  {task.description}
                </p>
              )}
              {task.due_date && (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: theme.subtext }}>
                  📅 Due {formatDate(task.due_date)}
                </p>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        {!isEditing && (
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button onClick={() => startEdit(task)} style={{
              background: "transparent", border: `1px solid ${theme.inputBorder}`,
              borderRadius: 6, padding: "5px 10px", cursor: "pointer",
              color: theme.subtext, fontSize: 12,
            }}>Edit</button>
            <button onClick={() => deleteTask(task.id)} style={{
              background: "transparent", border: `1px solid ${theme.danger}`,
              borderRadius: 6, padding: "5px 10px", cursor: "pointer",
              color: theme.danger, fontSize: 12,
            }}>Delete</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, fontFamily: "'Inter', system-ui, sans-serif", color: theme.text }}>

      {/* Navbar */}
      <nav style={{
        background: theme.nav,
        borderBottom: `1px solid ${theme.border}`,
        padding: "0 32px",
        display: "flex",
        alignItems: "center",
        height: 56,
        gap: 24,
      }}>
        <span style={{ fontWeight: 700, fontSize: 16, color: theme.text }}>Task Manager</span>
        <span style={{
          background: dark ? "#334155" : "#f1f5f9",
          border: `1px solid ${theme.border}`,
          borderRadius: 8,
          padding: "4px 14px",
          fontSize: 14,
          fontWeight: 500,
          color: theme.text,
        }}>Tasks</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setDark(!dark)}
          style={{
            background: "transparent", border: "none", cursor: "pointer",
            fontSize: 20, color: theme.text, padding: 4,
          }}
          title="Toggle dark mode"
        >
          {dark ? "☀️" : "🌙"}
        </button>
      </nav>

      {/* Main */}
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: theme.text }}>Task Manager</h1>

        {/* Add Task Form */}
        <div style={{
          background: theme.card,
          border: `1px solid ${theme.border}`,
          borderRadius: 12,
          padding: 20,
          marginBottom: 28,
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 1fr auto", gap: 12, alignItems: "start" }}>
            {/* Title */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: theme.text }}>Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
                style={inputStyle}
                placeholder="Task title"
              />
            </div>

            {/* Description */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: theme.text }}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ ...inputStyle, resize: "vertical", minHeight: 38, lineHeight: 1.4 }}
                placeholder="Optional description"
                rows={1}
              />
            </div>

            {/* Due */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: theme.text }}>Due</label>
              <input
                type="text"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={inputStyle}
                placeholder="dd-mm-yyyy"
              />
            </div>

            {/* Add button */}
            <div style={{ paddingTop: 22 }}>
              <button
                onClick={addTask}
                style={{
                  background: theme.accent,
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 22px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Add
              </button>
            </div>
          </div>

          {error && (
            <p style={{ marginTop: 10, marginBottom: 0, color: theme.danger, fontSize: 13 }}>{error}</p>
          )}
        </div>

        {/* Task List */}
        {loading ? (
          <p style={{ color: theme.subtext, textAlign: "center", padding: 32 }}>Loading tasks…</p>
        ) : tasks.length === 0 ? (
          <p style={{ color: theme.subtext }}>No tasks yet.</p>
        ) : (
          <>
            {pending.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: theme.subtext, marginBottom: 10 }}>
                  Pending — {pending.length}
                </p>
                {pending.map((t) => <TaskCard key={t.id} task={t} />)}
              </div>
            )}

            {done.length > 0 && (
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: theme.subtext, marginBottom: 10 }}>
                  Completed — {done.length}
                </p>
                {done.map((t) => <TaskCard key={t.id} task={t} />)}
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: `1px solid ${theme.border}`,
        padding: "20px 32px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: 13,
        color: theme.subtext,
      }}>
        <span>© 2026 Student–Teacher Portal • Built by <a href="#" style={{ color: theme.accent, textDecoration: "none" }}>Aman Pathak</a></span>
        <div style={{ display: "flex", gap: 16, fontSize: 18 }}>
          <a href="#" style={{ color: theme.subtext }}>⬡</a>
          <a href="#" style={{ color: theme.subtext }}>in</a>
          <a href="#" style={{ color: theme.subtext }}>▶</a>
          <a href="#" style={{ color: theme.subtext }}>▪</a>
        </div>
      </footer>
    </div>
  );
}
