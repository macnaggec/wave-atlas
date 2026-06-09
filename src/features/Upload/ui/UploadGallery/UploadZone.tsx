import { useRef } from 'react';
import { Box, Button, Group, Stack, Text } from '@mantine/core';
import { IconBrandGoogleDrive, IconFolderOpen, IconUpload } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { validateFileBatch } from 'entities/Media';

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  onDriveImport?: () => void;
  driveLoading?: boolean;
  disabled?: boolean;
}

export function UploadZone({ onFilesSelected, onDriveImport, driveLoading, disabled }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const { valid, validFiles, errors, warnings } = validateFileBatch(files);
    if (!valid) {
      notifications.show({ title: 'Upload Error', message: errors.join('\n'), color: 'red', autoClose: 8000 });
      if (validFiles.length > 0) {
        notifications.show({ title: 'Partial Upload', message: `${validFiles.length} of ${files.length} files will be uploaded`, color: 'yellow', autoClose: 5000 });
        onFilesSelected(validFiles);
      }
    } else {
      if (warnings.length > 0)
        notifications.show({ title: 'Upload Warning', message: warnings.join('\n'), color: 'yellow', autoClose: 5000 });
      onFilesSelected(validFiles);
    }
    e.target.value = '';
  };

  return (
    <Box px="md" pb="md">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleChange}
        style={{ display: 'none' }}
        aria-label="File upload input"
      />
      <Stack
        gap="md"
        align="center"
        py="xl"
        style={{
          borderRadius: 8,
          background: 'rgba(255,255,255,0.08)',
          border: '1px dashed rgba(255,255,255,0.14)',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <IconUpload size={28} stroke={1.5} style={{ color: 'rgba(255,255,255,0.7)' }} />
        <Text size="xs" style={{ color: 'rgba(255,255,255,0.65)' }}>Images & videos · max 50MB per file</Text>
        <Group gap="xs">
          <Button
            leftSection={<IconBrandGoogleDrive size={14} />}
            size="sm"
            variant="light"
            onClick={() => !disabled && onDriveImport?.()}
            loading={driveLoading}
            disabled={disabled}
          >
            Google Drive
          </Button>
          <Button
            leftSection={<IconFolderOpen size={14} />}
            size="sm"
            variant="subtle"
            onClick={() => !disabled && inputRef.current?.click()}
            disabled={disabled}
          >
            Local files
          </Button>
        </Group>
      </Stack>
    </Box>
  );
}
