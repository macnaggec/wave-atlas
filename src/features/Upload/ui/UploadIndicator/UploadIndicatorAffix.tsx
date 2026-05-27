import { Group, Paper, Text } from '@mantine/core';
import { useRouterState } from '@tanstack/react-router';
import { useUploadStore } from '../../model/uploadStore';
import { useUploadWarning } from 'features/Upload/model';
import { UploadIcon } from './UploadIcon';
import classes from './UploadIndicator.module.css';

/**
 * UploadIndicatorAffix - Inline upload status shown when panel is closed.
 * Upload is now managed from the sidebar, so this is display-only.
 */
export function UploadIndicatorAffix() {
  const isPanelOpen = useRouterState({
    select: (s) => s.matches.some(m => 'spotId' in (m.params ?? {})),
  });

  const hasActiveUploads = useUploadStore(state =>
    state.uploadQueue.some(item => item.status !== 'completed' && item.status !== 'error')
  );
  const uploadingSpotId = useUploadStore(state => state.uploadingSpotId);
  const uploadingSpotName = useUploadStore(state => state.uploadingSpotName);
  const totalCount = useUploadStore(state => state.sessionTotal);
  const completedCount = useUploadStore(state => state.sessionCompleted);

  useUploadWarning(hasActiveUploads);

  if (!hasActiveUploads || !uploadingSpotId || isPanelOpen) {
    return null;
  }

  const displayName = uploadingSpotName || uploadingSpotId;

  return (
    <Paper shadow="sm" px="sm" withBorder className={classes.plate}>
      <Group gap="xs" wrap="nowrap">
        <UploadIcon size={16} />
        <Text size="sm" fw={500} className={classes.name}>
          {displayName}
        </Text>
        <Text size="sm" fw={500} className={classes.counter}>
          {completedCount}/{totalCount}
        </Text>
      </Group>
    </Paper>
  );
}
