import { describe, it, expect } from 'vitest';
import { calculateMomentum } from '../src/core/momentum';
import { sanitizeHtml } from '../src/core/sanitize';
import { validateThreadCreation, validatePostCreation, ValidationError } from '../src/core/validation';

describe('Core Logic Tests', () => {
  describe('calculateMomentum', () => {
    it('calculates momentum correctly', () => {
      const now = Date.now();
      const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
      // 100 res in 1 day = 100 momentum
      expect(calculateMomentum(100, oneDayAgo)).toBe(100);
    });

    it('handles zero division protection (under 0.01 days)', () => {
      const now = new Date().toISOString();
      // 10 res in < 0.01 days -> uses 0.01 days -> 10 / 0.01 = 1000
      expect(calculateMomentum(10, now)).toBe(1000);
    });
  });

  describe('sanitizeHtml', () => {
    it('sanitizes malicious tags', () => {
      const input = '<script>alert("XSS")</script>&\'';
      const output = sanitizeHtml(input);
      expect(output).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;&amp;&#x27;');
    });

    it('keeps newlines', () => {
      const input = 'hello\nworld';
      const output = sanitizeHtml(input);
      expect(output).toBe('hello\nworld');
    });
  });

  describe('validation', () => {
    it('validates thread creation properly', () => {
      expect(() => validateThreadCreation({ title: 'A', body: 'B' })).not.toThrow();
    });

    it('throws on overly long title', () => {
      const longTitle = 'a'.repeat(61);
      expect(() => validateThreadCreation({ title: longTitle, body: 'B' })).toThrow(ValidationError);
    });

    it('throws on missing body', () => {
      expect(() => validateThreadCreation({ title: 'A' })).toThrow(ValidationError);
    });
  });
});
