import 'reflect-metadata';
import { existsSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

/**
 * Собранный клиент рядом с сервером. В рабочем дереве это apps/client/dist,
 * в развёрнутой копии — папка public около dist/main.js.
 */
function findClientBuild(): string | null {
  const candidates = [
    join(__dirname, 'public'),
    join(__dirname, '..', 'public'),
    join(__dirname, '..', '..', 'client', 'dist')
  ];
  return candidates.find(dir => existsSync(join(dir, 'index.html'))) ?? null;
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Клиент ходит на тот же origin, что и отдал ему страницу, поэтому CORS нужен
  // только для запуска врозь (vite на 5173). Список задаётся через ALLOWED_ORIGINS.
  const allowed = process.env.ALLOWED_ORIGINS?.split(',')
    .map(s => s.trim())
    .filter(Boolean);
  app.enableCors({ origin: allowed && allowed.length > 0 ? allowed : '*' });

  const clientBuild = findClientBuild();
  if (clientBuild) {
    app.useStaticAssets(clientBuild, {
      index: 'index.html',
      setHeaders(res, filePath) {
        // Имена ассетов содержат хеш содержимого — их можно кешировать надолго.
        // index.html хеша не имеет: закешируй его, и после пересборки игроки
        // будут час сидеть на старой версии, пока не почистят кеш руками.
        res.setHeader(
          'Cache-Control',
          filePath.endsWith('.html') ? 'no-cache' : 'public, max-age=31536000, immutable'
        );
      }
    });
  }

  const port = Number(process.env.PORT ?? 3000);
  // 0.0.0.0, иначе сервер не виден ни из локальной сети, ни из туннеля
  await app.listen(port, '0.0.0.0');
  console.log(`City Killer server listening on http://localhost:${port}`);
  console.log(
    clientBuild
      ? `Клиент раздаётся из ${clientBuild}`
      : 'Сборка клиента не найдена — запустите npm run build, иначе доступен только API'
  );
}

void bootstrap();
