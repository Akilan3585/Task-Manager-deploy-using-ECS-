/* Home.js (updated styling, preserved logic) */
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Heading, HStack, VStack, Text } from '@chakra-ui/react';
import { Helmet } from 'react-helmet-async';
import './Home.css';

function Home() {
  return (
    <Box py={16} textAlign="center">
      <Helmet>
        <title>Task Manager</title>
        <meta name="description" content="Welcome to the Task Manager" />
      </Helmet>
      <VStack spacing={6}>
        <Heading size="2xl">Welcome to Task Manager</Heading>
        <Text color="gray.600" _dark={{ color: 'gray.300' }}>
          Choose your role to continue
        </Text>
        <HStack spacing={4}>
          <Button as={RouterLink} to="/tasks" size="lg">
            Task
          </Button>
          
        </HStack>
      </VStack>
    </Box>
  );
}

export default Home;
