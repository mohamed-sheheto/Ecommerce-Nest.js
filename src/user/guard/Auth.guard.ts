import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { Roles } from '../decorator/Roles.decorator';
import { env } from '../../config/env';
import { AuthenticatedUser } from './auth.types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);
    const roles = this.reflector.get(Roles, context.getHandler());

    if (!roles) {
      return true;
    }

    if (!token) {
      throw new UnauthorizedException();
    }

    const payload = await this.jwtService
      .verifyAsync<AuthenticatedUser>(token, { secret: env.JWT_SECRET })
      .catch(() => {
        throw new UnauthorizedException();
      });

    if (!payload || !payload._id || !payload.role) {
      throw new UnauthorizedException();
    }

    if (!roles.includes(payload.role)) {
      throw new ForbiddenException();
    }

    request.user = payload;
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}