import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type { FastifyPluginAsync } from 'fastify';

// `package.json` has no type declarations and the project has no
// `resolveJsonModule`, so we read it via `createRequire` instead of a
// static `import`. Resolving relative to `import.meta.url` (rather than
// `process.cwd()`) keeps this correct regardless of where the process is
// launched from.
const require = createRequire(fileURLToPath(import.meta.url));
const packageJson = require('../../package.json') as { version?: unknown };
const apiVersion =
  typeof packageJson.version === 'string' ? packageJson.version : '0.0.0';

interface HealthResponse {
  status: 'ok';
  uptime: number;
  version: string;
}

const healthResponseSchema = {
  200: {
    type: 'object',
    required: ['status', 'uptime', 'version'],
    properties: {
      status: { type: 'string', const: 'ok' },
      uptime: { type: 'number' },
      version: { type: 'string' },
    },
    additionalProperties: false,
  },
};

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/health',
    {
      schema: {
        response: healthResponseSchema,
      },
    },
    async (): Promise<HealthResponse> => {
      return {
        status: 'ok',
        uptime: process.uptime(),
        version: apiVersion,
      };
    },
  );
};
