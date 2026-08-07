import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../app/App';
import { GAME_CONFIG } from '../config/gameConfig';
import { miningNodeById } from '../content/miningNodes';
import { getMiningEstimatedRates, createMiningRuntimeState } from '../game/formulas/miningFormulas';
import { getXpForLevel } from '../game/formulas/experienceFormulas';
import { createNewGame } from '../game/state/initialState';
import { useGameStore } from '../game/state/gameStore';
import { UI_LAYOUT_STORAGE_KEY } from '../app/uiLayout';
import { formatRatePerHour } from '../app/formatters';

const rect = (left: number, top: number, width: number, height: number): DOMRect =>
  ({
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  }) as DOMRect;

const mockInventoryCardRect = (element: HTMLElement, left: number, width: number): void => {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(rect(left, 0, width, 100));
};

const createDragDataTransfer = (sourceId: string) => ({
  effectAllowed: '',
  dropEffect: '',
  setData: vi.fn(),
  getData: vi.fn((type: string) => (type === 'text/plain' ? sourceId : '')),
});

const dispatchDragEvent = (
  target: EventTarget,
  type: 'dragstart' | 'dragover' | 'drop' | 'dragend',
  dataTransfer: ReturnType<typeof createDragDataTransfer>,
  clientX = 0,
) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clientX', { configurable: true, value: clientX });
  Object.defineProperty(event, 'dataTransfer', { configurable: true, value: dataTransfer });
  act(() => target.dispatchEvent(event));
};

const mockCombatGeometry = () => {
  const grid = document.querySelector<HTMLElement>('[data-ui-panel-grid="combat"]');
  if (!grid) throw new Error('Combat panel grid was not rendered');
  const geometry: Record<string, DOMRect> = {
    combatLocations: rect(0, 0, 1200, 200),
    targetPreview: rect(0, 212, 1200, 180),
    player: rect(0, 404, 280, 220),
    liveCombat: rect(292, 404, 560, 220),
    enemy: rect(864, 404, 280, 220),
    combatOverview: rect(0, 636, 1200, 180),
  };
  vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 1200, 900));
  Object.entries(geometry).forEach(([id, panelRect]) => {
    const panel = document.querySelector<HTMLElement>(`[data-ui-panel="${id}"]`);
    if (!panel) throw new Error(`Combat panel ${id} was not rendered`);
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue(panelRect);
  });
};

const dispatchPointer = (
  target: EventTarget,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  values: Record<string, number>,
) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.entries(values).forEach(([key, value]) =>
    Object.defineProperty(event, key, { configurable: true, value }),
  );
  act(() => target.dispatchEvent(event));
};

const seedInventory = (
  inventory: Array<{ itemId: string; quantity: number; locked?: boolean }>,
) => {
  const game = createNewGame(0, 'Inventory Tester');
  game.settings.threeQuality = 'off';
  game.inventory = inventory.map((stack) => ({ locked: false, ...stack }));
  game.discoveredItems = inventory.map((stack) => stack.itemId);
  useGameStore.getState().setGame(game);
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('navigation integration', () => {
  beforeEach(() => {
    const game = createNewGame(0, 'Navigator');
    game.settings.threeQuality = 'off';
    useGameStore.getState().setGame(game);
  });
  it('keeps an action active while navigating to Inventory', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Mining/ }));
    await user.click(screen.getByRole('button', { name: 'Mine Stone Outcrop' }));
    await user.click(screen.getAllByRole('button', { name: /Inventory/ })[0]);
    expect(screen.getByRole('heading', { name: 'Inventory' })).toBeInTheDocument();
    expect(useGameStore.getState().game?.activeAction.type).toBe('mining');
  });

  it('renders and exposes the registered panels for every extracted screen', async () => {
    const user = userEvent.setup();
    render(<App />);
    const cases = [
      {
        nav: 'Inventory',
        screen: 'inventory',
        panels: ['inventoryToolbar', 'inventoryBank'],
        labels: ['Inventory controls', 'Inventory bank'],
      },
      {
        nav: 'Equipment',
        screen: 'equipment',
        panels: ['equipmentLoadout', 'equipmentStats'],
        labels: ['Equipment loadout', 'Equipment statistics'],
      },
      {
        nav: 'Mining',
        screen: 'mining',
        panels: ['miningOverview', 'miningNodes'],
        labels: ['Mining overview', 'Mining nodes'],
      },
      {
        nav: 'Smithing',
        screen: 'smithing',
        panels: ['smithingOverview', 'smithingForge', 'smithingAnvil'],
        labels: ['Smithing overview', 'Smithing Forge', 'Smithing Anvil'],
      },
    ];

    for (const current of cases) {
      await user.click(screen.getAllByRole('button', { name: new RegExp(current.nav) })[0]);
      expect(document.querySelector(`[data-ui-panel-grid="${current.screen}"]`)).not.toBeNull();
      for (const panel of current.panels) {
        expect(document.querySelector(`[data-ui-panel="${panel}"]`)).not.toBeNull();
      }

      await user.click(screen.getByRole('button', { name: 'Edit game UI' }));
      const editor = screen.getByRole('dialog', { name: 'Edit game UI' });
      for (const label of current.labels) {
        expect(within(editor).getByRole('button', { name: new RegExp(label) })).toBeInTheDocument();
      }
      await user.click(within(editor).getByRole('button', { name: 'Close UI editor' }));
    }
  });

  it('persists an Inventory panel edit through the local UI layout', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Inventory/ })[0]);
    await user.click(screen.getByRole('button', { name: 'Edit game UI' }));
    let editor = screen.getByRole('dialog', { name: 'Edit game UI' });
    await user.click(within(editor).getByRole('button', { name: /Inventory bank/ }));
    fireEvent.change(within(editor).getByRole('slider', { name: 'Panel scale' }), {
      target: { value: '1.5' },
    });
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(UI_LAYOUT_STORAGE_KEY) ?? '{}');
      expect(stored.screenPanels.inventory.inventoryBank.scale).toBe(1.5);
    });

    await user.click(within(editor).getByRole('button', { name: 'Close UI editor' }));
    await user.click(screen.getByRole('button', { name: 'Edit game UI' }));
    editor = screen.getByRole('dialog', { name: 'Edit game UI' });
    await user.click(within(editor).getByRole('button', { name: /Inventory bank/ }));
    expect(within(editor).getByRole('slider', { name: 'Panel scale' })).toHaveValue('1.5');
    await user.click(within(editor).getByRole('button', { name: 'Close UI editor' }));
  });

  it('keeps Mining active while editing a panel layout', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Mining/ })[0]);
    await user.click(screen.getByRole('button', { name: 'Mine Stone Outcrop' }));
    await user.click(screen.getByRole('button', { name: 'Edit game UI' }));
    const editor = screen.getByRole('dialog', { name: 'Edit game UI' });
    await user.click(within(editor).getByRole('button', { name: /Mining overview/ }));
    fireEvent.change(within(editor).getByRole('slider', { name: 'Panel scale' }), {
      target: { value: '1.25' },
    });
    await waitFor(() => {
      expect(useGameStore.getState().game?.activeAction.type).toBe('mining');
    });
    await user.click(within(editor).getByRole('button', { name: 'Close UI editor' }));
  });

  it('separates selected rock inspection from the active Mining node', async () => {
    const user = userEvent.setup();
    const game = createNewGame(0, 'Mining Selection Tester');
    game.settings.threeQuality = 'off';
    game.skills.mining.level = 15;
    game.skills.mining.xp = getXpForLevel(15);
    useGameStore.getState().setGame(game);
    render(<App />);

    await user.click(screen.getAllByRole('button', { name: /Mining/ })[0]);
    await user.click(screen.getByRole('button', { name: 'Mine Stone Outcrop' }));
    expect(useGameStore.getState().game?.activeAction).toMatchObject({
      type: 'mining',
      nodeId: 'stone-outcrop',
    });

    await user.click(screen.getByRole('button', { name: 'Inspect Iron Vein' }));
    expect(useGameStore.getState().game?.activeAction).toMatchObject({
      type: 'mining',
      nodeId: 'stone-outcrop',
    });
    expect(screen.getByRole('heading', { name: 'Iron Vein' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch to Iron Vein' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Mining: Stone Outcrop' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Switch to Iron Vein' }));
    await user.click(screen.getByRole('button', { name: 'Replace activity' }));
    expect(useGameStore.getState().game?.activeAction).toMatchObject({
      type: 'mining',
      nodeId: 'iron-vein',
    });
    expect(document.querySelector('.mining-selected-rock h2')?.textContent).toBe('Iron Vein');
    await user.click(screen.getByRole('button', { name: 'Stop Mining' }));
    expect(useGameStore.getState().game?.activeAction.type).toBe('none');
    expect(document.querySelector('.mining-selected-rock h2')?.textContent).toBe('Iron Vein');
  });

  it('allows locked Coal inspection without allowing it to start', async () => {
    const user = userEvent.setup();
    const game = createNewGame(0, 'Locked Mining Tester');
    game.settings.threeQuality = 'off';
    useGameStore.getState().setGame(game);
    render(<App />);

    await user.click(screen.getAllByRole('button', { name: /Mining/ })[0]);
    await user.click(screen.getByRole('button', { name: 'Inspect Coal Seam' }));
    expect(screen.getAllByRole('heading', { name: 'Coal Seam' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Level 30 Required' })).toBeDisabled();
    expect(useGameStore.getState().game?.activeAction.type).toBe('none');
  });

  it('presents Mining details as player-facing guidance', async () => {
    const user = userEvent.setup();
    const game = createNewGame(0, 'Mining Copy Tester');
    game.settings.threeQuality = 'off';
    game.skills.mining.level = 15;
    game.skills.mining.xp = getXpForLevel(15);
    game.mining.stamina = 10;
    useGameStore.getState().setGame(game);
    render(<App />);

    await user.click(screen.getAllByRole('button', { name: /Mining/ })[0]);
    expect(screen.getByText('Available Deposits')).toBeInTheDocument();
    expect(screen.getByText(/Owned: 0/)).toBeInTheDocument();
    expect(screen.getByText(/Mining XP \/ Swing/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Inspect Iron Vein' }));
    expect(screen.getByText('Iron Pick')).toBeInTheDocument();
    expect(screen.getByText('Iron Pick', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getAllByText(/Owned 0/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Ore yield|1 per \d+ damage/)).not.toBeInTheDocument();
    expect(screen.queryByText('Resource progress')).not.toBeInTheDocument();
    expect(screen.queryByText('Phase One resources')).not.toBeInTheDocument();
    expect(screen.queryByText('Selected')).not.toBeInTheDocument();
    expect(screen.queryByText(/0\.75x|1\.80x/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mine Stone Outcrop' }));
    expect(screen.getByText('Before rest')).toBeInTheDocument();
    expect(screen.getByText('1 swing', { exact: true })).toBeInTheDocument();
  });

  it('renders the Mining Activity Bar with level progress, XP rate, stage, phase, and stamina', () => {
    const game = createNewGame(0, 'Activity Bar Tester');
    game.skills.mining.level = 10;
    const levelStart = getXpForLevel(10);
    const levelSpan = getXpForLevel(11) - levelStart;
    game.skills.mining.xp = levelStart + Math.floor(levelSpan / 2);
    game.activeAction = {
      type: 'mining',
      nodeId: 'stone-outcrop',
      startedAt: 0,
      phase: 'swing',
      progressMs: 1_000,
    };
    const runtime = createMiningRuntimeState('stone-outcrop');
    runtime.stageIndex = 3;
    runtime.stageDurability = 20;
    game.mining.nodeStates['stone-outcrop'] = runtime;
    useGameStore.getState().setGame(game);
    render(<App />);

    const levelBar = screen.getByRole('progressbar', { name: 'Mining level progress' });
    expect(levelBar).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText('10', { selector: '.activity-level-current' })).toBeInTheDocument();
    expect(screen.getByText('11', { selector: '.activity-level-next' })).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('XP to next: 133')).toBeInTheDocument();
    expect(screen.getByText(/^ETA: \d{2}:\d{2}$/)).toBeInTheDocument();
    expect(screen.getByText(/Rich Core/)).toBeInTheDocument();
    expect(screen.getByText('Swing')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Swing progress' })).toBeInTheDocument();
    expect(screen.getByText('Stamina')).toBeInTheDocument();
    expect(screen.getByText('100/100')).toBeInTheDocument();
    expect(
      screen.getByText(
        `~${formatRatePerHour(getMiningEstimatedRates(game, miningNodeById['stone-outcrop']).xpPerHour)} XP/hr`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Mining: Stone Outcrop' })).toBeInTheDocument();
  });

  it('keeps the Mining Activity Bar stable at max level and stops cleanly', async () => {
    const user = userEvent.setup();
    const game = createNewGame(0, 'Max Level Activity Tester');
    game.skills.mining.level = 100;
    game.skills.mining.xp = getXpForLevel(100);
    game.activeAction = {
      type: 'mining',
      nodeId: 'stone-outcrop',
      startedAt: 0,
      phase: 'rest',
      progressMs: 4_000,
    };
    useGameStore.getState().setGame(game);
    render(<App />);

    expect(screen.getByText('MAX LEVEL')).toBeInTheDocument();
    expect(screen.queryByText('101')).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Mining level progress' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
    expect(screen.queryByText(/^ETA:/)).not.toBeInTheDocument();
    expect(screen.getByText('Rest')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Rest progress' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open Mining: Stone Outcrop' }));
    expect(screen.getByRole('heading', { name: 'Mining' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Stop mining' }));
    expect(useGameStore.getState().game?.activeAction.type).toBe('none');
    expect(screen.queryByRole('button', { name: 'Stop mining' })).not.toBeInTheDocument();
  });

  it('uses the Stage 1 name and a compact Respawn phase', async () => {
    const game = createNewGame(0, 'Phase Activity Tester');
    const runtime = createMiningRuntimeState('stone-outcrop');
    runtime.respawnRemainingMs = 9_000;
    game.mining.nodeStates['stone-outcrop'] = runtime;
    game.activeAction = {
      type: 'mining',
      nodeId: 'stone-outcrop',
      startedAt: 0,
      phase: 'respawn',
      progressMs: 0,
    };
    useGameStore.getState().setGame(game);
    render(<App />);

    expect(screen.getByText('Rock reforming')).toBeInTheDocument();
    expect(screen.getByText('Respawn')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Respawn progress' })).toBeInTheDocument();

    game.activeAction = {
      type: 'mining',
      nodeId: 'stone-outcrop',
      startedAt: 0,
      phase: 'swing',
      progressMs: 0,
    };
    useGameStore.getState().setGame(game);
    await waitFor(() => expect(screen.getByText(/Outer Crust/)).toBeInTheDocument());
  });

  it('keeps extracted Inventory, Equipment, and Smithing interactions working', async () => {
    const user = userEvent.setup();
    const game = createNewGame(0, 'Crafter');
    game.settings.threeQuality = 'off';
    game.inventory = [
      { itemId: 'iron-ore', quantity: 1, locked: false },
      { itemId: 'coal', quantity: 1, locked: false },
      { itemId: 'bronze-sword', quantity: 1, locked: false },
    ];
    game.discoveredItems = ['iron-ore', 'coal', 'bronze-sword'];
    useGameStore.getState().setGame(game);
    render(<App />);

    await user.click(screen.getAllByRole('button', { name: /Inventory/ })[0]);
    await user.click(screen.getByRole('button', { name: /View Bronze Sword/ }));
    expect(screen.getByRole('heading', { name: 'Bronze Sword' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Equip' }));
    expect(useGameStore.getState().game?.equipment.weapon).toBe('bronze-sword');

    await user.click(screen.getAllByRole('button', { name: /Equipment/ })[0]);
    await user.click(screen.getByRole('button', { name: 'Weapon slot, Bronze Sword' }));
    expect(useGameStore.getState().game?.equipment.weapon).toBe('bronze-sword');
    await user.click(screen.getByRole('button', { name: 'Unequip' }));
    expect(useGameStore.getState().game?.equipment.weapon).toBeUndefined();

    await user.click(screen.getAllByRole('button', { name: /Smithing/ })[0]);
    await user.click(screen.getByRole('button', { name: 'Continuous' }));
    await user.click(screen.getByRole('button', { name: 'Start smelting' }));
    const action = useGameStore.getState().game?.activeAction;
    expect(action?.type).toBe('smithing');
    expect(action?.type === 'smithing' ? action.quantityMode : null).toBe('continuous');
    expect(screen.getByRole('button', { name: 'Open Smithing: Iron Bar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop smithing' })).toBeInTheDocument();
    expect(screen.getByText('Active Order')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Smelting Iron Bar' })).toBeInTheDocument();
    expect(screen.getAllByText('Next Iron Bar')).toHaveLength(2);
    expect(screen.queryByText('Quantity:')).not.toBeInTheDocument();
  });

  it('renders Smithing with compact facility-specific recipe presentations', async () => {
    const user = userEvent.setup();
    const game = createNewGame(0, 'Smithing Layout Tester');
    game.settings.threeQuality = 'off';
    game.inventory = [{ itemId: 'iron-ore', quantity: 1, locked: false }];
    useGameStore.getState().setGame(game);
    render(<App />);

    await user.click(screen.getAllByRole('button', { name: /Smithing/ })[0]);
    expect(screen.getByRole('heading', { name: 'Smithing idle' })).toBeInTheDocument();
    expect(screen.getAllByText('Quantity:', { selector: 'span' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Continuous' })).toHaveLength(1);
    expect(document.querySelectorAll('.smithing-forge-card')).toHaveLength(2);
    expect(document.querySelectorAll('.smithing-anvil-row').length).toBeGreaterThan(0);
    expect(
      screen.getByText('IRON', { selector: '.smithing-tier-heading span' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('STEEL', { selector: '.smithing-tier-heading span' }),
    ).toBeInTheDocument();
    expect(document.querySelector('.smithing-recipe-row')).toBeNull();
    expect(document.querySelector('.smithing-hammer-summary')).toBeNull();
    expect(screen.queryByText('Coal owned')).not.toBeInTheDocument();
    expect(screen.queryByText('Profession tool')).not.toBeInTheDocument();
    const smithingText =
      document.querySelector('[data-ui-panel-grid="smithing"]')?.textContent ?? '';
    expect(smithingText).not.toContain(String.fromCharCode(195, 130));
    expect(smithingText).not.toContain(String.fromCharCode(195, 151));
    expect(smithingText).not.toContain(String.fromCharCode(194, 183));
    expect(screen.getByRole('button', { name: 'No fuel' })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Requires level 30' })).toHaveLength(2);
    expect(
      screen
        .getAllByRole('button', { name: 'Requires level 30' })
        .every((button) => button.hasAttribute('disabled')),
    ).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Iron' }));
    expect(
      screen.getByText('IRON', { selector: '.smithing-tier-heading span' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('STEEL', { selector: '.smithing-tier-heading span' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All Metals' }));
    await user.click(screen.getByRole('button', { name: 'Weapons' }));
    await user.click(screen.getByRole('button', { name: 'Iron' }));
    expect(screen.getByText('Iron Sword')).toBeInTheDocument();
    expect(screen.queryByText('Iron Armor')).not.toBeInTheDocument();

    const forgeHeader = screen.getByRole('button', { name: /Forge Smelt ore/ });
    expect(forgeHeader).toHaveAttribute('aria-expanded', 'true');
    await user.click(forgeHeader);
    expect(forgeHeader).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelectorAll('.smithing-forge-card')).toHaveLength(0);
    await user.click(forgeHeader);
    expect(document.querySelectorAll('.smithing-forge-card')).toHaveLength(2);
  });

  it('shows the consolidated Anvil hammer status without copying it into the overview', async () => {
    const user = userEvent.setup();
    const game = createNewGame(0, 'Smithing Hammer Tester');
    game.settings.threeQuality = 'off';
    game.skills.smithing.level = 15;
    game.skills.smithing.xp = getXpForLevel(15);
    game.equipment.tool = 'iron-smithing-hammer';
    useGameStore.getState().setGame(game);
    render(<App />);

    await user.click(screen.getAllByRole('button', { name: /Smithing/ })[0]);
    expect(screen.getAllByText(/Iron Smithing Hammer · 8% faster · 3% preservation/)).toHaveLength(
      1,
    );
    expect(screen.queryByText('No Smithing Hammer')).not.toBeInTheDocument();
    expect(screen.queryByText(/XP\/hr/)).not.toBeInTheDocument();
  });

  it('selects Armor, previews compatible gear, and requires explicit replacement', async () => {
    const user = userEvent.setup();
    const game = createNewGame(0, 'Armor Tester');
    game.settings.threeQuality = 'off';
    game.inventory = [
      { itemId: 'iron-armor', quantity: 1, locked: true },
      { itemId: 'bronze-sword', quantity: 1, locked: false },
      { itemId: 'iron-shield', quantity: 1, locked: false },
      { itemId: 'iron-pickaxe', quantity: 2, locked: false },
    ];
    game.equipment.armor = 'bronze-armor';
    useGameStore.getState().setGame(game);
    render(<App />);

    await user.click(screen.getAllByRole('button', { name: /Equipment/ })[0]);
    expect(screen.queryByText(/9 combat slots/)).not.toBeInTheDocument();
    expect(document.querySelector('.equipment-loadout-workspace')).toBeInTheDocument();
    expect(document.querySelector('.equipment-loadout-inspection')).toBeInTheDocument();
    expect(document.querySelector('.equipment-compatible-bank')).toBeInTheDocument();
    expect(document.querySelector('.equipment-stats-shell')).toHaveClass(
      'equipment-stats-sticky-safe',
    );
    for (const heading of ['Combat Gear', 'Accessories', 'Profession Equipment']) {
      expect(
        screen
          .getAllByText(heading, { exact: true })
          .filter((element) => !element.classList.contains('visually-hidden')),
      ).toHaveLength(1);
    }
    for (const label of [
      'Helmet',
      'Armor',
      'Gloves',
      'Boots',
      'Weapon',
      'Off-hand',
      'Amulet',
      'Ring',
      'Cape',
      'Tool',
    ])
      expect(screen.getByRole('button', { name: new RegExp(`${label} slot`) })).toBeInTheDocument();
    expect(screen.queryByText('Future slots')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Amulet · Locked|Ring · Locked|Cape · Locked/),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Body|Legs/ })).not.toBeInTheDocument();
    expect(
      screen
        .getByRole('button', { name: 'Gloves slot, empty' })
        .querySelector('.equipment-empty-slot-icon'),
    ).toBeInTheDocument();
    expect(
      screen
        .getByRole('button', { name: 'Armor slot, Bronze Armor' })
        .querySelector('.equipment-empty-slot-icon'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Special Attacks')).not.toBeInTheDocument();

    const armorSlot = screen.getByRole('button', { name: 'Armor slot, Bronze Armor' });
    await user.click(armorSlot);
    expect(armorSlot).toHaveAttribute('aria-pressed', 'true');
    expect(useGameStore.getState().game?.equipment.armor).toBe('bronze-armor');
    expect(screen.getByRole('button', { name: /Inspect Iron Armor/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Inspect Iron Armor/ }));
    expect(useGameStore.getState().game?.equipment.armor).toBe('bronze-armor');
    expect(screen.getByRole('button', { name: 'Replace Bronze Armor' })).toBeInTheDocument();
    expect(screen.getByText('Item bonus comparison')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Replace Bronze Armor' }));
    expect(useGameStore.getState().game?.equipment.armor).toBe('iron-armor');
    expect(useGameStore.getState().game?.inventory).toContainEqual({
      itemId: 'bronze-armor',
      quantity: 1,
      locked: false,
    });

    const offhandSlot = screen.getByRole('button', { name: 'Off-hand slot, empty' });
    await user.click(offhandSlot);
    expect(screen.getByRole('button', { name: /Inspect Iron Bulwark/ })).toBeInTheDocument();
    expect(useGameStore.getState().game?.equipment.offhand).toBeUndefined();
    await user.click(screen.getByRole('button', { name: /Inspect Iron Bulwark/ }));
    expect(screen.getByRole('button', { name: 'Equip' })).toBeInTheDocument();
    expect(useGameStore.getState().game?.equipment.offhand).toBeUndefined();
  });

  it('separates Tool profession previews and keeps disclosure state local', async () => {
    const user = userEvent.setup();
    const game = createNewGame(0, 'Profession Tester');
    game.settings.threeQuality = 'off';
    game.equipment = {};
    game.inventory = [{ itemId: 'bronze-pickaxe', quantity: 1, locked: false }];
    useGameStore.getState().setGame(game);
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Equipment/ })[0]);

    const professionToggle = screen.getByRole('button', { name: /Profession Bonuses/ });
    expect(professionToggle).toHaveAttribute('aria-expanded', 'false');
    expect(professionToggle).toHaveTextContent('No pickaxe equipped');
    expect(screen.getByText('No compatible Weapons in Inventory.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Inventory' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tool slot, empty' }));
    expect(professionToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/No profession tool equipped/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Inspect Bronze Pick/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Inspect Bronze Pick/ }));
    expect(professionToggle).toHaveTextContent('Preview 16 damage');
    expect(screen.getByText(/1 damage · 0 pen/)).toBeInTheDocument();
    expect(screen.queryByText('Special Attacks')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Gloves slot, empty' }));
    expect(professionToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('No Gloves are currently available.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open Inventory' })).not.toBeInTheDocument();
    for (const [slot, message] of [
      ['Boots', 'No Boots are currently available.'],
      ['Amulet', 'No Amulets are currently available.'],
      ['Ring', 'No Rings are currently available.'],
      ['Cape', 'No Capes are currently available.'],
    ] as const) {
      await user.click(screen.getByRole('button', { name: `${slot} slot, empty` }));
      expect(screen.getByText(message)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Open Inventory' })).not.toBeInTheDocument();
    }
  });

  it('shows Special Attacks only for a relevant weapon selection', async () => {
    const user = userEvent.setup();
    const game = createNewGame(0, 'Special Tester');
    game.settings.threeQuality = 'off';
    game.equipment.weapon = 'bronze-sword';
    game.inventory = [{ itemId: 'iron-sword', quantity: 1, locked: false }];
    useGameStore.getState().setGame(game);
    render(<App />);

    await user.click(screen.getAllByRole('button', { name: /Equipment/ })[0]);
    expect(screen.getByText('Special Attacks')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Weapon slot, Bronze Sword' }));
    await user.click(screen.getByRole('button', { name: /Inspect Iron Sword/ }));
    expect(screen.getByText('Candidate special')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Armor slot, empty' }));
    expect(screen.queryByText('Special Attacks')).not.toBeInTheDocument();
  });

  it('preserves a manually expanded profession disclosure while a tool is equipped', async () => {
    const user = userEvent.setup();
    const game = createNewGame(0, 'Equipped Tool Tester');
    game.settings.threeQuality = 'off';
    game.equipment.tool = 'bronze-pickaxe';
    useGameStore.getState().setGame(game);
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Equipment/ })[0]);

    const professionToggle = screen.getByRole('button', { name: /Profession Bonuses/ });
    expect(professionToggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(professionToggle);
    expect(professionToggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(professionToggle);
    expect(professionToggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('button', { name: 'Weapon slot, empty' }));
    expect(professionToggle).toHaveAttribute('aria-expanded', 'true');
    expect(professionToggle).toHaveTextContent('16 damage · 25 pen');
  });

  it('shows the compact nine-slot equipment summary in Combat', async () => {
    const user = userEvent.setup();
    const game = createNewGame(0, 'Combat Armor');
    game.settings.threeQuality = 'off';
    game.equipment.armor = 'iron-armor';
    game.equipment.offhand = 'iron-shield';
    useGameStore.getState().setGame(game);
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Combat/ })[0]);
    const strip = screen.getByLabelText('Equipped items');
    for (const label of [
      'Weapon',
      'Helmet',
      'Armor',
      'Off-hand',
      'Gloves',
      'Boots',
      'Amulet',
      'Ring',
      'Cape',
    ])
      expect(within(strip).getByText(label)).toBeInTheDocument();
    expect(within(strip).getByText('Iron Armor')).toBeInTheDocument();
    expect(within(strip).getByText('Iron Bulwark')).toBeInTheDocument();
    expect(within(strip).queryByText('Body')).not.toBeInTheDocument();
    expect(within(strip).queryByText('Legs')).not.toBeInTheDocument();
    expect(within(strip).queryByText('Shield')).not.toBeInTheDocument();
    expect(within(strip).queryByText('Tool')).not.toBeInTheDocument();
  });

  it('renders the compact Inventory 2.1 bank structure and capacity semantics', async () => {
    const user = userEvent.setup();
    seedInventory([
      { itemId: 'copper-ore', quantity: 124 },
      { itemId: 'iron-sword', quantity: 1 },
      { itemId: 'rat-tail', quantity: 8, locked: true },
    ]);
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Inventory/ })[0]);

    expect(screen.getByRole('heading', { name: 'Inventory' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search inventory' })).toBeInTheDocument();
    for (const label of ['All', 'Materials', 'Equipment', 'Drops', 'Currency'])
      expect(screen.getByRole('button', { name: new RegExp(`^${label}`) })).toBeInTheDocument();
    const currencyFilter = screen.getByRole('button', { name: /^Currency/ });
    expect(currencyFilter).toHaveAttribute('aria-pressed', 'false');
    expect(currencyFilter).not.toBeDisabled();
    expect(within(currencyFilter).getByText('0')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Inventory capacity' })).toHaveAttribute(
      'aria-valuenow',
      '3',
    );
    expect(document.querySelector('[data-ui-panel="inventoryToolbar"]')).not.toBeNull();
    expect(document.querySelector('[data-ui-panel="inventoryBank"]')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Item Bank' })).toBeInTheDocument();
    expect(screen.getByText('3 stacks')).toBeInTheDocument();
    expect(screen.queryByText('Storage ledger')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Search and filter' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Materials' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Equipment' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Drops' })).toBeInTheDocument();
    expect(screen.queryByText(/Showing 3 of 3 stacks/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open Equipment' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Select an item' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /View Iron Sword/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: /View Rat Tail/ })).toHaveAccessibleName(/locked/i);

    const bankGrid = document.querySelector<HTMLElement>('.inventory-bank-grid');
    expect(bankGrid).not.toBeNull();
    const cards = within(bankGrid as HTMLElement).getAllByRole('button');
    expect(cards[0]).toHaveTextContent(/×/);
    expect(cards[0]).not.toHaveTextContent(
      /Materials|Equipment|Drops|Common|Uncommon|Rare|Epic|Tier/,
    );
    expect(cards[0]).toHaveAttribute('title');
    expect(screen.getByRole('combobox', { name: 'Sort inventory' })).toHaveValue('category');
    expect(screen.getByRole('checkbox', { name: 'Auto Sort' })).toBeChecked();
  });

  it('sorts, snapshots, persists, and manually reorders desktop card order', async () => {
    const user = userEvent.setup();
    seedInventory([
      { itemId: 'rat-tail', quantity: 2 },
      { itemId: 'iron-sword', quantity: 1 },
      { itemId: 'copper-ore', quantity: 8 },
    ]);
    const profileId = useGameStore.getState().game?.profileId;
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Inventory/ })[0]);

    const getCardIds = () =>
      within(document.querySelector('.inventory-bank-grid') as HTMLElement)
        .getAllByRole('button')
        .map((card) => card.getAttribute('aria-label') ?? '');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort inventory' }), 'name');
    expect(getCardIds()[0]).toMatch(/Copper Ore/);
    await user.click(screen.getByRole('button', { name: 'Name A-Z' }));
    expect(getCardIds()[0]).toMatch(/Rat Tail/);
    expect(screen.getByRole('checkbox', { name: 'Auto Sort' })).toBeChecked();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort inventory' }), 'manual');
    expect(screen.getByRole('checkbox', { name: 'Auto Sort' })).not.toBeChecked();
    expect(screen.queryByRole('button', { name: /Manual order/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Manual ordering active/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Materials' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Equipment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Drops' })).not.toBeInTheDocument();
    expect(
      within(document.querySelector('.inventory-bank-grid') as HTMLElement).getAllByRole(
        'button',
      )[0],
    ).toHaveAttribute('draggable', 'true');

    const source = screen.getByRole('button', { name: /View Rat Tail/ });
    let target = screen.getByRole('button', { name: /View Copper Ore/ });
    const dataTransfer = createDragDataTransfer('rat-tail');
    dispatchDragEvent(source, 'dragstart', dataTransfer);
    await waitFor(() => expect(source).toHaveClass('is-drag-source'));
    target = screen.getByRole('button', { name: /View Copper Ore/ });
    mockInventoryCardRect(target, 100, 100);
    dispatchDragEvent(target, 'dragover', dataTransfer, 150);
    dispatchDragEvent(target, 'drop', dataTransfer, 150);
    await waitFor(() => expect(getCardIds()[0]).toMatch(/Iron Sword/));

    await waitFor(() => {
      const stored = JSON.parse(
        window.localStorage.getItem(`ironbound-idle-inventory-view:${profileId}`) ?? '{}',
      );
      expect(stored.sortMode).toBe('manual');
      expect(stored.manualOrder[0]).toBe('iron-sword');
    });
  });

  it('uses actual horizontal drop geometry and ignores a stale target position', async () => {
    const user = userEvent.setup();
    seedInventory([
      { itemId: 'copper-ore', quantity: 4 },
      { itemId: 'tin-ore', quantity: 2 },
      { itemId: 'rat-tail', quantity: 1 },
    ]);
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Inventory/ })[0]);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort inventory' }), 'manual');

    const getCardIds = () =>
      within(document.querySelector('.inventory-bank-grid') as HTMLElement)
        .getAllByRole('button')
        .map((card) => card.getAttribute('aria-label') ?? '');
    expect(getCardIds().map((label) => label.match(/View ([^,]+)/)?.[1])).toEqual([
      'Copper Ore',
      'Tin Ore',
      'Rat Tail',
    ]);

    const source = screen.getByRole('button', { name: /View Rat Tail/ });
    const staleTarget = screen.getByRole('button', { name: /View Tin Ore/ });
    const actualTarget = screen.getByRole('button', { name: /View Copper Ore/ });
    const dataTransfer = createDragDataTransfer('rat-tail');
    mockInventoryCardRect(staleTarget, 200, 100);
    mockInventoryCardRect(actualTarget, 100, 100);

    dispatchDragEvent(source, 'dragstart', dataTransfer);
    await waitFor(() => expect(source).toHaveClass('is-drag-source'));
    dispatchDragEvent(staleTarget, 'dragover', dataTransfer, 295);
    expect(staleTarget).toHaveClass('is-drop-after');
    expect(document.querySelectorAll('.is-drop-before, .is-drop-after')).toHaveLength(1);
    dispatchDragEvent(actualTarget, 'drop', dataTransfer, 150);

    await waitFor(() =>
      expect(getCardIds().map((label) => label.match(/View ([^,]+)/)?.[1])).toEqual([
        'Rat Tail',
        'Copper Ore',
        'Tin Ore',
      ]),
    );
    expect(actualTarget).not.toHaveClass('is-drop-before');
    expect(staleTarget).not.toHaveClass('is-drop-after');
    expect(useGameStore.getState().game?.inventory.map((stack) => stack.itemId)).toEqual([
      'copper-ore',
      'tin-ore',
      'rat-tail',
    ]);
    expect(useGameStore.getState().game?.inventory.map((stack) => stack.quantity)).toEqual([
      4, 2, 1,
    ]);

    const rightEdgeSource = screen.getByRole('button', { name: /View Copper Ore/ });
    const rightEdgeTarget = screen.getByRole('button', { name: /View Tin Ore/ });
    mockInventoryCardRect(rightEdgeTarget, 300, 100);
    const rightEdgeDataTransfer = createDragDataTransfer('copper-ore');
    dispatchDragEvent(rightEdgeSource, 'dragstart', rightEdgeDataTransfer);
    dispatchDragEvent(rightEdgeTarget, 'drop', rightEdgeDataTransfer, 395);
    await waitFor(() =>
      expect(getCardIds().map((label) => label.match(/View ([^,]+)/)?.[1])).toEqual([
        'Rat Tail',
        'Tin Ore',
        'Copper Ore',
      ]),
    );
  });

  it('renders left and right markers, clears drag state, and suppresses only the immediate click', async () => {
    const user = userEvent.setup();
    seedInventory([
      { itemId: 'copper-ore', quantity: 4 },
      { itemId: 'tin-ore', quantity: 2 },
      { itemId: 'rat-tail', quantity: 1 },
    ]);
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Inventory/ })[0]);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort inventory' }), 'manual');

    const source = screen.getByRole('button', { name: /View Rat Tail/ });
    const firstTarget = screen.getByRole('button', { name: /View Copper Ore/ });
    const secondTarget = screen.getByRole('button', { name: /View Tin Ore/ });
    const dataTransfer = createDragDataTransfer('rat-tail');
    mockInventoryCardRect(firstTarget, 100, 100);
    mockInventoryCardRect(secondTarget, 200, 100);

    dispatchDragEvent(source, 'dragstart', dataTransfer);
    await waitFor(() => expect(source).toHaveClass('is-drag-source'));
    dispatchDragEvent(firstTarget, 'dragover', dataTransfer, 150);
    expect(firstTarget).toHaveClass('is-drop-before');
    dispatchDragEvent(secondTarget, 'dragover', dataTransfer, 295);
    expect(firstTarget).not.toHaveClass('is-drop-before');
    expect(secondTarget).toHaveClass('is-drop-after');

    dispatchDragEvent(source, 'dragend', dataTransfer);
    expect(document.querySelector('.is-drop-before, .is-drop-after')).toBeNull();

    dispatchDragEvent(source, 'dragstart', dataTransfer);
    dispatchDragEvent(firstTarget, 'dragover', dataTransfer, 150);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.querySelector('.is-drop-before, .is-drop-after')).toBeNull();
    dispatchDragEvent(source, 'dragstart', dataTransfer);
    dispatchDragEvent(firstTarget, 'dragover', dataTransfer, 150);
    dispatchDragEvent(firstTarget, 'drop', dataTransfer, 150);
    expect(document.querySelector('.is-drop-before, .is-drop-after')).toBeNull();
    fireEvent.click(firstTarget, { detail: 1 });
    expect(firstTarget).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: /View Rat Tail/ }));
    expect(screen.getByRole('button', { name: /View Rat Tail/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('restores the last automatic mode when Auto Sort is re-enabled', async () => {
    const user = userEvent.setup();
    seedInventory([
      { itemId: 'rat-tail', quantity: 2 },
      { itemId: 'iron-sword', quantity: 1 },
      { itemId: 'copper-ore', quantity: 8 },
    ]);
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Inventory/ })[0]);
    const sort = screen.getByRole('combobox', { name: 'Sort inventory' });
    const autoSort = screen.getByRole('checkbox', { name: 'Auto Sort' });
    await user.selectOptions(sort, 'rarity');
    await user.selectOptions(sort, 'manual');
    expect(autoSort).not.toBeChecked();
    await user.click(autoSort);
    expect(autoSort).toBeChecked();
    expect(sort).toHaveValue('rarity');
    await user.click(autoSort);
    expect(autoSort).not.toBeChecked();
    expect(sort).toHaveValue('manual');
  });

  it('searches, filters, and resets the visible bank without changing query state', async () => {
    const user = userEvent.setup();
    seedInventory([
      { itemId: 'copper-ore', quantity: 4 },
      { itemId: 'iron-sword', quantity: 1 },
      { itemId: 'rat-tail', quantity: 2 },
    ]);
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Inventory/ })[0]);
    const search = screen.getByRole('textbox', { name: 'Search inventory' });
    await user.type(search, 'iron');
    expect(screen.getByRole('button', { name: /View Iron Sword/ })).toBeInTheDocument();
    expect(screen.getByText('1 results for "iron"')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /View Copper Ore/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Materials/ }));
    expect(screen.queryByRole('button', { name: /View Copper Ore/ })).not.toBeInTheDocument();
    expect(search).toHaveValue('iron');
    expect(screen.getByText('No items match these filters')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset filters' }));
    expect(search).toHaveValue('');
    expect(screen.getByRole('button', { name: /View Copper Ore/ })).toBeInTheDocument();

    await user.type(search, 'ore');
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(search).toHaveValue('');
  });

  it('keeps desktop selection details live and protects locked stacks', async () => {
    const user = userEvent.setup();
    seedInventory([
      { itemId: 'iron-sword', quantity: 2 },
      { itemId: 'copper-ore', quantity: 4 },
    ]);
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Inventory/ })[0]);
    await user.click(screen.getByRole('button', { name: /View Iron Sword/ }));
    expect(screen.getByRole('heading', { name: 'Iron Sword' })).toBeInTheDocument();
    expect(screen.getByText('Sundering Strike')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lock' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Lock' }));
    expect(screen.getByRole('button', { name: /View Iron Sword/ })).toHaveAccessibleName(/locked/i);
    expect(screen.getByRole('button', { name: 'Unlock' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Destroy One' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(screen.getByRole('button', { name: 'Destroy One' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Destroy One' }));
    const confirmation = screen.getByRole('dialog', { name: 'Destroy one item?' });
    expect(confirmation).toBeInTheDocument();
    await user.click(within(confirmation).getByRole('button', { name: 'Destroy One' }));
    expect(useGameStore.getState().game?.inventory).toContainEqual({
      itemId: 'iron-sword',
      quantity: 1,
      locked: false,
    });
    expect(screen.getByRole('heading', { name: 'Iron Sword' })).toBeInTheDocument();
  });

  it('moves selection after quantity-one destruction and equips through the existing system', async () => {
    const user = userEvent.setup();
    seedInventory([
      { itemId: 'bronze-sword', quantity: 1 },
      { itemId: 'copper-ore', quantity: 1 },
    ]);
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Inventory/ })[0]);
    await user.click(screen.getByRole('button', { name: /View Bronze Sword/ }));
    await user.click(screen.getByRole('button', { name: 'Equip' }));
    expect(useGameStore.getState().game?.equipment.weapon).toBe('bronze-sword');
    expect(screen.queryByRole('button', { name: /View Bronze Sword/ })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Copper Ore' })).toBeInTheDocument();
  });

  it('shows contextual details actions and preserves safe unknown-item behavior', async () => {
    const user = userEvent.setup();
    seedInventory([
      { itemId: 'iron-sword', quantity: 2 },
      { itemId: 'rat-tail', quantity: 4 },
      { itemId: 'unknown-item', quantity: 3 },
    ]);
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Inventory/ })[0]);

    await user.click(screen.getByRole('button', { name: /View Iron Sword/ }));
    const details = () =>
      within(document.querySelector('.inventory-details-region') as HTMLElement);
    expect(screen.getByRole('heading', { name: 'Iron Sword' })).toBeInTheDocument();
    expect(details().getByText('Equipment')).toBeInTheDocument();
    expect(details().getByText('Sundering Strike')).toBeInTheDocument();
    expect(details().getByText(/Training Grounds|Smithing/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Equip' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Equipment' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lock' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Destroy One' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /View Rat Tail/ }));
    expect(screen.getByRole('heading', { name: 'Rat Tail' })).toBeInTheDocument();
    expect(details().getByText('Drops')).toBeInTheDocument();
    expect(details().getByText(/Training Grounds/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Equip' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View Equipment' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lock' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Destroy One' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /View Unknown item/ }));
    expect(screen.getByRole('heading', { name: 'Unknown item' })).toBeInTheDocument();
    expect(screen.getByText(/No actions are available/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Equip' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View Equipment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lock' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Destroy One' })).not.toBeInTheDocument();
    expect(details().getByText('3')).toBeInTheDocument();
  });

  it('uses Off-hand and keeps Mining tool stats separate from Inventory bonuses', async () => {
    const user = userEvent.setup();
    seedInventory([
      { itemId: 'iron-shield', quantity: 1 },
      { itemId: 'iron-sword', quantity: 1 },
      { itemId: 'iron-pickaxe', quantity: 1 },
    ]);
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Inventory/ })[0]);

    await user.click(screen.getByRole('button', { name: /View Iron Bulwark/ }));
    expect(screen.getByText('Off-hand')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /View Iron Sword/ }));
    expect(screen.getByText('Attack speed')).toBeInTheDocument();
    expect(screen.queryByText('Mining speed')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /View Iron Pick/ }));
    expect(screen.queryByText('Mining speed')).not.toBeInTheDocument();
    expect(screen.queryByText('Attack speed')).not.toBeInTheDocument();
  });

  it('opens compact item details as an accessible drawer and closes with Escape', async () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({
        matches: query === '(max-width: 900px)',
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
    try {
      const user = userEvent.setup();
      seedInventory([{ itemId: 'iron-sword', quantity: 1 }]);
      render(<App />);
      await user.click(screen.getAllByRole('button', { name: /Inventory/ })[0]);
      await user.selectOptions(screen.getByRole('combobox', { name: 'Sort inventory' }), 'manual');
      const card = screen.getByRole('button', { name: /View Iron Sword/ });
      expect(screen.queryByText('Drag to reorder')).not.toBeInTheDocument();
      expect(card).not.toHaveAttribute('draggable');
      expect(card).not.toHaveClass('is-drop-before');
      expect(card).not.toHaveClass('is-drop-after');
      await user.click(card);
      const drawer = screen.getByRole('dialog', { name: 'Iron Sword' });
      expect(drawer).toHaveAttribute('aria-modal', 'true');
      expect(within(drawer).getByRole('button', { name: 'Equip' })).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog', { name: 'Iron Sword' })).not.toBeInTheDocument();
      expect(card).toHaveAttribute('aria-pressed', 'true');
    } finally {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: originalMatchMedia,
      });
    }
  });

  it('shows navigation actions for a truly empty inventory and a full capacity state', async () => {
    const user = userEvent.setup();
    seedInventory([]);
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Inventory/ })[0]);
    expect(screen.getByRole('heading', { name: 'Your inventory is empty' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to Mining' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to Combat' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Select an item' })).not.toBeInTheDocument();

    const fullInventory = Array.from({ length: GAME_CONFIG.inventorySlots }, (_, index) => ({
      itemId: `unknown-${index}`,
      quantity: 1,
    }));
    act(() => seedInventory(fullInventory));
    await user.click(screen.getAllByRole('button', { name: /Inventory/ })[0]);
    expect(screen.getByRole('progressbar', { name: 'Inventory capacity' })).toHaveAttribute(
      'aria-valuenow',
      String(GAME_CONFIG.inventorySlots),
    );
    expect(
      screen.getAllByText(`${GAME_CONFIG.inventorySlots} / ${GAME_CONFIG.inventorySlots} slots`)[0],
    ).toBeInTheDocument();
  });

  it('opens and closes the local visual UI editor', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Edit game UI' }));
    expect(screen.getByRole('dialog', { name: 'Edit game UI' })).toBeInTheDocument();
    expect(screen.getByText('Sidebar width')).toBeInTheDocument();
    expect(screen.getByText('Home panels')).toBeInTheDocument();
    expect(screen.getByText('No editable panels are registered for Home yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close UI editor' }));
    expect(screen.queryByRole('dialog', { name: 'Edit game UI' })).not.toBeInTheDocument();
  });

  it('exposes individual combat panels to the visual UI editor', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Combat/ })[0]);
    await user.click(screen.getByRole('button', { name: 'Edit game UI' }));

    const editor = screen.getByRole('dialog', { name: 'Edit game UI' });
    await user.click(within(editor).getByRole('button', { name: /Combat locations/ }));
    expect(screen.getByText('Combat panels')).toBeInTheDocument();
    expect(screen.getByText('Grid column')).toBeInTheDocument();
    expect(screen.getByText('Panel width')).toBeInTheDocument();
    expect(screen.getByText('Minimum panel height')).toBeInTheDocument();
    expect(document.querySelector('[data-ui-panel="combatLocations"]')).not.toBeNull();
    expect(document.querySelector('[data-ui-panel="liveCombat"]')).not.toBeNull();

    await user.click(within(editor).getByRole('button', { name: /^Player/ }));
    expect(within(editor).getByText('Panel scale')).toBeInTheDocument();
    fireEvent.change(within(editor).getByRole('slider', { name: 'Panel scale' }), {
      target: { value: '1.5' },
    });
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('ironbound-idle-ui-layout') ?? '{}');
      expect(stored.screenPanels.combat.player.scale).toBe(1.5);
    });
    fireEvent.change(within(editor).getByRole('slider', { name: 'Minimum panel height' }), {
      target: { value: '200' },
    });
    await waitFor(() => {
      const playerSlot = document.querySelector<HTMLElement>('[data-ui-panel="player"]');
      const scaledContent = playerSlot?.querySelector<HTMLElement>('.ui-panel-scale-content');
      expect(['0', '0px']).toContain(playerSlot?.style.minWidth);
      expect(playerSlot?.style.minHeight).toBe('300px');
      expect(scaledContent?.style.width).toBe(`${100 / 1.5}%`);
      expect(scaledContent?.style.transform).toBe('scale(1.5)');
    });
    await user.click(within(editor).getByRole('button', { name: 'Center Player' }));
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('ironbound-idle-ui-layout') ?? '{}');
      expect(stored.screenPanels.combat.player.column).toBe(5);
    });

    await user.click(within(editor).getByRole('button', { name: 'Reset Player' }));
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('ironbound-idle-ui-layout') ?? '{}');
      expect(stored.screenPanels.combat.player).toEqual({
        column: 1,
        row: 3,
        columnSpan: 3,
        height: 0,
        scale: 1,
      });
    });
  });

  it('moves a combat panel with a real pointer drag and resolves row collisions', async () => {
    window.localStorage.removeItem(UI_LAYOUT_STORAGE_KEY);
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Combat/ })[0]);
    mockCombatGeometry();
    await user.click(screen.getByRole('button', { name: 'Edit game UI' }));

    const playerHandle = document.querySelector<HTMLButtonElement>('[title="Drag to move Player"]');
    expect(playerHandle).not.toBeNull();
    dispatchPointer(playerHandle as HTMLButtonElement, 'pointerdown', {
      pointerId: 7,
      clientX: 24,
      clientY: 420,
      buttons: 1,
    });
    dispatchPointer(window, 'pointermove', {
      pointerId: 99,
      clientX: 424,
      clientY: 700,
      buttons: 1,
    });
    dispatchPointer(window, 'pointerup', { pointerId: 99, clientX: 424, clientY: 700 });
    expect(JSON.parse(window.localStorage.getItem(UI_LAYOUT_STORAGE_KEY) ?? 'null')).toBeNull();

    dispatchPointer(window, 'pointermove', {
      pointerId: 7,
      clientX: 424,
      clientY: 700,
      buttons: 1,
    });
    dispatchPointer(window, 'pointerup', { pointerId: 7, clientX: 424, clientY: 700 });
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(UI_LAYOUT_STORAGE_KEY) ?? '{}');
      expect(stored.screenPanels.combat.player.row).toBe(5);
      expect(stored.screenPanels.combat.player.column).toBe(5);
    });
  });

  it('disables panel dragging in compact viewports while keeping controls available', async () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({
        matches: query === '(max-width: 900px)',
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
    try {
      window.localStorage.removeItem(UI_LAYOUT_STORAGE_KEY);
      const user = userEvent.setup();
      render(<App />);
      await user.click(screen.getAllByRole('button', { name: /Combat/ })[0]);
      mockCombatGeometry();
      await user.click(screen.getByRole('button', { name: 'Edit game UI' }));

      expect(
        screen.getByText(/Panel drag placement requires a viewport wider than 900px/),
      ).toBeInTheDocument();
      const editor = screen.getByRole('dialog', { name: 'Edit game UI' });
      await user.click(within(editor).getByRole('button', { name: /^Player/ }));
      const playerHandle = document.querySelector<HTMLButtonElement>(
        '[title="Panel dragging is available above 900px viewport width"]',
      );
      expect(playerHandle).toHaveAttribute('aria-disabled', 'true');
      expect(within(editor).getByRole('slider', { name: 'Grid row' })).toBeInTheDocument();
      dispatchPointer(playerHandle as HTMLButtonElement, 'pointerdown', {
        pointerId: 1,
        clientX: 24,
        clientY: 420,
        buttons: 1,
      });
      dispatchPointer(window, 'pointermove', {
        pointerId: 1,
        clientX: 24,
        clientY: 700,
        buttons: 1,
      });
      dispatchPointer(window, 'pointerup', { pointerId: 1, clientX: 24, clientY: 700 });
      expect(window.localStorage.getItem(UI_LAYOUT_STORAGE_KEY)).toBeNull();
    } finally {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: originalMatchMedia,
      });
    }
  });

  it('stops combat and shows the death report with recent actions', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Combat/ })[0]);
    await user.click(screen.getByRole('button', { name: 'Fight' }));
    await user.click(screen.getByRole('button', { name: 'Open debug menu' }));
    await user.click(screen.getByRole('button', { name: 'Kill Player' }));

    await waitFor(
      () => expect(screen.getByRole('dialog', { name: 'You died' })).toBeInTheDocument(),
      { timeout: 3000 },
    );
    const deathDialog = screen.getByRole('dialog', { name: 'You died' });
    expect(useGameStore.getState().game?.activeAction.type).toBe('none');
    expect(
      within(deathDialog).getAllByText(/You were killed by Forest Rat/).length,
    ).toBeGreaterThan(0);
    expect(
      within(deathDialog).getByRole('heading', { name: 'Recent actions' }),
    ).toBeInTheDocument();
    await user.click(within(deathDialog).getByRole('button', { name: 'Continue' }));
    expect(screen.queryByRole('dialog', { name: 'You died' })).not.toBeInTheDocument();
  });

  it('drives the real-time combat controls from the selected roster target', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Combat/ })[0]);
    expect(screen.getByRole('heading', { name: 'Combat' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Combat locations' })).toBeInTheDocument();
    const livePanel = screen.getByRole('region', { name: 'Live combat resolution' });
    await user.click(within(livePanel).getByRole('button', { name: 'Combat settings' }));
    expect(within(livePanel).getByRole('checkbox', { name: 'Auto Repeat' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Goblin Scavenger/ }));
    expect(screen.getAllByRole('heading', { name: 'Goblin Scavenger' })).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: /Aggressive/ }));
    await user.click(screen.getByRole('button', { name: 'Fight' }));
    const activeCombat = useGameStore.getState().game?.activeAction;
    expect(activeCombat?.type).toBe('combat');
    expect(activeCombat?.type === 'combat' ? activeCombat.enemyId : null).toBe('goblin-scavenger');
    expect(screen.getAllByRole('progressbar', { name: 'YOU health' })).toHaveLength(1);
    const activityStats = screen.getByLabelText('Combat activity summary');
    expect(within(activityStats).getByText('Combat level')).toBeInTheDocument();
    expect(within(activityStats).queryByText('Gold')).not.toBeInTheDocument();
    expect(within(activityStats).getByText('HP')).toBeInTheDocument();
    const activityStrip = activityStats.closest('[data-ui-region="actionStrip"]');
    expect(activityStrip).not.toBeNull();
    await waitFor(
      () => expect(within(activityStrip as HTMLElement).getByText(/0:0[1-9]/)).toBeInTheDocument(),
      { timeout: 2500 },
    );
    expect(screen.getByRole('tab', { name: 'Session summary' })).toBeInTheDocument();
    const sessionSummaryPanel = screen
      .getByRole('heading', { name: 'Session summary' })
      .closest('section');
    expect(sessionSummaryPanel).not.toBeNull();
    await waitFor(
      () =>
        expect(
          within(sessionSummaryPanel as HTMLElement).getByText(/0:0[1-9]/),
        ).toBeInTheDocument(),
      { timeout: 2500 },
    );
    expect(within(livePanel).getByRole('button', { name: 'Stop combat' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stop Combat' })).not.toBeInTheDocument();
    await user.click(within(livePanel).getByRole('button', { name: 'Stop combat' }));
    expect(useGameStore.getState().game?.activeAction.type).toBe('none');
  });

  it('opens combat settings and toggles elite hunting', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Combat/ })[0]);
    const livePanel = screen.getByRole('region', { name: 'Live combat resolution' });
    await user.click(within(livePanel).getByRole('button', { name: 'Combat settings' }));
    const settings = within(livePanel).getByRole('dialog', { name: 'Combat settings' });
    const huntElites = within(settings).getByRole('checkbox', { name: 'Hunt elites' });
    expect(huntElites).toBeChecked();
    await user.click(huntElites);
    expect(useGameStore.getState().game?.settings.huntElites).toBe(false);
    await user.click(huntElites);
    expect(useGameStore.getState().game?.settings.huntElites).toBe(true);
  });

  it('lets target selection browse freely and starts the selected target explicitly', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Combat/ })[0]);
    await user.click(screen.getByRole('button', { name: 'Fight' }));
    expect(useGameStore.getState().game?.activeAction.type).toBe('combat');
    expect(screen.getByRole('img', { name: 'Forest Rat portrait' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Switch target Goblin Scavenger/ }));
    expect(screen.queryByRole('heading', { name: 'Switch target?' })).not.toBeInTheDocument();
    const activeAfterBrowse = useGameStore.getState().game?.activeAction;
    expect(activeAfterBrowse?.type).toBe('combat');
    expect(activeAfterBrowse?.type === 'combat' ? activeAfterBrowse.enemyId : null).toBe(
      'forest-rat',
    );
    expect(
      screen.getByRole('group', { name: 'Selected target: Goblin Scavenger, level 4' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Important enemy trait: Desperate Swing/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New target' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New target' }));
    const activeCombat = useGameStore.getState().game?.activeAction;
    expect(activeCombat?.type).toBe('combat');
    expect(activeCombat?.type === 'combat' ? activeCombat.enemyId : null).toBe('goblin-scavenger');
  });

  it('browses another area without changing the active combat target', async () => {
    const user = userEvent.setup();
    const game = createNewGame(0, 'Navigator');
    game.settings.threeQuality = 'off';
    game.unlockedAreas.push('copper-hills');
    useGameStore.getState().setGame(game);
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Combat/ })[0]);
    await user.click(screen.getByRole('button', { name: 'Fight' }));
    const before = useGameStore.getState().game?.activeAction;
    expect(before?.type).toBe('combat');
    expect(before?.type === 'combat' ? before.enemyId : null).toBe('forest-rat');

    await user.click(screen.getByRole('button', { name: /Copper Hills/ }));

    const after = useGameStore.getState().game?.activeAction;
    expect(after?.type).toBe('combat');
    expect(after?.type === 'combat' ? after.areaId : null).toBe('training-grounds');
    expect(after?.type === 'combat' ? after.enemyId : null).toBe('forest-rat');
    expect(screen.getByRole('button', { name: /Switch target Cave Bat/ })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Forest Rat' })).toHaveLength(2);
  });

  it('uses accordion locations and exposes future combat tabs without fake content', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Combat/ })[0]);
    const locationsToggle = screen.getByRole('button', { name: 'Collapse locations' });
    expect(locationsToggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(locationsToggle);
    expect(screen.getByRole('button', { name: 'Expand locations' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('button', { name: /Training Grounds/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Expand locations' }));
    const trainingRow = screen.getByRole('button', { name: /Training Grounds/ });
    expect(trainingRow).toHaveAttribute('aria-expanded', 'true');
    await user.click(trainingRow);
    expect(trainingRow).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('button', { name: /Select target Forest Rat/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /Dungeons/ }));
    expect(screen.getByText('Dungeons are not available yet')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /Slayer Areas/ }));
    expect(screen.getByText('Slayer Areas are not available yet')).toBeInTheDocument();
  });

  it('keeps HP, attack timing, and the live log only in the center panel', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Combat/ })[0]);
    expect(screen.getAllByRole('progressbar', { name: 'YOU health' })).toHaveLength(1);
    expect(screen.getAllByRole('progressbar', { name: 'Forest Rat health' })).toHaveLength(1);
    expect(screen.getAllByRole('progressbar', { name: 'Next attack' })).toHaveLength(2);
    expect(screen.getByText('Live combat log')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Combat log' })).not.toBeInTheDocument();
    expect(screen.queryByText('Changes apply immediately')).not.toBeInTheDocument();
    expect(screen.queryByText('Hit chance')).not.toBeInTheDocument();
    expect(screen.queryByText('Threat')).not.toBeInTheDocument();
    expect(
      screen.queryByText('HP and attack timing are shown in Live Combat Resolution.'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Timers and combat results come from the simulation engine/),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Full drop table' }));
    expect(screen.getByRole('heading', { name: 'Loot table' })).toBeInTheDocument();
  });

  it('collapses and expands Target Analysis like the combat locations panel', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Combat/ })[0]);
    const collapse = screen.getByRole('button', { name: 'Collapse analysis' });
    expect(collapse).toHaveAttribute('aria-expanded', 'true');
    await user.click(collapse);
    expect(screen.getByRole('button', { name: 'Expand analysis' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByText('Your chance to hit')).not.toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Expand analysis' }));
    expect(screen.getByText('Your chance to hit')).toBeVisible();
  });

  it('opens the development debug menu beside the UI editor', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Open debug menu' }));
    expect(screen.getByRole('dialog', { name: 'Debug menu' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Skill target' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kill current monster' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Give gold' }));
    expect(useGameStore.getState().game?.gold).toBe(1000);
  });
});
