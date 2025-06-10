import { test, expect } from '@playwright/test';
import { sha1 } from '../../src/util/hash';

test.describe('hash', () => {
  test('sha1 should produce the correct hash for a known string', () => {
    const input = 'hello';
    const expectedHash = 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d'; // sha1('hello')
    expect(sha1(input)).toBe(expectedHash);
  });
}); 