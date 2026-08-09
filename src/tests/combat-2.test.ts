import { describe, expect, it } from 'vitest';
import { AREAS, areaById } from '../content/areas';
import { combatRegionById } from '../content/combatRegions';
import { ENEMIES } from '../content/enemies';
import { getDerivedStats } from '../game/formulas/statFormulas';
import { isCombatAreaUnlocked } from '../game/selectors/combatSelectors';
import { startCombat } from '../game/engine/actionController';
import { migrateSave } from '../game/persistence/migrations';
import { createNewGame } from '../game/state/initialState';
import type { AreaId, EnemyId } from '../game/types';

describe('Combat 2.0 content hierarchy', () => {
  it('defines Greenvale in the approved area order and maps every enemy', () => {
    expect(combatRegionById.greenvale.areaIds).toEqual([
      'forest-path',
      'wolf-den',
      'abandoned-camp',
      'old-shrine',
    ]);
    expect(AREAS.map((area) => area.name)).toEqual([
      'Forest Path',
      'Wolf Den',
      'Abandoned Camp',
      'Old Shrine',
      'Rocky Foothills',
      'Abandoned Mine',
      'Mountain Pass',
      'Ruined Watchtower',
    ]);
    expect(areaById['forest-path'].enemyIds).toEqual(['forest-rat', 'goblin-scavenger']);
    expect(areaById['wolf-den'].enemyIds).toEqual(['grey-wolf']);
    expect(areaById['abandoned-camp'].enemyIds).toEqual(['road-bandit']);
    expect(areaById['old-shrine'].enemyIds).toEqual(['cave-bat', 'stoneback-crab']);
    expect(Object.fromEntries(ENEMIES.map((enemy) => [enemy.id, enemy.areaId]))).toEqual({
      'forest-rat': 'forest-path',
      'goblin-scavenger': 'forest-path',
      'grey-wolf': 'wolf-den',
      'road-bandit': 'abandoned-camp',
      'cave-bat': 'old-shrine',
      'stoneback-crab': 'old-shrine',
      'hill-boar': 'rocky-foothills',
      'stonehide-ram': 'rocky-foothills',
      'tunnel-crawler': 'abandoned-mine',
      'forsaken-miner': 'abandoned-mine',
      'cliff-harpy': 'mountain-pass',
      'stonehill-marauder': 'mountain-pass',
      'ironbound-sentinel': 'ruined-watchtower',
      'watchtower-captain': 'ruined-watchtower',
    });
  });

  it('uses derived Combat Level rather than kill counts for normal areas', () => {
    const state = createNewGame(0, 'Unlocks');
    state.killCounts['forest-rat'] = 1_000_000;
    expect(isCombatAreaUnlocked(state, areaById['wolf-den'])).toBe(false);
    expect(isCombatAreaUnlocked(state, areaById['old-shrine'])).toBe(false);

    for (const skill of ['attack', 'strength', 'defence', 'hitpoints'] as const)
      state.skills[skill].level = 18;
    expect(getDerivedStats(state).combatLevel).toBe(18);
    expect(isCombatAreaUnlocked(state, areaById['wolf-den'])).toBe(true);
    expect(isCombatAreaUnlocked(state, areaById['old-shrine'])).toBe(true);
    expect(state.killCounts['cave-bat'] ?? 0).toBe(0);
  });
});

describe('Combat 2.0 area migration', () => {
  const cases: Array<[string, EnemyId, AreaId]> = [
    ['training-grounds', 'forest-rat', 'forest-path'],
    ['copper-hills', 'cave-bat', 'old-shrine'],
    ['ironwood-pass', 'grey-wolf', 'wolf-den'],
    ['ironwood-pass', 'road-bandit', 'abandoned-camp'],
  ];

  it.each(cases)('maps %s + %s to %s without resetting combat state', (oldArea, enemyId, areaId) => {
    const state = startCombat(
      createNewGame(0, 'Legacy Combat', 0),
      oldArea as unknown as AreaId,
      enemyId,
      'accurate',
      true,
      0,
    );
    if (state.activeAction.type !== 'combat') throw new Error('Expected active combat');
    state.schemaVersion = 8;
    state.unlockedAreas = [oldArea as unknown as AreaId];
    state.activeAction.combatState.enemyHp = 37;
    state.activeAction.combatState.playerAttackMs = 421;
    state.activeAction.combatState.adrenaline = 73;
    state.activeAction.combatState.eliteModifier = 'swift';
    state.activeAction.combatState.traitState.bleedStacks = 2;
    state.activeAction.specialQueued = true;
    state.activeAction.pendingStyle = 'defensive';
    const combatStateBefore = structuredClone(state.activeAction.combatState);

    const migrated = migrateSave(state, 8);
    expect(migrated.activeAction.type).toBe('combat');
    if (migrated.activeAction.type !== 'combat') return;
    expect(migrated.activeAction.areaId).toBe(areaId);
    expect(migrated.activeAction.enemyId).toBe(enemyId);
    expect(migrated.activeAction.combatState).toEqual(combatStateBefore);
    expect(migrated.activeAction.specialQueued).toBe(true);
    expect(migrated.activeAction.pendingStyle).toBe('defensive');
    expect(migrated.schemaVersion).toBe(15);
  });

  it('normalizes legacy unlocked area identifiers while retaining a safe default', () => {
    const state = createNewGame(0, 'Legacy Areas');
    state.schemaVersion = 8;
    state.unlockedAreas = ['training-grounds', 'ironwood-pass'] as unknown as AreaId[];
    const migrated = migrateSave(state, 8);
    expect(migrated.unlockedAreas).toEqual(['forest-path', 'wolf-den']);
  });
});
