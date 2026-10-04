import { describe, expect, it } from 'vitest';
import { browserFor, STEPS } from './accel';

const UA = {
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
  opera: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 OPR/114.0.0.0',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
  safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
};

describe('which browser to explain hardware acceleration for', () => {
  it('tells the Chromium family apart', () => {
    expect(browserFor(UA.chrome)).toBe('chrome');
    expect(browserFor(UA.edge)).toBe('edge');
    expect(browserFor(UA.opera)).toBe('opera');
    expect(browserFor(UA.chrome, { brave: true })).toBe('brave');
  });

  it('knows Firefox and Safari', () => {
    expect(browserFor(UA.firefox)).toBe('firefox');
    expect(browserFor(UA.safari)).toBe('safari');
  });

  it('treats every browser on an iPhone or iPad as iOS, since they all draw with WebKit', () => {
    expect(browserFor(UA.ios)).toBe('ios');
    expect(browserFor(UA.safari, { touchMac: true })).toBe('ios');
  });

  it('falls back to general advice for anything else', () => {
    expect(browserFor(UA.samsung)).toBe('other');
    expect(browserFor('')).toBe('other');
    expect(browserFor(undefined)).toBe('other');
  });

  it('has steps for every browser it can name', () => {
    for (const id of ['chrome', 'edge', 'brave', 'opera', 'firefox', 'safari', 'ios', 'other']) {
      expect(STEPS[id].name).toBeTruthy();
      expect(STEPS[id].steps.length).toBeGreaterThan(0);
    }
  });
});
