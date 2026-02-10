import { Container, Title, Text, Button, Stack, Paper } from '@mantine/core';
import { IconError404 } from '@tabler/icons-react';
import Link from 'next/link';

/**
 * Custom 404 page
 * Shown when:
 * - Route doesn't exist
 * - notFound() is called in a component
 */
export default function NotFound() {
  return (
    <Container size="sm" py="xl">
      <Paper shadow="md" p="xl" radius="md" withBorder>
        <Stack align="center" gap="lg">
          <IconError404 size={64} stroke={1.5} color="var(--mantine-color-gray-6)" />

          <Stack align="center" gap="xs">
            <Title order={1}>404</Title>
            <Title order={2}>Page Not Found</Title>
            <Text c="dimmed" ta="center">
              The page you're looking for doesn't exist or has been moved.
            </Text>
          </Stack>

          <Link href="/">
            <Button size="md">Go Home</Button>
          </Link>
        </Stack>
      </Paper>
    </Container>
  );
}
