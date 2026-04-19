import { useLocation, useNavigate } from '@tanstack/react-router';
import { Button, Tooltip } from '@mantine/core';
import { IconUpload } from '@tabler/icons-react';
import { useUploadStatus } from 'features/Upload/model';
import classes from './UploadIndicatorCompact.module.css';

/**
 * UploadIndicatorCompact - Pill-style upload indicator for toolbar
 *
 * Shows clickable pill with text "Uploading to …" and tooltip showing spot name + progress.
 * Navigates directly to uploading spot's Upload tab on click.
 *
 * Visibility:
 * - Show: Active uploads AND user on Upload tab AND current spot is NOT uploading spot
 * - Hide: On uploading spot's Upload tab OR no active uploads
 */
export function UploadIndicatorCompact() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // Get upload blocking state
  const { isBlocked, uploadingSpotId, uploadingSpotName, completedCount, totalCount } = useUploadStatus();

  // Don't render if no active uploads
  if (!isBlocked) {
    return null;
  }

  // Only show in Upload tab of different spot
  const currentSpotId = pathname?.split('/').filter(Boolean)[0];
  const isOnUploadTab = pathname?.endsWith('/upload');
  const isOnDifferentSpot = currentSpotId !== uploadingSpotId;

  // Hide if not on Upload tab OR if on uploading spot's Upload tab
  if (!isOnUploadTab || !isOnDifferentSpot) {
    return null;
  }

  const displayName = uploadingSpotName || uploadingSpotId;
  const tooltipText = `${displayName} ${completedCount}/${totalCount}`;

  const handleClick = () => {
    if (uploadingSpotId) {
      navigate({ to: '/$spotId/upload', params: { spotId: uploadingSpotId } });
    }
  };

  return (
    <Tooltip label={tooltipText} position="bottom" withArrow>
      <Button
        variant="light"
        color="blue"
        leftSection={<IconUpload size={16} />}
        onClick={handleClick}
        classNames={{ root: classes.pill }}
      >
        Uploading to …
      </Button>
    </Tooltip>
  );
}
