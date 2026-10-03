import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import Icon from '../components/Icon.jsx';
import ServiceTile from '../components/ServiceTile.jsx';
import StatusLabel from '../components/StatusLabel.jsx';
import { useToast } from '../components/Toast.jsx';
import { queueOf } from '../queueLogic.js';
import { useQueues } from '../QueueContext.jsx';
import { people } from '../utils/format.js';

const PRIORITY = { low: 'Low priority', medium: 'Medium priority', high: 'High priority' };
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

export default function AdminOverview() {
  const { state, toggleOpen } = useQueues();
  const confirm = useConfirm();
  const toast = useToast();

  const openCount = state.services.filter((s) => s.open).length;
  const waitingTotal = state.services.reduce((sum, s) => sum + queueOf(state, s.id).length, 0);
  const services = [...state.services].sort((a, b) => {
    if (a.open !== b.open) return a.open ? -1 : 1;
    return (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3);
  });

  async function handleToggle(service) {
    if (service.open) {
      const waiting = queueOf(state, service.id).length;
      const ok = await confirm({
        title: `Close ${service.name}?`,
        body: `New visitors won’t be able to join. ${
          waiting ? `${people(waiting)} already waiting keep their place and can still be served.` : 'Nobody is waiting right now.'
        }`,
        confirmLabel: 'Close queue',
      });
      if (!ok) return;
    }
    toast(toggleOpen(service.id));
  }

  return (
    <>
      <div className="head-row">
        <div>
          <p className="eyebrow">Campus services · Administrator</p>
          <h1 id="page-title" tabIndex={-1}>
            Today's queues
          </h1>
        </div>
        <Link to="/admin/services/new" className="btn btn-primary">
          <Icon name="plus" />
          Create service
        </Link>
      </div>

      <dl className="ops-summary">
        <div>
          <dt>Open services</dt>
          <dd>
            {openCount} <span>of {state.services.length}</span>
          </dd>
        </div>
        <div>
          <dt>Visitors waiting</dt>
          <dd>{waitingTotal}</dd>
        </div>
      </dl>

      <div className="table-wrap">
        <table className="ops">
          <caption className="sr-only">Services and queue status</caption>
          <thead>
            <tr>
              <th scope="col">Service</th>
              <th scope="col">Status</th>
              <th scope="col">Waiting</th>
              <th scope="col">Per visit</th>
              <th scope="col">Next joiner waits</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {services.map((s, index) => {
              const line = queueOf(state, s.id);
              const waiting = line.length;
              return (
                <Fragment key={s.id}>
                  {!s.open && (index === 0 || services[index - 1].open) && (
                    <tr className="ops-section-row">
                      <th colSpan="6">Closed services</th>
                    </tr>
                  )}
                  <tr>
                    <th scope="row">
                      <div className="name-cell">
                        <ServiceTile service={s} size="sm" />
                        <div>
                          <Link to={`/admin/queues/${s.id}`}>{s.name}</Link>
                          <span className={`prio priority-${s.priority}`}>{PRIORITY[s.priority]}</span>
                        </div>
                      </div>
                    </th>
                    <td data-label="Status">
                      <div className="status-cell">
                        <StatusLabel status={s.open ? 'open' : 'closed'} />
                        <button type="button" className="toggle-link" onClick={() => handleToggle(s)}>
                          <Icon name={s.open ? 'lock' : 'lock-open'} />
                          {s.open ? 'Close queue' : 'Open queue'}
                          <span className="sr-only">: {s.name}</span>
                        </button>
                      </div>
                    </td>
                    <td data-label="Waiting" className="num">
                      {waiting}
                    </td>
                    <td data-label="Per visit" className="num">
                      {s.duration} min
                    </td>
                    <td data-label="Next joiner waits" className="num">
                      {waiting * s.duration} min
                    </td>
                    <td>
                      <div className="row-actions">
                        <Link to={`/admin/services/${s.id}/edit`} className="btn btn-secondary btn-sm">
                          Edit service<span className="sr-only">: {s.name}</span>
                        </Link>
                        <Link to={`/admin/queues/${s.id}`} className="btn btn-secondary btn-sm">
                          Manage queue<span className="sr-only">: {s.name}</span>
                          <span aria-hidden="true">&nbsp;→</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="ops-note">
        <Icon name="info" />
        Closing a queue stops new joins. Visitors already waiting keep their place and can still be served.
      </p>
    </>
  );
}
