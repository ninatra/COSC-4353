// A small ticket drawing used in empty states.
export function TicketArt() {
  return (
    <svg width="120" height="76" viewBox="0 0 120 76" aria-hidden="true">
      <rect x="4" y="8" width="112" height="60" rx="10" fill="var(--t-blue-bg)" stroke="var(--ticket)" strokeWidth="1.5" />
      <line x1="84" y1="16" x2="84" y2="60" stroke="var(--ticket)" strokeWidth="1.5" strokeDasharray="3 4" />
      <circle cx="84" cy="8" r="6" fill="var(--bg)" stroke="var(--ticket)" strokeWidth="1.5" />
      <circle cx="84" cy="68" r="6" fill="var(--bg)" stroke="var(--ticket)" strokeWidth="1.5" />
      <rect x="4" y="0" width="112" height="7.2" fill="var(--bg)" />
      <rect x="4" y="68.8" width="112" height="8" fill="var(--bg)" />
      <rect x="18" y="22" width="44" height="6" rx="3" fill="var(--ticket)" opacity=".35" />
      <rect x="18" y="36" width="28" height="18" rx="4" fill="var(--ticket)" />
      <circle cx="100" cy="38" r="6" fill="var(--lime)" stroke="#242A2A" strokeWidth="1.5" />
    </svg>
  );
}

export default function EmptyState({ title, body, action }) {
  return (
    <div className="empty">
      <TicketArt />
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </div>
  );
}
