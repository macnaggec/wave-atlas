import { memo } from 'react';
import { Badge, Button, Menu, rem } from '@mantine/core';
import { IconChevronDown, IconPhoto } from '@tabler/icons-react';

export interface DraftSpot {
  spotId: string;
  spotName: string;
  count: number;
}

/**
 * Dropdown summarising spots with unpublished drafts.
 * Navigation to upload happens via the Upload button in the left strip.
 */
export const DraftsDropdown = memo(({ spots }: { spots: DraftSpot[] }) => {
  const totalDrafts = spots.reduce((sum, s) => sum + s.count, 0);

  return (
    <Menu shadow="md" width={240} withinPortal>
      <Menu.Target>
        <Button
          variant="light"
          color="yellow"
          size="xs"
          rightSection={<IconChevronDown style={{ width: rem(14), height: rem(14) }} />}
        >
          {totalDrafts} unpublished
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Spots with drafts</Menu.Label>
        {spots.map((s) => (
          <Menu.Item
            key={s.spotId}
            leftSection={<IconPhoto style={{ width: rem(14), height: rem(14) }} />}
            rightSection={<Badge size="xs" variant="filled" color="yellow">{s.count}</Badge>}
          >
            {s.spotName}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
});

DraftsDropdown.displayName = 'DraftsDropdown';
