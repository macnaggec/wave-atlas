import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Center, SimpleGrid, Skeleton, Text, Menu, Button, Badge, Group, rem } from '@mantine/core';
import { IconChevronDown, IconPhoto, IconTrash } from '@tabler/icons-react';
import { memo, useCallback } from 'react';
import { useTRPC } from 'app/lib/trpc';
import { useDeleteMedia } from 'entities/Media/model/useDeleteMedia';
import { BaseGallery, BaseCard, SelectionToolbar } from 'shared/ui/BaseGallery';
import { useGallerySelection } from 'shared/hooks/gallery';

export const Route = createFileRoute('/_drawer/me/')({
  component: UploadsTab,
});

// ============================================================================
// DRAFTS DROPDOWN
// ============================================================================

interface DraftSpot {
  spotId: string;
  spotName: string;
  count: number;
}

interface DraftsDropdownProps {
  spots: DraftSpot[];
}

/**
 * DraftsDropdown — toolbar button listing spots with unpublished drafts.
 * Each item navigates to the spot's upload tab.
 */
const DraftsDropdown = memo(({ spots }: DraftsDropdownProps) => {
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

// ============================================================================
// UPLOADS TAB
// ============================================================================

/**
 * UploadsTab — shows all published media uploaded by the authenticated user.
 *
 * Toolbar:
 * - SelectionToolbar with bulk delete action
 * - DraftsDropdown (when there are unpublished drafts)
 */
function UploadsTab() {
  const trpc = useTRPC();
  const { mutateAsync: deleteMedia } = useDeleteMedia();

  const { data: uploads = [], isLoading: uploadsLoading } = useQuery(
    trpc.users.myUploads.queryOptions(),
  );

  const { data: draftCounts = [] } = useQuery(
    trpc.users.myDraftCounts.queryOptions(),
  );

  // ========================================================================
  // SELECTION
  // ========================================================================

  const selection = useGallerySelection({
    items: uploads,
    getId: (item) => item.id,
  });

  // ========================================================================
  // DELETE
  // ========================================================================

  const handleBulkDelete = useCallback(
    async (selectedItems: typeof uploads) => {
      const results = await Promise.allSettled(
        selectedItems.map((item) => deleteMedia({ id: item.id })),
      );
      const succeededIds = selectedItems
        .filter((_, i) => results[i].status === 'fulfilled')
        .map((item) => item.id);
      selection.deselectItems(succeededIds);
    },
    [deleteMedia, selection],
  );

  const renderDeleteAction = useCallback(
    (selectedItems: typeof uploads) => (
      <Menu.Item
        color="red"
        leftSection={<IconTrash style={{ width: rem(14), height: rem(14) }} />}
        onClick={() => handleBulkDelete(selectedItems)}
      >
        Delete {selectedItems.length} {selectedItems.length === 1 ? 'item' : 'items'}
      </Menu.Item>
    ),
    [handleBulkDelete],
  );

  // ========================================================================
  // RENDER
  // ========================================================================

  if (uploadsLoading) {
    return (
      <SimpleGrid cols={3} spacing={10} mt="md">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height={120} radius="sm" />
        ))}
      </SimpleGrid>
    );
  }

  if (uploads.length === 0) {
    return (
      <Center mih={200}>
        <Text c="dimmed" size="sm">No published uploads yet.</Text>
      </Center>
    );
  }

  return (
    <BaseGallery
      items={uploads}
      selection={selection}
      toolbar={
        <Group gap="md" justify="space-between" w="100%">
          {draftCounts.length > 0 && <DraftsDropdown spots={draftCounts} />}
          <SelectionToolbar selection={selection} renderActions={renderDeleteAction} />
        </Group>
      }
      renderCard={(item) => (
        <BaseCard
          imageUrl={item.url}
          resourceType={item.type === 'VIDEO' ? 'video' : 'image'}
          alt={`Upload ${item.id}`}
        />
      )}
    />
  );
}
