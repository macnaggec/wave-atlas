import { memo, useCallback } from 'react';
import type { MouseEvent } from 'react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';

export interface DownloadButtonProps {
  mediaItemId: string;
  size: 'sm' | 'md';
  loading: boolean;
  disabled: boolean;
  onDownload: (mediaItemId: string) => void;
}

/**
 * DownloadButton — triggers a signed download for a purchased media item.
 *
 * Calls `onDownload` with the media item id. When `stopPropagation` is true,
 * prevents the click from bubbling to a parent card.
 */
const DownloadButton = memo(function DownloadButton({
  mediaItemId,
  size,
  loading,
  disabled,
  onDownload,
}: DownloadButtonProps) {
  const handleClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onDownload(mediaItemId);
    },
    [mediaItemId, onDownload],
  );

  return (
    <Tooltip label="Download original" withArrow>
      <ActionIcon
        variant={size === 'md' ? 'light' : 'subtle'}
        size={size}
        loading={loading}
        disabled={disabled}
        onClick={handleClick}
        aria-label="Download original file"
      >
        <IconDownload size={size === 'md' ? 16 : 14} />
      </ActionIcon>
    </Tooltip>
  );
});

export default DownloadButton;
