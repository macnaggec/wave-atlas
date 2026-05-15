import { useMutation } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';
import { useDraftMediaMutate } from './useDraftMedia';

export interface DriveFile {
  fileId: string;
  mimeType: string;
  driveThumbnailUrl: string;
}

/**
 * Registers a Google Drive file as a DRIVE_PENDING media item.
 *
 * On success, the returned MediaItem is optimistically appended to the draft
 * cache so it appears immediately in the gallery without a round-trip refetch.
 */
export function useDriveImport(spotId: string) {
  const trpc = useTRPC();
  const { append } = useDraftMediaMutate(spotId);

  const { mutateAsync, isPending, error } = useMutation(
    trpc.media.registerDriveImport.mutationOptions({
      onSuccess: (mediaItem) => {
        append(mediaItem);
      },
    })
  );

  const importFromDrive = (file: DriveFile) =>
    mutateAsync({
      spotId,
      remoteFileId: file.fileId,
      mimeType: file.mimeType,
      driveThumbnailUrl: file.driveThumbnailUrl,
    });

  return { importFromDrive, isPending, error };
}
