export const STATUS_LABELS = {
  WAITING: 'Waiting',
  ALMOST_READY: 'Almost ready',
  SERVING: 'Being served',
  SERVED: 'Served',
  LEFT: 'Left',
  REMOVED: 'Removed',
  NO_SHOW: 'No-show',
};

export function StatusBadge({ status }) {
  return (
    <span className={`badge status-${status.toLowerCase()}`}>{STATUS_LABELS[status] ?? status}</span>
  );
}

// Only high priority is flagged as a badge; medium and low are the normal case
// and read as plain text so the flag stands out.
export function PriorityBadge({ priority }) {
  const label = `${priority.charAt(0) + priority.slice(1).toLowerCase()} priority`;
  if (priority === 'HIGH') return <span className="badge priority-high">{label}</span>;
  return <span className="muted small">{label}</span>;
}

export function OpenBadge({ isOpen }) {
  return <span className={`badge ${isOpen ? 'open' : 'closed'}`}>{isOpen ? 'Open' : 'Closed'}</span>;
}
