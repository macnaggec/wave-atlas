import { createFileRoute, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { Drawer, Skeleton, Tabs, Text } from '@mantine/core';
import { useSpotPreview } from 'entities/Spot/model/useSpotPreview';

export const Route = createFileRoute('/_drawer/$spotId')({
  component: SpotLayout,
});

/**
 * SpotLayout — drawer content structure for a spot.
 *
 * Always renders inside Drawer.Content (provided by DrawerOutlet in root).
 * The tab strip is driven by the URL — no custom hook, just router state.
 */
function SpotLayout() {
  const { spotId } = Route.useParams();
  const navigate = useNavigate();
  const isUpload = useRouterState({
    select: (s) => s.location.pathname.endsWith('/upload'),
  });
  const { data: preview } = useSpotPreview(spotId);

  return (
    <>
      <Drawer.Header>
        {preview ? (
          <Text fw={600} size="lg">{preview.name}</Text>
        ) : (
          <Skeleton height={22} width={160} radius="sm" />
        )}
        <Drawer.CloseButton />
      </Drawer.Header>

      <Tabs
        value={isUpload ? 'upload' : 'gallery'}
        onChange={(tab) => {
          if (tab === 'upload') navigate({ to: '/$spotId/upload', params: { spotId } });
          else navigate({ to: '/$spotId', params: { spotId } });
        }}
      >
        <Tabs.List px="md">
          <Tabs.Tab value="gallery">Gallery</Tabs.Tab>
          <Tabs.Tab value="upload">Upload</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      <Drawer.Body>
        <Outlet />
      </Drawer.Body>
    </>
  );
}
