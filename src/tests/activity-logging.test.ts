import { describe, expect, it } from 'vitest';
import { getCombatLogPresentation } from '../app/screens/combat/combatLogPresentation';
import { appendCombatLog } from '../game/logging/combatLog';
import { appendMilestone } from '../game/logging/milestoneLog';
import { migrateSave } from '../game/persistence/migrations';
import { parseGameState } from '../game/persistence/saveSchema';
import { startCombat } from '../game/engine/actionController';
import { createNewGame } from '../game/state/initialState';

describe('Activity Logging 2.0', () => {
  it('initializes separate bounded milestone and combat histories', () => {
    const state = createNewGame(0, 'Logger', 0);
    expect(state.activityLogs).toEqual({ milestones: [], combat: [] });
    expect('log' in state).toBe(false);

    for (let index = 0; index < 55; index += 1)
      appendMilestone(state, { skillId: 'mining', level: index + 1, at: index });
    for (let index = 0; index < 125; index += 1)
      appendCombatLog(state, {
        kind: 'player-miss',
        enemyId: 'redknife-lookout',
        at: index,
        encounterStartedAt: 0,
        special: false,
      });

    expect(state.activityLogs.milestones).toHaveLength(50);
    expect(state.activityLogs.combat).toHaveLength(120);
  });

  it('keeps milestone and combat domains isolated', () => {
    const state = createNewGame(0, 'Logger', 0);
    appendMilestone(state, { skillId: 'mining', level: 42, at: 100 });
    appendCombatLog(state, {
      kind: 'player-hit',
      enemyId: 'redknife-lookout',
      damage: 3,
      special: false,
      at: 101,
      encounterStartedAt: 101,
    });
    appendCombatLog(state, {
      kind: 'loot',
      enemyId: 'redknife-lookout',
      itemId: 'redknife-token',
      quantity: 1,
      at: 102,
      encounterStartedAt: 101,
    });

    expect(state.activityLogs.milestones).toHaveLength(1);
    expect(state.activityLogs.milestones[0]).toMatchObject({ kind: 'level-up', skillId: 'mining' });
    expect(state.activityLogs.combat).toHaveLength(2);
    expect(state.activityLogs.combat.map((entry) => getCombatLogPresentation(entry).text)).toEqual([
      'Received 1 Redknife Token.',
      'You hit Redknife Lookout for 3.',
    ]);
  });

  it('keeps bounded combat and milestone IDs unique for identical events', () => {
    const state = createNewGame(0, 'Unique IDs', 0);
    for (let index = 0; index < 120; index += 1)
      appendCombatLog(state, {
        kind: 'loot',
        enemyId: 'redknife-lookout',
        itemId: 'redknife-token',
        quantity: 1,
        at: 500,
        encounterStartedAt: 500,
      });
    appendCombatLog(state, {
      kind: 'loot',
      enemyId: 'redknife-lookout',
      itemId: 'redknife-token',
      quantity: 1,
      at: 500,
      encounterStartedAt: 500,
    });
    appendCombatLog(state, {
      kind: 'loot',
      enemyId: 'redknife-lookout',
      itemId: 'redknife-token',
      quantity: 1,
      at: 500,
      encounterStartedAt: 500,
    });
    for (let index = 0; index < 55; index += 1)
      appendMilestone(state, { skillId: 'attack', level: 2, at: 900 });
    expect(new Set(state.activityLogs.combat.map((entry) => entry.id)).size).toBe(120);
    expect(new Set(state.activityLogs.milestones.map((entry) => entry.id)).size).toBe(50);
  });

  it('presents typed combat events without parsing a text field', () => {
    const presentation = getCombatLogPresentation({
      id: 'hit-1',
      kind: 'player-hit',
      enemyId: 'redknife-lookout',
      damage: 4,
      special: false,
      at: 2_000,
      encounterStartedAt: 1_000,
    });
    expect(presentation).toMatchObject({
      text: 'You hit Redknife Lookout for 4.',
      label: 'Player hit',
      category: 'player-hit',
    });
  });

  it('migrates only recognizable milestones and combat-origin legacy entries', () => {
    const state = createNewGame(0, 'Legacy Logger', 0);
    const raw = state as unknown as Record<string, unknown>;
    delete raw.activityLogs;
    raw.log = [
      { id: 'level', at: 10, text: 'Mining reached level 42.', tone: 'success' },
      {
        id: 'combat',
        at: 20,
        text: 'You hit Forest Rat for 3.',
        tone: 'neutral',
        combatEncounterStartedAt: 15,
      },
      { id: 'discovery', at: 30, text: 'Iron Bar added to the collection.', tone: 'success' },
    ];
    state.schemaVersion = 9;

    const migrated = migrateSave(state, 9);
    expect(migrated.schemaVersion).toBe(16);
    expect(migrated.activityLogs.milestones).toMatchObject([
      { kind: 'level-up', skillId: 'mining', level: 42 },
    ]);
    expect(migrated.activityLogs.combat).toMatchObject([
      { kind: 'legacy', message: 'You hit Forest Rat for 3.', encounterStartedAt: 15 },
    ]);
    expect(migrated.activityLogs.combat).toHaveLength(1);
    const parsed = parseGameState(JSON.stringify(state));
    expect(parsed.schemaVersion).toBe(16);
    expect(parsed.activityLogs.milestones[0]).toMatchObject({ skillId: 'mining', level: 42 });
    expect(parsed.activityLogs.combat[0]).toMatchObject({ kind: 'legacy' });
  });

  it('normalizes retired enemy bleed records into generic legacy entries', () => {
    const state = createNewGame(0, 'Retired Bleed Log', 0);
    state.activityLogs.combat = [{
      id: 'retired-bleed',
      kind: 'enemy-bleed',
      enemyId: 'redknife-lookout',
      damage: 3,
      at: 20,
      encounterStartedAt: 15,
    } as never];

    const migrated = parseGameState(JSON.stringify(state));
    expect(migrated.activityLogs.combat).toEqual([{
      id: 'retired-bleed',
      kind: 'legacy',
      at: 20,
      message: 'Legacy combat event: retired bleed damage.',
      encounterStartedAt: 15,
    }]);
  });

  it('preserves active combat state during log migration', () => {
    const state = startCombat(
      createNewGame(0, 'Active Legacy', 0),
      'redknife-road-camp',
      'redknife-lookout',
      'accurate',
      true,
      0,
    );
    if (state.activeAction.type !== 'combat') throw new Error('Expected active combat.');
    state.activeAction.combatState.enemyHp = 5;
    state.activeAction.combatState.playerAttackMs = 321;
    state.activeAction.combatState.enemyAttackMs = 654;
    state.activeAction.combatState.adrenaline = 73;
    state.activeAction.pendingStyle = 'defensive';
    state.activeAction.specialQueued = true;
    const expectedCombat = structuredClone(state.activeAction);
    const raw = state as unknown as Record<string, unknown>;
    delete raw.activityLogs;
    raw.log = [];
    state.schemaVersion = 9;

    const migrated = migrateSave(state, 9);
    expect(migrated.activeAction).toEqual(expectedCombat);
  });
});
