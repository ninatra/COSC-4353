const POINTS = [
  'See your place in line and your estimated wait.',
  "Get a notification when you're almost up.",
  'Staff call people forward and manage every queue from one screen.',
];

// Two-panel frame for the login and registration forms.
export default function AuthLayout({ children }) {
  return (
    <div className="auth-layout">
      <aside className="auth-aside">
        <span className="board-label">QueueSmart</span>
        <h2>Wait anywhere. We'll tell you when it's your turn.</h2>
        <ul className="auth-points">
          {POINTS.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </aside>
      {children}
    </div>
  );
}
