import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { signToken, verifyToken } from './jwt.js';

describe('jwt', () => {
  it('round-trips payload', () => {
    const t = signToken({ sub: 'id1', username: 'u@x.com' });
    expect(verifyToken(t)).toEqual({ sub: 'id1', username: 'u@x.com' });
  });

  it('rejects tampered token', () => {
    const t = signToken({ sub: 'id1', username: 'u@x.com' });
    const bad = `${t.slice(0, -4)}xxxx`;
    expect(() => verifyToken(bad)).toThrow();
  });

  it('rejects token with wrong shape', () => {
    const t = jwt.sign({ sub: 'only' }, process.env.JWT_SECRET!);
    expect(() => verifyToken(t)).toThrow('Invalid token payload');
  });
});
