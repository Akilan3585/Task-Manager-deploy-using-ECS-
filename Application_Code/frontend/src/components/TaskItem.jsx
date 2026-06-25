import React from 'react';
import { Box, HStack, Text, Button, Badge, VStack } from '@chakra-ui/react';

export default function TaskItem({ task, onToggle, onDelete }) {
  return (
    <Box p={3} borderWidth="1px" rounded="md">
      <HStack justify="space-between">
        <VStack align="start" spacing={0}>
          <Text fontWeight="bold">{task.title}</Text>
          {task.description ? <Text fontSize="sm">{task.description}</Text> : null}
          <Text fontSize="sm" color="gray.500">{task.due_date || ''}</Text>
        </VStack>
        <HStack>
          <Badge colorScheme={task.status === 'done' ? 'green' : task.status === 'inprogress' ? 'yellow' : 'gray'}>{task.status}</Badge>
          <Button size="sm" onClick={() => onToggle(task)}>{task.status === 'done' ? 'Mark Todo' : 'Mark Done'}</Button>
          <Button size="sm" colorScheme="red" onClick={() => onDelete(task.id)}>Delete</Button>
        </HStack>
      </HStack>
    </Box>
  );
}
