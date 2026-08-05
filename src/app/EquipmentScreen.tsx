import { Lock } from 'lucide-react';
import { itemById } from '../content/items';
import type { EquipmentSlot, GameState } from '../game/types';
import { useGameStore } from '../game/state/gameStore';
import { getDerivedStats } from '../game/formulas/statFormulas';
import { ItemIcon } from './ItemIcon';
import { ScreenHeading } from './ScreenHeading';
import { UiPanelSlot } from './UiPanelSlot';
import type { UiLayout } from './uiLayout';

export interface EquipmentScreenProps {
  game: GameState;
  uiLayout: UiLayout;
}

export function EquipmentScreen({ game, uiLayout }: EquipmentScreenProps) {
  const unequip = useGameStore((store) => store.unequip);
  const stats = getDerivedStats(game);
  const slots: EquipmentSlot[] = ['head', 'body', 'weapon', 'shield', 'legs', 'tool'];
  return (
    <>
      <ScreenHeading
        eyebrow="Loadout"
        title="Equipment"
        description="A good tool changes the rhythm of every action."
        trailing={<span className="badge gold">Derived stats live</span>}
      />
      <div className="ui-panel-grid equipment-panel-grid" data-ui-panel-grid="equipment">
        <UiPanelSlot screen="equipment" id="equipmentLoadout" layout={uiLayout}>
          <section className="panel panel-pad">
            <div className="eyebrow">Mannequin</div>
            <div className="equipment-grid">
              {slots.map((slot) => {
                const id = game.equipment[slot];
                const item = id ? itemById[id] : undefined;
                return (
                  <button
                    className={`equip-slot slot-${slot}`}
                    key={slot}
                    onClick={() => id && unequip(slot)}
                    title={id ? `Unequip ${item?.name}` : `${slot} slot`}
                    aria-label={id ? `Unequip ${item?.name}` : `${slot} slot empty`}
                  >
                    <strong>{slot}</strong>
                    {item ? (
                      <>
                        <span className="equipment-item-icon">
                          <ItemIcon itemId={item.id} size="md" />
                        </span>
                        <small>{item.name}</small>
                      </>
                    ) : (
                      <span className="empty-slot">Empty</span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="button-row" style={{ marginTop: 18, justifyContent: 'center' }}>
              {(['amulet', 'ring', 'cape'] as EquipmentSlot[]).map((slot) => (
                <span className="badge locked" key={slot}>
                  <Lock size={10} /> {slot} · future
                </span>
              ))}
            </div>
          </section>
        </UiPanelSlot>
        <UiPanelSlot screen="equipment" id="equipmentStats" layout={uiLayout}>
          <section className="panel panel-pad">
            <div className="eyebrow">Combat readout</div>
            <h2>Field statistics</h2>
            {[
              ['Attack level', stats.attack],
              ['Maximum hit', stats.maxHit],
              ['Defence rating', stats.defence],
              ['Maximum health', stats.maxHealth],
              ['Attack interval', `${(stats.attackIntervalMs / 1000).toFixed(1)}s`],
              [
                'Mining interval',
                `${Math.round((1 - stats.miningIntervalMultiplier) * 100)}% faster`,
              ],
            ].map(([label, value]) => (
              <div className="stat-line" key={String(label)}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
            <p className="subtle" style={{ marginTop: 18 }}>
              Equip items from Inventory. Swapping is atomic; the displaced item returns to your
              bank.
            </p>
          </section>
        </UiPanelSlot>
      </div>
    </>
  );
}
