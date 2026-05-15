// src/features/Upload/model/useGooglePicker.ts
import { useCallback } from 'react';
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

/**
 * Orchestrates Google Drive import:
 * 1. Requests an OAuth2 access token (silent if already authorised).
 * 2. Opens the Google Picker with Drive scope.
 * 3. For each selected file calls media.registerDriveImport and appends to
 *    the draft media TanStack Query cache — card appears immediately.
 */
export function useGooglePicker(spotId: string) {
  const trpc = useTRPC();
  const { append } = useDraftMediaMutate(spotId);

  const { mutateAsync: registerDriveImport } = useMutation(
    trpc.media.registerDriveImport.mutationOptions(),
  );

  const openPicker = useCallback(
    (accessToken: string) => {
      if (!window.gapi) {
        notify.error('Google Picker is not loaded yet. Please try again.', 'Drive Error');
        return;
      }

      gapi.load('picker', () => {
        const picker = new google.picker.PickerBuilder()
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
            const docs = data.docs ?? [];

            for (const doc of docs) {
              const driveThumbnailUrl =
                doc.thumbnails?.[0]?.url ??
                `https://lh3.googleusercontent.com/d/${doc.id}=w400`;

              try {
                const mediaItem = await registerDriveImport({
                  spotId,
                  remoteFileId: doc.id,
                  mimeType: doc.mimeType,
                  driveThumbnailUrl,
                });
                append(mediaItem);
              } catch {
                notify.error(
                  `Failed to import "${doc.name}"`,
                  'Drive Import Error',
                );
              }
            }
          })
          .build();

        picker.setVisible(true);
      });
    },
    [spotId, registerDriveImport, append],
  );

  const trigger = useCallback(() => {
    if (!window.google?.accounts?.oauth2) {
      notify.error('Google Sign-in is not available yet. Please try again.', 'Drive Error');
      return;
    }

    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: DRIVE_READONLY_SCOPE,
      callback: (response) => {
        if (response.error) {
          notify.error('Google Drive access was denied.', 'Drive Error');
          return;
        }
        openPicker(response.access_token);
      },
    });

    tokenClient.requestAccessToken({ prompt: '' });
  }, [openPicker]);

  return { trigger };
}
