import { CircleHelp } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import { GameTooltip } from '../items/GameTooltip';
import { getGameConcept, type GameConceptId } from './gameConcepts';

export function GameConceptTooltip({ concept }: { concept: GameConceptId }) {
  const definition = getGameConcept(concept);
  const details = typeof definition.details === 'function' ? definition.details() : definition.details;
  return (
    <div className="concept-tooltip-content">
      <strong>{definition.title}</strong>
      <p>{definition.description}</p>
      {details?.map((detail) => <span key={detail}>{detail}</span>)}
    </div>
  );
}

export function ExplainedTerm({
  concept,
  children,
  label,
  showHelpIcon = true,
}: {
  concept: GameConceptId;
  children?: ReactNode;
  label?: string;
  showHelpIcon?: boolean;
}): ReactElement {
  const definition = getGameConcept(concept);
  return (
    <GameTooltip
      content={<GameConceptTooltip concept={concept} />}
      label={`${label ?? definition.title} explanation`}
    >
      <span className="explained-term">
        {children ?? label ?? definition.title}
        {showHelpIcon && <CircleHelp className="explained-term-icon" aria-hidden="true" />}
      </span>
    </GameTooltip>
  );
}
