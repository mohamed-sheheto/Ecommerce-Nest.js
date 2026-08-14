import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomInt } from 'crypto';
import { User } from 'src/user/user.schema';
import {
  ResetPasswordDto,
  SignInDto,
  SignUpDto,
  VerifyCodeDto,
} from './Dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from '@nestjs-modules/mailer';
import { env } from 'src/config/env';
import { Role } from 'src/user/roles';
import { toUserResponse } from 'src/user/user.mapper';
import { RefreshTokenPayload } from 'src/user/guard/auth.types';

const OTP_TTL_MS = 10 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 10 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;
const REFRESH_TOKEN_MAX_USES = 5;
const REFRESH_TOKEN_TTL = '7d';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwtService: JwtService,
    private readonly mailService: MailerService,
  ) {}

  private async issueTokens(user: {
    _id: string | Types.ObjectId;
    email: string;
    role: Role;
  }): Promise<{ access_token: string; refresh_token: string }> {
    const payload = {
      _id: user._id,
      email: user.email,
      role: user.role,
    };
    const access_token = await this.jwtService.signAsync(payload, {
      secret: env.JWT_SECRET,
    });
    const refresh_token = await this.jwtService.signAsync(
      { ...payload, countEX: REFRESH_TOKEN_MAX_USES },
      {
        secret: env.JWT_SECRET_REFRESHTOKEN,
        expiresIn: REFRESH_TOKEN_TTL,
      },
    );
    return { access_token, refresh_token };
  }

  async signUp(signUpDto: SignUpDto) {
    const user = await this.userModel.findOne({ email: signUpDto.email });
    if (user) {
      throw new ConflictException('User already exist');
    }
    const password = await bcrypt.hash(signUpDto.password, env.BCRYPT_ROUNDS);
    const newUser = await this.userModel.create({
      ...signUpDto,
      password,
      role: 'user',
      active: true,
    });

    const tokens = await this.issueTokens(newUser);
    return {
      status: 200,
      message: 'User created successfully',
      data: toUserResponse(newUser),
      ...tokens,
    };
  }

  async signIn(signInDto: SignInDto) {
    const user = await this.userModel
      .findOne({ email: signInDto.email })
      .select('+password');
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(signInDto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.issueTokens(user);
    return {
      status: 200,
      message: 'User logged in successfully',
      data: toUserResponse(user),
      ...tokens,
    };
  }

  async resetPassword({ email }: ResetPasswordDto) {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      // Deliberately identical to the success response so the endpoint
      // does not reveal which emails are registered.
      return {
        status: 200,
        message: `Code sent successfully on your email (${email})`,
      };
    }

    const code = randomInt(0, 1000000).toString().padStart(6, '0');
    const codeHash = await bcrypt.hash(code, env.BCRYPT_ROUNDS);
    await this.userModel.findOneAndUpdate(
      { email },
      {
        verificationCode: codeHash,
        verificationCodeExpiresAt: new Date(Date.now() + OTP_TTL_MS),
        verificationAttempts: 0,
      },
    );

    const htmlMessage = `
    <div>
      <h1>Forgot your password? If you didn't forget your password, please ignore this email!</h1>
      <p>Use the following code to verify your account: <h3 style="color: red; font-weight: bold; text-align: center">${code}</h3></p>
      <h6 style="font-weight: bold">Ecommerce-Nest.JS</h6>
    </div>
    `;

    await this.mailService.sendMail({
      from: `Ecommerce-Nest.JS <${env.MAIL_USER}>`,
      to: email,
      subject: `Ecommerce-Nest.JS - Reset Password`,
      html: htmlMessage,
    });
    return {
      status: 200,
      message: `Code sent successfully on your email (${email})`,
    };
  }

  async verifyCode({ email, code }: VerifyCodeDto) {
    const user = await this.userModel
      .findOne({ email })
      .select('+verificationCode +verificationCodeExpiresAt +verificationAttempts');

    if (!user) {
      throw new NotFoundException('User Not Found');
    }
    if (!user.verificationCode || !user.verificationCodeExpiresAt) {
      throw new UnauthorizedException('No verification code was requested');
    }
    if (user.verificationAttempts >= MAX_VERIFY_ATTEMPTS) {
      throw new UnauthorizedException(
        'Too many failed attempts, request a new code',
      );
    }
    if (Date.now() > user.verificationCodeExpiresAt.getTime()) {
      throw new UnauthorizedException('Code expired, request a new code');
    }

    const isMatch = await bcrypt.compare(code, user.verificationCode);
    if (!isMatch) {
      await this.userModel.updateOne(
        { email },
        { $inc: { verificationAttempts: 1 } },
      );
      throw new UnauthorizedException('Invalid code');
    }

    await this.userModel.updateOne(
      { email },
      {
        verificationCode: null,
        verificationCodeExpiresAt: null,
        verificationAttempts: 0,
        passwordResetVerifiedAt: new Date(),
      },
    );

    return {
      status: 200,
      message: 'Code verified successfully, go to change your password',
    };
  }

  async changePassword(changePasswordData: SignInDto) {
    const user = await this.userModel.findOne({
      email: changePasswordData.email,
    });
    if (!user) {
      throw new NotFoundException('User Not Found');
    }
    if (!user.passwordResetVerifiedAt) {
      throw new ForbiddenException(
        'Verify your email code before changing the password',
      );
    }
    if (
      Date.now() - user.passwordResetVerifiedAt.getTime() >
      PASSWORD_RESET_TTL_MS
    ) {
      throw new ForbiddenException(
        'Verification expired, request a new code',
      );
    }

    const password = await bcrypt.hash(
      changePasswordData.password,
      env.BCRYPT_ROUNDS,
    );
    await this.userModel.updateOne(
      { email: changePasswordData.email },
      { password, passwordResetVerifiedAt: null },
    );
    return {
      status: 200,
      message: 'Password changed successfully, go to login',
    };
  }

  async refreshToken(refreshToken: string) {
    const payload = await this.jwtService
      .verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: env.JWT_SECRET_REFRESHTOKEN,
      })
      .catch(() => {
        throw new UnauthorizedException(
          'Invalid refresh token, please go to sign in',
        );
      });

    if (
      !payload ||
      typeof payload.countEX !== 'number' ||
      payload.countEX <= 0
    ) {
      throw new UnauthorizedException(
        'Invalid refresh token, please go to sign in',
      );
    }

    const { exp: _exp, ...newPayload } = payload;
    void _exp;
    const newPayoadForAccessToken = {
      _id: newPayload._id,
      email: newPayload.email,
      role: newPayload.role,
    };

    const access_token = await this.jwtService.signAsync(
      newPayoadForAccessToken,
      {
        secret: env.JWT_SECRET,
      },
    );

    const refresh_token = await this.jwtService.signAsync(
      { ...newPayload, countEX: payload.countEX - 1 },
      {
        secret: env.JWT_SECRET_REFRESHTOKEN,
        expiresIn: REFRESH_TOKEN_TTL,
      },
    );

    return {
      status: 200,
      message: 'Refresh Access token successfully',
      access_token,
      refresh_token,
    };
  }
}