import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import { notificationsFor } from '../queueLogic.js';
import { useQueues } from '../QueueContext.jsx';
import { timeAgo } from '../utils/format.js';

export default function NotificationBell() {
  const { user } = useAuth();
  const { state, markNotificationsRead } = useQueues();
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  const notifications = notificationsFor(state, user);
  const unread = notifications.filter((n) => !n.read);

  // Close the panel when clicking anywhere outside it.
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (!panelRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="bell" ref={panelRef}>
      <button
        className="icon-button"
        aria-label={`Notifications, ${unread.length} unread`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread.length > 0 && <span className="bell-count">{unread.length}</span>}
      </button>

      {open && (
        <div className="bell-panel">
          <div className="bell-header">
            <strong>Notifications</strong>
            {unread.length > 0 && (
              <button className="link-button" onClick={() => markNotificationsRead(unread.map((n) => n.id))}>
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="muted bell-empty">No notifications yet.</p>
          ) : (
            <ul className="bell-list">
              {notifications.slice(0, 15).map((n) => (
                <li key={n.id} className={n.read ? '' : 'unread'}>
                  <button className="bell-item" onClick={() => markNotificationsRead([n.id])}>
                    <span>{n.message}</span>
                    <span className="muted small">{timeAgo(n.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
