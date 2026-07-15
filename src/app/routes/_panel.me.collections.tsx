import { createContext, useContext, useMemo, useState } from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Select, Tabs } from '@mantine/core';
import { IconMapPin } from '@tabler/icons-react';
import { useTabNavigation } from 'shared/hooks';
import { useTRPC } from 'shared/lib/trpc';
import type { SurfSessionItem } from 'entities/SurfSession';
import { PanelScrollChromeProvider } from 'shared/ui/PanelScrollChrome';
import styles from './_panel.me.collections.module.css';

const TAB_ROUTES = {
  uploads: '/me/collections',
  purchases: '/me/collections/purchases',
  favorites: '/me/collections/favorites',
} as const;

type CollectionsContextValue = {
  sessions: SurfSessionItem[];
  visibleUploads: SurfSessionItem[];
  isLoadingUploads: boolean;
};

const CollectionsContext = createContext<CollectionsContextValue | null>(null);

export function useCollectionsContext() {
  const context = useContext(CollectionsContext);
  if (!context) {
    throw new Error('useCollectionsContext must be used inside CollectionsLayout');
  }

  return context;
}

export const Route = createFileRoute('/_panel/me/collections')({
  staticData: { panelHeader: 'My Collections', panelMode: 'workspace' },
  component: CollectionsLayout,
});

function CollectionsLayout() {
  const trpc = useTRPC();
  const { activeTab, handleTabChange } = useTabNavigation(TAB_ROUTES);
  const { data: sessions = [], isLoading: isLoadingUploads } = useQuery({
    ...trpc.sessions.mine.queryOptions(),
    enabled: activeTab === 'uploads',
  });
  const [spotFilter, setSpotFilter] = useState<string | null>(null);

  const spotOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const session of sessions) {
      if (!seen.has(session.spot.id)) seen.set(session.spot.id, session.spot.name);
    }

    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
  }, [sessions]);

  const visibleUploads = useMemo(
    () => (spotFilter ? sessions.filter((session) => session.spot.id === spotFilter) : sessions),
    [sessions, spotFilter],
  );

  const contextValue = useMemo(
    () => ({ sessions, visibleUploads, isLoadingUploads }),
    [sessions, visibleUploads, isLoadingUploads],
  );

  const toolbar = (
    <div
      className={styles.toolbar}
      data-testid="collections-toolbar"
    >
      <Tabs
        className={styles.tabs}
        data-testid="collections-tabs"
        radius="xl"
        value={activeTab}
        variant="pills"
        onChange={handleTabChange}
      >
        <Tabs.List>
          <Tabs.Tab value="uploads">Uploads</Tabs.Tab>
          <Tabs.Tab value="purchases">Purchases</Tabs.Tab>
          <Tabs.Tab value="favorites">Favorites</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {activeTab === 'uploads' && spotOptions.length > 1 && (
        <Select
          aria-label="Filter uploads by spot"
          className={styles.spotSelect}
          placeholder="All spots"
          data={spotOptions}
          value={spotFilter}
          onChange={setSpotFilter}
          clearable
          size="xs"
          radius="xl"
          leftSection={<IconMapPin size={13} />}
        />
      )}
    </div>
  );

  return (
    <PanelScrollChromeProvider value={toolbar}>
      <CollectionsContext.Provider value={contextValue}>
        <Outlet />
      </CollectionsContext.Provider>
    </PanelScrollChromeProvider>
  );
}
