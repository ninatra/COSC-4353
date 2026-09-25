// Client-side form checks. Each returns an object of { field: message } for
// the fields that are invalid; an empty object means the form is valid.

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const NAME_MAX = 50;
export const PASSWORD_MIN = 8;

export function validateLogin({ email, password }) {
  const errors = {};
  if (!email.trim()) errors.email = 'Email is required.';
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Enter a valid email address.';
  if (!password) errors.password = 'Password is required.';
  return errors;
}

export function validateRegister({ name, email, password, confirmPassword, role, adminCode }) {
  const errors = {};
  if (!name.trim()) errors.name = 'Full name is required.';
  else if (name.trim().length > NAME_MAX) errors.name = `Name must be ${NAME_MAX} characters or fewer.`;

  if (!email.trim()) errors.email = 'Email is required.';
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Enter a valid email address.';

  if (!password) errors.password = 'Password is required.';
  else if (password.length < PASSWORD_MIN) errors.password = `Password must be at least ${PASSWORD_MIN} characters.`;
  else if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
    errors.password = 'Password must include at least one letter and one number.';

  if (!confirmPassword) errors.confirmPassword = 'Please confirm your password.';
  else if (confirmPassword !== password) errors.confirmPassword = 'Passwords do not match.';

  if (role === 'ADMIN' && !adminCode.trim()) errors.adminCode = 'Administrator code is required.';
  return errors;
}
