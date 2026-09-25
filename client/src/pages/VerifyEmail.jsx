import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';

export default function VerifyEmail() {
  const { token } = useParams();
  const [status, setStatus] = useState({ state: 'loading' });

  useEffect(() => {
    api(`/auth/verify/${token}`)
      .then(() => setStatus({ state: 'done' }))
      .catch((err) => setStatus({ state: 'error', message: err.message }));
  }, [token]);

  return (
    <div className="card auth-card">
      <h1>Email verification</h1>
      {status.state === 'loading' && <p>Verifying…</p>}
      {status.state === 'done' && <p>Your email is verified. You can close this page.</p>}
      {status.state === 'error' && <p className="error">{status.message}</p>}
      <Link to="/">Go to QueueSmart</Link>
    </div>
  );
}
