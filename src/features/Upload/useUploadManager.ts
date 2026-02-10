import { useState, useCallback, useEffect, useRef } from 'react';
import { getCloudinarySignature, createMediaItem, deleteMedia } from 'app/actions/media';
import { uploadToCloudinary } from 'shared/lib/cloudinary-client';
import { getErrorMessage } from 'shared/lib/getErrorMessage';
import { extractExifData } from 'shared/lib/exifExtractor';
import { MediaItem } from 'entities/Media/types';
import { MEDIA_UPLOAD_CONFIG } from 'entities/Media/constants';
import { notify } from 'shared/lib/notifications';
import { v4 as uuidv4 } from 'uuid';

export type UploadStatus = 'pending' | 'signing' | 'uploading' | 'saving' | 'completed' | 'error';

export interface UploadItem {
  id: string;
  file: File | null;
  previewUrl: string;
  status: UploadStatus;
  progress: number;
  result?: MediaItem;
  error?: string;
  cloudinaryResult?: {
    secure_url: string;
    resource_type: string;
  };
}

export const useUploadManager = (
  spotId: string,
  initialDrafts: MediaItem[] | null = null
) => {
  // Initialize queue with server-fetched drafts using useState initializer
  const [queue, setQueue] = useState<UploadItem[]>(() => {
    if (!initialDrafts) return [];

    return initialDrafts.map((draft): UploadItem => ({
      id: draft.id,
      file: null as any,
      previewUrl: draft.watermarkUrl,
      status: 'completed',
      progress: 100,
      result: draft,
    }));
  });

  const isMountedRef = useRef(true);

  const queueRef = useRef<UploadItem[]>([]);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  // Cleanup object URLs to avoid memory leaks
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      queueRef.current.forEach((item) => {
        // Only revoke object URLs created from files, not stored URLs
        if (item.previewUrl && item.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, []); // Run only on unmount

  const processUpload = useCallback(async (id: string, file: File | null) => {
    if (!file) return;

    try {
      // 0. Extract EXIF metadata
      const exifData = await extractExifData(file);

      // Check if we already have a Cloudinary result (retry scenario)
      const existingItem = queueRef.current.find(i => i.id === id);
      const existingCloudinaryResult = existingItem?.cloudinaryResult;

      let cloudResult: { secure_url: string; resource_type: string };

      if (existingCloudinaryResult) {
        // Skip Cloudinary upload, reuse existing result
        cloudResult = existingCloudinaryResult;

        // Update UI to show we're skipping to save step
        if (!isMountedRef.current) return;
        setQueue((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: 'saving', progress: 100 } : item))
        );
      } else {
        // Normal flow: signature → upload
        // 1. Signing
        if (!isMountedRef.current) return;
        setQueue((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: 'signing' } : item))
        );

        const signatureData = await getCloudinarySignature({
          folder: MEDIA_UPLOAD_CONFIG.FOLDER
        });

        // 2. Uploading
        if (!isMountedRef.current) return;
        setQueue((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: 'uploading', progress: 0 } : item))
        );

        cloudResult = await uploadToCloudinary({
          file,
          signature: signatureData.signature,
          timestamp: signatureData.timestamp,
          apiKey: signatureData.apiKey || '',
          cloudName: signatureData.cloudName || '',
          folder: signatureData.folder,
          onProgress: (progress) => {
            if (!isMountedRef.current) return;
            setQueue((prev) =>
              prev.map((item) => (item.id === id ? { ...item, progress } : item))
            );
          },
        });

        // Store Cloudinary result immediately (before DB save)
        if (!isMountedRef.current) return;
        setQueue((prev) =>
          prev.map((item) =>
            item.id === id
              ? { ...item, cloudinaryResult: { secure_url: cloudResult.secure_url, resource_type: cloudResult.resource_type } }
              : item
          )
        );

        // 3. Saving to DB
        if (!isMountedRef.current) return;
        setQueue((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: 'saving', progress: 100 } : item))
        );
      }

      const mediaItem = await createMediaItem({
        spotId,
        cloudinaryResult: {
          secure_url: cloudResult.secure_url,
          resource_type: cloudResult.resource_type,
        },
        capturedAt: exifData.capturedAt || undefined,
      });

      // Store dateSource in result for UI badge display
      const mediaItemWithSource: MediaItem = {
        ...mediaItem,
        dateSource: exifData.source,
      };

      // 4. Success
      if (!isMountedRef.current) return;
      setQueue((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: 'completed', result: mediaItemWithSource } : item
        )
      );

    } catch (error: unknown) {
      const message = getErrorMessage(error);

      if (!isMountedRef.current) return;
      setQueue((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status: 'error', error: message } // Preserve cloudinaryResult
            : item
        )
      );

      notify.error(`${file?.name || 'File'}: ${message}`, 'Upload Failed');
    }
  }, [spotId]);

  const addFiles = useCallback((files: File[]) => {
    const newItems: UploadItem[] = files.map((file) => ({
      id: uuidv4(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending',
      progress: 0,
    }));

    setQueue((prev) => [...prev, ...newItems]);

    // Trigger uploads
    newItems.forEach((item) => {
      processUpload(item.id, item.file);
    });
  }, [processUpload]);

  const remove = useCallback(async (id: string) => {
    const item = queueRef.current.find(i => i.id === id);

    // If this is a completed draft (saved to DB), delete from database first
    if (item?.status === 'completed' && item.result) {
      const result = await deleteMedia({ id: item.result.id });

      if (!result.success) {
        notify.error(result.error, 'Delete Failed');
        return; // Don't remove from UI if deletion failed
      }
    }

    // Remove from local state
    setQueue((prev) => {
      const itemToRemove = prev.find(i => i.id === id);
      // Only revoke blob URLs, not stored URLs
      if (itemToRemove?.previewUrl && itemToRemove.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(itemToRemove.previewUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const clearCompleted = useCallback(() => {
    setQueue((prev) => {
      // Revoke URLs for removed items (only blobs)
      prev
        .filter(i => i.status === 'completed' && i.previewUrl.startsWith('blob:'))
        .forEach(i => URL.revokeObjectURL(i.previewUrl));
      return prev.filter((i) => i.status !== 'completed');
    });
  }, []);

  const retry = useCallback((id: string) => {
    const item = queueRef.current.find(i => i.id === id);
    if (!item || item.status !== 'error' || !item.file) return;

    // Reset status to pending and trigger upload
    setQueue((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: 'pending', progress: 0, error: undefined } : i))
    );

    // Trigger upload (will reuse cloudinaryResult if present)
    processUpload(id, item.file);
  }, [processUpload]);

  const removeByMediaIds = useCallback((mediaIds: string[]) => {
    setQueue((prev) => {
      // Find items to remove by matching result.id
      const toRemove = prev.filter(item =>
        item.result && mediaIds.includes(item.result.id)
      );

      // Revoke blob URLs for removed items
      toRemove.forEach(item => {
        if (item.previewUrl && item.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });

      // Filter out items with matching mediaIds
      return prev.filter(item =>
        !item.result || !mediaIds.includes(item.result.id)
      );
    });
  }, []);

  const updateMetadata = useCallback((
    mediaIds: string[],
    updates: Partial<Pick<MediaItem, 'price' | 'capturedAt'>>
  ) => {
    setQueue((prev) =>
      prev.map((item) => {
        // Only update items that have a result and match the mediaIds
        if (!item.result || !mediaIds.includes(item.result.id)) {
          return item;
        }

        // Update the result with new metadata
        return {
          ...item,
          result: {
            ...item.result,
            ...updates,
          },
        };
      })
    );
  }, []);

  return {
    queue,
    addFiles,
    remove,
    removeByMediaIds,
    clearCompleted,
    retry,
    updateMetadata,
    hasActiveUploads: queue.some(i => [
      'signing',
      'uploading',
      'saving'
    ].includes(i.status)),
  };
};
