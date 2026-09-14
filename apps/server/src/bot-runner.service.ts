import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { GameCommand, GameState, PlayerRole, decideBotCommand } from '@citykiller/shared';
import { existsSync } from 'fs';
import { join } from 'path';
import { Worker } from 'worker_threads';

/** Сколько ждём поток, прежде чем считать, что он завис */
const TIMEOUT_MS = 4000;

interface Pending {
  resolve: (command: GameCommand | null) => void;
  timer: NodeJS.Timeout;
  state: GameState;
  role: PlayerRole;
}

/**
 * Ходы бота считаются в отдельном потоке. Что бы с потоком ни случилось —
 * упал, завис, файла нет, — ход всё равно будет: его досчитает основной
 * поток той же функцией. Партия не зависает никогда.
 */
@Injectable()
export class BotRunnerService implements OnModuleDestroy {
  private readonly logger = new Logger('BotRunner');
  private readonly workerPath = join(__dirname, 'bot.worker.js');
  private worker: Worker | null = null;
  private seq = 0;
  private readonly pending = new Map<number, Pending>();

  decide(state: GameState, role: PlayerRole): Promise<GameCommand | null> {
    const worker = this.ensureWorker();
    if (!worker) return Promise.resolve(this.inline(state, role));

    const id = ++this.seq;
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        this.logger.warn(`поток бота не ответил за ${TIMEOUT_MS} мс — перезапускаю`);
        this.restart();
      }, TIMEOUT_MS);
      this.pending.set(id, { resolve, timer, state, role });
      worker.postMessage({ id, state, role });
    });
  }

  /** Запасной путь: та же функция в основном потоке */
  private inline(state: GameState, role: PlayerRole): GameCommand | null {
    try {
      return decideBotCommand(state, role);
    } catch (e) {
      this.logger.warn(`бот не смог решить ход: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  }

  private ensureWorker(): Worker | null {
    if (this.worker) return this.worker;
    // запуск без сборки (нет dist/bot.worker.js) — просто считаем в основном потоке
    if (!existsSync(this.workerPath)) return null;
    try {
      const worker = new Worker(this.workerPath);
      worker.on('message', (msg: { id: number; command?: GameCommand | null; error?: string }) => {
        const p = this.pending.get(msg.id);
        if (!p) return;
        clearTimeout(p.timer);
        this.pending.delete(msg.id);
        if (msg.error) {
          this.logger.warn(`ошибка в потоке бота: ${msg.error}`);
          p.resolve(this.inline(p.state, p.role));
        } else {
          p.resolve(msg.command ?? null);
        }
      });
      worker.on('error', (err: unknown) => {
        this.logger.warn(`поток бота упал: ${err instanceof Error ? err.message : String(err)}`);
        if (this.worker === worker) this.worker = null;
        this.flushInline();
      });
      worker.on('exit', () => {
        if (this.worker === worker) this.worker = null;
        this.flushInline();
      });
      // поток не должен держать процесс, если сервер останавливают
      worker.unref();
      this.worker = worker;
      this.logger.log('поток бота запущен');
      return worker;
    } catch (e) {
      this.logger.warn(`не удалось запустить поток бота: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  }

  /** Всё, что ждало поток, досчитываем здесь */
  private flushInline(): void {
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer);
      this.pending.delete(id);
      p.resolve(this.inline(p.state, p.role));
    }
  }

  private restart(): void {
    const worker = this.worker;
    this.worker = null;
    this.flushInline();
    void worker?.terminate();
  }

  onModuleDestroy(): void {
    void this.worker?.terminate();
  }
}
