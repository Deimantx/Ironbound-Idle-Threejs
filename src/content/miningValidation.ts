import { itemById, ITEMS } from './items';
import { MINING_NODES } from './miningNodes';
import { MINING_TOOLS, miningToolByItemId } from './miningTools';
import { smithingToolByItemId } from './smithingTools';

const ACTIVE_MINING_NODE_IDS = ['stone-outcrop', 'iron-vein', 'coal-seam'] as const;

export const validateMiningContent = (): string[] => {
  const errors: string[] = [];
  const nodeIds = new Set<string>();
  if (MINING_NODES.length !== ACTIVE_MINING_NODE_IDS.length)
    errors.push('Mining must have exactly three active Phase One nodes.');
  for (const node of MINING_NODES) {
    if (nodeIds.has(node.id)) errors.push(`Duplicate Mining node ID: ${node.id}`);
    nodeIds.add(node.id);
    if (!itemById[node.primaryRewardItemId])
      errors.push(`${node.id} references missing primary item.`);
    if (node.level < 1 || node.requiredPenetration < 0)
      errors.push(`${node.id} has invalid requirements.`);
    if (node.damagePerPrimaryReward <= 0 || node.respawnMs <= 0)
      errors.push(`${node.id} has invalid reward or respawn tuning.`);
    if (node.stages.length !== 5) errors.push(`${node.id} must have exactly five stages.`);
    const stageIds = new Set<string>();
    for (const [index, stage] of node.stages.entries()) {
      if (stageIds.has(stage.id)) errors.push(`Duplicate Mining stage ID: ${stage.id}`);
      stageIds.add(stage.id);
      if (stage.durability <= 0 || stage.bonusChanceMultiplier < 0)
        errors.push(`${stage.id} has invalid durability or bonus multiplier.`);
      const previous = node.stages[index - 1];
      if (previous && stage.durability <= previous.durability)
        errors.push(`${node.id} stage durability must increase toward the center.`);
      if (previous && stage.bonusChanceMultiplier <= previous.bonusChanceMultiplier)
        errors.push(`${node.id} stage bonus multiplier must increase toward the center.`);
    }
    for (const drop of node.bonusDrops) {
      if (!itemById[drop.itemId])
        errors.push(`${node.id} references missing bonus item ${drop.itemId}.`);
      if (drop.chance < 0 || drop.chance > 1)
        errors.push(`${node.id} has an invalid bonus chance.`);
      if (drop.minQuantity <= 0 || drop.maxQuantity < drop.minQuantity)
        errors.push(`${node.id} has an invalid bonus quantity range.`);
    }
  }
  for (const nodeId of ACTIVE_MINING_NODE_IDS)
    if (!nodeIds.has(nodeId)) errors.push(`Missing active Mining node: ${nodeId}.`);
  const toolIds = new Set<string>();
  for (const tool of MINING_TOOLS) {
    if (toolIds.has(tool.itemId)) errors.push(`Duplicate Mining tool ID: ${tool.itemId}`);
    toolIds.add(tool.itemId);
    if (!itemById[tool.itemId]) errors.push(`Mining tool references missing item ${tool.itemId}.`);
    if (tool.requiredMiningLevel < 1 || tool.rockDamage <= 0 || tool.penetration < 0)
      errors.push(`${tool.itemId} has invalid Mining requirements.`);
    if (tool.swingIntervalMs <= 0 || tool.staminaCost <= 0)
      errors.push(`${tool.itemId} has invalid swing or stamina tuning.`);
  }
  for (const item of ITEMS)
    if (
      item.category === 'tool' &&
      item.slot === 'tool' &&
      !miningToolByItemId[item.id] &&
      !smithingToolByItemId[item.id]
    )
      errors.push(`Pickaxe item ${item.id} is missing a Mining tool definition.`);
  return errors;
};

export const assertValidMiningContent = (): void => {
  const errors = validateMiningContent();
  if (errors.length > 0) throw new Error(errors.join('\n'));
};
