import { Lock, ShieldCheck, Sparkles, Unlock } from 'lucide-react';
import type { InventoryStack, ItemDefinition } from '../game/types';
import { formatNumber } from './formatters';
import { getInventoryDisplayGroup, getInventoryValueLabel } from './inventoryView';
import { ItemIcon } from './ItemIcon';

export interface InventoryItemDetailsProps {
  stack: InventoryStack;
  item?: ItemDefinition;
  headingId: string;
  onEquip: () => void;
  onOpenEquipment: () => void;
  onToggleLock: () => void;
  onDestroyOne: () => void;
}

const bonusLabels: Record<string, string> = {
  attack: 'Attack',
  strength: 'Strength',
  defence: 'Defence',
  health: 'Health',
  speed: 'Gathering speed',
};

const formatBonus = (key: string, value: number): string =>
  key === 'speed' ? `+${Math.round(value * 100)}%` : `+${value}`;

export function InventoryItemDetails({
  stack,
  item,
  headingId,
  onEquip,
  onOpenEquipment,
  onToggleLock,
  onDestroyOne,
}: InventoryItemDetailsProps) {
  const name = item?.name ?? 'Unknown item';
  const displayGroup = getInventoryDisplayGroup(item?.category);
  const slot = item?.slot;
  const isEquippable = Boolean(slot);
  const bonuses = Object.entries(item?.bonuses ?? {}).filter(
    ([, value]) => typeof value === 'number' && value !== 0,
  );

  if (!item) {
    return (
      <section className="inventory-item-details" aria-labelledby={headingId}>
        <div className="inventory-details-hero">
          <ItemIcon itemId={stack.itemId} size="md" />
          <div>
            <div className="inventory-card-rarity rarity-unknown">Unknown item</div>
            <h2 id={headingId}>Unknown item</h2>
          </div>
        </div>
        <p className="subtle">
          This stack is preserved safely, but its item definition is unavailable. No actions are
          available.
        </p>
        <div className="stat-line">
          <span>Quantity</span>
          <strong>{formatNumber(stack.quantity)}</strong>
        </div>
      </section>
    );
  }

  return (
    <section className="inventory-item-details" aria-labelledby={headingId}>
      <div className="inventory-details-hero">
        <ItemIcon itemId={item.id} size="md" />
        <div className="inventory-details-title">
          <div className={`inventory-card-rarity rarity-${item.rarity}`}>
            {getInventoryValueLabel(item.rarity)}
          </div>
          <h2 id={headingId}>{name}</h2>
          <div className="inventory-details-category">
            {displayGroup ? getInventoryValueLabel(displayGroup) : 'Item'}
          </div>
        </div>
      </div>
      <p className="subtle inventory-details-description">{item.description}</p>
      <dl className="inventory-details-metadata">
        <div className="stat-line">
          <dt>Quantity</dt>
          <dd>{formatNumber(stack.quantity)}</dd>
        </div>
        {item.source && (
          <div className="stat-line inventory-source-row">
            <dt>Source</dt>
            <dd>{item.source}</dd>
          </div>
        )}
        {isEquippable && (
          <div className="stat-line">
            <dt>Slot</dt>
            <dd>{getInventoryValueLabel(slot ?? 'unknown')}</dd>
          </div>
        )}
        {item.tier && (
          <div className="stat-line">
            <dt>Tier</dt>
            <dd>{getInventoryValueLabel(item.tier)}</dd>
          </div>
        )}
      </dl>
      {bonuses.length > 0 && (
        <div className="inventory-detail-group">
          <div className="eyebrow">Bonuses</div>
          <div className="inventory-bonus-grid">
            {bonuses.map(([key, value]) => (
              <div className="inventory-bonus" key={key}>
                <span>{bonusLabels[key] ?? getInventoryValueLabel(key)}</span>
                <strong>{formatBonus(key, value as number)}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
      {item.specialAttack && (
        <div className="inventory-special-attack">
          <div className="inventory-special-attack-heading">
            <Sparkles size={15} aria-hidden="true" />
            <div>
              <div className="eyebrow">Special attack</div>
              <strong>{item.specialAttack.name}</strong>
            </div>
          </div>
          <p>{item.specialAttack.description}</p>
          <div className="inventory-special-attack-meta">
            <span>{Math.round(item.specialAttack.damageMultiplier * 100)}% damage</span>
            <span>{Math.round(item.specialAttack.accuracyMultiplier * 100)}% accuracy</span>
            {item.specialAttack.ignoresFlatDamageReduction && <span>Ignores flat reduction</span>}
            {item.specialAttack.executeThreshold && (
              <span>
                Execute below {Math.round(item.specialAttack.executeThreshold * 100)}% health
              </span>
            )}
          </div>
        </div>
      )}
      <div className="inventory-detail-actions">
        {isEquippable && (
          <div className="inventory-detail-action-group">
            <div className="inventory-detail-action-label">Primary actions</div>
            <div className="button-row">
              <button type="button" className="button primary" onClick={onEquip}>
                Equip
              </button>
              <button type="button" className="button ghost" onClick={onOpenEquipment}>
                View Equipment
              </button>
            </div>
          </div>
        )}
        <div className="inventory-detail-action-group">
          <div className="inventory-detail-action-label">Utility actions</div>
          <div className="button-row">
            <button
              type="button"
              className="button ghost"
              onClick={onToggleLock}
              aria-pressed={stack.locked}
            >
              {stack.locked ? (
                <Unlock size={14} aria-hidden="true" />
              ) : (
                <Lock size={14} aria-hidden="true" />
              )}
              {stack.locked ? 'Unlock' : 'Lock'}
            </button>
            <button
              type="button"
              className="button danger"
              onClick={onDestroyOne}
              disabled={stack.locked}
              title={stack.locked ? 'Unlock this stack before destroying it' : undefined}
            >
              <ShieldCheck size={14} aria-hidden="true" />
              Destroy One
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
