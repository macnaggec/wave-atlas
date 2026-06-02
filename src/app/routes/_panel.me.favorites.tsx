import { createFileRoute } from '@tanstack/react-router';
import { Center, Text } from '@mantine/core';

export const Route = createFileRoute('/_panel/me/favorites')({
  component: FavoritesTab,
});

function FavoritesTab() {
  return (
    <Center mih={200}>
      <Text c="dimmed" size="sm">Your favorites will appear here.</Text>
    </Center>
  );
}
