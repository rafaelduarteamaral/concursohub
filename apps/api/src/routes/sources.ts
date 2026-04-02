import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

const sourceBodySchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url(),
  type: z.enum(['rss', 'playwright']),
  cron_expression: z.string().default('0 * * * *'),
  is_active: z.boolean().default(true),
  crawl_interval_minutes: z.number().int().min(5).default(60),
  config: z.record(z.unknown()).default({}),
});

const idParamSchema = z.object({ id: z.string().uuid() });

export default async function sourcesRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /sources
  fastify.get('/sources', async (_request: FastifyRequest, reply: FastifyReply) => {
    const client = await fastify.pg.connect();
    try {
      const result = await client.query(
        `SELECT s.*,
          COUNT(c.id)::integer as concurso_count
         FROM sources s
         LEFT JOIN concursos c ON c.source_id = s.id
         GROUP BY s.id
         ORDER BY s.created_at DESC`,
      );
      return reply.send(result.rows);
    } finally {
      client.release();
    }
  });

  // GET /sources/:id
  fastify.get('/sources/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = idParamSchema.parse(request.params);
    const client = await fastify.pg.connect();
    try {
      const result = await client.query('SELECT * FROM sources WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Fonte não encontrada' });
      }
      return reply.send(result.rows[0]);
    } finally {
      client.release();
    }
  });

  // POST /sources
  fastify.post('/sources', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = sourceBodySchema.parse(request.body);
    const client = await fastify.pg.connect();
    try {
      const result = await client.query(
        `INSERT INTO sources (name, url, type, cron_expression, is_active, crawl_interval_minutes, config)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [body.name, body.url, body.type, body.cron_expression, body.is_active,
         body.crawl_interval_minutes, JSON.stringify(body.config)],
      );
      return reply.status(201).send(result.rows[0]);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('unique')) {
        return reply.status(409).send({ error: 'URL já cadastrada' });
      }
      throw err;
    } finally {
      client.release();
    }
  });

  // PATCH /sources/:id
  fastify.patch('/sources/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = idParamSchema.parse(request.params);
    const body = sourceBodySchema.partial().parse(request.body);
    const client = await fastify.pg.connect();
    try {
      const sets: string[] = [];
      const params: unknown[] = [];
      let pi = 1;

      const fields: Array<keyof typeof body> = [
        'name', 'url', 'type', 'cron_expression', 'is_active',
        'crawl_interval_minutes', 'config',
      ];
      for (const field of fields) {
        if (body[field] !== undefined) {
          sets.push(`${field} = $${pi++}`);
          params.push(field === 'config' ? JSON.stringify(body[field]) : body[field]);
        }
      }

      if (sets.length === 0) {
        return reply.status(400).send({ error: 'Nenhum campo para atualizar' });
      }

      params.push(id);
      const result = await client.query(
        `UPDATE sources SET ${sets.join(', ')} WHERE id = $${pi} RETURNING *`,
        params,
      );
      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Fonte não encontrada' });
      }
      return reply.send(result.rows[0]);
    } finally {
      client.release();
    }
  });

  // DELETE /sources/:id
  fastify.delete('/sources/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = idParamSchema.parse(request.params);
    const client = await fastify.pg.connect();
    try {
      const result = await client.query(
        'DELETE FROM sources WHERE id = $1 RETURNING id',
        [id],
      );
      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Fonte não encontrada' });
      }
      return reply.status(204).send();
    } finally {
      client.release();
    }
  });

  // POST /sources/:id/trigger — force immediate crawl by resetting last_crawled_at
  fastify.post('/sources/:id/trigger', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = idParamSchema.parse(request.params);
    const client = await fastify.pg.connect();
    try {
      const result = await client.query(
        `UPDATE sources SET last_crawled_at = NULL WHERE id = $1 RETURNING id, name`,
        [id],
      );
      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Fonte não encontrada' });
      }
      return reply.send({
        message: `Fonte "${result.rows[0].name}" será processada no próximo ciclo do scraper`,
      });
    } finally {
      client.release();
    }
  });
}
