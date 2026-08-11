const MAX_CLASS_LENGTH = 160;
const MAX_TEXT_LENGTH = 120;
const MAX_DEBUG_ANCESTORS = 8;

export interface UiInspectorTarget {
  rect: DOMRect;
  tagName: string;
  htmlId?: string;
  classes?: string;
  text?: string;
  ariaLabel?: string;
  role?: string;
  title?: string;

  screen?: string;
  uiRegion?: string;
  panelId?: string;
  panelRegionId?: string;
  panelOwnerId?: string;

  debugKind?: string;
  debugId?: string;
  debugIdLabel?: string;
  debugLabel?: string;
  debugMetadata: Record<string, string>;
}

export interface UiInspectorDisplayRow {
  label: string;
  value: string;
}

const clean = (value: string | null | undefined, maxLength?: number): string | undefined => {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;
  return maxLength && normalized.length > maxLength
    ? `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
    : normalized;
};

const attr = (element: Element, name: string): string | undefined => clean(element.getAttribute(name));

const formatDataDebugLabel = (attributeName: string): string =>
  attributeName
    .replace(/^data-debug-/, '')
    .split('-')
    .filter(Boolean)
    .map((part) => (part === 'id' ? 'ID' : `${part.charAt(0).toUpperCase()}${part.slice(1)}`))
    .join(' ');

const getDebugMetadata = (element: Element): Record<string, string> => {
  const metadata: Record<string, string> = {};
  let current: Element | null = element;
  let depth = 0;

  while (current && depth < MAX_DEBUG_ANCESTORS) {
    for (const attribute of Array.from(current.attributes)) {
      if (!attribute.name.startsWith('data-debug-') || metadata[attribute.name]) continue;
      const value = clean(attribute.value);
      if (value) metadata[attribute.name] = value;
    }
    current = current.parentElement;
    depth += 1;
  }

  return metadata;
};

export function getUiInspectorSemanticElement(element: Element): Element {
  return element.closest('[data-debug-kind]') ?? element;
}

const getDebugId = (
  metadata: Record<string, string>,
): { value?: string; label?: string } => {
  if (metadata['data-debug-id']) {
    return { value: metadata['data-debug-id'], label: 'Entity ID' };
  }

  const specificId = Object.entries(metadata).find(
    ([name]) => name.startsWith('data-debug-') && name.endsWith('-id'),
  );
  return specificId
    ? { value: specificId[1], label: formatDataDebugLabel(specificId[0]) }
    : {};
};

const getClasses = (element: Element): string | undefined => {
  const classValue = typeof element.className === 'string' ? element.className : element.getAttribute('class');
  return clean(classValue, MAX_CLASS_LENGTH);
};

export function resolveUiInspectorTarget(element: Element): UiInspectorTarget | null {
  if (element.closest('[data-ui-inspector-ignore]')) return null;

  const semantic = getUiInspectorSemanticElement(element);
  const metadata = getDebugMetadata(element);
  const debugId = getDebugId(metadata);
  const panelRegion = semantic.closest('[data-ui-panel-region]');
  const panel = semantic.closest('[data-ui-panel]');
  const shellRegion = semantic.closest('[data-ui-region]');
  const screen = semantic.closest('[data-debug-screen]');

  return {
    rect: semantic.getBoundingClientRect(),
    tagName: semantic.tagName.toLowerCase(),
    htmlId: attr(semantic, 'id'),
    classes: getClasses(semantic),
    text: clean(semantic.textContent, MAX_TEXT_LENGTH),
    ariaLabel: attr(semantic, 'aria-label'),
    role: attr(semantic, 'role'),
    title: attr(semantic, 'title'),
    screen: screen ? attr(screen, 'data-debug-screen') : undefined,
    uiRegion: shellRegion ? attr(shellRegion, 'data-ui-region') : undefined,
    panelId: panel ? attr(panel, 'data-ui-panel') : undefined,
    panelRegionId: panelRegion ? attr(panelRegion, 'data-ui-panel-region') : undefined,
    panelOwnerId: panelRegion ? attr(panelRegion, 'data-ui-panel-owner') : undefined,
    debugKind: metadata['data-debug-kind'],
    debugId: debugId.value,
    debugIdLabel: debugId.label,
    debugLabel: metadata['data-debug-label'],
    debugMetadata: metadata,
  };
}

const addRow = (rows: UiInspectorDisplayRow[], label: string, value: string | undefined) => {
  if (value) rows.push({ label, value });
};

export function getUiInspectorDisplayRows(target: UiInspectorTarget): UiInspectorDisplayRow[] {
  const rows: UiInspectorDisplayRow[] = [];
  addRow(rows, 'SCREEN', target.screen);
  addRow(rows, 'UI REGION', target.uiRegion);
  addRow(rows, 'PANEL', target.panelId);
  addRow(rows, 'PANEL REGION', target.panelRegionId);
  addRow(rows, 'KIND', target.debugKind);
  addRow(rows, target.debugIdLabel ?? 'ENTITY ID', target.debugId);
  addRow(rows, 'LABEL', target.debugLabel);

  const primaryIdAttribute = target.debugId
    ? Object.entries(target.debugMetadata).find(([, value]) => value === target.debugId)?.[0]
    : undefined;
  for (const [name, value] of Object.entries(target.debugMetadata)) {
    if (
      name === 'data-debug-kind' ||
      name === 'data-debug-id' ||
      name === 'data-debug-label' ||
      name === primaryIdAttribute
    ) {
      continue;
    }
    addRow(rows, formatDataDebugLabel(name), value);
  }

  addRow(rows, 'ELEMENT', target.tagName);
  addRow(rows, 'ID', target.htmlId);
  addRow(rows, 'ROLE', target.role);
  addRow(rows, 'ARIA', target.ariaLabel);
  addRow(rows, 'TITLE', target.title);
  addRow(rows, 'CSS', target.classes);
  addRow(rows, 'TEXT', target.text);
  return rows;
}

export function formatUiInspectorReference(target: UiInspectorTarget): string {
  const copyLabel: Record<string, string> = {
    SCREEN: 'Screen',
    'UI REGION': 'Region',
    PANEL: 'Panel',
    'PANEL REGION': 'Panel region',
    KIND: 'Kind',
    'ENTITY ID': 'Entity ID',
    LABEL: 'Label',
    ELEMENT: 'Element',
    ID: 'ID',
    ROLE: 'Role',
    ARIA: 'ARIA',
    TITLE: 'Title',
    CSS: 'Classes',
    TEXT: 'Text',
  };
  return [
    'Ironbound UI reference',
    ...getUiInspectorDisplayRows(target).map(({ label, value }) => `${copyLabel[label] ?? label}: ${value}`),
  ].join('\n');
}
