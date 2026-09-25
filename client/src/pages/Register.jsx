import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { homePath } from '../components/ProtectedRoute.jsx';

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'USER',
    adminCode: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={homePath(user)} replace />;

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const created = await register(form);
      navigate(homePath(created));
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card auth-card" onSubmit={handleSubmit}>
      <h1>Create an account</h1>
      {error && <p className="error">{error}</p>}
      <label>
        Full name
        <input value={form.name} onChange={update('name')} required />
      </label>
      <label>
        Email
        <input type="email" value={form.email} onChange={update('email')} required />
      </label>
      <label>
        Password <span className="muted">(at least 8 characters)</span>
        <input
          type="password"
          value={form.password}
          onChange={update('password')}
          minLength={8}
          required
        />
      </label>
      <label>
        Account type
        <select value={form.role} onChange={update('role')}>
          <option value="USER">User – join queues</option>
          <option value="ADMIN">Administrator – manage services</option>
        </select>
      </label>
      {form.role === 'ADMIN' && (
        <label>
          Administrator code
          <input value={form.adminCode} onChange={update('adminCode')} required />
        </label>
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
