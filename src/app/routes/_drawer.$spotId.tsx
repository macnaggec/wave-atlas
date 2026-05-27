import { createFileRoute, Outlet } from '@tanstack/react-router';
import { Skeleton, Text } from '@mantine/core';
import { useSpotPreview } from 'entities/Spot/model/useSpotPreview';
import { CartButton } from 'features/Cart/ui/CartButton';
import { DrawerBody, DrawerHeader } from 'shared/ui/DrawerLayout';

export const Route = createFileRoute('/_drawer/$spotId')({
  component: SpotLayout,
});

function SpotLayout() {
  const { spotId } = Route.useParams();
  const { data: preview } = useSpotPreview(spotId);

  return (
    <>
      <DrawerHeader>
        {preview ? (
          <Text fw={600} size="lg">{preview.name}</Text>
        ) : (
          <Skeleton height={22} width={160} radius="sm" />
        )}
      </DrawerHeader>

      <DrawerBody>
        <Outlet />
      </DrawerBody>

      <CartButton spotId={spotId} />
    </>
  );
}
