import { v4 as uuidv4 } from 'uuid';
import { uploadToCloudinary } from './cloudinaryTransport';
import { useUploadStore } from './uploadStore';
import { revokeBlobUrl } from './types';
import type { UploadCommands } from './useUploadCommands';

// ── Deps injected from useUploadManager ──────────────────────────────────────

export type CoordinatorDeps = {
  commands: UploadCommands;
  draftId: string;
};

// ── Drive selection type ─────────────────────────────────────────────────────

export type DriveSelection = {
  remoteFileId: string;
  declaredMimeType: string;
  thumbnailUrl: string;
  accessToken: string;
};

// ── Local upload ─────────────────────────────────────────────────────────────

export async function startLocalUpload(file: File, deps: CoordinatorDeps): Promise<void> {
  const clientRequestId = uuidv4();
  const previewUrl = URL.createObjectURL(file);

  useUploadStore.getState().addTransfer({
    source: 'local',
    clientRequestId,
    file,
    previewUrl,
    progress: 0,
  });

  try {
    const grant = await deps.commands.beginLocal({
      draftId: deps.draftId,
      clientRequestId,
      declaredMimeType: file.type,
      declaredByteSize: file.size,
    });

    useUploadStore.getState().updateTransfer(clientRequestId, { attemptId: grant.attemptId });

    const { promise, abort } = uploadToCloudinary({
      file,
      signature: grant.signature,
      timestamp: grant.timestamp,
      apiKey: grant.apiKey,
      cloudName: grant.cloudName,
      folder: '',           // public_id is already scoped — folder param not needed
      eager: grant.eager,
      onProgress: (progress) =>
        useUploadStore.getState().updateTransfer(clientRequestId, { progress }),
    });

    useUploadStore.getState().updateTransfer(clientRequestId, { abort });

    const receipt = await promise;

    await deps.commands.finalizeLocal({
      attemptId: grant.attemptId,
      providerReceipt: receipt,
    });

    // Remove browser resources — MediaItem is now in Query cache.
    revokeBlobUrl(previewUrl);
    useUploadStore.getState().removeTransfer(clientRequestId);
  } catch (err) {
    const transfer = useUploadStore.getState().transfers.get(clientRequestId);
    if (!transfer) return; // already removed (discard during upload)
    // Leave transfer in store with current state — attempt status comes from Query.
    useUploadStore.getState().updateTransfer(clientRequestId, { progress: 0 });
    throw err;
  }
}

// ── Drive upload ─────────────────────────────────────────────────────────────

export async function startDriveUpload(
  selection: DriveSelection,
  deps: CoordinatorDeps,
): Promise<void> {
  const clientRequestId = uuidv4();

  useUploadStore.getState().addTransfer({
    source: 'drive',
    clientRequestId,
    previewUrl: selection.thumbnailUrl,
  });

  const { attemptId } = await deps.commands.beginDrive({
    draftId: deps.draftId,
    clientRequestId,
    remoteFileId: selection.remoteFileId,
    declaredMimeType: selection.declaredMimeType,
  });

  useUploadStore.getState().updateTransfer(clientRequestId, { attemptId });

  await deps.commands.processDrive({ attemptId, accessToken: selection.accessToken });

  // Remove browser thumbnail — MediaItem is now in Query cache.
  useUploadStore.getState().removeTransfer(clientRequestId);
}

// ── Discard ───────────────────────────────────────────────────────────────────

export async function discardAttempt(
  clientRequestIdOrAttemptId: string,
  deps: CoordinatorDeps,
): Promise<void> {
  // Find the transfer by clientRequestId or attemptId.
  const all = useUploadStore.getState().getAll();
  const transfer = all.find(
    t => t.clientRequestId === clientRequestIdOrAttemptId
      || t.attemptId === clientRequestIdOrAttemptId,
  );

  // Abort in-flight XHR immediately.
  if (transfer?.source === 'local' && transfer.abort) {
    try { transfer.abort(); } catch { /* expected */ }
  }

  if (transfer?.source === 'local') revokeBlobUrl(transfer.previewUrl);

  if (transfer?.attemptId) {
    await deps.commands.discard({ attemptId: transfer.attemptId });
  }

  if (transfer) {
    useUploadStore.getState().removeTransfer(transfer.clientRequestId);
  }
}

export async function discardAllDraft(deps: CoordinatorDeps): Promise<void> {
  // Abort all in-flight local XHRs immediately.
  useUploadStore.getState().getAll().forEach(t => {
    if (t.source === 'local') {
      if (t.abort) try { t.abort(); } catch { /* expected */ }
      revokeBlobUrl(t.previewUrl);
    }
  });

  // Single server transaction — awaited before UI clears.
  await deps.commands.discardDraft({ draftId: deps.draftId });

  useUploadStore.getState().clearTransfers();
}

// ── Retry ─────────────────────────────────────────────────────────────────────

export async function retryAttempt(
  clientRequestIdOrAttemptId: string,
  deps: CoordinatorDeps,
  requestDriveAccessToken: () => Promise<string>,
): Promise<void> {
  const transfer = useUploadStore.getState().getAll().find(
    t => t.clientRequestId === clientRequestIdOrAttemptId
      || t.attemptId === clientRequestIdOrAttemptId,
  );

  if (!transfer) return;

  if (transfer.source === 'local') {
    await startLocalUpload(transfer.file, deps);
    useUploadStore.getState().removeTransfer(transfer.clientRequestId);
  } else {
    // Drive retry: obtain fresh access token, then re-process.
    const accessToken = await requestDriveAccessToken();
    if (!transfer.attemptId) return;
    await deps.commands.processDrive({ attemptId: transfer.attemptId, accessToken });
    useUploadStore.getState().removeTransfer(transfer.clientRequestId);
  }
}
