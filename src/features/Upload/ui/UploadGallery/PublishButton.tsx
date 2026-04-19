'use client';

import { Box, Button } from '@mantine/core';
import { IconUpload } from '@tabler/icons-react';
import classes from './PublishButton.module.css';

export interface PublishButtonProps {
  total: number;
  ready: number;
  allReady: boolean;
  hasActiveUploads: boolean;
  isPublishing: boolean;
  selectedCount: number;
  onPublish: () => void;
}

/**
 * PublishButton - Purely presentational publish trigger
 *
 * Shows publish action button. When items are selected, shows "Publish {count}".
 * Otherwise shows "Publish All" when all drafts are ready.
 * Owns no async logic, no server actions, no side effects.
 * All outcome handling (loading state, notifications, cache) is the caller's concern.
 */
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
    <Box className={classes.anchor}>
      <Button
        size="lg"
        leftSection={<IconUpload size={20} />}
        onClick={onPublish}
        loading={isPublishing}
        color="green"
        style={{ boxShadow: 'var(--mantine-shadow-md)' }}
      >
        {label}
      </Button>
    </Box>
  );
}
