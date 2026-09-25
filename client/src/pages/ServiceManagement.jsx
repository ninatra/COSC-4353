// TODO (teammate): Service Management screen.
//
// Build here:
// - A list of all services (state.services) with an Edit button for each,
//   plus a "New service" button. The Admin Dashboard links here with
//   ?edit=<serviceId> when the admin clicks Edit (read it with useSearchParams).
// - A create/edit form with client-side validation and an error under each field:
//     Service Name       required, max 100 characters (show a character counter)
//     Description        required
//     Expected Duration  required, whole number of minutes, at least 1
//     Priority           LOW / MEDIUM / HIGH
//
// Saving (mock data, no backend needed):
//   const { state, addService, updateService } = useQueues();   // from '../QueueContext.jsx'
//   addService({ name, description, expectedDuration: Number(duration), priority });
//   updateService(serviceId, { name, description, expectedDuration: Number(duration), priority });
//
// Reusable pieces: PriorityBadge / OpenBadge in components/Badges.jsx, and the
// .card, .field-error, .button-row and table styles in index.css.

export default function ServiceManagement() {
  return (
    <section className="stack">
      <h1>Service management</h1>
      <div className="card">
        <p className="muted">This screen is under construction.</p>
      </div>
    </section>
  );
}
