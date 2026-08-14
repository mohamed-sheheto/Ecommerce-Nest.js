import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../guard/auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const user = ctx.switchToHttp().getRequest<Request>().user;
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  },
);