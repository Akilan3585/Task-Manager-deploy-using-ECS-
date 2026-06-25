import React from 'react';
import { VStack, Text } from '@chakra-ui/react';
import TaskItem from './TaskItem';
import LoadingSpinner from './LoadingSpinner';

export default function TaskList({ tasks, loading, onToggle, onDelete }) {
  if (loading) return <LoadingSpinner />;
  if (!tasks || tasks.length === 0) return <Text>No tasks yet.</Text>;

  return (
    <VStack spacing={3} align="stretch">
      {tasks.map((t) => (
        <TaskItem key={t.id} task={t} onToggle={onToggle} onDelete={onDelete} />
      ))}
    </VStack>
  );
}
