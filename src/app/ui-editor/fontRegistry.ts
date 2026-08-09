export const UI_FONT_ROLE_IDS = ['heading', 'body', 'stat'] as const;

export type UiFontRoleId = (typeof UI_FONT_ROLE_IDS)[number];

export const UI_FONT_IDS = ['inter', 'interDisplay'] as const;

export type UiFontId = (typeof UI_FONT_IDS)[number];

export type UiFontWeightMode = 'variable' | 'static';

export interface UiFontDefinition {
  id: UiFontId;
  label: string;
  cssFamily: string;
  weightMode: UiFontWeightMode;
  minWeight: number;
  maxWeight: number;
  weightStep: number;
  supportedWeights?: number[];
}

export interface UiFontFamilies {
  heading: UiFontId;
  body: UiFontId;
  stat: UiFontId;
}

export const UI_FONT_REGISTRY: Record<UiFontId, UiFontDefinition> = {
  inter: {
    id: 'inter',
    label: 'Inter',
    cssFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
    weightMode: 'variable',
    minWeight: 100,
    maxWeight: 900,
    weightStep: 1,
  },
  interDisplay: {
    id: 'interDisplay',
    label: 'Inter Display',
    cssFamily: "'Inter Display', 'Inter', ui-sans-serif, system-ui, sans-serif",
    weightMode: 'static',
    minWeight: 100,
    maxWeight: 900,
    weightStep: 100,
    supportedWeights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
  },
};

export const UI_FONT_REGISTRY_ENTRIES = UI_FONT_IDS.map((id) => UI_FONT_REGISTRY[id]);

export const UI_FONT_ROLE_DEFINITIONS: Array<{
  id: UiFontRoleId;
  label: string;
  description: string;
}> = [
  {
    id: 'heading',
    label: 'Heading Font',
    description: 'Page titles, panel titles, and subheadings.',
  },
  {
    id: 'body',
    label: 'Body / UI Font',
    description: 'General text, descriptions, buttons, and navigation.',
  },
  {
    id: 'stat',
    label: 'Stat / Numeric Font',
    description: 'Prominent statistics and numeric utility text.',
  },
];

export const DEFAULT_UI_FONT_FAMILIES: UiFontFamilies = {
  heading: 'inter',
  body: 'inter',
  stat: 'inter',
};

export const getUiFontDefinition = (fontId: UiFontId): UiFontDefinition => UI_FONT_REGISTRY[fontId];

export const sanitizeUiFontId = (value: unknown): UiFontId =>
  typeof value === 'string' && UI_FONT_IDS.includes(value as UiFontId) ? value as UiFontId : 'inter';

export const sanitizeUiFontFamilies = (value: unknown): UiFontFamilies => {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    heading: sanitizeUiFontId(source.heading),
    body: sanitizeUiFontId(source.body),
    stat: sanitizeUiFontId(source.stat),
  };
};

export const cloneUiFontFamilies = (families: UiFontFamilies): UiFontFamilies => ({ ...families });

export const resolveFontWeight = (fontId: UiFontId, requestedWeight: number): number => {
  const definition = getUiFontDefinition(fontId);
  const safeWeight = Number.isFinite(requestedWeight)
    ? Math.min(definition.maxWeight, Math.max(definition.minWeight, requestedWeight))
    : 400;
  if (definition.weightMode === 'variable' || !definition.supportedWeights?.length) {
    return safeWeight;
  }
  return definition.supportedWeights.reduce((nearest, supportedWeight) => {
    const nearestDistance = Math.abs(nearest - safeWeight);
    const supportedDistance = Math.abs(supportedWeight - safeWeight);
    return supportedDistance < nearestDistance ? supportedWeight : nearest;
  }, definition.supportedWeights[0]);
};
