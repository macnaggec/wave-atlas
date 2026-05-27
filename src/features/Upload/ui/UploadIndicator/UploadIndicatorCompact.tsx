import { Button, Tooltip } from '@mantine/core';
import { IconUpload } from '@tabler/icons-react';
import { useUploadStatus } from 'features/Upload/model';
import classes from './UploadIndicatorCompact.module.css';

/**
 * UploadIndicatorCompact - Pill showing active upload progress.
 * Upload tab is gone; this is now purely informational.
 */
export function UploadIndicatorCompact() {
  const { isBlocked, uploadingSpotName, uploadingSpotId, completedCount, totalCount } = useUploadStatus();

  if (!isBlocked) return null;

  const displayName = uploadingSpotName || uploadingSpotId || '…';
  const tooltipText = `${displayName} ${completedCount}/${totalCount}`;

  return (
    <Tooltip label={tooltipText} position="bottom" withArrow>
      <Button
        variant="light"
        color="blue"
        leftSection={<IconUpload size={16} />}
        classNames={{ root: classes.pill }}
      >
        Uploading to …
      </Button>
    </Tooltip>
  );
}
