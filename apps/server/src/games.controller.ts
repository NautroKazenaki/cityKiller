import { Controller, Get } from '@nestjs/common';
import { GameHistoryEntry, PersistenceService } from './persistence.service';

@Controller('games')
export class GamesController {
  constructor(private readonly persistence: PersistenceService) {}

  @Get()
  list(): GameHistoryEntry[] {
    return this.persistence.listHistory();
  }
}
