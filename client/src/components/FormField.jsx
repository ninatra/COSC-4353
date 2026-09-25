// A labelled input with an error message underneath.
export default function FormField({ label, hint, error, id, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label} {hint && <span className="muted">{hint}</span>}
      </label>
      {children}
      {error && (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

// Props to spread on the input so screen readers announce the error.
export function errorProps(id, error) {
  return error ? { 'aria-invalid': true, 'aria-describedby': `${id}-error` } : {};
}
