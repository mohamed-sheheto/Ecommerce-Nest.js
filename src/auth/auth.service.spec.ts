import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MailerService } from '@nestjs-modules/mailer';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User } from 'src/user/user.schema';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const bcryptMock = bcrypt as unknown as {
  hash: jest.Mock;
  compare: jest.Mock;
};

describe('AuthService', () => {
  let service: AuthService;
  let userModel: {
    findOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
    create: jest.Mock;
    updateOne: jest.Mock;
  };
  let mailService: { sendMail: jest.Mock };

  const baseUser = {
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    name: 'Test User',
    email: 'test@example.com',
    role: 'user',
  };

  beforeEach(async () => {
    userModel = {
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      create: jest.fn(),
      updateOne: jest.fn(),
    };
    mailService = { sendMail: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: JwtService, useValue: { signAsync: jest.fn(), verifyAsync: jest.fn() } },
        { provide: MailerService, useValue: mailService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('signUp', () => {
    it('hashes the password and never returns it', async () => {
      userModel.findOne.mockResolvedValue(null);
      const hashSpy = bcryptMock.hash.mockResolvedValue('hashed');
      userModel.create.mockImplementation(async (dto) => ({ ...baseUser, ...dto, password: dto.password }));

      const result = await service.signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'secret123',
      });

      expect(hashSpy).toHaveBeenCalledWith('secret123', 4);
      expect(result.data).not.toHaveProperty('password');
      expect(result.data.email).toBe('test@example.com');
    });

    it('rejects a duplicate email with 409', async () => {
      userModel.findOne.mockResolvedValue(baseUser);

      await expect(
        service.signUp({ name: 'A', email: 'test@example.com', password: 'secret123' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('signIn', () => {
    it('rejects unknown emails with a generic error', async () => {
      userModel.findOne.mockImplementation(() => ({
        select: jest.fn().mockResolvedValue(null),
      }));

      await expect(
        service.signIn({ email: 'nobody@example.com', password: 'x' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a wrong password', async () => {
      userModel.findOne.mockImplementation(() => ({ select: jest.fn().mockResolvedValue({ ...baseUser, password: 'hash' }) }));
      bcryptMock.compare.mockResolvedValue(false);

      await expect(
        service.signIn({ email: 'test@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('signs tokens on success', async () => {
      userModel.findOne.mockImplementation(() => ({ select: jest.fn().mockResolvedValue({ ...baseUser, password: 'hash' }) }));
      bcryptMock.compare.mockResolvedValue(true);
      const jwt = (service as unknown as { jwtService: { signAsync: jest.Mock } }).jwtService;
      jwt.signAsync = jest.fn().mockResolvedValue('signed-token');

      const result = await service.signIn({
        email: 'test@example.com',
        password: 'right',
      });

      expect(result.access_token).toBe('signed-token');
      expect(result.refresh_token).toBe('signed-token');
    });
  });

  describe('resetPassword', () => {
    it('returns the same message for unknown emails (no account enumeration)', async () => {
      userModel.findOne.mockResolvedValue(null);

      const result = await service.resetPassword({ email: 'ghost@example.com' });

      expect(result.message).toContain('Code sent successfully');
      expect(mailService.sendMail).not.toHaveBeenCalled();
    });

    it('stores a hashed code with a TTL and sends it by mail', async () => {
      userModel.findOne.mockResolvedValue(baseUser);
      const hashSpy = bcryptMock.hash.mockResolvedValue('code-hash');

      const result = await service.resetPassword({ email: 'test@example.com' });

      expect(hashSpy).toHaveBeenCalled();
      expect(userModel.findOneAndUpdate).toHaveBeenCalledWith(
        { email: 'test@example.com' },
        expect.objectContaining({
          verificationCode: 'code-hash',
          verificationCodeExpiresAt: expect.any(Date),
          verificationAttempts: 0,
        }),
      );
      expect(mailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'test@example.com' }),
      );
      expect(result.message).toContain('Code sent successfully');
    });
  });

  describe('verifyCode', () => {
    it('rejects an invalid code and counts the attempt', async () => {
      userModel.findOne.mockImplementation(() => ({ select: jest.fn().mockResolvedValue({
        ...baseUser,
        verificationCode: 'stored-hash',
        verificationCodeExpiresAt: new Date(Date.now() + 60_000),
        verificationAttempts: 0,
      }) }));
      bcryptMock.compare.mockResolvedValue(false);

      await expect(
        service.verifyCode({ email: 'test@example.com', code: '000000' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(userModel.updateOne).toHaveBeenCalledWith(
        { email: 'test@example.com' },
        { $inc: { verificationAttempts: 1 } },
      );
    });

    it('rejects after the attempt cap', async () => {
      userModel.findOne.mockImplementation(() => ({ select: jest.fn().mockResolvedValue({
        ...baseUser,
        verificationCode: 'stored-hash',
        verificationCodeExpiresAt: new Date(Date.now() + 60_000),
        verificationAttempts: 5,
      }) }));

      await expect(
        service.verifyCode({ email: 'test@example.com', code: '123456' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects expired codes', async () => {
      userModel.findOne.mockImplementation(() => ({ select: jest.fn().mockResolvedValue({
        ...baseUser,
        verificationCode: 'stored-hash',
        verificationCodeExpiresAt: new Date(Date.now() - 1000),
        verificationAttempts: 0,
      }) }));

      await expect(
        service.verifyCode({ email: 'test@example.com', code: '123456' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('clears the code and marks the email as verified on success', async () => {
      userModel.findOne.mockImplementation(() => ({ select: jest.fn().mockResolvedValue({
        ...baseUser,
        verificationCode: 'stored-hash',
        verificationCodeExpiresAt: new Date(Date.now() + 60_000),
        verificationAttempts: 0,
      }) }));
      bcryptMock.compare.mockResolvedValue(true);

      const result = await service.verifyCode({
        email: 'test@example.com',
        code: '123456',
      });

      expect(result.message).toContain('Code verified');
      expect(userModel.updateOne).toHaveBeenCalledWith(
        { email: 'test@example.com' },
        expect.objectContaining({
          passwordResetVerifiedAt: expect.any(Date),
        }),
      );
    });
  });

  describe('changePassword', () => {
    it('blocks the change until the code has been verified', async () => {
      userModel.findOne.mockResolvedValue({ ...baseUser, passwordResetVerifiedAt: null });

      await expect(
        service.changePassword({ email: 'test@example.com', password: 'newpass' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks an expired verification', async () => {
      userModel.findOne.mockResolvedValue({
        ...baseUser,
        passwordResetVerifiedAt: new Date(Date.now() - 11 * 60_000),
      });

      await expect(
        service.changePassword({ email: 'test@example.com', password: 'newpass' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('updates the password and clears the verification marker', async () => {
      userModel.findOne.mockResolvedValue({
        ...baseUser,
        passwordResetVerifiedAt: new Date(Date.now() - 1000),
      });
      bcryptMock.hash.mockResolvedValue('new-hash');

      const result = await service.changePassword({
        email: 'test@example.com',
        password: 'newpass',
      });

      expect(userModel.updateOne).toHaveBeenCalledWith(
        { email: 'test@example.com' },
        { password: 'new-hash', passwordResetVerifiedAt: null },
      );
      expect(result.message).toContain('Password changed');
    });
  });

  describe('refreshToken', () => {
    let jwt: { verifyAsync: jest.Mock; signAsync: jest.Mock };

    beforeEach(() => {
      jwt = (service as unknown as { jwtService: { verifyAsync: jest.Mock; signAsync: jest.Mock } }).jwtService;
    });

    it('rejects an invalid refresh token', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('bad'));

      await expect(service.refreshToken('garbage')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an exhausted refresh token (countEX <= 0)', async () => {
      jwt.verifyAsync.mockResolvedValue({ _id: 'id', email: 'e', role: 'user', countEX: 0 });

      await expect(service.refreshToken('token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('mints a fresh access token and decrements countEX', async () => {
      jwt.verifyAsync.mockResolvedValue({
        _id: 'id',
        email: 'e@example.com',
        role: 'user',
        countEX: 2,
      });
      jwt.signAsync.mockResolvedValue('new-token');

      const result = await service.refreshToken('token');

      expect(result.access_token).toBe('new-token');
      expect(jwt.signAsync).toHaveBeenLastCalledWith(
        expect.objectContaining({ countEX: 1 }),
        expect.anything(),
      );
    });
  });
});