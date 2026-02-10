'use client';

import React, { FC, memo, useRef } from 'react';
import { ActionIcon, Box, Stack, Text, Tooltip } from '@mantine/core';
import { IconPhotoPlus } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { validateFileBatch } from 'shared/lib/uploadValidation';
import classes from './AddFileCard.module.css';

/**
 * Props for AddFileCard component
 */
export interface AddFileCardProps {
  /** Callback when files are selected */
  onFilesSelected: (files: File[]) => void;

  /** File input accept attribute (default: 'image/*,video/*') */
  accept?: string;

  /** Whether to allow multiple file selection (default: true) */
  multiple?: boolean;

  /** Custom tooltip text showing upload limits */
  tooltipContent?: React.ReactNode;
}

/**
 * AddFileCard - Special card for triggering file upload
 *
 * Renders a card with an ActionIcon that naturally fits in the gallery grid.
 * Includes a tooltip showing upload limits and validates files before upload.
 * Designed to be used as the first card in upload galleries via the `prepend` slot.
 *
 * @example
 * ```tsx
 * <Gallery
 *   prepend={<AddFileCard onFilesSelected={addFiles} />}
 *   items={uploadItems}
 *   renderCard={...}
 * />
 * ```
 */
const AddFileCard: FC<AddFileCardProps> = memo(({
  onFilesSelected,
  accept = 'image/*,video/*',
  multiple = true,
  tooltipContent,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) return;

    // Validate files
    const validation = validateFileBatch(files);

    // Show errors if any
    if (!validation.valid) {
      notifications.show({
        title: 'Upload Error',
        message: validation.errors.join('\n'),
        color: 'red',
        autoClose: 8000,
      });

      // If some files are valid, show them
      if (validation.validFiles.length > 0) {
        notifications.show({
          title: 'Partial Upload',
          message: `${validation.validFiles.length} of ${files.length} files will be uploaded`,
          color: 'yellow',
          autoClose: 5000,
        });
        onFilesSelected(validation.validFiles);
      }
    } else {
      // All files valid, show warnings if any
      if (validation.warnings.length > 0) {
        notifications.show({
          title: 'Upload Warning',
          message: validation.warnings.join('\n'),
          color: 'yellow',
          autoClose: 5000,
        });
      }

      onFilesSelected(validation.validFiles);
    }

    // Reset input to allow selecting the same files again
    event.target.value = '';
  };

  const defaultTooltip = (
    <Stack gap={4}>
      <Text size="xs" fw={600}>Upload Limits:</Text>
      <Text size="xs">• Images: max 10MB</Text>
      <Text size="xs">• Videos: max 50MB</Text>
      <Text size="xs">• Max 20 files per batch</Text>
      <Text size="xs">• Max 200MB total per batch</Text>
    </Stack>
  );

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        style={{ display: 'none' }}
        aria-label="File upload input"
      />

      <Tooltip
        label={tooltipContent || defaultTooltip}
        position="right"
        withArrow
        multiline
        w={220}
        openDelay={500}
        closeDelay={100}
      >
        <Box className={classes.card} onClick={handleClick}>
          <Stack align="center" justify="center" gap={4} className={classes.content}>
            <ActionIcon
              size={36}
              radius="md"
              variant="light"
              color="blue"
              className={classes.actionIcon}
            >
              <IconPhotoPlus size={20} stroke={1.5} />
            </ActionIcon>
            <Text size="xs" fw={500} className={classes.label}>
              Add Files
            </Text>
          </Stack>
        </Box>
      </Tooltip>
    </>
  );
});

AddFileCard.displayName = 'AddFileCard';

export default AddFileCard;
