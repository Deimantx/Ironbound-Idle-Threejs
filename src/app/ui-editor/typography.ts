import {
  cloneUiFontFamilies,
  DEFAULT_UI_FONT_FAMILIES,
  getUiFontDefinition,
  resolveFontWeight,
  sanitizeUiFontFamilies,
  type UiFontFamilies,
  type UiFontRoleId,
} from './fontRegistry';

export type { UiFontFamilies, UiFontId, UiFontRoleId } from './fontRegistry';

export const UI_TYPOGRAPHY_ROLE_IDS = [
  'pageTitle',
  'panelTitle',
  'subheading',
  'body',
  'description',
  'small',
  'eyebrow',
  'button',
  'navigation',
  'stat',
] as const;

export type UiTypographyRoleId = (typeof UI_TYPOGRAPHY_ROLE_IDS)[number];

export interface UiTypographyRole {
  size: number;
  weight: number;
}

export type UiTypographyRoleRecord = Record<UiTypographyRoleId, UiTypographyRole>;

export interface UiTypography {
  fontFamilies: UiFontFamilies;
  roles: UiTypographyRoleRecord;
}

export interface UiTypographyRoleDefinition {
  id: UiTypographyRoleId;
  label: string;
  description: string;
  minSize: number;
  maxSize: number;
  sizeStep: number;
  minWeight: number;
  maxWeight: number;
  weightStep: number;
}

export const UI_TYPOGRAPHY_ROLE_DEFINITIONS: UiTypographyRoleDefinition[] = [
  {
    id: 'pageTitle',
    label: 'Page Title',
    description: 'Main title at the top of each screen.',
    minSize: 25,
    maxSize: 56,
    sizeStep: 1,
    minWeight: 100,
    maxWeight: 900,
    weightStep: 50,
  },
  {
    id: 'panelTitle',
    label: 'Panel Title',
    description: 'Primary headings inside large UI panels.',
    minSize: 14,
    maxSize: 34,
    sizeStep: 1,
    minWeight: 100,
    maxWeight: 900,
    weightStep: 50,
  },
  {
    id: 'subheading',
    label: 'Subheading',
    description: 'Secondary headings inside a panel.',
    minSize: 11,
    maxSize: 26,
    sizeStep: 1,
    minWeight: 100,
    maxWeight: 900,
    weightStep: 50,
  },
  {
    id: 'body',
    label: 'Body',
    description: 'General interface and paragraph text.',
    minSize: 11,
    maxSize: 22,
    sizeStep: 1,
    minWeight: 100,
    maxWeight: 900,
    weightStep: 50,
  },
  {
    id: 'description',
    label: 'Description',
    description: 'Muted explanatory and secondary text.',
    minSize: 9,
    maxSize: 20,
    sizeStep: 1,
    minWeight: 100,
    maxWeight: 900,
    weightStep: 50,
  },
  {
    id: 'small',
    label: 'Small Text',
    description: 'Compact labels and secondary metadata.',
    minSize: 8,
    maxSize: 16,
    sizeStep: 1,
    minWeight: 100,
    maxWeight: 900,
    weightStep: 50,
  },
  {
    id: 'eyebrow',
    label: 'Eyebrow',
    description: 'Uppercase category labels above titles.',
    minSize: 8,
    maxSize: 18,
    sizeStep: 1,
    minWeight: 100,
    maxWeight: 900,
    weightStep: 50,
  },
  {
    id: 'button',
    label: 'Button',
    description: 'Game action button labels.',
    minSize: 9,
    maxSize: 20,
    sizeStep: 1,
    minWeight: 100,
    maxWeight: 900,
    weightStep: 50,
  },
  {
    id: 'navigation',
    label: 'Navigation',
    description: 'Persistent sidebar navigation labels.',
    minSize: 10,
    maxSize: 22,
    sizeStep: 1,
    minWeight: 100,
    maxWeight: 900,
    weightStep: 50,
  },
  {
    id: 'stat',
    label: 'Stat Values',
    description: 'Prominent numeric values and metrics.',
    minSize: 14,
    maxSize: 42,
    sizeStep: 1,
    minWeight: 100,
    maxWeight: 900,
    weightStep: 50,
  },
];

export const UI_TYPOGRAPHY_GROUPS: Array<{
  label: string;
  roles: UiTypographyRoleId[];
}> = [
  { label: 'Headings', roles: ['pageTitle', 'panelTitle', 'subheading'] },
  { label: 'Text', roles: ['body', 'description', 'small'] },
  { label: 'Interface', roles: ['eyebrow', 'button', 'navigation', 'stat'] },
];

export const DEFAULT_UI_TYPOGRAPHY: UiTypography = {
  fontFamilies: cloneUiFontFamilies(DEFAULT_UI_FONT_FAMILIES),
  roles: {
    pageTitle: { size: 38, weight: 700 },
    panelTitle: { size: 20, weight: 700 },
    subheading: { size: 15, weight: 700 },
    body: { size: 16, weight: 400 },
    description: { size: 13, weight: 400 },
    small: { size: 10, weight: 400 },
    eyebrow: { size: 11, weight: 400 },
    button: { size: 12, weight: 600 },
    navigation: { size: 16, weight: 400 },
    stat: { size: 26, weight: 700 },
  },
};

const definitionByRole = Object.fromEntries(
  UI_TYPOGRAPHY_ROLE_DEFINITIONS.map((definition) => [definition.id, definition]),
) as Record<UiTypographyRoleId, UiTypographyRoleDefinition>;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const getCompactStatSize = (masterSize: number): number =>
  clamp(Math.round(masterSize * 0.55), 10, 22);

export const getCompactButtonSize = (masterSize: number): number =>
  clamp(Math.round(masterSize * 0.84), 9, 16);

export const getCompactStatLabelSize = (masterSize: number): number =>
  clamp(Math.round(masterSize * 0.42), 9, 18);

const safeNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const cssRoleName = (roleId: UiTypographyRoleId): string =>
  roleId.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

const sanitizeRole = (
  value: unknown,
  fallback: UiTypographyRole,
  definition: UiTypographyRoleDefinition,
): UiTypographyRole => {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const size = Math.round(
    clamp(safeNumber(source.size, fallback.size), definition.minSize, definition.maxSize),
  );
  const weight = Math.round(
    clamp(safeNumber(source.weight, fallback.weight), definition.minWeight, definition.maxWeight) /
      definition.weightStep,
  ) * definition.weightStep;
  return { size, weight };
};

export const cloneUiTypography = (typography: UiTypography): UiTypography => ({
  fontFamilies: cloneUiFontFamilies(typography.fontFamilies),
  roles: Object.fromEntries(
    UI_TYPOGRAPHY_ROLE_IDS.map((id) => [id, { ...typography.roles[id] }]),
  ) as UiTypographyRoleRecord,
});

export const sanitizeUiTypography = (value: unknown): UiTypography => {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const storedRoles = source.roles && typeof source.roles === 'object'
    ? (source.roles as Record<string, unknown>)
    : {};
  return {
    fontFamilies: sanitizeUiFontFamilies(source.fontFamilies),
    roles: Object.fromEntries(
      UI_TYPOGRAPHY_ROLE_IDS.map((id) => [
        id,
        sanitizeRole(storedRoles[id], DEFAULT_UI_TYPOGRAPHY.roles[id], definitionByRole[id]),
      ]),
    ) as UiTypographyRoleRecord,
  };
};

export const getTypographyCssVariables = (
  typography: UiTypography,
): Record<string, string> => {
  const fontFamilies = sanitizeUiFontFamilies(typography.fontFamilies ?? DEFAULT_UI_FONT_FAMILIES);
  const fontRoleByTypographyRole: Record<UiTypographyRoleId, UiFontRoleId> = {
    pageTitle: 'heading',
    panelTitle: 'heading',
    subheading: 'heading',
    body: 'body',
    description: 'body',
    small: 'body',
    eyebrow: 'body',
    button: 'body',
    navigation: 'body',
    stat: 'stat',
  };
  const variables: Record<string, string> = {
    '--font-family-ui': getUiFontDefinition(fontFamilies.body).cssFamily,
    '--font-family-heading': getUiFontDefinition(fontFamilies.heading).cssFamily,
    '--font-family-body': getUiFontDefinition(fontFamilies.body).cssFamily,
    '--font-family-stat': getUiFontDefinition(fontFamilies.stat).cssFamily,
  };
  for (const id of UI_TYPOGRAPHY_ROLE_IDS) {
    const role = typography.roles[id];
    const cssName = cssRoleName(id);
    const fontId = fontFamilies[fontRoleByTypographyRole[id]];
    const sizeVariable = id === 'pageTitle' ? '--font-size-page-title-max' : `--font-size-${cssName}`;
    variables[sizeVariable] = `${role.size}px`;
    variables[`--font-weight-${cssName}`] = String(resolveFontWeight(fontId, role.weight));
  }
  variables['--font-size-stat-compact'] = `${getCompactStatSize(typography.roles.stat.size)}px`;
  variables['--font-weight-stat-compact'] = variables['--font-weight-stat'];
  variables['--font-size-stat-label'] = `${getCompactStatLabelSize(typography.roles.stat.size)}px`;
  variables['--font-size-button-compact'] = `${getCompactButtonSize(typography.roles.button.size)}px`;
  variables['--font-weight-button-compact'] = variables['--font-weight-button'];
  return variables;
};
