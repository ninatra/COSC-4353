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
    <main id="main" className="wrap page">
      <div className="panel verify-panel">
        <h1 id="page-title" tabIndex={-1}>
          Email verification
        </h1>
        {status.state === 'loading' && <p>Verifying…</p>}
        {status.state === 'done' && <p>Your email is verified. You can close this page.</p>}
        {status.state === 'error' && (
          <p className="error" role="alert">
            {status.message}
          </p>
        )}
        <Link to="/" className="link-arrow">
          Go to QueueSmart<span aria-hidden="true">&nbsp;→</span>
        </Link>
      </div>
    </main>
  );
}
