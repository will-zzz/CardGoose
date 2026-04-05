import jwt from 'jsonwebtoken';

const SECRET = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
  return s;
};

export interface TokenPayload {
  sub: string;
  username: string;
}

export function signToken(payload: TokenPayload, expiresIn: jwt.SignOptions['expiresIn'] = '7d'): string {
  return jwt.sign(
    { sub: payload.sub, username: payload.username },
    SECRET(),
    { expiresIn },
  );
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, SECRET()) as jwt.JwtPayload & { username?: string };
  const sub = decoded.sub;
  const username = decoded.username;
  if (typeof sub !== 'string' || typeof username !== 'string') {
    throw new Error('Invalid token payload');
  }
  return { sub, username };
}
