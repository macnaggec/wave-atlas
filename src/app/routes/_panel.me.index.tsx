import { createFileRoute } from '@tanstack/react-router';
import { Stack, Text } from '@mantine/core';
import { PanelGalleryLayout } from 'shared/ui/PanelGalleryLayout';

export const Route = createFileRoute('/_panel/me/')({
  staticData: { panelHeader: 'Account', panelMode: 'workspace' },
  component: AccountRoute,
});

function AccountRoute() {
  return (
    <PanelGalleryLayout>
      <Stack gap="xs">
        <Text c="dimmed" size="sm">
          Profile and security controls will appear here.
        </Text>
      </Stack>
    </PanelGalleryLayout>
  );
}
