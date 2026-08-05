import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../app/App';
import { GAME_CONFIG } from '../config/gameConfig';
import { createNewGame } from '../game/state/initialState';
import { useGameStore } from '../game/state/gameStore';
import { UI_LAYOUT_STORAGE_KEY } from '../app/uiLayout';

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
    await user.click(screen.getAllByRole('button', { name: 'Mine' })[0]);
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
        panels: ['smithingControls', 'smithingRecipes'],
        labels: ['Smithing controls', 'Smithing recipes'],
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
    await user.click(screen.getAllByRole('button', { name: 'Mine' })[0]);
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

  it('keeps extracted Inventory, Equipment, and Smithing interactions working', async () => {
    const user = userEvent.setup();
    const game = createNewGame(0, 'Crafter');
    game.settings.threeQuality = 'off';
    game.inventory = [
      { itemId: 'copper-ore', quantity: 1, locked: false },
      { itemId: 'tin-ore', quantity: 1, locked: false },
      { itemId: 'bronze-sword', quantity: 1, locked: false },
    ];
    game.discoveredItems = ['copper-ore', 'tin-ore', 'bronze-sword'];
    useGameStore.getState().setGame(game);
    render(<App />);

    await user.click(screen.getAllByRole('button', { name: /Inventory/ })[0]);
    await user.click(screen.getByRole('button', { name: /View Bronze Sword/ }));
    expect(screen.getByRole('heading', { name: 'Bronze Sword' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Equip' }));
    expect(useGameStore.getState().game?.equipment.weapon).toBe('bronze-sword');

    await user.click(screen.getAllByRole('button', { name: /Equipment/ })[0]);
    await user.click(screen.getByRole('button', { name: 'Unequip Bronze Sword' }));
    expect(useGameStore.getState().game?.equipment.weapon).toBeUndefined();

    await user.click(screen.getAllByRole('button', { name: /Smithing/ })[0]);
    await user.click(screen.getByRole('button', { name: 'Forging' }));
    await user.click(screen.getByRole('button', { name: 'Continuous' }));
    await user.click(screen.getByRole('button', { name: 'Smelting' }));
    await user.click(screen.getAllByRole('button', { name: 'Start forging' })[0]);
    const action = useGameStore.getState().game?.activeAction;
    expect(action?.type).toBe('smithing');
    expect(action?.type === 'smithing' ? action.quantityMode : null).toBe('continuous');
  });

  it('renders the Inventory 2.0 bank structure and capacity semantics', async () => {
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
    expect(screen.getByRole('progressbar', { name: 'Inventory capacity' })).toHaveAttribute(
      'aria-valuenow',
      '3',
    );
    expect(document.querySelector('[data-ui-panel="inventoryToolbar"]')).not.toBeNull();
    expect(document.querySelector('[data-ui-panel="inventoryBank"]')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Item Bank' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Select an item' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /View Iron Sword/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: /View Rat Tail/ })).toHaveAccessibleName(/locked/i);
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
      const card = screen.getByRole('button', { name: /View Iron Sword/ });
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
    await user.click(screen.getByRole('button', { name: 'Suicide player' }));

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
