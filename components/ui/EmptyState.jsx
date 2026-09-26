export default function EmptyState({ icon, title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon" aria-hidden="true">
        {icon || <DefaultIllustration />}
      </div>
      <h3 className="empty-state__title">{title || 'Nothing here yet'}</h3>
      {description ? (
        <p className="empty-state__description">{description}</p>
      ) : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}

function DefaultIllustration() {
  return (
    <svg
      viewBox="0 0 64 64"
      width="64"
      height="64"
      role="presentation"
      focusable="false"
    >
      <rect
        x="6"
        y="12"
        width="52"
        height="40"
        rx="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.5"
      />
      <path
        d="M18 38V24l16-4v14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="15" cy="39" r="4" fill="currentColor" opacity="0.85" />
      <circle cx="31" cy="35" r="4" fill="currentColor" opacity="0.85" />
      <path
        d="M42 28h10M42 34h8M42 40h10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.45"
      />
    </svg>
  );
}

export { EmptyState };