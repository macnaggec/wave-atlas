import { trpcClient } from 'app/lib/trpcClient';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'server/router';
import { uploadToCloudinary } from './cloudinaryTransport';
import { getErrorMessage } from 'shared/lib/getErrorMessage';
import { extractExifData } from 'shared/lib/exifExtractor';
import { MediaItem } from 'entities/Media/types';
import { MEDIA_UPLOAD_CONFIG } from 'entities/Media/constants';
import { notify } from 'shared/lib/notifications';
import { CloudinaryResult, ExifMetadata, UploadItem } from './types';

type SignatureData = inferRouterOutputs<AppRouter>['media']['signCloudinary'];

/**
 * LOW-LEVEL IMPLEMENTATION
 *
 * Executes the upload pipeline stages.
 * Handles technical details of API calls and data transformation.
 */
export class UploadPipeline {
  constructor(
    private spotId: string,
    private updateItemStatus: (updates: Partial<UploadItem>) => void,
  ) { }

  async extractMetadata(file: File): Promise<ExifMetadata> {
    const exifData = await extractExifData(file);

    // Convert ExifData to ExifMetadata format
    // Map 'fallback' to 'none' since no EXIF data was found
    return {
      capturedAt: exifData.capturedAt ?? undefined,
      source: exifData.source === 'fallback' ? 'none' : exifData.source
    };
  }

  async getSignature(): Promise<SignatureData> {
    this.updateItemStatus({ status: 'signing' });
    return await trpcClient.media.signCloudinary.mutate({
      folder: MEDIA_UPLOAD_CONFIG.FOLDER,
    });
  }

  uploadToCloud(
    file: File,
    signature: SignatureData,
    onProgress: (progress: number) => void,
  ): { promise: Promise<CloudinaryResult>; abort: () => void } {
    this.updateItemStatus({ status: 'uploading', progress: 0 });

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

  async saveToDatabase(
    cloudResult: CloudinaryResult,
    exifData: ExifMetadata
  ): Promise<MediaItem> {
    this.updateItemStatus({ status: 'saving', progress: 100 });

    const mediaItem = await trpcClient.media.create.mutate({
      spotId: this.spotId,
      cloudinaryResult: cloudResult,
      capturedAt: exifData.capturedAt ?? undefined,
    });

    // Only set dateSource if EXIF data was found
    // 'none' and 'manual' shouldn't set dateSource on MediaItem
    return exifData.source === 'exif'
      ? { ...mediaItem, dateSource: 'exif' as const }
      : mediaItem;
  }

  complete(mediaId: string): void {
    this.updateItemStatus({ status: 'completed', mediaId });
  }

  handleError(error: unknown, file: File | null): void {
    const message = getErrorMessage(error);

    // User cancellations are silent
    if (this.isUserCancellation(message)) {
      return;
    }

    this.updateItemStatus({ status: 'error', error: message });
    notify.error(`${file?.name || 'File'}: ${message}`, 'Upload Failed');
  }

  private isUserCancellation(message: string): boolean {
    return message.includes('cancelled') || message.includes('abort');
  }
}
