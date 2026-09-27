const STATUS = {
  open: ['Open', 'ok'],
  closed: ['Closed', 'off'],
  waiting: ['Waiting', 'wait'],
  almost: ['Almost ready', 'almost'],
  served: ['Served', 'ok'],
  left: ['Left queue', 'off'],
  removed: ['Removed', 'bad'],
};

// A colored dot plus text, so status never relies on color alone.
export default function StatusLabel({ status }) {
  const [label, tone] = STATUS[status] ?? [status, 'off'];
  return (
    <span className={`status st-${tone}`}>
      <span className="dot" aria-hidden="true" />
      {label}
    </span>
  );
}
