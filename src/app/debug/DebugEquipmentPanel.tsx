import { useState } from 'react';
import { ITEMS, itemById } from '../../content/items';
import { getDerivedStats } from '../../game/formulas/statFormulas';
import {
  ACTIVE_EQUIPMENT_SLOTS,
  EQUIPMENT_SLOT_LABELS,
  type ActiveEquipmentSlot,
} from '../../game/equipmentSlots';
import {
  debugClearEquipment,
  debugClampHp,
  debugEquipItem,
  debugEquipSet,
  debugGrantAndEquip,
  debugGrantItem,
  debugGrantSet,
  debugSetHp,
  debugSetHpAboveMaximum,
  debugSimulateFullInventoryUnequip,
  debugUnequipSlot,
  parseDebugInteger,
} from '../../game/debug/debugActions';
import { ActionButton, Field, Section, labelize } from './DebugComponents';
import type { PanelProps } from './debugUiTypes';

export function EquipmentPanel({ game, run, confirm }: PanelProps) {
  const [selectedSlot, setSelectedSlot] = useState<ActiveEquipmentSlot>('weapon');
  const compatible = ITEMS.filter((item) => item.slot === selectedSlot).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  const [selectedItem, setSelectedItem] = useState(compatible[0]?.id ?? '');
  const [hpAmount, setHpAmount] = useState(String(game.player.currentHp));
  const itemId = compatible.some((item) => item.id === selectedItem)
    ? selectedItem
    : (compatible[0]?.id ?? '');
  return (
    <>
      <Section
        title="Equipment loadout"
        description="All current slots are shown; direct actions use normal ownership, capacity, and HP recalculation."
      >
        <div className="debug-tools-equipment-slots">
          {ACTIVE_EQUIPMENT_SLOTS.map((slot) => {
            const id = game.equipment[slot];
            const item = id ? itemById[id] : undefined;
            return (
              <div className="debug-tools-equipment-slot" key={slot}>
                <span>{EQUIPMENT_SLOT_LABELS[slot]}</span>
                <strong>{item?.name ?? 'Empty'}</strong>
                <small>
                  {id ?? 'No item ID'}
                  {id &&
                    ` · HP ${game.player.currentHp <= getDerivedStats(game).maxHealth ? 'valid' : 'invalid'}`}
                </small>
              </div>
            );
          })}
        </div>
      </Section>
      <Section title="Direct controls">
        <div className="debug-tools-grid">
          <Field label="Slot">
            <select
              value={selectedSlot}
              onChange={(event) => {
                const next = event.target.value as ActiveEquipmentSlot;
                setSelectedSlot(next);
                setSelectedItem(ITEMS.find((item) => item.slot === next)?.id ?? '');
              }}
              aria-label="Equipment slot"
            >
              {ACTIVE_EQUIPMENT_SLOTS.map((slot) => (
                <option key={slot} value={slot}>
                  {EQUIPMENT_SLOT_LABELS[slot]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Compatible item">
            <select
              value={itemId}
              onChange={(event) => setSelectedItem(event.target.value)}
              aria-label="Compatible item"
            >
              {compatible.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.id}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="debug-tools-inline-note">
          Compatible options are derived with <code>item.slot === selectedSlot</code>.
        </p>
        <div className="button-row">
          <ActionButton onClick={() => run((state) => debugGrantItem(state, itemId))}>
            Grant Selected Item
          </ActionButton>
          <ActionButton onClick={() => run((state) => debugEquipItem(state, itemId))}>
            Equip Selected
          </ActionButton>
          <ActionButton onClick={() => run((state) => debugGrantAndEquip(state, itemId))}>
            Grant and Equip
          </ActionButton>
          <ActionButton
            danger
            onClick={() => run((state) => debugUnequipSlot(state, selectedSlot))}
          >
            Unequip Slot
          </ActionButton>
        </div>
      </Section>
      <Section title="Equipment presets">
        <div className="button-row">
          {(['bronze', 'iron', 'steel'] as const).map((tier) => (
            <span className="debug-tools-button-group" key={tier}>
              <ActionButton onClick={() => run((state) => debugGrantSet(state, tier))}>
                Grant {labelize(tier)} Set
              </ActionButton>
              <ActionButton onClick={() => run((state) => debugEquipSet(state, tier))}>
                Equip {labelize(tier)} Set
              </ActionButton>
            </span>
          ))}
          <ActionButton
            danger
            onClick={() =>
              confirm(
                {
                  title: 'Clear Equipment?',
                  message:
                    'Normal unequip actions will run. Failed slots remain equipped and no gear is deleted.',
                  confirmLabel: 'Clear Equipment',
                  danger: true,
                },
                () => run(debugClearEquipment),
              )
            }
          >
            Clear Equipment
          </ActionButton>
        </div>
      </Section>
      <Section title="Equipment edge cases">
        <div className="button-row">
          <ActionButton
            onClick={() => run((state) => debugSimulateFullInventoryUnequip(state, selectedSlot))}
            title="Use normal unequip logic with effective capacity equal to current occupancy."
          >
            Simulate Full Inventory, Then Attempt Unequip
          </ActionButton>
          <ActionButton
            onClick={() => run((state) => debugSetHp(state, getDerivedStats(state).maxHealth))}
          >
            Set HP to Current Maximum
          </ActionButton>
          <ActionButton onClick={() => run((state) => debugSetHp(state, 1))}>
            Set HP to 1
          </ActionButton>
          <ActionButton danger onClick={() => run(debugSetHpAboveMaximum)}>
            Set HP Above Maximum
          </ActionButton>
          <ActionButton onClick={() => run(debugClampHp)}>Recalculate and Clamp HP</ActionButton>
        </div>
        <div className="debug-tools-grid">
          <Field label="Exact HP">
            <input
              type="number"
              min="0"
              value={hpAmount}
              onChange={(event) => setHpAmount(event.target.value)}
            />
          </Field>
          <ActionButton
            onClick={() =>
              run((state) => debugSetHp(state, parseDebugInteger(hpAmount, 0) ?? 0, false))
            }
          >
            Set Exact HP
          </ActionButton>
        </div>
      </Section>
    </>
  );
}
