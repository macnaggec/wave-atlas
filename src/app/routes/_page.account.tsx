import { createFileRoute } from '@tanstack/react-router';
import { Text } from '@mantine/core';

export const Route = createFileRoute('/_page/account')({
  component: AccountRoute,
});

function AccountRoute() {
  return <Text c="dimmed">Account Settings — coming soon</Text>;
}
