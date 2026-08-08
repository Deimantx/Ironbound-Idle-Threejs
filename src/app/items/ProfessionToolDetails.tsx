import { getProfessionToolPresentation } from './itemProfessionPresentation';

export function ProfessionToolDetails({
  itemId,
  className,
}: {
  itemId?: string;
  className?: string;
}) {
  const presentation = getProfessionToolPresentation(itemId);
  if (!presentation) return null;

  return (
    <div className={`item-tooltip-profession${className ? ` ${className}` : ''}`}>
      <span className="item-tooltip-kicker">{presentation.professionLabel}</span>
      <span>
        {presentation.requiredLevelLabel}: <strong>{presentation.requiredLevel}</strong>
      </span>
      {presentation.effects.map((effect) => (
        <span key={effect.id}>
          {effect.label}: <strong>{effect.value}</strong>
        </span>
      ))}
    </div>
  );
}
