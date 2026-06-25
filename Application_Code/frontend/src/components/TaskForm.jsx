import React, { useState } from 'react';
import { Box, Input, Textarea, Button, HStack, FormControl, FormLabel } from '@chakra-ui/react';

export default function TaskForm({ onCreate }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await onCreate({ title, description, due_date: dueDate || null });
      setTitle('');
      setDescription('');
      setDueDate('');
    } catch (err) {
      console.error('Create failed', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box as="form" onSubmit={submit}>
      <HStack spacing={3} align="flex-start">
        <FormControl>
          <FormLabel>Title</FormLabel>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" />
        </FormControl>
        <FormControl>
          <FormLabel>Description</FormLabel>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
        </FormControl>
        <FormControl>
          <FormLabel>Due</FormLabel>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </FormControl>
        <Button type="submit" colorScheme="blue" isLoading={busy} alignSelf="flex-end">Add</Button>
      </HStack>
    </Box>
  );
}
