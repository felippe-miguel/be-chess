import { afterAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';

describe('app', () => {
  let app: FastifyInstance;

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health returns 200 with the health envelope', async () => {
    app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { status: string; uptime: number; version: string };
    expect(body.status).toBe('ok');
    expect(typeof body.uptime).toBe('number');
    expect(typeof body.version).toBe('string');
    expect(body.version.length).toBeGreaterThan(0);
  });

  it('GET /health (without the /api/v1 prefix) returns a 404 envelope', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(404);
    const body = response.json() as { error: { code: string; message: string } };
    expect(typeof body.error.code).toBe('string');
    expect(typeof body.error.message).toBe('string');
  });

  it('GET /api/v1/nope returns a 404 envelope', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/nope',
    });

    expect(response.statusCode).toBe(404);
    const body = response.json() as { error: { code: string; message: string } };
    expect(typeof body.error.code).toBe('string');
    expect(typeof body.error.message).toBe('string');
  });

  it('returns a 500 envelope for unhandled route errors', async () => {
    const errorApp = await buildApp();
    errorApp.get('/__test-throw', () => {
      throw new Error('boom');
    });

    const response = await errorApp.inject({
      method: 'GET',
      url: '/__test-throw',
    });

    expect(response.statusCode).toBe(500);
    const body = response.json() as { error: { code: string; message: string } };
    expect(typeof body.error.code).toBe('string');
    expect(typeof body.error.message).toBe('string');

    await errorApp.close();
  });

  it('responds to CORS preflight on /api/v1/health with the allowed origin', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/health',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'GET',
      },
    });

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});
