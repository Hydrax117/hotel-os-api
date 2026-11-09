import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule, ObserveInstrument } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
    rawBody: true,
  });

  app.setGlobalPrefix('api/v1');

  // ── Socket.IO adapter ─────────────────────────────────────────────────────
  app.useWebSocketAdapter(new IoAdapter(app));

  // Build the allowed-origins list, expanding each entry to also cover the
  // www. variant so https://arenax.com.ng and https://www.arenax.com.ng are
  // both accepted without needing two separate env vars.
  function withWwwVariant(url: string): string[] {
    try {
      const parsed = new URL(url);
      const variants = [url];
      if (parsed.hostname.startsWith('www.')) {
        // www.foo.com → also allow foo.com
        parsed.hostname = parsed.hostname.slice(4);
        variants.push(parsed.toString().replace(/\/$/, ''));
      } else {
        // foo.com → also allow www.foo.com
        parsed.hostname = `www.${parsed.hostname}`;
        variants.push(parsed.toString().replace(/\/$/, ''));
      }
      return variants;
    } catch {
      return [url];
    }
  }

  const allowedOrigins = [
    process.env['FRONTEND_URL'] ?? 'http://localhost:3000',
    process.env['HOTEL_FRONTEND_URL'] ?? 'http://hotel.localhost:3000',
  ].flatMap(withWwwVariant);

  console.log('[CORS] Allowed origins:', allowedOrigins);

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (server-to-server, curl, mobile apps)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Return false to block — do NOT throw, throwing causes a 500
      callback(null, false);
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  const config = new DocumentBuilder()
    .setTitle('Hotel OS API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env['PORT'] ?? 3001);
}
bootstrap();
