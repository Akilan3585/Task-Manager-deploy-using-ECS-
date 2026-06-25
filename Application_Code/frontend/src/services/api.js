// api.js: centralized API helpers for Task Manager
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3500';

const handleRes = async (res) => {
	if (!res.ok) {
		const text = await res.text();
		throw new Error(text || res.statusText);
	}
	return res.status === 204 ? null : res.json();
};

export const getTasks = () => fetch(`${API_BASE_URL}/tasks`).then(handleRes);
export const getTask = (id) => fetch(`${API_BASE_URL}/tasks/${id}`).then(handleRes);
export const createTask = (payload) => fetch(`${API_BASE_URL}/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(handleRes);
export const updateTask = (id, payload) => fetch(`${API_BASE_URL}/tasks/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(handleRes);
export const deleteTask = (id) => fetch(`${API_BASE_URL}/tasks/${id}`, { method: 'DELETE' }).then(handleRes);

export default { getTasks, getTask, createTask, updateTask, deleteTask };
