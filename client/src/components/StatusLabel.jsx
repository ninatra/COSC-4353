const STATUS = {
  open: ['Open', 'ok'],
  closed: ['Closed', 'off'],
  waiting: ['Waiting', 'wait'],
  almost: ['Almost ready', 'almost'],
  served: ['Served', 'ok'],
  completed: ['Completed', 'ok'],
  referred: ['Referred', 'wait'],
  unresolved: ['Unresolved', 'bad'],
  'follow-up': ['Follow-up needed', 'almost'],
  left: ['Left queue', 'off'],
  removed: ['Removed', 'bad'],
};

// A colored dot plus text, so status never relies on color alone.
export default function StatusLabel({ status }) {
  const [label, tone] = STATUS[status] ?? [status, 'off'];
  return (
    <span className={`status st-${tone} st-${status}`}>
      <span className="dot" aria-hidden="true" />
      {label}
    </span>
  );
}
