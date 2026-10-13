import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import FormField, { FieldError, fieldProps } from '../components/FormField.jsx';
import Icon from '../components/Icon.jsx';
import ServiceTile from '../components/ServiceTile.jsx';
import StatusLabel from '../components/StatusLabel.jsx';
import { useToast } from '../components/Toast.jsx';
import { findService, queueOf } from '../queueLogic.js';
import { useQueues } from '../QueueContext.jsx';
import { focusFirstError } from '../utils/validation.js';
import { people } from '../utils/format.js';

const NAME_MAX = 100;
const DESCRIPTION_MAX = 500;
const LOCATION_MAX = 120;
const HOURS_MAX = 120;
const CONTACT_MAX = 200;
const INSTRUCTIONS_MAX = 500;
const FIELD_ORDER = ['name', 'description', 'category','expectedDuration', 'location', 'hours', 'contact', 'maxCapacity'];
const PRIORITIES = [
  ['LOW', 'Low'],
  ['MEDIUM', 'Medium'],
  ['HIGH', 'High'],
];
const CATEGORIES = ['Academic', 'Financial', 'Technology', 'Student support', 'Other'];

export default function ServiceManagement() {
  return (
    <ServiceManagementContent />
  );
}

function ServiceManagementContent() {
  const { serviceId } = useParams();
  const { pathname } = useLocation();
  const { state } = useQueues();
  const service = serviceId ? findService(state, serviceId) : null;

  if (serviceId && !service) return <Navigate to="/admin/services" replace />;
  if (serviceId) return <ServiceForm service={service} />;
  if (pathname.endsWith('/new')) return <ServiceForm />;
  return <ServiceList />;
}

function ServiceList() {
  const { state, toggleOpen, deleteService } = useQueues();
  const confirm = useConfirm();
  const toast = useToast();

  async function handleToggle(service) {
    if (service.isOpen) {
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
    try { toast(await toggleOpen(service.id)); } catch (error) { toast(error.message); }
  }

  async function handleDelete(service) {
    const waiting = queueOf(state, service.id).length;
    const ok = await confirm({
      title: `Delete ${service.name}?`,
      body: waiting ? `${service.name} has ${waiting} people waiting. Close or clear its queue before deleting it.` : 'This removes the service from the catalog permanently.',
      confirmLabel: waiting ? 'Keep service' : 'Delete service',
      danger: !waiting,
    });
    if (!ok || waiting) return;
    try { toast(await deleteService(service.id)); } catch (error) { toast(error.message); }
  }

  return (
    <>
      <div className="head-row">
        <div>
          <p className="eyebrow">Administrator</p>
          <h1 id="page-title" tabIndex={-1}>Services</h1>
        </div>
        <Link to="/admin/services/new" className="btn btn-primary">
          <Icon name="plus" />
          Create service
        </Link>
      </div>
      
      <ul className="svc-list">
        {state.services.map((service) => {
          const waiting = queueOf(state, service.id).length;
          return (
            <li key={service.id} className="admin-service-card">
              <div className="admin-service-heading">
                <ServiceTile service={service} />
                <div className="admin-service-title">
                  <p className="admin-service-category">{service.category || 'Other'}</p>
                  <h2>{service.name}</h2>
                </div>
                <StatusLabel status={service.isOpen ? 'open' : 'closed'} />
              </div>
              <p className="admin-service-description">{service.description}</p>
              <dl className="admin-service-metrics">
                <div><dt>Waiting</dt><dd>{waiting}{service.maxCapacity ? <span> / {service.maxCapacity}</span> : null}</dd></div>
                <div><dt>Visit duration</dt><dd>{service.expectedDuration}<span> min</span></dd></div>
                <div><dt>Priority</dt><dd className={`priority priority-${service.priority.toLowerCase()}`}>{service.priority.charAt(0).toUpperCase() + service.priority.slice(1).toLowerCase()}</dd></div>
              </dl>
              <div className="admin-service-location">
                <Icon name="map-pin" />
                <span>{service.location || 'Location not set'}</span>
              </div>
              {(service.hours || service.contact || service.instructions) && (
                <dl className="admin-service-details">
                  {service.hours && <div><dt>Hours</dt><dd>{service.hours}</dd></div>}
                  {service.contact && <div><dt>Contact</dt><dd>{service.contact}</dd></div>}
                  {service.instructions && <div><dt>Instructions</dt><dd>{service.instructions}</dd></div>}
                </dl>
              )}
              <div className="admin-service-actions">
                <Link to={`/admin/queues/${service.id}`} className="btn btn-secondary btn-sm">Waiting list</Link>
                <Link to={`/admin/services/${service.id}/edit`} className="btn btn-secondary btn-sm" aria-label={`Edit ${service.name}`}><Icon name="pencil" />Edit</Link>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleToggle(service)} aria-label={`${service.isOpen ? 'Close' : 'Open'} ${service.name}`}>
                  <Icon name={service.isOpen ? 'lock' : 'lock-open'} />{service.isOpen ? 'Close' : 'Open'}
                </button>
                <button type="button" className="icon-btn admin-service-delete" onClick={() => handleDelete(service)} aria-label={`Delete ${service.name}`} title="Delete service"><Icon name="trash-2" /></button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function ServiceForm({ service }) {
  const isEditing = Boolean(service);
  const navigate = useNavigate();
  const { saveService } = useQueues();
  const toast = useToast();
  const [form, setForm] = useState(() => service
    ? {
        name: service.name, description: service.description, expectedDuration: String(service.expectedDuration), priority: service.priority, isOpen: service.isOpen,
        location: service.location ?? '', contact: service.contact ?? '', hours: service.hours ?? '', category: service.category ?? 'Other',
        maxCapacity: service.maxCapacity ? String(service.maxCapacity) : '', instructions: service.instructions ?? '',
      }
    : {
        name: '', description: '', expectedDuration: '', priority: 'LOW', isOpen: true, location: '', contact: '', hours: '', category: 'Other',
        maxCapacity: '', instructions: '',
      });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const update = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm({ ...form, [field]: value });
    if (errors[field]) setErrors({ ...errors, [field]: undefined });
  };

  async function handleSubmit(event) {
    event.preventDefault();
    const found = {};
    if (!form.name.trim()) found.name = 'Enter a service name.';
    else if (form.name.trim().length > NAME_MAX) found.name = `Keep the service name to ${NAME_MAX} characters or fewer.`;
    if (!form.description.trim()) found.description = 'Enter a short description.';
    if (!form.location.trim()) found.location = 'Enter the service location.';
    const expectedDuration = Number(form.expectedDuration);
    if (!form.expectedDuration.trim()) found.expectedDuration = 'Enter the expected visit duration.';
    else if (!Number.isInteger(expectedDuration) || expectedDuration < 1) found.expectedDuration = 'Use a whole number of minutes greater than zero.';
    if (!PRIORITIES.some(([value]) => value === form.priority)) found.priority = 'Choose a priority.';
    if (!form.category.trim()) found.category = 'Choose a service category.';
    const maxCapacity = form.maxCapacity.trim() ? Number(form.maxCapacity) : null;
    if (form.maxCapacity.trim() && (!Number.isInteger(maxCapacity) || maxCapacity < 1)) found.maxCapacity = 'Use a whole number greater than zero, or leave this blank for no limit.';
    setErrors(found);
    if (Object.keys(found).length) {
      focusFirstError(found, FIELD_ORDER);
      return;
    }
    const values = {
      name: form.name.trim(), description: form.description.trim(), expectedDuration, priority: form.priority, isOpen: form.isOpen,
      location: form.location.trim(), contact: form.contact.trim(), hours: form.hours.trim(), category: form.category,
      maxCapacity, instructions: form.instructions.trim(),
    };
    setSaving(true);
    try {
      toast(await saveService(values, isEditing ? service.id : undefined));
      navigate('/admin/services');
    } catch (error) { toast(error.message); }
    finally { setSaving(false); }
  }

  return (
    <>
      <Link to="/admin/services" className="back"><Icon name="arrow-left" /> Services</Link>
      <p className="eyebrow">Administrator</p>
      <h1 id="page-title" tabIndex={-1}>{isEditing ? 'Edit service' : 'Create service'}</h1>
      <form className="panel form-panel" onSubmit={handleSubmit} noValidate>
        <p className="form-note">Set the details students use to choose a service and estimate their wait.</p>
        <div className="form-grid">
          <FormField
            id="name"
            label="Service name"
            className="form-wide"
            error={errors.name}
            counter={<span className={`counter ${form.name.length > NAME_MAX ? 'over' : ''}`}>{form.name.length}/{NAME_MAX}</span>}
          >
            <input type="text" required maxLength={NAME_MAX} value={form.name} onChange={update('name')} {...fieldProps('name', { error: errors.name })} />
          </FormField>
          <FormField id="description" label="Description" className="form-wide" error={errors.description}>
            <textarea required maxLength={DESCRIPTION_MAX} value={form.description} onChange={update('description')} {...fieldProps('description', { error: errors.description, hint: true })} />
          </FormField>
          <FormField id="expectedDuration" label="Expected duration" suffix="minutes per visit" error={errors.expectedDuration}>
            <input type="number" required min="1" step="1" inputMode="numeric" value={form.expectedDuration} onChange={update('expectedDuration')} {...fieldProps('expectedDuration', { error: errors.expectedDuration })} />
          </FormField>
          <FormField id="location" label="Location" hint="Building, room number, or virtual service details." error={errors.location}>
            <input type="text" required maxLength={LOCATION_MAX} value={form.location} onChange={update('location')} {...fieldProps('location', { error: errors.location, hint: true })} />
          </FormField>
          <div className={`field ${errors.category ? 'has-error' : ''}`}>
            <label htmlFor="category">Category</label>
            <select id="category" required aria-invalid={errors.category ? true : undefined} value={form.category} onChange={update('category')}>
              {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            </select>
            {errors.category && <FieldError id="category-err">{errors.category}</FieldError>}
          </div>
          <FormField id="hours" label="Hours of operation" error={errors.hours}>
            <input type="text" maxLength={HOURS_MAX} placeholder="Mon-Fri, 8:00 AM-5:00 PM" value={form.hours} onChange={update('hours')} {...fieldProps('hours', { error: errors.hours })} />
          </FormField>
          <FormField id="contact" label="Contact information" hint="Email address, phone number, or website." error={errors.contact}>
            <input type="text" maxLength={CONTACT_MAX} value={form.contact} onChange={update('contact')} {...fieldProps('contact', { error: errors.contact, hint: true })} />
          </FormField>
          <FormField id="maxCapacity" label="Maximum queue capacity" hint="Leave blank for no limit." error={errors.maxCapacity}>
            <input type="number" min="1" step="1" inputMode="numeric" value={form.maxCapacity} onChange={update('maxCapacity')} {...fieldProps('maxCapacity', { error: errors.maxCapacity, hint: true })} />
          </FormField>
          <FormField id="instructions" label="Additional instructions" className="form-wide" hint="Tell students what to bring or do before joining." error={errors.instructions}>
            <textarea maxLength={INSTRUCTIONS_MAX} value={form.instructions} onChange={update('instructions')} {...fieldProps('instructions', { error: errors.instructions, hint: true })} />
          </FormField>
          <fieldset className={`field form-wide ${errors.priority ? 'has-error' : ''}`}>
            <legend>Priority</legend>
            <div className="radio-seg">
              {PRIORITIES.map(([value, label]) => (
                <label key={value}>
                  <input type="radio" name="priority" value={value} checked={form.priority === value} onChange={update('priority')} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            {errors.priority && <FieldError id="priority-err">{errors.priority}</FieldError>}
          </fieldset>
        </div>
        {!isEditing && (
          <label className="check">
            <input type="checkbox" checked={form.isOpen} onChange={update('isOpen')} />
            Open for new visitors right away
          </label>
        )}
        <div className="form-actions">
          <button type="submit" disabled={saving} className="btn btn-primary">{isEditing ? 'Save changes' : 'Create service'}</button>
          <Link to="/admin/services" className="btn btn-secondary">Cancel</Link>
        </div>
      </form>
    </>
  );
}
