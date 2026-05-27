import type { ReactNode } from 'react';

interface PageFrameProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function PageFrame({
  eyebrow,
  title,
  description,
  action,
  children,
}: PageFrameProps) {
  return (
    <div className="page">
      <div className="page__header">
        <div>
          {eyebrow ? (
            <p className="eyebrow eyebrow--subtle">{eyebrow}</p>
          ) : null}
          <h1 className="page__title">{title}</h1>
          {description ? (
            <p className="page__description">{description}</p>
          ) : null}
        </div>
        {action ? <div className="page__action">{action}</div> : null}
      </div>
      {children}
    </div>
  );
}