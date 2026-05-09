import { Button } from '@mantine/core';
import { IconUpload } from '@tabler/icons-react';
import { FloatingAction } from 'shared/ui/DrawerLayout';

export interface PublishButtonProps {
  total: number;
  allReady: boolean;
  hasActiveUploads: boolean;
  isPublishing: boolean;
  selectedCount: number;
  onPublish: () => void;
}

export function PublishButton({
  total,
  allReady,
  hasActiveUploads,
  isPublishing,
  selectedCount,
  onPublish,
}: PublishButtonProps) {
  if (total === 0 || hasActiveUploads) return null;
  if (!allReady) return null;

  const label = selectedCount > 0 ? `Publish ${selectedCount}` : 'Publish All';

  return (
    <FloatingAction>
      <Button
        size="lg"
        leftSection={<IconUpload size={20} />}
        onClick={onPublish}
        loading={isPublishing}
        color="green"
      >
        {label}
      </Button>
    </FloatingAction>
  );
}
