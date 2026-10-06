import { describe, expect, it } from 'vitest';
import { checkMessage, firstInvalid } from './contact';

const ok = { name: 'Ada', email: 'ada@example.com', subject: '', message: 'Hello there, Tilak.' };

describe('the contact form’s checks', () => {
  it('passes a message with a name and enough to say', () => {
    expect(checkMessage(ok)).toEqual({});
    expect(checkMessage({ ...ok, email: '' })).toEqual({});
  });
  it('says what’s wrong with each field', () => {
    expect(checkMessage({ name: ' ', email: 'ada@', subject: '', message: 'hi' })).toEqual({
      name: 'Enter your name.',
      email: 'Check the email address. It looks incomplete.',
      message: 'Write a little more: at least 10 characters.',
    });
  });
  it('picks the first field that’s wrong, in the form’s order', () => {
    expect(firstInvalid({ message: 'x', email: 'y' })).toBe('email');
    expect(firstInvalid({ message: 'x' })).toBe('message');
    expect(firstInvalid({})).toBeNull();
  });
});
