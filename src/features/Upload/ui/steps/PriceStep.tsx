import { Box, Group, NumberInput } from '@mantine/core';
import { IconPhoto, IconVideo } from '@tabler/icons-react';
import { MIN_MEDIA_PRICE_CENTS } from 'entities/Media';
import { useUploadStore } from '../../model';

interface PriceStepProps {
  hasTriedPublish: boolean;
}

export function PriceStep({ hasTriedPublish }: PriceStepProps) {
  const photoPrice = useUploadStore((s) => s.photoPrice);
  const videoPrice = useUploadStore((s) => s.videoPrice);
  const setPhotoPrice = useUploadStore((s) => s.setPhotoPrice);
  const setVideoPrice = useUploadStore((s) => s.setVideoPrice);

  const minDollars = MIN_MEDIA_PRICE_CENTS / 100;
  const photoError = hasTriedPublish && photoPrice < MIN_MEDIA_PRICE_CENTS;
  const videoError = hasTriedPublish && videoPrice < MIN_MEDIA_PRICE_CENTS;

  const inputStyles = {
    input: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' },
    controls: { borderLeft: '1px solid rgba(255,255,255,0.08)' },
    control: { borderColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)' },
  };

  return (
    <Group gap="md" px="md" py="sm">
      <Group gap={6} align="center">
        <Box style={{ display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.45)' }}>
          <IconPhoto size={20} />
        </Box>
        <NumberInput
          size="xs"
          value={photoPrice / 100}
          onChange={(val) => setPhotoPrice(typeof val === 'number' ? Math.round(val * 100) : MIN_MEDIA_PRICE_CENTS)}
          min={minDollars}
          step={1}
          decimalScale={0}
          prefix="$"
          placeholder={`$${minDollars}`}
          w={80}
          error={photoError ? `Min $${minDollars}` : undefined}
          styles={inputStyles}
        />
      </Group>
      <Group gap={6} align="center">
        <Box style={{ display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.45)' }}>
          <IconVideo size={20} />
        </Box>
        <NumberInput
          size="xs"
          value={videoPrice / 100}
          onChange={(val) => setVideoPrice(typeof val === 'number' ? Math.round(val * 100) : MIN_MEDIA_PRICE_CENTS)}
          min={minDollars}
          step={1}
          decimalScale={0}
          prefix="$"
          placeholder={`$${minDollars}`}
          w={80}
          error={videoError ? `Min $${minDollars}` : undefined}
          styles={inputStyles}
        />
      </Group>
    </Group>
  );
}
