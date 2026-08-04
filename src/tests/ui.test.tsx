import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach } from 'vitest';
import { App } from '../app/App';
import { createNewGame } from '../game/state/initialState';
import { useGameStore } from '../game/state/gameStore';

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

  it('opens and closes the local visual UI editor', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Edit game UI' }));
    expect(screen.getByRole('dialog', { name: 'Edit game UI' })).toBeInTheDocument();
    expect(screen.getByText('Sidebar width')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close UI editor' }));
    expect(screen.queryByRole('dialog', { name: 'Edit game UI' })).not.toBeInTheDocument();
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
    expect(within(deathDialog).getAllByText(/You were killed by Forest Rat/).length).toBeGreaterThan(0);
    expect(within(deathDialog).getByRole('heading', { name: 'Recent actions' })).toBeInTheDocument();
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
    expect(
      activeAfterBrowse?.type === 'combat'
        ? activeAfterBrowse.enemyId
        : null,
    ).toBe('forest-rat');
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
