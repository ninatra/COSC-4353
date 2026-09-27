import Icon from './Icon.jsx';

// A labelled field with an optional hint, counter and inline error.
// Pass the input as children and spread fieldProps(id, { error, hint }) on it
// so screen readers link the hint and error to the input.
export default function FormField({ id, label, hint, error, counter, suffix, children }) {
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <div className="label-row">
        <label htmlFor={id}>{label}</label>
        {counter}
      </div>
      {hint && (
        <p className="hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {suffix ? (
        <div className="suffix">
          {children}
          <span>{suffix}</span>
        </div>
      ) : (
        children
      )}
      {error && <FieldError id={`${id}-err`}>{error}</FieldError>}
    </div>
  );
}

export function FieldError({ id, children }) {
  return (
    <p className="error" id={id}>
      <Icon name="circle-alert" />
      {children}
    </p>
  );
}

export function fieldProps(id, { error, hint } = {}) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(' ');
  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy || undefined,
  };
}
