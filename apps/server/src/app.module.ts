import { Module } from '@nestjs/common';
import { AuthController, ProfileController } from './auth.controller';
import { AuthService } from './auth.service';
import { GameGateway } from './game.gateway';
import { GamesController } from './games.controller';
import { LeaderboardController } from './leaderboard';
import { PersistenceService } from './persistence.service';
import { RoomsService } from './rooms.service';

@Module({
  controllers: [GamesController, AuthController, ProfileController, LeaderboardController],
  providers: [PersistenceService, AuthService, RoomsService, GameGateway]
})
export class AppModule {}
