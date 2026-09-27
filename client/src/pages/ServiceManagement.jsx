// TODO (teammate): Admin Services screen + create/edit form.
// Routes already point here: /admin/services, /admin/services/new and
// /admin/services/:serviceId/edit (read it with useParams()).
//
// 1. List view (/admin/services)
//    - Eyebrow "Administrator", <h1 id="page-title" tabIndex={-1}>Services</h1>,
//      and a "Create service" link to /admin/services/new (btn btn-primary).
//    - Lead: "Edits show up everywhere the service appears, including students'
//      tickets and wait estimates."
//    - <ul className="svc-list">: one <li> per service with <ServiceTile>, name,
//      description, a .meta row (StatusLabel, "8 min per visit", priority,
//      "5 people waiting") and two buttons: Edit (link to .../edit) and
//      Waiting list (link to /admin/queues/:id).
//
// 2. Form (/admin/services/new and /admin/services/:id/edit), <form className="panel form-panel" noValidate>
//    - Service name: required, 100 characters max, live counter "12/100" (.counter, .over when > 100)
//    - Description: required (<textarea>), hint "One line students see on the service card."
//    - Expected duration: required positive whole number, suffix "minutes per visit"
//    - Priority: Low / Medium / High as radio buttons (.radio-seg)
//    - New services only: checkbox "Open for new visitors right away" (.check)
//    - Treat whitespace-only as empty, show errors under each field, and move
//      focus to the first invalid field (see focusFirstError in utils/validation.js).
//    - Save: saveService(values, serviceId) from useQueues(); leave serviceId out
//      to create. It returns a message for toast() (useToast). Then navigate to
//      /admin/services.
//      values = { name, desc, duration: Number(...), priority: 'low'|'medium'|'high', open }
//
// Reuse: FormField + fieldProps (components/FormField.jsx), ServiceTile,
// StatusLabel, Icon, useQueues, useToast. Copy the look from Register.jsx.
// Design reference: the prototype's vAdminServices() and vAdminForm().

export default function ServiceManagement() {
  return (
    <>
      <p className="eyebrow">Administrator</p>
      <h1 id="page-title" tabIndex={-1}>
        Services
      </h1>
      <p className="lead">This screen is under construction.</p>
    </>
  );
}
