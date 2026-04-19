import { Group, Paper, Text } from '@mantine/core';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useUploadStore } from '../../model/uploadStore';
import { useUploadWarning } from 'features/Upload/model';
import { UploadIcon } from './UploadIcon';
import classes from './UploadIndicator.module.css';

/**
 * UploadIndicatorAffix - Inline upload status shown in the Header.
 *
 * Renders to the left of the avatar. Same height as UserControl (38px).
 * Shows: [Icon] "[Spot Name…] X/Y"
 * Click navigates directly to upload tab.
 *
 * Visibility:
 * - Show: Active uploads AND SidePanel closed (main page)
 * - Hide: SidePanel open OR no uploads
 */
export function UploadIndicatorAffix() {
  const isPanelOpen = useRouterState({
    select: (s) => s.matches.some(m => 'spotId' in (m.params ?? {})),
  });
  const navigate = useNavigate();

  const hasActiveUploads = useUploadStore(state =>
    state.uploadQueue.some(item => item.status !== 'completed' && item.status !== 'error')
  );
  const uploadingSpotId = useUploadStore(state => state.uploadingSpotId);
  const uploadingSpotName = useUploadStore(state => state.uploadingSpotName);
  const totalCount = useUploadStore(state => state.sessionTotal);
  const completedCount = useUploadStore(state => state.sessionCompleted);

  useUploadWarning(hasActiveUploads);

  const handleClick = () => {
    if (uploadingSpotId) {
      navigate({ to: '/$spotId/upload', params: { spotId: uploadingSpotId } });
    }
  };

  if (!hasActiveUploads || !uploadingSpotId || isPanelOpen) {
    return null;
  }

  const displayName = uploadingSpotName || uploadingSpotId;

  return (
    <Paper
      shadow="sm"
      px="sm"
      withBorder
      className={classes.plate}
      onClick={handleClick}
    >
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
