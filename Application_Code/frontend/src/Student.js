import React, { useEffect, useState } from 'react';
import { VStack, Heading, Box } from '@chakra-ui/react';
import TaskForm from './components/TaskForm';
import TaskList from './components/TaskList';
import * as api from './services/api';

export default function Student() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getTasks();
      setTasks(data || []);
    } catch (err) {
      console.error('Failed to load tasks', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (payload) => {
    const created = await api.createTask(payload);
    setTasks((s) => [created, ...s]);
  };

  const handleUpdate = async (id, patch) => {
    const updated = await api.updateTask(id, patch);
    setTasks((s) => s.map(t => (t.id === updated.id ? updated : t)));
  };

  const handleDelete = async (id) => {
    await api.deleteTask(id);
    setTasks((s) => s.filter(t => t.id !== Number(id)));
  };

  return (
    <VStack align="stretch" spacing={6}>
      <Box>
        <Heading size="md">Task Manager</Heading>
      </Box>
      <TaskForm onCreate={handleCreate} />
      <TaskList
        tasks={tasks}
        loading={loading}
        onToggle={(task) => handleUpdate(task.id, { status: task.status === 'done' ? 'todo' : 'done' })}
        onDelete={(id) => handleDelete(id)}
      />
    </VStack>
  );
}
