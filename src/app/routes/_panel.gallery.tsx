import { createFileRoute } from '@tanstack/react-router';
import { PublicGallery } from 'features/PublicGallery';
import { usePanelFilter } from './_panel';

export const Route = createFileRoute('/_panel/gallery')({
  staticData: { panelMode: 'galleryWorkspace' },
  component: GalleryPage,
});

function GalleryPage() {
  const { filters, clearFilters } = usePanelFilter();
  return <PublicGallery filters={filters} onClearFilters={clearFilters} />;
}
