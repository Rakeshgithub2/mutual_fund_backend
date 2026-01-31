import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

export const generateAccessToken = (payload: { id: string; email: string; role: string }): string => {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '15m' });
};

export const generateRefreshToken = (payload: { id: string }): string => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' });
};

export const verifyRefreshToken = (token: string): { id: string } => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as { id: string };
};