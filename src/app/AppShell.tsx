import { GlobeScene } from 'views/GlobeScene';
import { LeftStrip } from 'widgets/LeftStrip/LeftStrip';

export function AppShell() {
  return (
    <>
      <GlobeScene />
      <LeftStrip />
    </>
  );
}
