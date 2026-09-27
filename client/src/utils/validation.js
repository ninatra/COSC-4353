// Client-side form checks. Each returns { field: 'message' } for invalid fields;
// an empty object means the form is valid. Whitespace-only counts as empty.

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const NAME_MAX = 50;
export const PASSWORD_MIN = 8;

function checkEmail(email) {
  if (!email.trim()) return 'Enter your email address.';
  if (!EMAIL_PATTERN.test(email.trim())) return 'Enter a valid email address, like name@school.edu.';
  return undefined;
}

export function validateLogin({ email, password }) {
  const errors = {};
  const emailError = checkEmail(email);
  if (emailError) errors.email = emailError;
  if (!password.trim()) errors.password = 'Enter your password.';
  return errors;
}

export function validateRegister({ name, email, password, confirmPassword, role, adminCode }) {
  const errors = {};
  if (!name.trim()) errors.name = 'Enter your full name.';
  else if (name.trim().length > NAME_MAX) errors.name = `Keep your name to ${NAME_MAX} characters or fewer.`;

  const emailError = checkEmail(email);
  if (emailError) errors.email = emailError;

  if (!password.trim()) errors.password = 'Enter a password.';
  else if (password.length < PASSWORD_MIN)
    errors.password = `Use at least ${PASSWORD_MIN} characters. This one has ${password.length}.`;

  if (!confirmPassword) errors.confirmPassword = 'Enter your password again.';
  else if (confirmPassword !== password) errors.confirmPassword = "The passwords don't match.";

  if (role === 'ADMIN' && !adminCode.trim()) errors.adminCode = 'Enter the administrator code.';
  return errors;
}

// Focuses the first invalid field, in the order the fields appear.
export function focusFirstError(errors, order) {
  const first = order.find((field) => errors[field]);
  if (first) document.getElementById(first)?.focus();
}
