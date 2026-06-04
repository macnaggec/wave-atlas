import { uploadToCloudinary } from './cloudinaryTransport';
import { getErrorMessage } from 'shared/lib/getErrorMessage';
import { extractExifData } from 'shared/lib/exifExtractor';
import { MediaItem } from 'entities/Media/types';
import { CloudinaryResult, ExifMetadata, UploadItem } from './types';

type SignatureData = {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  eager: string;
};

type PipelineClient = {
  media: {
    signCloudinary: { mutate: () => Promise<SignatureData> };
    create: { mutate: (input: {
      spotId: string;
      sessionId?: string;
      cloudinaryResult: CloudinaryResult;
      capturedAt?: Date;
    }) => Promise<MediaItem> };
  };
};

export function createUploadPipeline(
  spotId: string,
  sessionId: string | null,
  updateStatus: (updates: Partial<UploadItem>) => void,
  client: PipelineClient,
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

    return await client.media.signCloudinary.mutate();
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
      eager: signature.eager,
      onProgress,
    });
  }

  async function saveToDatabase(
    cloudResult: CloudinaryResult,
    exifData: ExifMetadata,
  ): Promise<MediaItem> {
    updateStatus({ status: 'saving', progress: 100 });
    const mediaItem = await client.media.create.mutate({
      spotId,
      ...(sessionId !== null ? { sessionId } : {}),
      cloudinaryResult: cloudResult,
      capturedAt: exifData.capturedAt ?? undefined,
    });
    // Only set dateSource if EXIF data was found
    // 'none' and 'manual' shouldn't set dateSource on MediaItem
    return exifData.source === 'exif'
      ? { ...mediaItem, dateSource: 'exif' as const }
      : mediaItem;
  }

  function complete(mediaId: string, capturedAt?: Date): void {
    updateStatus({ status: 'completed', mediaId, capturedAt });
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
