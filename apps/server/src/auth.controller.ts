import { Body, Controller, Get, Headers, HttpException, HttpStatus, Post } from '@nestjs/common';
import { AuthService, PublicUser, bearer } from './auth.service';
import { PersistenceService } from './persistence.service';
import { ProfileStats, computeProfile } from './profile.stats';

interface Credentials {
  login?: unknown;
  password?: unknown;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() body: Credentials): { token: string; user: PublicUser } {
    const result = this.auth.register(body?.login, body?.password);
    if (!result.ok) throw new HttpException({ error: result.error }, result.status);
    return { token: result.token, user: result.user };
  }

  @Post('login')
  login(@Body() body: Credentials): { token: string; user: PublicUser } {
    const result = this.auth.login(body?.login, body?.password);
    if (!result.ok) throw new HttpException({ error: result.error }, result.status);
    return { token: result.token, user: result.user };
  }

  @Get('me')
  me(@Headers('authorization') header?: string): PublicUser {
    const user = this.auth.userByToken(bearer(header));
    if (!user) throw new HttpException({ error: 'Войдите заново' }, HttpStatus.UNAUTHORIZED);
    return user;
  }

  @Post('logout')
  logout(@Headers('authorization') header?: string): { ok: true } {
    this.auth.logout(bearer(header));
    return { ok: true };
  }
}

@Controller('profile')
export class ProfileController {
  constructor(
    private readonly auth: AuthService,
    private readonly persistence: PersistenceService
  ) {}

  @Get()
  stats(@Headers('authorization') header?: string): ProfileStats {
    const user = this.auth.userByToken(bearer(header));
    if (!user) throw new HttpException({ error: 'Войдите заново' }, HttpStatus.UNAUTHORIZED);
    return computeProfile(user, this.persistence.listUserGames(user.id));
  }
}
