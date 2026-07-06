import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { GamesController } from './games.controller';
import { PersistenceService } from './persistence.service';
import { RoomsService } from './rooms.service';

@Module({
  controllers: [GamesController],
  providers: [PersistenceService, RoomsService, GameGateway]
})
export class AppModule {}
