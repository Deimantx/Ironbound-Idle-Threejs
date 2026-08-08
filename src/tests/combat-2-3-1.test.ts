import { describe, expect, it } from 'vitest';
import { itemById } from '../content/items';
import { formatHealth } from '../app/formatters';
import { getActualDps, getActualKillsPerHour } from '../app/combat/sessionMetrics';
import { getCombatLogPresentation } from '../app/combat/combatLogPresentation';
import { getSpecialAttackEffectRows } from '../app/items/specialAttackPresentation';
import { getTooltipPosition } from '../app/items/tooltipPosition';
import { parseGameState } from '../game/persistence/saveSchema';
import { startCombat } from '../game/engine/actionController';
import { createNewGame } from '../game/state/initialState';

describe('Combat 2.3.1 presentation and metrics', () => {
  it('uses seconds for actual DPS while keeping kills hourly', () => {
    expect(getActualDps(100, 20_000)).toBe(5);
    expect(getActualDps(0, 20_000)).toBe(0);
    expect(getActualDps(100, 0)).toBe(0);
    expect(Number.isFinite(getActualDps(100, 1))).toBe(true);
    expect(getActualKillsPerHour(3, 20_000)).toBe(540);
  });

  it('formats fractional player health upward and clamps invalid display values', () => {
    expect(formatHealth(31.9768)).toBe('32');
    expect(formatHealth(0)).toBe('0');
    expect(formatHealth(-1)).toBe('0');
    expect(formatHealth(132)).toBe('132');
  });

  it('rounds fractional combat death damage for the combat log', () => {
    const presentation = getCombatLogPresentation({
      id: 'death-1',
      kind: 'player-defeated',
      at: 1,
      enemyId: 'forest-rat',
      encounterStartedAt: 1,
      cause: { kind: 'enemy-hit', damage: 1.7851200000000205, heavy: false },
    });
    expect(presentation.text).toBe('You were killed by Forest Rat with a hit for 2.');
  });

  it('presents special attacks with their actual effects and compounded execute damage', () => {
    const bronzeRows = getSpecialAttackEffectRows(itemById['bronze-sword']!.specialAttack!);
    expect(bronzeRows.map((row) => row.label)).toEqual([
      'Deals 160% damage',
      '+25% Accuracy',
    ]);
    const ironRows = getSpecialAttackEffectRows(itemById['iron-sword']!.specialAttack!);
    expect(ironRows.map((row) => row.label)).toContain('Ignores flat damage reduction');
    const steelRows = getSpecialAttackEffectRows(itemById['steel-sword']!.specialAttack!);
    expect(steelRows.map((row) => row.label)).toContain('Below 35% HP: ~394% total damage');
  });

  it('migrates legacy combat momentum to adrenaline without retaining the old field', () => {
    const state = startCombat(
      createNewGame(0, 'Migration test', 0),
      'forest-path',
      'forest-rat',
      'accurate',
      false,
      0,
    ) as unknown as Record<string, unknown>;
    state.schemaVersion = 10;
    const activeAction = state.activeAction as Record<string, unknown>;
    const combatState = activeAction.combatState as Record<string, unknown>;
    delete combatState.adrenaline;
    combatState.momentum = 68;
    const parsed = parseGameState(JSON.stringify(state));
    expect(parsed.schemaVersion).toBe(13);
    expect(parsed.activeAction.type === 'combat' && parsed.activeAction.combatState.adrenaline).toBe(68);
    expect(
      parsed.activeAction.type === 'combat' && 'momentum' in parsed.activeAction.combatState,
    ).toBe(false);
    expect(parsed.activeAction.type === 'combat' && parsed.activeAction.combatState.enemyHp).toBeGreaterThan(0);
  });

  it('flips and clamps tooltip positions against the viewport', () => {
    const normal = getTooltipPosition(
      { top: 100, left: 100, width: 40, height: 20 },
      { width: 120, height: 50 },
      { width: 600, height: 400 },
      'right',
    );
    expect(normal.placement).toBe('right');
    expect(normal.left).toBe(150);

    const rightEdge = getTooltipPosition(
      { top: 100, left: 560, width: 30, height: 20 },
      { width: 160, height: 50 },
      { width: 600, height: 400 },
      'right',
    );
    expect(rightEdge.placement).toBe('left');

    const bottomEdge = getTooltipPosition(
      { top: 370, left: 100, width: 30, height: 20 },
      { width: 120, height: 80 },
      { width: 600, height: 400 },
      'bottom',
    );
    expect(bottomEdge.top).toBe(280);
  });
});
