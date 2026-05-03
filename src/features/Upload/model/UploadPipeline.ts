import { trpcClient } from 'app/lib/trpcClient';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'server/router';
import { uploadToCloudinary } from './cloudinaryTransport';
import { getErrorMessage } from 'shared/lib/getErrorMessage';
import { extractExifData } from 'shared/lib/exifExtractor';
import { MediaItem } from 'entities/Media/types';
import { CloudinaryResult, ExifMetadata, UploadItem } from './types';

type SignatureData = inferRouterOutputs<AppRouter>['media']['signCloudinary'];

export function createUploadPipeline(
  spotId: string,
  updateStatus: (updates: Partial<UploadItem>) => void,
) {
  async function extractMetadata(file: File): Promise<ExifMetadata> {
    const exifData = await extractExifData(file);
    return {
      capturedAt: exifData.capturedAt ?? undefined,
      source: exifData.source === 'fallback' ? 'none' : exifData.source,
    };
  }

  async function getSignature(): Promise<SignatureData> {
    updateStatus({ status: 'signing' });

    return await trpcClient.media.signCloudinary.mutate();
  }

  function uploadToCloud(
    file: File,
    signature: SignatureData,
    onProgress: (progress: number) => void,
  ): { promise: Promise<CloudinaryResult>; abort: () => void } {
    updateStatus({ status: 'uploading', progress: 0 });
    return uploadToCloudinary({
      file,
      signature: signature.signature,
      timestamp: signature.timestamp,
      apiKey: signature.apiKey,
      cloudName: signature.cloudName,
      folder: signature.folder,
      type: signature.type,
      eager: signature.eager,
      onProgress,
    });
  }

  async function saveToDatabase(
    cloudResult: CloudinaryResult,
    exifData: ExifMetadata,
  ): Promise<MediaItem> {
    updateStatus({ status: 'saving', progress: 100 });
    const mediaItem = await trpcClient.media.create.mutate({
      spotId,
      cloudinaryResult: cloudResult,
      capturedAt: exifData.capturedAt ?? undefined,
    });
    // Only set dateSource if EXIF data was found
    // 'none' and 'manual' shouldn't set dateSource on MediaItem
    return exifData.source === 'exif'
      ? { ...mediaItem, dateSource: 'exif' as const }
      : mediaItem;
  }

  function complete(mediaId: string): void {
    updateStatus({ status: 'completed', mediaId });
  }

  // Returns the error message to show, or null if the error is a silent user cancellation.
  function handleError(error: unknown): string | null {
    const message = getErrorMessage(error);
    if (
      message.includes('cancelled')
      || message.includes('abort')) {
      return null;
    }
    updateStatus({ status: 'error', error: message });

    return message;
  }

  return {
    extractMetadata,
    getSignature,
    uploadToCloud,
    saveToDatabase,
    complete,
    handleError
  };
}
