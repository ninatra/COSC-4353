import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import FormField, { errorProps } from '../components/FormField.jsx';
import { homePath } from '../components/ProtectedRoute.jsx';
import { NAME_MAX, PASSWORD_MIN, validateRegister } from '../utils/validation.js';

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'USER',
    adminCode: '',
  });
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
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      const { confirmPassword, ...payload } = form;
      const created = await register({ ...payload, name: form.name.trim(), email: form.email.trim() });
      navigate(homePath(created));
    } catch (err) {
      setServerError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card auth-card" onSubmit={handleSubmit} noValidate>
      <h1>Create an account</h1>
      {serverError && <p className="error" role="alert">{serverError}</p>}
      <FormField label="Full name" id="name" error={errors.name}>
        <input
          id="name"
          autoComplete="name"
          maxLength={NAME_MAX}
          value={form.name}
          onChange={update('name')}
          {...errorProps('name', errors.name)}
        />
      </FormField>
      <FormField label="Email" hint="(this is your username)" id="email" error={errors.email}>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={update('email')}
          {...errorProps('email', errors.email)}
        />
      </FormField>
      <FormField
        label="Password"
        hint={`(at least ${PASSWORD_MIN} characters, with a letter and a number)`}
        id="password"
        error={errors.password}
      >
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={update('password')}
          {...errorProps('password', errors.password)}
        />
      </FormField>
      <FormField label="Confirm password" id="confirmPassword" error={errors.confirmPassword}>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={update('confirmPassword')}
          {...errorProps('confirmPassword', errors.confirmPassword)}
        />
      </FormField>
      <FormField label="Account type" id="role">
        <select id="role" value={form.role} onChange={update('role')}>
          <option value="USER">User (join queues)</option>
          <option value="ADMIN">Administrator (manage services)</option>
        </select>
      </FormField>
      {form.role === 'ADMIN' && (
        <FormField label="Administrator code" id="adminCode" error={errors.adminCode}>
          <input
            id="adminCode"
            value={form.adminCode}
            onChange={update('adminCode')}
            {...errorProps('adminCode', errors.adminCode)}
          />
        </FormField>
      )}
      <button type="submit" disabled={submitting}>
        {submitting ? 'Creating account…' : 'Register'}
      </button>
      <p className="muted">
        Already registered? <Link to="/login">Log in</Link>
      </p>
    </form>
  );
}
