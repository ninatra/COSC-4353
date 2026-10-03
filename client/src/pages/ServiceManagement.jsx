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
const FIELD_ORDER = ['name', 'desc', 'duration', 'location', 'category', 'hours', 'contact', 'maxCapacity'];
const PRIORITIES = [
  ['low', 'Low'],
  ['medium', 'Medium'],
  ['high', 'High'],
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

  async function handleDelete(service) {
    const waiting = queueOf(state, service.id).length;
    const ok = await confirm({
      title: `Delete ${service.name}?`,
      body: waiting ? `${service.name} has ${waiting} people waiting. Close or clear its queue before deleting it.` : 'This removes the service from the catalog permanently.',
      confirmLabel: waiting ? 'Keep service' : 'Delete service',
      danger: !waiting,
    });
    if (!ok || waiting) return;
    toast(deleteService(service.id));
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
            <li key={service.id}>
              <ServiceTile service={service} />
              <div>
                <h2>{service.name}</h2>
                <p className="desc">{service.desc}</p>
                <div className="meta service-summary">
                  <StatusLabel status={service.open ? 'open' : 'closed'} />
                  <span>{service.duration} min per visit</span>
                  <span>{waiting} {waiting === 1 ? 'person' : 'people'} waiting</span>
                  <span className={`priority priority-${service.priority}`}>{service.priority} priority</span>
                </div>
                <div className="service-meta">
                  {service.location && <span><strong>Location:</strong> {service.location}</span>}
                  {service.contact && <span><strong>Contact:</strong> {service.contact}</span>}
                  {service.hours && <span><strong>Hours:</strong> {service.hours}</span>}
                  {service.category && <span><strong>Category:</strong> {service.category}</span>}
                  {service.maxCapacity && <span><strong>Capacity:</strong> {service.maxCapacity}</span>}
                  {service.instructions && <span><strong>Instructions:</strong> {service.instructions}</span>}
                </div>
              </div>
              <div className="btn-row">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleToggle(service)}>
                  <Icon name={service.open ? 'lock' : 'lock-open'} />
                  {service.open ? 'Close' : 'Open'}
                </button>
                <Link to={`/admin/services/${service.id}/edit`} className="btn btn-secondary btn-sm">
                  <Icon name="pencil" />
                  Edit
                </Link>
                <Link to={`/admin/queues/${service.id}`} className="btn btn-secondary btn-sm">
                  Waiting list
                </Link>
                <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => handleDelete(service)}>
                  Delete
                </button>
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
        name: service.name, desc: service.desc, duration: String(service.duration), priority: service.priority, open: service.open,
        location: service.location ?? '', contact: service.contact ?? '', hours: service.hours ?? '', category: service.category ?? 'Other',
        maxCapacity: service.maxCapacity ? String(service.maxCapacity) : '', instructions: service.instructions ?? '',
      }
    : {
        name: '', desc: '', duration: '', priority: 'low', open: true, location: '', contact: '', hours: '', category: 'Other',
        maxCapacity: '', instructions: '',
      });
  const [errors, setErrors] = useState({});

  const update = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm({ ...form, [field]: value });
    if (errors[field]) setErrors({ ...errors, [field]: undefined });
  };

  function handleSubmit(event) {
    event.preventDefault();
    const found = {};
    if (!form.name.trim()) found.name = 'Enter a service name.';
    else if (form.name.trim().length > NAME_MAX) found.name = `Keep the service name to ${NAME_MAX} characters or fewer.`;
    if (!form.desc.trim()) found.desc = 'Enter a short description.';
    if (!form.location.trim()) found.location = 'Enter the service location.';
    const duration = Number(form.duration);
    if (!form.duration.trim()) found.duration = 'Enter the expected visit duration.';
    else if (!Number.isInteger(duration) || duration < 1) found.duration = 'Use a whole number of minutes greater than zero.';
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
      name: form.name.trim(), desc: form.desc.trim(), duration, priority: form.priority, open: form.open,
      location: form.location.trim(), contact: form.contact.trim(), hours: form.hours.trim(), category: form.category,
      maxCapacity, instructions: form.instructions.trim(),
    };
    toast(isEditing ? saveService(values, service.id) : saveService(values));
    navigate('/admin/services');
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
          <FormField id="desc" label="Description" className="form-wide" error={errors.desc}>
            <textarea required maxLength={DESCRIPTION_MAX} value={form.desc} onChange={update('desc')} {...fieldProps('desc', { error: errors.desc, hint: true })} />
          </FormField>
          <FormField id="duration" label="Expected duration" suffix="minutes per visit" error={errors.duration}>
            <input type="number" required min="1" step="1" inputMode="numeric" value={form.duration} onChange={update('duration')} {...fieldProps('duration', { error: errors.duration })} />
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
            <input type="checkbox" checked={form.open} onChange={update('open')} />
            Open for new visitors right away
          </label>
        )}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">{isEditing ? 'Save changes' : 'Create service'}</button>
          <Link to="/admin/services" className="btn btn-secondary">Cancel</Link>
        </div>
      </form>
    </>
  );
}
