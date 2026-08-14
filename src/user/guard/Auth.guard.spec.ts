import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AuthGuard } from './Auth.guard';
import { Roles } from '../decorator/Roles.decorator';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let jwtService: { verifyAsync: jest.Mock };
  let reflector: { get: jest.Mock };

  const makeContext = (token?: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: token ? `Bearer ${token}` : undefined },
        }),
      }),
      getHandler: () => ({}),
    }) as unknown as Parameters<AuthGuard['canActivate']>[0];

  beforeEach(async () => {
    jwtService = { verifyAsync: jest.fn() };
    reflector = { get: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        AuthGuard,
        { provide: JwtService, useValue: jwtService },
        { provide: Reflector, useValue: reflector },
      ],
    }).compile();

    guard = module.get(AuthGuard);
  });

  it('lets public routes through without a token', async () => {
    reflector.get.mockReturnValue(undefined);

    await expect(guard.canActivate(makeContext())).resolves.toBe(true);
  });

  it('rejects a missing token on protected routes', async () => {
    reflector.get.mockReturnValue(['user']);

    await expect(guard.canActivate(makeContext())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an invalid token', async () => {
    reflector.get.mockReturnValue(['user']);
    jwtService.verifyAsync.mockRejectedValue(new Error('expired'));

    await expect(guard.canActivate(makeContext('bad.token.here'))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token without a payload', async () => {
    reflector.get.mockReturnValue(['user']);
    jwtService.verifyAsync.mockResolvedValue(undefined);

    await expect(guard.canActivate(makeContext('valid.token'))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('forbids an authenticated user with the wrong role (403, not 401)', async () => {
    reflector.get.mockReturnValue(['admin']);
    jwtService.verifyAsync.mockResolvedValue({
      _id: 'u1',
      email: 'user@example.com',
      role: 'user',
    });

    await expect(guard.canActivate(makeContext('valid.token'))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('does not let an admin bypass a user-only route', async () => {
    reflector.get.mockReturnValue(['user']);
    jwtService.verifyAsync.mockResolvedValue({
      _id: 'a1',
      email: 'admin@example.com',
      role: 'admin',
    });

    await expect(guard.canActivate(makeContext('valid.token'))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('attaches the typed user to the request on success', async () => {
    reflector.get.mockReturnValue(['user']);
    const payload = {
      _id: 'u1',
      email: 'user@example.com',
      role: 'user',
    };
    jwtService.verifyAsync.mockResolvedValue(payload);

    const request = {
      headers: { authorization: 'Bearer valid.token' },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
    } as unknown as Parameters<AuthGuard['canActivate']>[0];

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request).toHaveProperty('user', payload);
  });

  it('reads the required roles via the Roles decorator key', async () => {
    reflector.get.mockReturnValue(['user']);
    jwtService.verifyAsync.mockResolvedValue({
      _id: 'u1',
      email: 'user@example.com',
      role: 'user',
    });

    await guard.canActivate(makeContext('valid.token'));

    expect(reflector.get).toHaveBeenCalledWith(Roles, expect.anything());
  });
});