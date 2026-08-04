import { initPlasmicLoader, type PlasmicComponentLoader } from '@plasmicapp/loader-react';
import { IronboundGameFrame } from './PlasmicFrame';

const projectId = import.meta.env.VITE_PLASMIC_PROJECT_ID?.trim();
const publicToken = import.meta.env.VITE_PLASMIC_PUBLIC_TOKEN?.trim();
const usePlasmic = import.meta.env.VITE_PLASMIC_ENABLED?.trim().toLowerCase() === 'true';

export const PLASMIC_PROJECT_ID = projectId ?? '';
export const PLASMIC_COMPONENT = import.meta.env.VITE_PLASMIC_COMPONENT?.trim() || 'IronboundShell';
const isTestMode = import.meta.env.MODE === 'test';
export const isPlasmicConfigured = !isTestMode && usePlasmic && Boolean(projectId && publicToken);

/** Optional visual-editor connection. The game remains fully local when unset. */
export const PLASMIC: PlasmicComponentLoader | null = isPlasmicConfigured
  ? initPlasmicLoader({
      projects: [{ id: projectId as string, token: publicToken as string }],
      platform: 'react',
      preview: import.meta.env.DEV,
      onClientSideFetch: 'warn',
    })
  : null;

if (PLASMIC) {
  PLASMIC.registerComponent(IronboundGameFrame, {
    name: 'IronboundGameFrame',
    displayName: 'Ironbound Game Frame',
    importPath: './src/plasmic/PlasmicFrame',
    props: {
      sidebar: { type: 'slot' },
      header: { type: 'slot' },
      content: { type: 'slot' },
      actionStrip: { type: 'slot' },
      overlays: { type: 'slot' },
    },
  });
}
