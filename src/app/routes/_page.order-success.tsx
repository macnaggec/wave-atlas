import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Box,
  Button,
  Card,
  Center,
  Group,
  Image,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconCheck, IconDownload, IconMail } from '@tabler/icons-react';
import { useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { memo, useCallback, useState } from 'react';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'server/router';
import { trpcProxy } from 'app/lib/trpcClient';
import { useTRPC } from 'app/lib/trpc';
import { notify } from 'shared/lib/notifications';
import { getErrorMessage } from 'shared/lib/getErrorMessage';

export const Route = createFileRoute('/_page/order-success')({
  validateSearch: (search): { orderId?: string } => ({
    orderId: typeof search.orderId === 'string' ? search.orderId : undefined,
  }),
  loaderDeps: ({ search }) => ({ orderId: search.orderId }),
  loader: ({ context: { queryClient }, deps }) => {
    if (!deps.orderId) return;
    return queryClient.ensureQueryData(
      trpcProxy.checkout.getGuestPurchases.queryOptions({ orderId: deps.orderId })
    );
  },
  pendingComponent: OrderSuccessPending,
  component: OrderSuccessPage,
});

function OrderSuccessPending() {
  return (
    <Stack p="xl" maw={600} mx="auto">
      <Skeleton height={32} width={200} />
      <SimpleGrid cols={2} spacing="sm">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} height={160} radius="md" />
        ))}
      </SimpleGrid>
    </Stack>
  );
}

/**
 * OrderSuccessPage — shown to guest buyers after CryptoCloud redirects back.
 *
 * Downloads are token-based: each purchase has a cryptographically random
 * downloadToken stored in DB. No authentication required.
 */
function OrderSuccessPage() {
  const { orderId } = Route.useSearch();

  if (!orderId) {
    return (
      <Center mih={300}>
        <Stack align="center">
          <Text c="dimmed">No order found.</Text>
          <Button component={Link} to="/">Back to home</Button>
        </Stack>
      </Center>
    );
  }

  return <OrderSuccessContent orderId={orderId} />;
}

function OrderSuccessContent({ orderId }: { orderId: string }) {
  const trpc = useTRPC();
  const { data: purchases } = useSuspenseQuery(
    trpc.checkout.getGuestPurchases.queryOptions({ orderId })
  );

  if (purchases.length === 0) {
    return (
      <Center mih={300}>
        <Stack align="center">
          <Text c="dimmed">No purchases found for this order.</Text>
          <Button component={Link} to="/">Back to home</Button>
        </Stack>
      </Center>
    );
  }

  return (
    <Stack p="xl" maw={600} mx="auto">
      <Group gap="xs">
        <IconCheck color="var(--mantine-color-green-6)" size={28} />
        <Title order={3}>Payment successful!</Title>
      </Group>
      <Text size="sm">
        Your files are ready. Download them below.
      </Text>
      <Text size="xs" c="orange.7" fw={500}>
        ⚠ This URL is your only access to these files — bookmark it before you leave.
      </Text>

      <GuestEmailCapture orderId={orderId} />

      <SimpleGrid cols={2} spacing="sm">
        {purchases.map((p) => (
          <GuestPurchaseCard key={p.id} purchase={p} orderId={orderId} />
        ))}
      </SimpleGrid>

      <Button component={Link} to="/" variant="subtle" mt="xs">
        Back to home
      </Button>
    </Stack>
  );
}

function GuestEmailCapture({ orderId }: { orderId: string }) {
  const trpc = useTRPC();
  const [email, setEmail] = useState('');
  const [saved, setSaved] = useState(false);

  const saveEmail = useMutation({
    ...trpc.checkout.saveGuestEmail.mutationOptions(),
    onSuccess: () => {
      setSaved(true);
      notify.success('We\'ll send your links there once email delivery is live.', 'Email saved');
    },
    onError: (err) => notify.error(getErrorMessage(err), 'Failed to save email'),
  });

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.currentTarget.value);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!email.trim()) return;
    saveEmail.mutate({ orderId, email: email.trim() });
  }, [saveEmail.mutate, orderId, email]);

  if (saved) return null;

  return (
    <Group gap="xs" align="flex-end">
      <TextInput
        flex={1}
        size="sm"
        placeholder="your@email.com"
        label="Want a backup link? Enter your email."
        type="email"
        value={email}
        onChange={handleEmailChange}
      />
      <Button
        size="sm"
        variant="light"
        leftSection={<IconMail size={14} />}
        loading={saveEmail.isPending}
        disabled={!email.trim()}
        onClick={handleSubmit}
      >
        Send
      </Button>
    </Group>
  );
}

type GuestPurchase = inferRouterOutputs<AppRouter>['checkout']['getGuestPurchases'][number];

const GuestPurchaseCard = memo(function GuestPurchaseCard({ purchase, orderId }: { purchase: GuestPurchase; orderId: string }) {
  const trpc = useTRPC();

  const { refetch, isFetching } = useQuery({
    ...trpc.checkout.getGuestDownloadAccess.queryOptions({ purchaseId: purchase.id, orderId }),
    enabled: false,
  });

  const handleDownload = useCallback(async () => {
    const result = await refetch();
    if (result.data) {
      window.open(result.data.downloadUrl, '_blank', 'noopener,noreferrer');
    } else if (result.error) {
      notify.error(getErrorMessage(result.error), 'Download Failed');
    }
  }, [refetch]);

  return (
    <Card padding="xs" radius="md" withBorder>
      <Card.Section>
        <Image
          src={purchase.mediaItem.thumbnailUrl}
          height={120}
          fit="cover"
          alt="Purchased media"
        />
      </Card.Section>

      <Box mt="xs">
        <Button
          fullWidth
          size="sm"
          variant="light"
          leftSection={<IconDownload size={14} />}
          loading={isFetching}
          onClick={handleDownload}
        >
          Download
        </Button>
      </Box>
    </Card>
  );
});
