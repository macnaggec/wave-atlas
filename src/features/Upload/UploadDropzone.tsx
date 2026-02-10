'use client';

import { Group, Text, rem, useMantineTheme } from '@mantine/core';
import { IconUpload, IconPhoto, IconX } from '@tabler/icons-react';
import { Dropzone, DropzoneProps, IMAGE_MIME_TYPE, FileRejection } from '@mantine/dropzone';
import { notify } from 'shared/lib/notifications';
import { memo, useMemo, useCallback } from 'react';
import classes from './UploadDropzone.module.css';

export interface UploadDropzoneProps extends Partial<DropzoneProps> {
  onDrop: (files: File[]) => void;
}

export const UploadDropzone = memo(({ onDrop, ...props }: UploadDropzoneProps) => {
  const theme = useMantineTheme();

  const handleReject = useCallback((files: FileRejection[]) => {
    notify.error(
      `${files.length} file(s) were rejected. Check size or type.`,
      'File Rejected'
    );
  }, []);

  const iconSize = useMemo(() => ({ width: rem(52), height: rem(52) }), []);


  return (
    <Dropzone
      onDrop={onDrop}
      onReject={handleReject}
      maxSize={50 * 1024 * 1024} // 50MB
      accept={[...IMAGE_MIME_TYPE, 'video/mp4', 'video/quicktime', 'video/webm']}
      {...props}
    >
      <Group justify="center" gap="xl" mih={220} className={classes.dropzoneContent}>
        <Dropzone.Accept>
          <IconUpload
            className={classes.iconAccept}
            style={iconSize}
            stroke={1.5}
          />
        </Dropzone.Accept>
        <Dropzone.Reject>
          <IconX
            className={classes.iconReject}
            style={iconSize}
            stroke={1.5}
          />
        </Dropzone.Reject>
        <Dropzone.Idle>
          <IconPhoto
            className={classes.iconIdle}
            style={iconSize}
            stroke={1.5}
          />
        </Dropzone.Idle>

        <div>
          <Text size="xl" inline>
            Drag images or videos here or click to select
          </Text>
          <Text size="sm" c="dimmed" inline mt={7}>
            Attach as many files as you like, each file should not exceed 50mb
          </Text>
        </div>
      </Group>
    </Dropzone>
  );
});

UploadDropzone.displayName = 'UploadDropzone';
