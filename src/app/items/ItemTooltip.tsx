import type { ReactElement } from 'react';
import type { ItemDefinition } from '../../game/types';
import { getEquipmentBonusLabel, formatEquipmentBonus, getEquipmentSlotLabel } from '../shared/equipmentView';
import { ArtViewport } from '../art/ArtViewport';
import { ItemIcon } from './ItemIcon';
import { GameTooltip } from './GameTooltip';
import { ProfessionToolDetails } from './ProfessionToolDetails';
import { SpecialAttackDetails } from './SpecialAttackDetails';

const titleCase = (value: string): string => value.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

export function ItemTooltipContent({ item }: { item?: ItemDefinition }) {
  if (!item)
    return (
      <div className="item-tooltip-content item-tooltip-unknown">
        <strong>Unknown item</strong>
        <span>This item definition is unavailable.</span>
      </div>
    );
  const bonuses = Object.entries(item.bonuses ?? {}).filter(([, value]) => value !== 0);
  return (
    <div className="item-tooltip-content">
      <div className="item-tooltip-header">
        <ArtViewport className="item-tooltip-icon-viewport" aria-hidden="true">
          <ItemIcon itemId={item.id} size="md" framed={false} artVariant="item-tooltip" />
        </ArtViewport>
        <div className="item-tooltip-header-copy">
          <strong>{item.name}</strong>
          <span>
            {titleCase(item.rarity)} · {item.slot ? getEquipmentSlotLabel(item.slot) : titleCase(item.category)}
            {item.tier ? ` · ${titleCase(item.tier)}` : ''}
          </span>
        </div>
      </div>
      <p>{item.description}</p>
      {bonuses.length > 0 && (
        <div className="item-tooltip-bonuses">
          <span className="item-tooltip-kicker">Bonuses</span>
          {bonuses.map(([key, value]) => (
            <span key={key}>
              {getEquipmentBonusLabel(key)}: {formatEquipmentBonus(key, value as number)}
            </span>
          ))}
        </div>
      )}
      <ProfessionToolDetails itemId={item.id} />
      {item.specialAttack && (
        <div className="item-tooltip-special">
          <span className="item-tooltip-kicker">{item.specialAttack.name}</span>
          <SpecialAttackDetails special={item.specialAttack} />
          <p>{item.specialAttack.description}</p>
        </div>
      )}
    </div>
  );
}

export function ItemTooltip({
  item,
  children,
  disabled = false,
}: {
  item?: ItemDefinition;
  children: ReactElement;
  disabled?: boolean;
}) {
  if (disabled) return children;
  return (
    <GameTooltip content={<ItemTooltipContent item={item} />} label={item?.name ?? 'Unknown item'}>
      {children}
    </GameTooltip>
  );
}
