import { useAuth } from '../AuthContext.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Icon from '../components/Icon.jsx';
import { fillService, notificationsFor, updatesFor } from '../queueLogic.js';
import { useQueues } from '../QueueContext.jsx';
import { fmtTime } from '../utils/format.js';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import { useToast } from '../components/Toast.jsx';

const UPDATE_STYLE = {
  'queue-active': ['user-plus', 'blue'], capacity: ['users', 'sun'],
  confirmed: ['ticket', 'blue'], joined: ['user-plus', 'blue'], position: ['arrow-up', 'blue'],
  next: ['bell-ring', 'sun'], almost: ['bell-ring', 'sun'], served: ['circle-check', 'mint'], left: ['log-out', 'peach'],
  removed: ['user-minus', 'peach'], closed: ['lock', 'peach'], opened: ['lock-open', 'mint'],
  edit: ['pencil', 'lilac'], created: ['plus', 'lilac'], wait: ['clock', 'sun'], reorder: ['list-ordered', 'lilac'],
};

// "Today · Oct 22, 2026", "Yesterday · Oct 21, 2026" or "Oct 18, 2026".
function dayLabel(iso) {
  const date = iso ? new Date(iso) : new Date();
  const full = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const daysAgo = Math.round((new Date(new Date().toDateString()) - new Date(date.toDateString())) / 86400000);
  return daysAgo === 0 ? `Today · ${full}` : daysAgo === 1 ? `Yesterday · ${full}` : full;
}

// Splits a newest-first list into [label, updates] groups, one per day.
function byDay(updates) {
  const groups = [];
  for (const update of updates) {
    const label = dayLabel(update.at);
    if (groups.at(-1)?.[0] !== label) groups.push([label, []]);
    groups.at(-1)[1].push(update);
  }
  return groups;
}

export default function Updates() {
  const { user } = useAuth();
  const { state, clearUpdates, markUpdateRead, markAllUpdatesRead } = useQueues();
  const confirm = useConfirm();
  const toast = useToast();
  const isAdmin = user.role === 'ADMIN';
  const audience = isAdmin ? 'admin' : user.email;
  const updates = updatesFor(state, audience);
  const unread = new Set(notificationsFor(state, audience).map((update) => update.n));

  async function handleClear() {
    const ok = await confirm({
      title: 'Clear notifications?',
      body: 'This removes the notification history from this view. New updates will still appear as they happen.',
      confirmLabel: 'Clear notifications',
      danger: true,
    });
    if (ok) {
      try { await clearUpdates(audience); } catch (error) { toast(error.message); }
    }
  }

  return (
    <>
      <div className="head-row notification-page-head">
        <div>
          <p className="eyebrow">{isAdmin ? 'Administrator' : 'Activity'}</p>
          <h1 id="page-title" tabIndex={-1}>Notifications</h1>
        </div>
        <div className="notification-actions">
          {unread.size > 0 && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => markAllUpdatesRead(audience).catch(error => toast(error.message))}>
              Mark all as read
            </button>
          )}
          {updates.length > 0 && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleClear}>
              Clear notifications
            </button>
          )}
        </div>
      </div>
      <p className="lead">
        {isAdmin ? 'Detailed queue activity across every service, newest first.' : 'Queue updates and status changes appear here, newest first.'}
      </p>
      {!updates.length ? (
        <EmptyState icon="bell" title="All caught up" body="New queue updates and service notices will appear here." />
      ) : (
        <>
          {byDay(updates).map(([label, items]) => (
            <section key={label} aria-label={label}>
              <p className="day-label">{label}</p>
              <ol className="ulist">
                {items.map((update) => {
                  const [icon, tint] = UPDATE_STYLE[update.kind] ?? ['info', 'blue'];
                  return (
                    <li className={`uitem ${unread.has(update.n) ? 'is-unread' : ''}`} key={update.n}>
                      <span className={`tile tint-${tint}`} aria-hidden="true"><Icon name={icon} /></span>
                      <div>
                        <h3>
                          {unread.has(update.n) && <span className="unread-dot" aria-label="Unread" />}
                          {update.title}
                        </h3>
                        <p>{fillService(state, update.body, update.serviceId)}</p>
                      </div>
                      <div className="uitem-meta">
                        <time>{fmtTime(update.t)}</time>
                        {unread.has(update.n) && (
                          <button type="button" className="notification-read" onClick={() => markUpdateRead(audience, update.n).catch(error => toast(error.message))}>
                            Mark as read
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </>
      )}
    </>
  );
}
