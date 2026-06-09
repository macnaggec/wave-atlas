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

type CreateMediaInput = {
  spotId: string;
  sessionId?: string;
  cloudinaryResult: CloudinaryResult;
  capturedAt?: Date;
};

type PipelineDeps = {
  signCloudinary: () => Promise<SignatureData>;
  createMedia: (input: CreateMediaInput) => Promise<MediaItem>;
};

export function createUploadPipeline(
  spotId: string,
  sessionId: string | null,
  updateStatus: (updates: Partial<UploadItem>) => void,
  deps: PipelineDeps,
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
    return await deps.signCloudinary();
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
    const mediaItem = await deps.createMedia({
      spotId,
      ...(sessionId !== null ? { sessionId } : {}),
      cloudinaryResult: cloudResult,
      capturedAt: exifData.capturedAt ?? undefined,
    });
    return exifData.source === 'exif'
      ? { ...mediaItem, dateSource: 'exif' as const }
      : mediaItem;
  }

  function complete(mediaId: string, capturedAt?: Date): void {
    updateStatus({ status: 'completed', mediaId, capturedAt });
  }

  function handleError(error: unknown): string | null {
    const message = getErrorMessage(error);
    if (message.includes('cancelled') || message.includes('abort')) {
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
    handleError,
  };
}
