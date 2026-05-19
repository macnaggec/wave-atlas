// src/features/Upload/model/useGooglePicker.ts
import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';
import { notify } from 'shared/lib/notifications';
import { useDraftMediaMutate } from './useDraftMedia';

const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

const PICKER_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'image/tiff', 'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/mpeg',
].join(',');

type DriveImportItem = {
  id: string;
  name?: string;
  mimeType?: string;
  thumbnailUrl?: string;
};

type DriveDoc = google.picker.PickerDocument;

function createImportingItem(doc: DriveDoc): DriveImportItem {
  return {
    id: `drive-import-${doc.id}`,
    name: doc.name,
    mimeType: doc.mimeType,
    thumbnailUrl: doc.thumbnails?.[0]?.url ?? doc.url,
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

  return new Promise((resolve) => {
    gapi.load('picker', resolve);
  });
}

function buildPicker(
  accessToken: string,
  onPick: (docs: DriveDoc[]) => Promise<void>
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
      if (data.action !== google.picker.Action.PICKED) return;
      await onPick(data.docs ?? []);
    })
    .build();
}

export function useGooglePicker(spotId: string) {
  const trpc = useTRPC();
  const { append } = useDraftMediaMutate(spotId);

  const [isPickerLoading, setIsPickerLoading] = useState(false);
  const [importingItems, setImportingItems] = useState<DriveImportItem[]>([]);

  const { mutateAsync: registerDriveImport } = useMutation(
    trpc.media.registerDriveImport.mutationOptions(),
  );

  const importDriveDocs = useCallback(
    async (docs: DriveDoc[], accessToken: string) => {
      const skeletons = docs.map(createImportingItem);
      setImportingItems((current) => [...current, ...skeletons]);

      await Promise.all(docs.map(async (doc) => {
        const skeletonId = `drive-import-${doc.id}`;

        try {
          const mediaItem = await registerDriveImport({
            spotId,
            remoteFileId: doc.id,
            mimeType: doc.mimeType,
            accessToken,
          });
          append(mediaItem);
        } catch {
          notify.error(`Failed to import "${doc.name}"`, 'Drive Import Error');
        } finally {
          setImportingItems((current) => current.filter((item) => item.id !== skeletonId));
        }
      }));
    },
    [append, registerDriveImport, spotId],
  );

  const trigger = useCallback(async () => {
    setIsPickerLoading(true);

    try {
      const accessToken = await requestDriveAccessToken();
      await loadGooglePicker();
      const picker = buildPicker(accessToken, (docs) => importDriveDocs(docs, accessToken));
      picker.setVisible(true);
    } catch (error) {
      notify.error(
        error instanceof Error ? error.message : 'Google Drive import failed. Please try again.',
        'Drive Error',
      );
    } finally {
      setIsPickerLoading(false);
    }
  }, [importDriveDocs]);

  return { trigger, isPickerLoading, importingItems };
}
