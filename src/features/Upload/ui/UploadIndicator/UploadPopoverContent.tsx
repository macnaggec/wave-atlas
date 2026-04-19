import { FC, useCallback } from 'react';
import { Anchor, Group, Text } from '@mantine/core';
import { IconUpload } from '@tabler/icons-react';
import { useNavigate } from '@tanstack/react-router';

export interface UploadPopoverContentProps {
  /** Name of the spot being uploaded to */
  spotName: string;

  /** ID of the spot being uploaded to (for navigation) */
  spotId: string;

  /** Number of completed uploads */
  completedCount: number;

  /** Total number of uploads */
  totalCount: number;

  /** Callback when navigation is triggered (for closing popover) */
  onNavigate?: () => void;
}

/**
 * UploadPopoverContent - Universal popover content for upload progress
 *
 * Displays: "[Icon] Uploading to [Button] X/Y"
 * Used by: Toolbar indicator + AddFileCard (blocked state)
 *
 * @example
 * ```tsx
 * <Popover.Dropdown>
 *   <UploadPopoverContent
 *     spotName="Pipeline"
 *     spotId="pipeline"
 *     completedCount={2}
 *     totalCount={5}
 *     onNavigate={() => setOpened(false)}
 *   />
 * </Popover.Dropdown>
 * ```
 */
export const UploadPopoverContent: FC<UploadPopoverContentProps> = ({
  spotName,
  spotId,
  completedCount,
  totalCount,
  onNavigate,
}) => {
  const navigate = useNavigate();

  const handleClick = useCallback(() => {
    onNavigate?.();
    navigate({ to: '/$spotId/upload', params: { spotId } });
  }, [onNavigate, navigate, spotId]);

  return (
    <Group gap="xs" wrap="nowrap">
      <IconUpload size={16} />
      <Text size="sm">
        Uploading to{' '}
        <Anchor
          component="button"
          onClick={handleClick}
          style={{ cursor: 'pointer' }}
        >
          {spotName}
        </Anchor>
        {' '}
        <Text component="span" c="dimmed">
          {completedCount}/{totalCount}
        </Text>
      </Text>
    </Group>
  );
};
