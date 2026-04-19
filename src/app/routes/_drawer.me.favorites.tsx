import { createFileRoute } from '@tanstack/react-router';
import { Center, Text } from '@mantine/core';

export const Route = createFileRoute('/_drawer/me/favorites')({
  component: FavoritesTab,
});

/**
 * FavoritesTab — shows media favorited by the authenticated user.
 */
function FavoritesTab() {
  return (
    <Center mih={200}>
      <Text c="dimmed" size="sm">Your favorites will appear here.</Text>
    </Center>
  );
}
