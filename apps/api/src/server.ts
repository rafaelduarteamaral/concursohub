import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import Fastify from 'fastify';
import { ZodError } from 'zod';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyPostgres from '@fastify/postgres';
import IORedis from 'ioredis';

import concursosRoutes from './routes/concursos.js';
import sourcesRoutes from './routes/sources.js';
import adminRoutes from './routes/admin.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';
const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://concursohub:concursohub@localhost:5432/concursohub';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport:
        process.env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    trustProxy: true,
  });

  // Security
  await fastify.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });

  await fastify.register(cors, {
    origin: [
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      /localhost:\d+/,
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await fastify.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
    errorResponseBuilder: (_request, context) => ({
      error: 'Too Many Requests',
      message: `Rate limit exceeded, retry in ${context.after}`,
      statusCode: 429,
    }),
  });

  // Database
  await fastify.register(fastifyPostgres, { connectionString: DATABASE_URL });

  // Redis client (decorating fastify instance)
  const redis = new IORedis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 3 });
  fastify.decorate('redis', redis);

  // Routes
  await fastify.register(concursosRoutes, { prefix: '/api/v1' });
  await fastify.register(sourcesRoutes, { prefix: '/api/v1' });
  await fastify.register(adminRoutes, { prefix: '/api/v1' });

  // Health check
  fastify.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));

  // Global error handler
  fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error({ err: error, url: request.url }, 'Unhandled error');

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'Validation Error',
        details: error.errors,
      });
    }

    if (error.validation) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: error.message,
        details: error.validation,
      });
    }

    const statusCode = error.statusCode || 500;
    return reply.status(statusCode).send({
      error: error.name || 'Internal Server Error',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Ocorreu um erro inesperado',
    });
  });

  return fastify;
}

async function start() {
  const fastify = await buildServer();

  const shutdown = async (signal: string) => {
    fastify.log.info(`Received ${signal}, shutting down gracefully...`);
    try {
      await fastify.close();
      process.exit(0);
    } catch (err) {
      fastify.log.error(err, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    await fastify.listen({ port: PORT, host: HOST });
    fastify.log.info(`ConcursoHub API running at http://${HOST}:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
