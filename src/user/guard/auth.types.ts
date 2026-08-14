import { Role } from '../roles';

export interface AuthenticatedUser {
  _id: string;
  email: string;
  role: Role;
}

export interface RefreshTokenPayload extends AuthenticatedUser {
  countEX: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};