import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import AuthFrame from '../components/AuthFrame.jsx';
import FormField, { FieldError, fieldProps } from '../components/FormField.jsx';
import { homePath } from '../components/ProtectedRoute.jsx';
import { useToast } from '../components/Toast.jsx';
import { focusFirstError, NAME_MAX, PASSWORD_MIN, validateRegister } from '../utils/validation.js';

const FIELD_ORDER = ['name', 'email', 'password', 'confirmPassword', 'adminCode'];

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', role: 'USER', adminCode: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={homePath(user)} replace />;

  const update = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
    if (errors[field]) setErrors({ ...errors, [field]: undefined });
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError('');
    const found = validateRegister(form);
    setErrors(found);
    if (Object.keys(found).length) {
      focusFirstError(found, FIELD_ORDER);
      return;
    }
    setSubmitting(true);
    try {
      const { confirmPassword, ...payload } = form;
      const created = await register({ ...payload, name: form.name.trim(), email: form.email.trim() });
      toast('Account created');
      navigate(homePath(created));
    } catch (err) {
      setServerError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const passwordHint = `At least ${PASSWORD_MIN} characters.`;

  return (
    <AuthFrame
      title="Create an account"
      footer={
        <>
          Already have an account? <Link to="/login">Sign in</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        {serverError && (
          <div role="alert" className="form-alert">
            <FieldError>{serverError}</FieldError>
          </div>
        )}
        <FormField id="name" label="Full name" error={errors.name}>
          <input autoComplete="name" maxLength={NAME_MAX} value={form.name} onChange={update('name')} {...fieldProps('name', { error: errors.name })} />
        </FormField>
        <FormField id="email" label="Email" hint="This is your username." error={errors.email}>
          <input
            type="email"
            autoComplete="email"
            placeholder="name@school.edu"
            value={form.email}
            onChange={update('email')}
            {...fieldProps('email', { error: errors.email, hint: true })}
          />
        </FormField>
        <FormField id="password" label="Password" hint={passwordHint} error={errors.password}>
          <input
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={update('password')}
            {...fieldProps('password', { error: errors.password, hint: true })}
          />
        </FormField>
        <FormField id="confirmPassword" label="Confirm password" error={errors.confirmPassword}>
          <input
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={update('confirmPassword')}
            {...fieldProps('confirmPassword', { error: errors.confirmPassword })}
          />
        </FormField>
        <fieldset className="field">
          <legend>Account type</legend>
          <div className="radio-seg">
            {[
              ['USER', 'User'],
              ['ADMIN', 'Administrator'],
            ].map(([value, label]) => (
              <label key={value}>
                <input type="radio" name="role" value={value} checked={form.role === value} onChange={update('role')} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {form.role === 'ADMIN' && (
          <FormField id="adminCode" label="Administrator code" error={errors.adminCode}>
            <input value={form.adminCode} onChange={update('adminCode')} {...fieldProps('adminCode', { error: errors.adminCode })} />
          </FormField>
        )}
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthFrame>
  );
}
