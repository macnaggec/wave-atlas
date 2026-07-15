import { createFileRoute } from '@tanstack/react-router';
import { PublicGallery } from 'features/PublicGallery';
import { usePanelFilter } from './_panel';

export const Route = createFileRoute('/_panel/$spotId/gallery')({
  staticData: { panelMode: 'galleryWorkspace' },
  component: GalleryPage,
});

function GalleryPage() {
  const { spotId } = Route.useParams();
  const { filters, clearFilters } = usePanelFilter();
  return <PublicGallery spotId={spotId} filters={filters} onClearFilters={clearFilters} />;
}
