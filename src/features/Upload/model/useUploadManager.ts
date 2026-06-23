import { useCallback } from 'react';
import { MEDIA_UPLOAD_LIMITS } from 'entities/Media';
import { notify } from 'shared/lib/notifications';
import { getErrorMessage } from 'shared/lib/getErrorMessage';
import { useUploadCommands } from './useUploadCommands';
import {
  startLocalUpload,
  startDriveUpload,
  discardAttempt,
  discardAllDraft,
  retryAttempt,
  type DriveSelection,
} from './uploadCoordinator';
import { requestDriveAccessToken } from './useGooglePicker';

function validateFileSize(file: File): void {
  const max = file.type.startsWith('video/')
    ? MEDIA_UPLOAD_LIMITS.MAX_FILE_SIZE_VIDEO
    : MEDIA_UPLOAD_LIMITS.MAX_FILE_SIZE_IMAGE;
  if (file.size > max) throw new Error(`${file.name} exceeds the maximum allowed size.`);
}

export function useUploadManager(draftId: string) {
  const commands = useUploadCommands(draftId);
  const deps = { commands, draftId };

  const addFiles = useCallback((files: File[]) => {
    for (const file of files) {
      try {
        validateFileSize(file);
        void startLocalUpload(file, deps).catch(err =>
          notify.error(`${file.name}: ${getErrorMessage(err)}`, 'Upload Failed'),
        );
      } catch (err) {
        notify.error(getErrorMessage(err), 'Upload Failed');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);

  const addDriveSelections = useCallback((selections: DriveSelection[]) => {
    for (const sel of selections) {
      void startDriveUpload(sel, deps).catch(err =>
        notify.error(getErrorMessage(err), 'Drive Import Failed'),
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);

  const remove = useCallback(async (kind: 'attempt' | 'draft', id: string) => {
    try {
      if (kind === 'draft') {
        await commands.deleteDraftMedia({ id });
      } else {
        await discardAttempt(id, deps);
      }
    } catch (err) {
      notify.error(getErrorMessage(err), 'Delete Failed');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);

  const discardAll = useCallback(async () => {
    try {
      await discardAllDraft(deps);
    } catch (err) {
      notify.error(getErrorMessage(err), 'Discard Failed');
      throw err;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);

  const retry = useCallback((id: string) => {
    void retryAttempt(id, deps, requestDriveAccessToken).catch(err =>
      notify.error(getErrorMessage(err), 'Retry Failed'),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);

  return { addFiles, addDriveSelections, remove, discardAll, retry };
}
