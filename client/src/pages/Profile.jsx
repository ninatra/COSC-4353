import { useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import FormField, { FieldError, fieldProps } from '../components/FormField.jsx';
import { useToast } from '../components/Toast.jsx';
import { focusFirstError, NAME_MAX, PHONE_MAX, validateProfile } from '../utils/validation.js';

// The signed-in user's profile (UserProfile table): name, phone and alert preference.
export default function Profile() {
  const { user, updateProfile } = useAuth();
  const toast = useToast();
  const isAdmin = user.role === 'ADMIN';
  const [form, setForm] = useState({
    fullName: user.name ?? '',
    phone: user.phone ?? '',
    almostReadyAlerts: user.almostReadyAlerts ?? true,
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  const update = (field) => (event) => {
    setForm({ ...form, [field]: event.target.value });
    if (errors[field]) setErrors({ ...errors, [field]: undefined });
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setServerError('');
    const found = validateProfile(form);
    setErrors(found);
    if (Object.keys(found).length) {
      focusFirstError(found, ['fullName', 'phone']);
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ fullName: form.fullName.trim(), phone: form.phone.trim() || null, almostReadyAlerts: form.almostReadyAlerts });
      toast('Profile saved');
    } catch (error) {
      setServerError(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <p className="eyebrow">{isAdmin ? 'Administrator' : 'Account'}</p>
      <h1 id="page-title" tabIndex={-1}>
        Profile
      </h1>
      <p className="lead">Your name and contact details. Your email is your username and can't be changed here.</p>

      <form className="panel form-panel profile-panel" onSubmit={handleSubmit} noValidate>
        {serverError && (
          <div role="alert" className="form-alert">
            <FieldError>{serverError}</FieldError>
          </div>
        )}
        <FormField id="email" label="Email">
          <input type="email" value={user.email} readOnly {...fieldProps('email')} />
        </FormField>
        <FormField
          id="fullName"
          label="Full name"
          error={errors.fullName}
          counter={<span className="counter">{form.fullName.trim().length}/{NAME_MAX}</span>}
        >
          <input type="text" autoComplete="name" value={form.fullName} onChange={update('fullName')} {...fieldProps('fullName', { error: errors.fullName })} />
        </FormField>
        <FormField id="phone" label="Phone (optional)" hint="Staff can use this if they need to reach you about a visit." error={errors.phone}>
          <input
            type="tel"
            autoComplete="tel"
            maxLength={PHONE_MAX}
            placeholder="713-555-0100"
            value={form.phone}
            onChange={update('phone')}
            {...fieldProps('phone', { error: errors.phone, hint: true })}
          />
        </FormField>
        {!isAdmin && (
          <label className="check">
            <input
              type="checkbox"
              checked={form.almostReadyAlerts}
              onChange={(event) => setForm({ ...form, almostReadyAlerts: event.target.checked })}
            />
            Notify me when I'm almost up or next in line
          </label>
        )}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </form>
    </>
  );
}
