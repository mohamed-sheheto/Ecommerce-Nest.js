import { Body, Controller, Post, ValidationPipe } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  RefreshTokenDto,
  ResetPasswordDto,
  SignInDto,
  SignUpDto,
  VerifyCodeDto,
} from './Dto/auth.dto';

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  //  @docs   Sign Up
  //  @Route  POST /api/v1/auth/sign-up
  //  @access Public
  @Post('sign-up')
  signUp(
    @Body(new ValidationPipe({ forbidNonWhitelisted: true }))
    signUpDto: SignUpDto,
  ) {
    return this.authService.signUp(signUpDto);
  }
  //  @docs   Sign In
  //  @Route  POST /api/v1/auth/sign-in
  //  @access Public
  @Post('sign-in')
  signIn(
    @Body(new ValidationPipe({ forbidNonWhitelisted: true }))
    signInDto: SignInDto,
  ) {
    return this.authService.signIn(signInDto);
  }
  //  @docs   Any User Can Reset Password
  //  @Route  POST /api/v1/auth/reset-password
  //  @access Public
  @Post('reset-password')
  resetPassword(
    @Body(new ValidationPipe({ forbidNonWhitelisted: true }))
    email: ResetPasswordDto,
  ) {
    return this.authService.resetPassword(email);
  }
  //  @docs   Any User Can Verify Code
  //  @Route  POST /api/v1/auth/verify-code
  //  @access Public
  @Post('verify-code')
  verifyCode(
    @Body(new ValidationPipe({ forbidNonWhitelisted: true }))
    verifyCodeDto: VerifyCodeDto,
  ) {
    return this.authService.verifyCode(verifyCodeDto);
  }

  //  @docs   Any User Can change password after verifying the reset code
  //  @Route  POST /api/v1/auth/change-password
  //  @access Public (requires a verified reset code)
  @Post('change-password')
  changePassword(
    @Body(new ValidationPipe({ forbidNonWhitelisted: true }))
    changePasswordData: SignInDto,
  ) {
    return this.authService.changePassword(changePasswordData);
  }

  //  @docs   Any User Can loged can refresh token
  //  @Route  POST /api/v1/auth/refresh-token
  //  @access Private for users=> admin, user (loged)
  @Post('refresh-token')
  refreshToken(
    @Body(new ValidationPipe({ forbidNonWhitelisted: true }))
    { refreshToken }: RefreshTokenDto,
  ) {
    return this.authService.refreshToken(refreshToken);
  }
}