import { MINING_NODE_ART } from './artRegistry';
import { ArtImage } from './ArtImage';

export function MiningNodeArt({ nodeId, className = '' }: { nodeId: string; className?: string }) {
  const source = MINING_NODE_ART[nodeId];
  return source ? (
    <ArtImage className={`mining-node-art ${className}`.trim()} src={source} alt="" aria-hidden="true" />
  ) : null;
}
