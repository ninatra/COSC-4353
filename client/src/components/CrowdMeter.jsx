import { crowdLevel } from '../queueLogic.js';

const LABELS = ['No line', 'Quiet', 'Moderate', 'Busy'];

// Three bars that fill up as the wait grows.
export default function CrowdMeter({ wait }) {
  const level = crowdLevel(wait);
  return (
    <span className={`crowd crowd-${level}`}>
      <span className="bars" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {LABELS[level]}
    </span>
  );
}
