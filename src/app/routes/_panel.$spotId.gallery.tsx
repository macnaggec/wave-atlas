import { createFileRoute } from '@tanstack/react-router';
import { PublicGallery } from 'features/PublicGallery';

export const Route = createFileRoute('/_panel/$spotId/gallery')({
  staticData: { forceExpanded: true },
  component: GalleryPage,
});

function GalleryPage() {
  const { spotId } = Route.useParams();
  return <PublicGallery spotId={spotId} />;
}
