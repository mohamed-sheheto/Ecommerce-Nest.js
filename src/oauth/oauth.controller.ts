import { BadRequestException, Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { Profile } from 'passport-google-oauth20';
import { AuthService } from './oauth.service';

type GoogleCallbackRequest = Request & {
  user: {
    accessToken: string;
    profile: Profile;
  };
};

@Controller('v1/auth')
export class OAuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('google/sign')
  @UseGuards(AuthGuard('google'))
  googleLogin() {
    return { msg: 'Google Authentication' };
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleLoginCallback(@Req() req: GoogleCallbackRequest) {
    const email = req.user.profile.emails?.[0]?.value;
    const photo = req.user.profile.photos?.[0]?.value;
    if (!email || !req.user.profile.id || !req.user.profile.displayName) {
      throw new BadRequestException(
        'Google account is missing required profile data',
      );
    }
    const user = {
      userId: req.user.profile.id,
      email,
      name: req.user.profile.displayName,
      photo,
    };
    return await this.signInOrSignUpWithGoogle(user);
  }

  private async signInOrSignUpWithGoogle(user: {
    userId: string;
    email: string;
    name: string;
    photo?: string;
  }) {
    return await this.authService.validateUser(user);
  }
}