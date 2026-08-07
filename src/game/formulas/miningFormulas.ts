import { MINING_TUNING } from '../../config/miningTuning';
import { miningNodeById } from '../../content/miningNodes';
import { getMiningToolDefinition } from '../../content/miningTools';
import type {
  GameState,
  MiningBonusDrop,
  MiningNodeDefinition,
  MiningNodeId,
  MiningNodeRuntimeState,
  MiningStageDefinition,
  MiningState,
  MiningToolDefinition,
} from '../types';

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const getMiningTool = (state: GameState): MiningToolDefinition => {
  const equipped = getMiningToolDefinition(state.equipment.tool);
  if (equipped && state.skills.mining.level >= equipped.requiredMiningLevel) return equipped;
  return MINING_TUNING.noTool;
};

export const getMiningEffectiveness = (
  tool: MiningToolDefinition,
  node: MiningNodeDefinition,
): number => {
  const raw = node.requiredPenetration <= 0 ? 1 : tool.penetration / node.requiredPenetration;
  return clamp(raw, MINING_TUNING.minimumEffectiveness, 1);
};

export const getMiningSwingDamage = (
  tool: MiningToolDefinition,
  node: MiningNodeDefinition,
): number => Math.max(1, Math.floor(tool.rockDamage * getMiningEffectiveness(tool, node)));

export const getMiningSwingXp = (node: MiningNodeDefinition, effectiveness: number): number =>
  Math.max(1, Math.floor(node.xpPerSwing * clamp(effectiveness, 0, 1)));

export const getMiningPrimaryYield = (
  damage: number,
  node: MiningNodeDefinition,
  previousProgress: number,
): { quantity: number; remainingProgress: number } => {
  const safePrevious = Number.isFinite(previousProgress) ? Math.max(0, previousProgress) : 0;
  const total = safePrevious + Math.max(0, damage) / Math.max(1, node.damagePerPrimaryReward);
  const quantity = Math.floor(total);
  return { quantity, remainingProgress: total - quantity };
};

export const getMiningStageBonusChance = (
  drop: MiningBonusDrop,
  stage: MiningStageDefinition,
): number => clamp(drop.chance * stage.bonusChanceMultiplier, 0, 1);

export const hashMiningInput = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
};

export const nextMiningRandom = (
  runtime: Pick<MiningNodeRuntimeState, 'rngSeed' | 'rngCursor'>,
): number => {
  const seed = runtime.rngSeed >>> 0 || 1;
  const value = (Math.imul(seed ^ (runtime.rngCursor + 1), 1_664_525) + 1_013_904_223) >>> 0;
  runtime.rngCursor += 1;
  return value / 4_294_967_296;
};

export const createMiningRuntimeState = (nodeId: MiningNodeId): MiningNodeRuntimeState => {
  const node = miningNodeById[nodeId];
  const firstStage = node?.stages[0];
  return {
    stageIndex: 0,
    stageDurability: firstStage?.durability ?? 1,
    primaryYieldProgress: 0,
    respawnRemainingMs: 0,
    rngSeed: hashMiningInput(`mining:${nodeId}`),
    rngCursor: 0,
  };
};

export const normalizeMiningNodeState = (
  nodeId: MiningNodeId,
  input: unknown,
): MiningNodeRuntimeState => {
  const node = miningNodeById[nodeId];
  const fallback = createMiningRuntimeState(nodeId);
  if (!node || !input || typeof input !== 'object') return fallback;
  const value = input as Partial<MiningNodeRuntimeState>;
  const stageIndex = Math.floor(Number(value.stageIndex));
  const safeStageIndex = Number.isFinite(stageIndex)
    ? clamp(stageIndex, 0, Math.max(0, node.stages.length - 1))
    : fallback.stageIndex;
  const stage = node.stages[safeStageIndex] ?? node.stages[0];
  const respawnRemainingMs = Number(value.respawnRemainingMs);
  const primaryYieldProgress = Number(value.primaryYieldProgress);
  return {
    stageIndex: safeStageIndex,
    stageDurability: Number.isFinite(Number(value.stageDurability))
      ? clamp(Number(value.stageDurability), 0, stage.durability)
      : stage.durability,
    primaryYieldProgress: Number.isFinite(primaryYieldProgress)
      ? clamp(primaryYieldProgress, 0, 0.999999999)
      : 0,
    respawnRemainingMs: Number.isFinite(respawnRemainingMs)
      ? clamp(respawnRemainingMs, 0, node.respawnMs)
      : 0,
    rngSeed: Number.isFinite(Number(value.rngSeed))
      ? Number(value.rngSeed) >>> 0 || 1
      : fallback.rngSeed,
    rngCursor: Number.isFinite(Number(value.rngCursor))
      ? Math.max(0, Math.floor(Number(value.rngCursor)))
      : 0,
  };
};

export const normalizeMiningState = (input: unknown): MiningState => {
  const value = input && typeof input === 'object' ? (input as Partial<MiningState>) : {};
  const source = value.nodeStates && typeof value.nodeStates === 'object' ? value.nodeStates : {};
  const nodeStates: MiningState['nodeStates'] = {};
  for (const node of Object.values(miningNodeById)) {
    const raw = (source as Record<string, unknown>)[node.id];
    if (raw !== undefined) nodeStates[node.id] = normalizeMiningNodeState(node.id, raw);
  }
  const stamina = Number(value.stamina);
  return {
    stamina: Number.isFinite(stamina)
      ? clamp(stamina, 0, MINING_TUNING.maxStamina)
      : MINING_TUNING.maxStamina,
    nodeStates,
  };
};

export const getMiningRuntimeState = (
  mining: MiningState,
  nodeId: MiningNodeId,
): MiningNodeRuntimeState => mining.nodeStates[nodeId] ?? createMiningRuntimeState(nodeId);

export interface MiningRateEstimate {
  effectiveness: number;
  damage: number;
  swingIntervalMs: number;
  staminaCost: number;
  swingsPerRock: number;
  cycleMs: number;
  primaryPerHour: number;
  primaryOrePerHour: number;
  xpPerHour: number;
}

export const getMiningEstimatedRates = (
  state: GameState,
  node: MiningNodeDefinition,
): MiningRateEstimate => {
  const tool = getMiningTool(state);
  const effectiveness = getMiningEffectiveness(tool, node);
  const damage = getMiningSwingDamage(tool, node);
  const totalDurability = node.stages.reduce((total, stage) => total + stage.durability, 0);
  const swingsPerRock = Math.max(1, Math.ceil(totalDurability / damage));
  const swingsPerStamina = Math.max(1, Math.floor(MINING_TUNING.maxStamina / tool.staminaCost));
  const restsPerRock = Math.floor(swingsPerRock / swingsPerStamina);
  const cycleMs =
    swingsPerRock * tool.swingIntervalMs +
    restsPerRock * MINING_TUNING.restDurationMs +
    node.respawnMs;
  const primaryPerRock = getMiningPrimaryYield(swingsPerRock * damage, node, 0).quantity;
  const primaryPerHour = (primaryPerRock * 3_600_000) / Math.max(1, cycleMs);
  return {
    effectiveness,
    damage,
    swingIntervalMs: tool.swingIntervalMs,
    staminaCost: tool.staminaCost,
    swingsPerRock,
    cycleMs,
    primaryPerHour,
    primaryOrePerHour: primaryPerHour,
    xpPerHour:
      (swingsPerRock * getMiningSwingXp(node, effectiveness) * 3_600_000) / Math.max(1, cycleMs),
  };
};
