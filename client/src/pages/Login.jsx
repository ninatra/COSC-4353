import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import AuthFrame from '../components/AuthFrame.jsx';
import FormField, { FieldError, fieldProps } from '../components/FormField.jsx';
import { homePath } from '../components/ProtectedRoute.jsx';
import { focusFirstError, validateLogin } from '../utils/validation.js';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
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
    const found = validateLogin(form);
    setErrors(found);
    if (Object.keys(found).length) {
      focusFirstError(found, ['email', 'password']);
      return;
    }
    setSubmitting(true);
    try {
      const loggedIn = await login(form.email.trim(), form.password);
      navigate(homePath(loggedIn));
    } catch (err) {
      setServerError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthFrame
      title="Welcome back"
      footer={
        <>
          New to QueueSmart? <Link to="/register">Create an account</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        {serverError && (
          <div role="alert" className="form-alert">
            <FieldError>{serverError}</FieldError>
          </div>
        )}
        <FormField id="email" label="Email" error={errors.email}>
          <input
            type="email"
            autoComplete="email"
            placeholder="name@school.edu"
            value={form.email}
            onChange={update('email')}
            {...fieldProps('email', { error: errors.email })}
          />
        </FormField>
        <FormField id="password" label="Password" error={errors.password}>
          <input
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={update('password')}
            {...fieldProps('password', { error: errors.password })}
          />
        </FormField>
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthFrame>
  );
}
