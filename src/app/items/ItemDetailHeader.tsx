import type { ReactNode } from 'react';
import type { ItemDefinition } from '../../game/types';
import { ArtViewport } from '../art/ArtViewport';
import { ItemArtwork } from './ItemArtwork';

export function ItemDetailHeader({
  item,
  itemId,
  headingId,
  eyebrow,
  metadata,
}: {
  item?: ItemDefinition;
  itemId?: string;
  headingId?: string;
  eyebrow: ReactNode;
  metadata: ReactNode;
}) {
  return (
    <div className="item-detail-header">
      <ArtViewport className="item-detail-icon-viewport" aria-hidden="true">
        <ItemArtwork itemId={item?.id ?? itemId} size="lg" />
      </ArtViewport>
      <div className="item-detail-header-copy">
        <span className="eyebrow">{eyebrow}</span>
        <h2 id={headingId}>{item?.name ?? 'Unknown item'}</h2>
        <span className="item-detail-meta">{metadata}</span>
      </div>
    </div>
  );
}
