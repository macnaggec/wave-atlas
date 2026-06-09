// src/features/Upload/model/useGooglePicker.ts
import { useCallback, useState } from 'react';
import { notify } from 'shared/lib/notifications';
import { useRegisterDriveImport } from 'entities/Media';
import { useUploadStore } from './uploadStore';
import { QueueItem } from './types';

const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

const PICKER_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'image/tiff', 'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/mpeg',
].join(',');

type DriveDoc = google.picker.PickerDocument;

function createImportingItem(doc: DriveDoc, spotId: string, sessionId: string | null): QueueItem {
  return {
    id: `drive-import-${doc.id}`,
    spotId,
    sessionId,
    file: null,
    previewUrl: doc.thumbnails?.[0]?.url ?? doc.url ?? '',
    status: 'importing',
    progress: 0,
  };
}

async function requestDriveAccessToken(): Promise<string> {
  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Sign-in is not available yet. Please try again.');
  }

  return new Promise((resolve, reject) => {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: DRIVE_READONLY_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error('Google Drive access was denied.'));
          return;
        }
        resolve(response.access_token);
      },
      error_callback: () => reject(new Error('Google Drive authorization failed. Please try again.')),
    });

    tokenClient.requestAccessToken({ prompt: '' });
  });
}

async function loadGooglePicker(): Promise<void> {
  if (!window.gapi) {
    throw new Error('Google Picker is not loaded yet. Please try again.');
  }

  const load = new Promise<void>((resolve) => { gapi.load('picker', resolve); });
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Google Picker took too long to load. Please try again.')), 10_000),
  );

  return Promise.race([load, timeout]);
}

function buildPicker(
  accessToken: string,
  onPick: (docs: DriveDoc[]) => Promise<void>,
  onClose: () => void,
) {
  return new google.picker.PickerBuilder()
    .addView(
      new google.picker.DocsView(google.picker.ViewId.DOCS)
        .setMimeTypes(PICKER_MIME_TYPES)
        .setIncludeFolders(false),
    )
    .setOAuthToken(accessToken)
    .setDeveloperKey(import.meta.env.VITE_GOOGLE_API_KEY ?? '')
    .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
    .setTitle('Select photos or videos from Google Drive')
    .setCallback(async (data: google.picker.PickerResponseObject) => {
      if (data.action === google.picker.Action.CANCEL) {
        onClose();
        return;
      }
      if (data.action === google.picker.Action.PICKED) {
        onClose();
        await onPick(data.docs ?? []);
      }
    })
    .build();
}

export function useGooglePicker(spotId: string, sessionId: string | null) {
  const [isPickerInitializing, setIsPickerInitializing] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [importingItems, setImportingItems] = useState<QueueItem[]>([]);

  const { mutateAsync: registerDriveImport } = useRegisterDriveImport();

  const importDriveDocs = useCallback(
    async (docs: DriveDoc[], accessToken: string) => {
      const skeletons = docs.map((doc) => createImportingItem(doc, spotId, sessionId));
      setImportingItems((current) => [...current, ...skeletons]);

      await Promise.all(docs.map(async (doc) => {
        const skeletonId = `drive-import-${doc.id}`;

        try {
          const mediaItem = await registerDriveImport({
            spotId,
            ...(sessionId !== null ? { sessionId } : {}),
            remoteFileId: doc.id,
            mimeType: doc.mimeType,
            accessToken,
          });
          // Always add to Zustand so the item is visible regardless of sessionId.
          // When sessionId is null, append() is a no-op and Zustand is the only store.
          // When sessionId is set, useUploadQueue deduplicates by mediaId so the item
          // appears once (via the Zustand path with result resolved from TQ).
          useUploadStore.getState().addToQueue([{
            id: skeletonId,
            spotId,
            sessionId,
            file: null,
            previewUrl: mediaItem.thumbnailUrl ?? doc.thumbnails?.[0]?.url ?? '',
            status: 'completed',
            progress: 100,
            mediaId: mediaItem.id,
          }]);
        } catch {
          notify.error(`Failed to import "${doc.name}"`, 'Drive Import Error');
        } finally {
          setImportingItems((current) => current.filter((item) => item.id !== skeletonId));
        }
      }));
    },
    [registerDriveImport, spotId, sessionId],
  );

  const trigger = useCallback(async () => {
    setIsPickerInitializing(true);

    try {
      const accessToken = await requestDriveAccessToken();
      await loadGooglePicker();
      const picker = buildPicker(
        accessToken,
        (docs) => importDriveDocs(docs, accessToken),
        () => setIsPickerOpen(false),
      );
      setIsPickerOpen(true);
      picker.setVisible(true);
    } catch (error) {
      notify.error(
        error instanceof Error ? error.message : 'Google Drive import failed. Please try again.',
        'Drive Error',
      );
    } finally {
      setIsPickerInitializing(false);
    }
  }, [importDriveDocs]);

  return { trigger, isPickerLoading: isPickerInitializing || isPickerOpen, importingItems };
}
