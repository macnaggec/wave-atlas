import { Box, Container, Paper, Stack } from '@mantine/core';
import React from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <Box
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <Container size="xs" style={{ width: '100%' }}>
        <Stack align="center" gap="xl">
          {/* Optional: Add your logo here */}
          <Box
            style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              color: 'white',
              textAlign: 'center',
            }}
          >
            Wave Atlas
          </Box>

          {/* Auth content */}
          <Paper
            radius="lg"
            p="xl"
            shadow="xl"
            style={{
              width: '100%',
              maxWidth: '420px',
            }}
          >
            {children}
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
