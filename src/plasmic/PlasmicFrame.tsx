import type { ReactNode } from 'react';
import { PlasmicComponent, PlasmicRootProvider } from '@plasmicapp/loader-react';
import { PLASMIC, PLASMIC_COMPONENT } from './plasmicInit';

export interface PlasmicSlots {
  sidebar: ReactNode;
  header: ReactNode;
  content: ReactNode;
  actionStrip: ReactNode;
  overlays: ReactNode;
}

interface PlasmicFrameProps {
  slots: PlasmicSlots;
  fallback: ReactNode;
}

/**
 * Renders the local game shell by default. Once a Plasmic project is connected,
 * the named slots are handed to the visual component so layout can be changed
 * without touching gameplay code.
 */
export function PlasmicFrame({ slots, fallback }: PlasmicFrameProps) {
  if (!PLASMIC) return fallback;
  return (
    <PlasmicRootProvider loader={PLASMIC} skipFonts>
      <PlasmicComponent component={PLASMIC_COMPONENT} componentProps={slots} />
    </PlasmicRootProvider>
  );
}

/** Registered automatically so this shell is available as a code component. */
export function IronboundGameFrame({
  sidebar,
  header,
  content,
  actionStrip,
  overlays,
}: PlasmicSlots) {
  return (
    <div className="app">
      {sidebar}
      <div className="main">
        {header}
        <main className="content">{content}</main>
        {actionStrip}
      </div>
      {overlays}
    </div>
  );
}
