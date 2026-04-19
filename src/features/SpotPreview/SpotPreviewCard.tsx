import { useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Carousel } from '@mantine/carousel';
import { Card, Text, Button, Image, Skeleton, Stack, Group, Badge, ThemeIcon } from '@mantine/core';
import carouselClasses from 'shared/ui/carousel.module.css';
import classes from './SpotPreviewCard.module.css';
import { IconPhoto, IconArrowRight, IconUpload } from '@tabler/icons-react';
import { Spot } from 'entities/Spot/types';
import { useSpotCard } from 'widgets/GlobeMap/model/useSpotCard';

interface SpotPreviewCardProps {
  spot: Spot;
}

export function SpotPreviewCard({ spot }: SpotPreviewCardProps) {
  const { data, isLoading } = useSpotCard(spot.id);
  const navigate = useNavigate();
  const navigateToGallery = useCallback(() => navigate({ to: `/${spot.id}` as any }), [navigate, spot.id]);
  const navigateToUpload = useCallback(() => navigate({ to: `/${spot.id}/upload` as any }), [navigate, spot.id]);

  const hasMedia = !isLoading && data != null && data.media.length > 0;

  return (
    <Card w={300} padding="md" radius="md" withBorder shadow="sm">
      <Card.Section>
        {isLoading || data == null ? (
          <Skeleton height={200} width="100%" />
        ) : (
          <Carousel
            withControls={hasMedia && data.media.length > 1}
            withIndicators={hasMedia && data.media.length > 1}
            height={200}
            emblaOptions={{ loop: true, align: 'start' }}
            slideSize="100%"
            slideGap="md"
            classNames={{ indicators: carouselClasses.indicators, indicator: carouselClasses.indicator }}
          >
            {hasMedia ? (
              data.media.map((item) => (
                <Carousel.Slide key={item.id}>
                  <Image
                    src={item.url}
                    h="100%"
                    w="100%"
                    fit="cover"
                    alt={spot.name}
                  />
                </Carousel.Slide>
              ))
            ) : (
              <Carousel.Slide>
                <Stack align="center" justify="center" h="100%" bg="gray.1">
                  <ThemeIcon size={40} color="gray" variant="light">
                    <IconPhoto />
                  </ThemeIcon>
                  <Text size="sm" c="dimmed">No media yet</Text>
                </Stack>
              </Carousel.Slide>
            )}
          </Carousel>
        )}
      </Card.Section>

      <Stack gap="xs" mt="md">
        <Group justify="space-between" align="center">
          <Text fw={600} size="lg" lineClamp={1} className={classes.spotName}>
            {spot.name}
          </Text>
          {data != null && data.totalMedia > 0 && (
            <Badge variant="light" color="blue" size="sm">
              {data.totalMedia} media
            </Badge>
          )}
        </Group>

        {spot.location && (
          <Text size="xs" c="dimmed" lineClamp={2}>
            {spot.location}
          </Text>
        )}

        <Button
          fullWidth
          variant="light"
          rightSection={<IconArrowRight size={16} />}
          mt="xs"
          onClick={navigateToGallery}
        >
          View Gallery
        </Button>

        <Button
          fullWidth
          variant="outline"
          rightSection={<IconUpload size={16} />}
          onClick={navigateToUpload}
        >
          Upload
        </Button>
      </Stack>
    </Card>
  );
}
