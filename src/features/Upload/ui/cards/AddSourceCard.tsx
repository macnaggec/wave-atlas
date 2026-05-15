'use client';

import React, { FC, memo, useRef } from 'react';
import { Box, Button, Stack, Text, Tooltip } from '@mantine/core';
import { IconBrandGoogleDrive, IconFolderOpen } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { validateFileBatch } from 'entities/Media/lib/uploadValidation';
import classes from './AddFileCard.module.css';

export interface AddSourceCardProps {
  /** Callback when local files are selected */
  onFilesSelected: (files: File[]) => void;
  /** Callback to open Google Drive Picker */
  onDriveImport?: () => void;
  /** File input accept attribute (default: 'image/*,video/*') */
  accept?: string;
  /** Whether both actions are disabled (another spot is uploading) */
  disabled?: boolean;
  /** Tooltip content for upload limits */
  tooltipContent?: React.ReactNode;
}

const defaultTooltip = (
  <Stack gap={4}>
    <Text size="xs" fw={600}>Upload Limits:</Text>
    <Text size="xs">• Images: max 10MB</Text>
    <Text size="xs">• Videos: max 50MB</Text>
    <Text size="xs">• Max 20 files per batch</Text>
    <Text size="xs">• Max 200MB total per batch</Text>
  </Stack>
);

const AddSourceCard: FC<AddSourceCardProps> = memo(({
  onFilesSelected,
  onDriveImport,
  accept = 'image/*,video/*',
  disabled = false,
  tooltipContent,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleLocalClick = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const handleDriveClick = () => {
    if (disabled) return;
    onDriveImport?.();
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const validation = validateFileBatch(files);

    if (!validation.valid) {
      notifications.show({
        title: 'Upload Error',
        message: validation.errors.join('\n'),
        color: 'red',
        autoClose: 8000,
      });
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

    event.target.value = '';
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        onChange={handleChange}
        className={classes.hiddenInput}
        aria-label="File upload input"
        data-testid="file-input"
      />
      <Tooltip
        label={tooltipContent || defaultTooltip}
        position="right"
        withArrow
        multiline
        w={220}
        openDelay={500}
        closeDelay={100}
        disabled={disabled}
      >
        <Box
          className={classes.card}
          style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
        >
          <Stack align="center" justify="center" gap="xs" className={classes.content}>
            <Text size="xs" fw={500} c="dimmed">Add media</Text>
            <Button
              size="xs"
              variant="filled"
              color="blue"
              leftSection={<IconBrandGoogleDrive size={14} />}
              onClick={handleDriveClick}
              disabled={disabled}
              fullWidth
            >
              Google Drive
            </Button>
            <Button
              size="xs"
              variant="subtle"
              color="gray"
              leftSection={<IconFolderOpen size={14} />}
              onClick={handleLocalClick}
              disabled={disabled}
              fullWidth
            >
              Local files
            </Button>
          </Stack>
        </Box>
      </Tooltip>
    </>
  );
});

AddSourceCard.displayName = 'AddSourceCard';

export default AddSourceCard;
