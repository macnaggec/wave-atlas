import { createFileRoute, Outlet, useMatches, useNavigate } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { Skeleton, Text } from '@mantine/core';
import type { Spot } from 'entities/Spot/types';
import { SidePanel } from 'widgets/SidePanel';
import { useCartStore } from 'features/Cart/model/cartStore';
import { useSpotPreview } from 'entities/Spot/model/useSpotPreview';
import { CartDrawerHeader } from 'features/Cart/ui/CartDrawerHeader';

export const Route = createFileRoute('/_panel')({
  component: PanelLayout,
});

function PanelLayout() {
  return (
    <PanelFrame>
      <Outlet />
    </PanelFrame>
  );
}

type SpotLoaderData = { spot: Spot | null };

function PanelFrame({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const matches = useMatches();

  // Cart state — always subscribed; meaningful only when on /cart
  const cartItems = useCartStore((s) => s.items);

  // Active route identification
  const cartMatch = matches.find((m) => m.routeId === '/_panel/cart');
  const spotMatch = matches.find((m) => m.routeId === '/_panel/$spotId');

  const cartFrom = cartMatch
    ? (cartMatch.search as { from?: string }).from
    : undefined;

  // From-spot name for cart back-link — reads from already-cached spots list
  const { data: cartFromSpot } = useSpotPreview(cartFrom ?? '');

  // Per-route force-expanded: /me is always wide with a back button, no toggle
  const forceExpanded = matches.some(
    (m) => !!(m.staticData as { forceExpanded?: boolean }).forceExpanded,
  );

  const header: ReactNode = (() => {
    if (cartMatch) {
      return (
        <CartDrawerHeader
          itemCount={cartItems.length}
          spotName={cartFrom && cartFromSpot ? cartFromSpot.name : undefined}
          onBack={
            cartFrom
              ? () => void navigate({ to: '/$spotId', params: { spotId: cartFrom } })
              : undefined
          }
        />
      );
    }

    if (spotMatch) {
      const spotName = (spotMatch.loaderData as unknown as SpotLoaderData | undefined)?.spot?.name ?? null;
      return spotName ? (
        <Text fw={600} size="lg">{spotName}</Text>
      ) : (
        <Skeleton height={22} width={160} radius="sm" />
      );
    }

    // Static header from route metadata (e.g. /me → "My Collection")
    for (const m of [...matches].reverse()) {
      const ph = (m.staticData as { panelHeader?: string }).panelHeader;
      if (ph) return <Text fw={600} size="lg">{ph}</Text>;
    }

    return undefined;
  })();

  return (
    <SidePanel
      isOpen={isOpen}
      onOpen={() => setIsOpen(true)}
      onClose={() => setIsOpen(false)}
      expanded={forceExpanded || expanded}
      onExpandToggle={forceExpanded ? undefined : () => setExpanded((e) => !e)}
      onBack={forceExpanded ? () => void navigate({ to: '/' }) : undefined}
      header={header}
    >
      {children}
    </SidePanel>
  );
}
