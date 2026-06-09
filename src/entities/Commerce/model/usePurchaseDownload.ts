import { useCallback, useState } from 'react';
import { useTRPCClient } from 'app/lib/trpc';
import { notify } from 'shared/lib/notifications';
import { getErrorMessage } from 'shared/lib/getErrorMessage';

export function usePurchaseDownload() {
  const trpcClient = useTRPCClient();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const download = useCallback(async (mediaItemId: string) => {
    if (downloadingId !== null) return;
    setDownloadingId(mediaItemId);
    try {
      const { downloadUrl } = await trpcClient.checkout.getSignedMediaAccess.query({ mediaItemId });
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      notify.error(getErrorMessage(err), 'Download Failed');
    } finally {
      setDownloadingId(null);
    }
  }, [downloadingId, trpcClient]);

  const isDownloading = useCallback(
    (mediaItemId: string) => downloadingId === mediaItemId,
    [downloadingId],
  );

  const isAnyDownloading = downloadingId !== null;

  return { download, isDownloading, isAnyDownloading };
}
