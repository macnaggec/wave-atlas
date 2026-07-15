import { Select, Tabs } from '@mantine/core';
import { IconMapPin } from '@tabler/icons-react';
import styles from './CollectionsToolbar.module.css';

type SpotOption = {
  value: string;
  label: string;
};

type CollectionsToolbarProps = {
  activeTab: string;
  spotOptions: SpotOption[];
  spotFilter: string | null;
  onSpotFilterChange: (spotId: string | null) => void;
  onTabChange: (tab: string | null) => void;
};

export function CollectionsToolbar({
  activeTab,
  spotOptions,
  spotFilter,
  onSpotFilterChange,
  onTabChange,
}: CollectionsToolbarProps) {
  return (
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
        onChange={onTabChange}
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
          onChange={onSpotFilterChange}
          clearable
          size="xs"
          radius="xl"
          leftSection={<IconMapPin size={13} />}
        />
      )}
    </div>
  );
}
