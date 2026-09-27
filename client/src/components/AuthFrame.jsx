import { SampleTicket } from './QueueTicket.jsx';
import { ThemeButton, Wordmark } from './AppShell.jsx';

// Shared frame for sign in and registration: the form panel plus an example ticket.
export default function AuthFrame({ title, children, footer }) {
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <main id="main" className="wrap">
        <div className="auth-grid">
          <div>
            <div className="auth-top">
              <Wordmark />
              <ThemeButton />
            </div>
            <div className="panel auth-panel">
              <h1 id="page-title" tabIndex={-1}>
                {title}
              </h1>
              {children}
              <p className="auth-switch">{footer}</p>
              <p className="demo-flag">
                <span className="mono">DEMO</span>
                <span>
                  Try <strong>user@queuesmart.dev</strong> or <strong>admin@queuesmart.dev</strong> with password{' '}
                  <strong>password123</strong>. Queue data is sample data saved only in this browser.
                </span>
              </p>
            </div>
          </div>
          <div className="auth-preview-wrap" aria-hidden="true">
            <div className="auth-preview">
              <SampleTicket />
            </div>
            <p className="auth-preview-cap">Join a line from your phone, then see your place and wait right here.</p>
          </div>
        </div>
      </main>
    </>
  );
}
