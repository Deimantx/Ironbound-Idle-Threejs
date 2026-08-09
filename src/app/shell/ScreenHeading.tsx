import type { ReactNode } from 'react';

interface ScreenHeadingProps {
  eyebrow: string;
  title: string;
  description: string;
  trailing?: ReactNode;
}

export function ScreenHeading({ eyebrow, title, description, trailing }: ScreenHeadingProps) {
  return (
    <div className="screen-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p className="subtle">{description}</p>
      </div>
      {trailing}
    </div>
  );
}
