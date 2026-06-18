import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from 'shared/lib/notifications';
import { useDeleteMedia } from 'entities/Media';
import { useTRPC } from 'shared/lib/trpc';
import { useUploadStore } from './uploadStore';
import { UploadItem } from './types';

const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

const PICKER_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'image/tiff', 'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/mpeg',
].join(',');

type DriveDoc = google.picker.PickerDocument;

function createImportingItem(doc: DriveDoc): UploadItem {
  return {
    id: `drive-import-${doc.id}`,
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

export function useGooglePicker() {
  const [isPickerInitializing, setIsPickerInitializing] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutateAsync: registerDriveImport } = useMutation(trpc.media.registerDriveImport.mutationOptions());
  const { mutateAsync: deleteMedia } = useDeleteMedia();

  const importDriveDocs = useCallback(
    async (docs: DriveDoc[], accessToken: string) => {
      const skeletons = docs.map((doc) => createImportingItem(doc));
      useUploadStore.getState().addToQueue(skeletons);

      let anySucceeded = false;
      await Promise.all(skeletons.map(async (skeleton, i) => {
        const doc = docs[i]!;

        try {
          const mediaItem = await registerDriveImport({
            remoteFileId: doc.id,
            mimeType: doc.mimeType,
            accessToken,
          });
          const store = useUploadStore.getState();
          const wasCancelled = store.uploadQueue.find(i => i.id === skeleton.id)?.status === 'cancelled';
          if (wasCancelled) {
            deleteMedia({ id: mediaItem.id }).catch((err) =>
              console.error('[Drive import cancel] Failed to delete orphaned draft', { id: mediaItem.id, err }),
            );
            store.removeItem(skeleton.id);
          } else {
            store.updateItem(skeleton.id, {
              status: 'completed',
              progress: 100,
              mediaId: mediaItem.id,
              previewUrl: mediaItem.thumbnailUrl ?? doc.thumbnails?.[0]?.url ?? '',
            });
            anySucceeded = true;
          }
        } catch {
          const store = useUploadStore.getState();
          const wasCancelled = store.uploadQueue.find(i => i.id === skeleton.id)?.status === 'cancelled';
          if (!wasCancelled) {
            const errorMessage = `Failed to import "${doc.name}"`;
            store.updateItem(skeleton.id, { status: 'error', error: errorMessage });
            notify.error(errorMessage, 'Drive Import Error');
          } else {
            store.removeItem(skeleton.id);
          }
        }
      }));
      if (anySucceeded) void queryClient.invalidateQueries({ queryKey: trpc.media.myDrafts.queryKey() });
    },
    [registerDriveImport, deleteMedia, queryClient, trpc],
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

  return { trigger, isPickerLoading: isPickerInitializing || isPickerOpen };
}
