import { memo } from 'react';
import { Group, Modal } from '@mantine/core';
import { ImageWithSkeleton } from 'shared/ui';
import DownloadButton from 'features/Cart/ui/DownloadButton';

export interface PurchaseLightboxItem {
  previewUrl: string | null;
  mediaItem: { id: string; thumbnailUrl: string };
}

export interface PurchaseLightboxProps {
  purchase: PurchaseLightboxItem | null;
  onClose: () => void;
  isDownloading: boolean;
  isAnyDownloading: boolean;
  onDownload: (mediaItemId: string) => void;
}

/**
 * PurchaseLightbox — full-size preview modal for a purchased media item.
 *
 * Shows a clean (no-watermark) preview via the stored previewUrl and
 * provides a download action for the original file.
 */
const PurchaseLightbox = memo(function PurchaseLightbox({
  purchase,
  onClose,
  isDownloading,
  isAnyDownloading,
  onDownload,
}: PurchaseLightboxProps) {
  return (
    <Modal
      opened={purchase !== null}
      onClose={onClose}
      size="xl"
      padding="sm"
      centered
      withCloseButton
    >
      {purchase && (
        <Group
          align="flex-end"
          justify="flex-end"
          mb="sm"
        >
          <DownloadButton
            mediaItemId={purchase.mediaItem.id}
            size="md"
            loading={isDownloading}
            disabled={isAnyDownloading}
            onDownload={onDownload}
          />
        </Group>
      )}
      {purchase?.previewUrl && (
        <ImageWithSkeleton
          key={purchase.mediaItem.id}
          src={purchase.previewUrl}
          alt="Purchased media preview"
          mah="70vh"
        />
      )}
    </Modal>
  );
});

export default PurchaseLightbox;
