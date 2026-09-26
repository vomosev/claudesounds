export function CardHeader({ title, subtitle, actions, className = '' }) {
  return (
    <div className={`card__header ${className}`.trim()}>
      <div className="card__header-text">
        {title ? <h2 className="card__title">{title}</h2> : null}
        {subtitle ? <p className="card__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="card__actions cluster">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ className = '', children }) {
  return <div className={`card__body ${className}`.trim()}>{children}</div>;
}

export function CardFooter({ className = '', children }) {
  return <div className={`card__footer ${className}`.trim()}>{children}</div>;
}

export default function Card({
  as: Tag = 'section',
  padded = true,
  raised = false,
  className = '',
  title,
  subtitle,
  actions,
  children,
  ...rest
}) {
  const classes = [
    'card',
    padded ? 'card--padded' : 'card--flush',
    raised ? 'card--raised' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Tag className={classes} {...rest}>
      {title || subtitle || actions ? (
        <CardHeader title={title} subtitle={subtitle} actions={actions} />
      ) : null}
      {children}
    </Tag>
  );
}

export { Card };

export function CardGrid({ className = '', children }) {
  return <div className={`card-grid ${className}`.trim()}>{children}</div>;
}