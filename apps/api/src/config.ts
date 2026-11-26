import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().min(1).default('0.0.0.0'),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
});

export type Config = Readonly<z.infer<typeof envSchema>>;

/**
 * Parses `process.env` against the schema above.
 *
 * This is a pure function (no `process.exit`) so it stays safe to call from
 * tests. `loadConfig` below is the side-effecting entry point used by the
 * actual process.
 */
export function parseConfig(env: NodeJS.ProcessEnv): z.ZodSafeParseResult<Config> {
  return envSchema.safeParse(env);
}

/**
 * Parses `process.env`, and on failure prints a human-readable message and
 * exits the process. Only call this from the real server entry point
 * (`server.ts`) — never from `app.ts` or test files, so importing those
 * modules never has the side effect of killing the process.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = parseConfig(env);
  if (!result.success) {
    console.error('Invalid environment configuration:');
    console.error(z.prettifyError(result.error));
    process.exit(1);
  }
  return result.data;
}
