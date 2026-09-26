import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import AuthLayout from '../components/AuthLayout.jsx';
import FormField, { errorProps } from '../components/FormField.jsx';
import { homePath } from '../components/ProtectedRoute.jsx';
import { validateLogin } from '../utils/validation.js';

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
    if (Object.keys(found).length > 0) return;

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
    <AuthLayout>
      <form className="card auth-card" onSubmit={handleSubmit} noValidate>
        <h1>Log in</h1>
        {serverError && <p className="error" role="alert">{serverError}</p>}
        <FormField label="Email" id="email" error={errors.email}>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={update('email')}
            {...errorProps('email', errors.email)}
          />
        </FormField>
        <FormField label="Password" id="password" error={errors.password}>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={update('password')}
            {...errorProps('password', errors.password)}
          />
        </FormField>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
        <p className="muted">
          No account? <Link to="/register">Register</Link>
        </p>
        <p className="demo-hint">
          Demo accounts: <strong>user@queuesmart.dev</strong> or <strong>admin@queuesmart.dev</strong>,
          password <strong>password123</strong>
        </p>
      </form>
    </AuthLayout>
  );
}
