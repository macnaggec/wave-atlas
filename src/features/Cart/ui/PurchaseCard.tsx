import { memo, useCallback } from 'react';
import { Card, Group, Image, Text } from '@mantine/core';
import DownloadButton from 'features/Cart/ui/DownloadButton';
import { formatPrice } from 'shared/lib/currency';
import classes from './PurchaseCard.module.css';

export interface PurchaseCardItem {
  id: string;
  amountPaid: number;
  previewUrl: string | null;
  mediaItem: { id: string; thumbnailUrl: string };
}

export interface PurchaseCardProps {
  purchase: PurchaseCardItem;
  isDownloading: boolean;
  isAnyDownloading: boolean;
  onDownload: (mediaItemId: string) => void;
  onPreview: (mediaItemId: string) => void;
}

function PurchaseCard({
  purchase,
  isDownloading,
  isAnyDownloading,
  onDownload,
  onPreview,
}: PurchaseCardProps) {
  const handleClick = useCallback(() => {
    if (purchase.previewUrl) onPreview(purchase.mediaItem.id);
  }, [purchase.previewUrl, purchase.mediaItem.id, onPreview]);

  return (
    <Card
      padding="xs"
      radius="md"
      withBorder
      className={purchase.previewUrl ? classes.card : undefined}
      onClick={handleClick}
    >
      <Card.Section>
        <Image
          src={purchase.mediaItem.thumbnailUrl}
          height={120}
          fit="cover"
          alt="Purchased media"
        />
      </Card.Section>

      <Group
        justify="space-between"
        mt="xs"
        wrap="nowrap"
      >
        <Text size="xs" c="dimmed">
          {formatPrice(purchase.amountPaid)}
        </Text>
        <DownloadButton
          mediaItemId={purchase.mediaItem.id}
          size="sm"
          loading={isDownloading}
          disabled={isAnyDownloading}
          onDownload={onDownload}
        />
      </Group>
    </Card>
  );
}

export default memo(PurchaseCard);
