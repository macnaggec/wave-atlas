import { memo, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Badge, Button, Menu, rem } from '@mantine/core';
import { IconChevronDown, IconPhoto } from '@tabler/icons-react';

export interface DraftSpot {
  spotId: string;
  spotName: string;
  count: number;
}

/**
 * Dropdown button listing spots with unpublished drafts.
 * Each menu item navigates to the spot's upload page.
 */
export const DraftsDropdown = memo(({ spots }: { spots: DraftSpot[] }) => {
  const navigate = useNavigate();

  const handleNavigate = useCallback(
    (spotId: string) => {
      void navigate({ to: '/$spotId/upload', params: { spotId } });
    },
    [navigate],
  );

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
            onClick={() => handleNavigate(s.spotId)}
          >
            {s.spotName}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
});

DraftsDropdown.displayName = 'DraftsDropdown';
