// TODO (teammate): Updates screen, shared by users (/updates) and admins (/admin/updates).
//
// - Audience: user.role === 'ADMIN' ? 'admin' : user.email
// - Head row: eyebrow ("Administrator" or "Activity"), <h1 id="page-title" tabIndex={-1}>Updates</h1>,
//   and a "Clear all" button (btn btn-secondary btn-sm) when the list isn't empty.
//   Clear all asks first with useConfirm():
//     title "Clear all updates?", body "This empties the Updates list. Your ticket and
//     history are not affected.", confirmLabel "Clear updates"
//   then calls clearUpdates(audience) from useQueues().
// - Lead: users "Confirmations, position changes, and status changes for your tickets,
//   newest first." / admins "Queue activity across every service, newest first." followed by
//   "Times come from the demo clock. Nothing is sent by email or text."
// - List: <p className="day-label">Today · {DEMO_DATE}</p> then <ol className="ulist">, one
//   <li className="uitem"> per update: a tinted tile with an icon by kind, <h3>{title}</h3>,
//   <p>{fillService(state, body, serviceId)}</p>, and <time>{fmtTime(t)}</time>.
//   Icons by kind: confirmed ticket/blue, joined user-plus/blue, position arrow-up/blue,
//   almost bell-ring/sun, served circle-check/mint, left log-out/peach, removed user-minus/peach,
//   closed lock/peach, opened lock-open/mint, edit pencil/lilac, created plus/lilac,
//   wait clock/sun, reorder list-ordered/lilac.
// - Empty state: title "All caught up".
//
// Data: updatesFor(state, audience) and fillService() from '../queueLogic.js' (already newest first).
// Design reference: the prototype's vUpdates().

export default function Updates() {
  return (
    <>
      <p className="eyebrow">Activity</p>
      <h1 id="page-title" tabIndex={-1}>
        Updates
      </h1>
      <p className="lead">This screen is under construction.</p>
    </>
  );
}
