'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Carousel } from '@mantine/carousel';
import { Card, Text, Button, Image, Skeleton, Stack, Group, Badge, ThemeIcon } from '@mantine/core';
import { IconPhoto, IconArrowRight, IconUpload } from '@tabler/icons-react';
import { getSpotPreviewData, SpotPreviewData } from 'app/actions/spot-preview';
import { getErrorMessage } from 'shared/lib/getErrorMessage';

interface SpotPreviewCardProps {
  spotId: string;
}

export function SpotPreviewCard({ spotId }: SpotPreviewCardProps) {
  const [data, setData] = useState<SpotPreviewData | null>(null);
  const [isPending, startTransition] = useTransition();

  // TODO: Refactor Data Fetching to use SWR/React Query for caching
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const result = await getSpotPreviewData(spotId);
        if (isMounted) {
          startTransition(() => {
            setData(result);
          });
        }
      } catch (error) {
        // We catch here because the Server Action wrapper throws on error.
        // If we don't catch, it becomes an unhandled promise rejection in the client.
        if (isMounted) {
          console.error('Failed to load spot preview:', getErrorMessage(error));
          // data remains null, showing skeleton or empty state
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [spotId]);

  if (isPending || !data) {
    return (
      <Card w={280} padding="md" radius="md" withBorder>
        <Card.Section>
          <Skeleton height={180} width="100%" />
        </Card.Section>
        <Stack mt="md" gap="xs">
          <Skeleton height={20} width="70%" />
          <Skeleton height={15} width="40%" />
        </Stack>
      </Card>
    );
  }

  const hasMedia = data.media.length > 0;

  return (
    <Card w={300} padding="md" radius="md" withBorder shadow="sm">
      <Card.Section>
        <Carousel
          withIndicators={hasMedia && data.media.length > 1}
          height={200}
          emblaOptions={{ loop: true, align: 'start' }}
          slideSize="100%"
          slideGap="md"
        >
          {hasMedia ? (
            data.media.map((item) => (
              <Carousel.Slide key={item.id}>
                <Image
                  src={item.url}
                  h="100%"
                  w="100%"
                  fit="cover"
                  alt={data.name}
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
      </Card.Section>

      <Stack gap="xs" mt="md">
        <Group justify="space-between" align="center">
          <Text fw={600} size="lg" lineClamp={1} style={{ flex: 1 }}>
            {data.name}
          </Text>
          {data.totalMedia > 0 && (
            <Badge variant="light" color="blue" size="sm">
              {data.totalMedia} media
            </Badge>
          )}
        </Group>

        {data.location && (
          <Text size="xs" c="dimmed" lineClamp={2}>
            {data.location}
          </Text>
        )}

        <Link href={`/${spotId}?tab=gallery`} style={{ textDecoration: 'none' }}>
          <Button
            fullWidth
            variant="light"
            rightSection={<IconArrowRight size={16} />}
            mt="xs"
          >
            View Gallery
          </Button>
        </Link>

        <Link href={`/${spotId}?tab=upload`} style={{ textDecoration: 'none' }}>
          <Button
            fullWidth
            variant="outline"
            rightSection={<IconUpload size={16} />}
          >
            Upload
          </Button>
        </Link>
      </Stack>
    </Card>
  );
}
