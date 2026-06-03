import { Suspense } from 'react';
import { GlobeScene } from 'views/GlobeScene';
import { LeftStrip } from 'widgets/LeftStrip/LeftStrip';
import { UploadIndicatorAffix } from 'features/Upload';

export function AppShell() {
  return (
    <>
      <GlobeScene />
      <Suspense>
        <UploadIndicatorAffix />
      </Suspense>
      <LeftStrip />
    </>
  );
}
