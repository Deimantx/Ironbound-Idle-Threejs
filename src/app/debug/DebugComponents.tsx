import type { ReactNode } from 'react';
import { enemyById } from '../../content/enemies';
import { miningNodeById } from '../../content/miningNodes';
import { recipeById } from '../../content/recipes';
import type { GameState } from '../../game/types';

export const labelize = (value: string): string =>
  value.replace(/[-_]/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());

export const skillLabel = (skill: string): string =>
  skill === 'hitpoints' ? 'Hitpoints' : labelize(skill);

export const activeActionLabel = (game: GameState): string => {
  if (game.activeAction.type === 'none') return 'None';
  if (game.activeAction.type === 'mining')
    return `Mining · ${miningNodeById[game.activeAction.nodeId]?.name ?? game.activeAction.nodeId}`;
  if (game.activeAction.type === 'smithing')
    return `Smithing · ${recipeById[game.activeAction.recipeId]?.name ?? game.activeAction.recipeId}`;
  return `Combat · ${enemyById[game.activeAction.enemyId]?.name ?? game.activeAction.enemyId}`;
};

export const uniqueSorted = (values: Array<string | undefined>): string[] =>
  [...new Set(values.filter((value): value is string => Boolean(value)))].sort();

export function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`debug-tools-field ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Section({
  title,
  description,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`debug-tools-section ${className}`}>
      <div className="debug-tools-section-heading">
        <div>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function ActionButton({
  children,
  onClick,
  danger = false,
  disabled = false,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      className={`button ${danger ? 'danger' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

export function Details({ details }: { details?: string[] }) {
  if (!details?.length) return null;
  return (
    <ul className="debug-tools-result-details">
      {details.map((detail) => (
        <li key={detail}>{detail}</li>
      ))}
    </ul>
  );
}
