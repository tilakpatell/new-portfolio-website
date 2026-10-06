// The contact form's checks (pages/Contact.jsx): what's wrong with each
// field, and the first of them in the form's order (where focus goes).

export const FIELDS = ['name', 'email', 'subject', 'message'];

export function checkMessage(form) {
  const e = {};
  if (!form.name.trim()) e.name = 'Enter your name.';
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Check the email address. It looks incomplete.';
  if (form.message.trim().length < 10) e.message = 'Write a little more: at least 10 characters.';
  return e;
}

export const firstInvalid = (errors) => FIELDS.find((f) => errors[f]) ?? null;
