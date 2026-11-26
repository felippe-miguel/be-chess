import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health.js';
import { loadConfig } from './config.js';

interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
  };
}

function resolveLoggerOptions(nodeEnv: string): boolean | Record<string, unknown> {
  if (nodeEnv === 'test') {
    return false;
  }
  if (nodeEnv === 'development') {
    return {
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    };
  }
  return true;
}

export async function buildApp(): Promise<FastifyInstance> {
  const config = loadConfig();

  const app = Fastify({
    logger: resolveLoggerOptions(config.NODE_ENV),
  });

  await app.register(cors, {
    origin: config.CORS_ORIGIN,
  });

  await app.register(healthRoutes, { prefix: '/api/v1' });

  app.setErrorHandler<FastifyError>((error, _request, reply) => {
    const statusCode = error.statusCode ?? 500;

    if (statusCode >= 500) {
      app.log.error(error);
      const message =
        config.NODE_ENV === 'production' ? 'Internal Server Error' : error.message;
      const body: ErrorEnvelope = {
        error: { code: 'INTERNAL_SERVER_ERROR', message },
      };
      reply.status(statusCode).send(body);
      return;
    }

    const body: ErrorEnvelope = {
      error: { code: error.code ?? 'BAD_REQUEST', message: error.message },
    };
    reply.status(statusCode).send(body);
  });

  app.setNotFoundHandler((request, reply) => {
    const body: ErrorEnvelope = {
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
      },
    };
    reply.status(404).send(body);
  });

  return app;
}
