/**
 * Migration-only IDs for content that no longer has runtime definitions.
 * Keep this list literal so retired content cannot leak back into selectors or UI.
 */
export const RETIRED_ITEM_IDS = new Set([
  'stone-fragment',
  'sharpening-grit',
  'copper-ore',
  'tin-ore',
  'mithril-ore',
  'bronze-bar',
  'bronze-sword',
  'bronze-helmet',
  'bronze-armor',
  'bronze-shield',
  'bronze-pickaxe',
  'bronze-platebody',
  'bronze-platelegs',
]);

export const RETIRED_RECIPE_IDS = new Set([
  'bronze-bar',
  'bronze-sword',
  'bronze-helmet',
  'bronze-armor',
  'bronze-shield',
  'bronze-pickaxe',
]);
