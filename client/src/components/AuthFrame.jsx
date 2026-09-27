import { SampleTicket } from './QueueTicket.jsx';
import { ThemeButton, Wordmark } from './AppShell.jsx';

// Sample tickets scattered behind the example ticket: [id, service, tint, left %, top %, rotation]
const STUBS = [
  ['AA-014', 'Academic Advising', 'lilac', 5, 5, -12],
  ['SS-039', 'Student Services', 'peach', 64, 3, 10],
  ['SS-040', 'Student Services', 'lilac', 86, 40, 16],
  ['IT-021', 'IT Help Desk', 'mint', 70, 84, -8],
  ['AA-013', 'Academic Advising', 'sun', 3, 86, 8],
  ['IT-025', 'IT Help Desk', 'blue', 38, 93, -4],
];

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
            <div className="auth-art">
              {STUBS.map(([id, service, tint, left, top, rotate]) => (
                <div
                  key={id}
                  className={`stub tint-${tint}`}
                  style={{ left: `${left}%`, top: `${top}%`, transform: `rotate(${rotate}deg)` }}
                >
                  <span className="mono">{id}</span>
                  {service}
                </div>
              ))}
            </div>
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
