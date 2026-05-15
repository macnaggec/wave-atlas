import { createFileRoute } from '@tanstack/react-router';
import { Button, Center, Stack, Text, Title } from '@mantine/core';
import { IconLogin2 } from '@tabler/icons-react';
import { UploadManager } from 'features/Upload';
import { useDraftMedia } from 'features/Upload/model/useDraftMedia';
import { useUser } from 'shared/hooks/useUser';
import { useAuthModal } from 'features/Auth/AuthModalProvider';
import { useSpotUploadContext } from 'app/contexts/SpotUploadContext';

export const Route = createFileRoute('/_drawer/$spotId/upload')({
  component: UploadTab,
});

function UploadTab() {
  const { spotId } = Route.useParams();
  const { isAuthenticated, isLoading } = useUser();
  const { draftMedia } = useDraftMedia(isAuthenticated ? spotId : null);
  const { open: openAuthModal } = useAuthModal();
  const { onPublishSuccess } = useSpotUploadContext();

  if (isLoading) return null;

  if (!isAuthenticated) {
    return (
      <Center mih={260}>
        <Stack gap="xs" align="center" ta="center">
          <Title order={4}>Sign in to upload</Title>
          <Text c="dimmed" maw={360}>
            Uploads are tied to your account so you can manage them later.
          </Text>
          <Button leftSection={<IconLogin2 size={16} />} onClick={openAuthModal}>
            Sign in
          </Button>
        </Stack>
      </Center>
    );
  }

  return (
    <UploadManager
      spotId={spotId}
      draftMedia={draftMedia ?? []}
      onPublishSuccess={onPublishSuccess}
    />
  );
}

