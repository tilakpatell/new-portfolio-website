import { describe, expect, it } from 'vitest';
import { listen, news, say } from './lifeNews';

describe('lifeNews', () => {
  it('keeps the last line and tells who listens', () => {
    let heard = 0;
    const off = listen(() => heard++);
    say('Patrol inbound');
    expect(news().text).toBe('Patrol inbound');
    expect(heard).toBe(1);
    off();
    say('again');
    expect(heard).toBe(1);
  });
});
