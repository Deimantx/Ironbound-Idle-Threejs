import { PlasmicCanvasHost } from '@plasmicapp/loader-react';
import './plasmicInit';

/**
 * Endpoint used by Plasmic Studio to discover and preview registered code
 * components while the local Vite server is running.
 */
export function PlasmicHost() {
  return <PlasmicCanvasHost />;
}
