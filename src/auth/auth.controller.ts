import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

class RegisterDto {
  email!: string;
  password!: string;
  name!: string;
  organizationSlug!: string;
}

class LoginDto {
  email!: string;
  password!: string;
}

class CreateConnectionDto {
  name!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body.email, body.password, body.name, body.organizationSlug);
  }

  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: any) {
    return this.authService.me(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('org')
  async getOrg(@Req() req: any) {
    return this.authService.getOrg(req.user.userId);
  }
}
