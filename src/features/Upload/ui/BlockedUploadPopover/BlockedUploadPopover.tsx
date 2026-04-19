'use client';

import { FC, ReactElement, useState } from 'react';
import { Box, Popover } from '@mantine/core';
import { useUploadStatus } from 'features/Upload/model';
import { UploadPopoverContent } from '../UploadIndicator';

/**
 * Props for BlockedUploadPopover component
 */
export interface BlockedUploadPopoverProps {
  /** Child component to wrap (e.g., AddFileCard) */
  children: ReactElement;
}

/**
 * BlockedUploadPopover - Shows upload blocking popover
 *
 * Pure presentation component that always shows the popover.
 * Parent is responsible for only rendering this when uploads are blocked.
 *
 * @example
 * ```tsx
 * {isBlocked ? (
 *   <BlockedUploadPopover>
 *     <AddFileCard onFilesSelected={...} disabled />
 *   </BlockedUploadPopover>
 * ) : (
 *   <AddFileCard onFilesSelected={...} />
 * )}
 * ```
 */
export const BlockedUploadPopover: FC<BlockedUploadPopoverProps> = ({ children }) => {
  const [popoverOpened, setPopoverOpened] = useState(false);

  // Get upload state for popover content
  const { uploadingSpotId, uploadingSpotName, completedCount, totalCount } = useUploadStatus();

  return (
    <Popover
      opened={popoverOpened}
      onChange={setPopoverOpened}
      position="bottom-start"
      withArrow
      shadow="md"
    >
      <Popover.Target>
        <Box onClick={() => setPopoverOpened(true)}>
          {children}
        </Box>
      </Popover.Target>
      <Popover.Dropdown>
        <UploadPopoverContent
          spotName={uploadingSpotName || uploadingSpotId!}
          spotId={uploadingSpotId!}
          completedCount={completedCount}
          totalCount={totalCount}
          onNavigate={() => setPopoverOpened(false)}
        />
      </Popover.Dropdown>
    </Popover>
  );
};
