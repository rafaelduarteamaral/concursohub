import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

const promptBodySchema = z.object({
  key: z.string().min(1).max(100),
  system_prompt: z.string().min(10),
  user_prompt_template: z.string().min(10),
  description: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
});

const promptKeyParamSchema = z.object({ key: z.string().min(1) });

export default async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /admin/stats
  fastify.get('/admin/stats', async (_request: FastifyRequest, reply: FastifyReply) => {
    const client = await fastify.pg.connect();
    try {
      const [summary, byStatus, byArea, byEstado, topSources, aiCosts] = await Promise.all([
        client.query(`
          SELECT
            COUNT(*)::integer as total_concursos,
            COUNT(*) FILTER (WHERE status = 'inscricoes_abertas')::integer as inscricoes_abertas,
            COUNT(*) FILTER (WHERE status = 'previsto')::integer as previstos,
            COUNT(*) FILTER (WHERE ai_status = 'pending')::integer as pending_ai,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::integer as novos_hoje,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::integer as novos_7d,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::integer as novos_30d
          FROM concursos
        `),
        client.query(`
          SELECT status, COUNT(*)::integer as count
          FROM concursos GROUP BY status ORDER BY count DESC
        `),
        client.query(`
          SELECT area, COUNT(*)::integer as count
          FROM concursos WHERE area IS NOT NULL
          GROUP BY area ORDER BY count DESC LIMIT 10
        `),
        client.query(`
          SELECT estado, COUNT(*)::integer as count
          FROM concursos WHERE estado IS NOT NULL
          GROUP BY estado ORDER BY count DESC LIMIT 10
        `),
        client.query(`
          SELECT s.name as source_name, s.type as source_type, COUNT(c.id)::integer as count
          FROM sources s
          LEFT JOIN concursos c ON c.source_id = s.id
          GROUP BY s.id, s.name, s.type
          ORDER BY count DESC LIMIT 10
        `),
        client.query(`
          SELECT
            COALESCE(SUM(cost_usd) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours'), 0)::float as cost_today,
            COALESCE(SUM(cost_usd) FILTER (WHERE created_at > NOW() - INTERVAL '7 days'), 0)::float as cost_7d,
            COUNT(*) FILTER (WHERE success = false AND created_at > NOW() - INTERVAL '24 hours')::integer as errors_today
          FROM ai_processing_logs
        `),
      ]);

      return reply.send({
        ...summary.rows[0],
        by_status: Object.fromEntries(byStatus.rows.map((r) => [r.status, r.count])),
        by_area: byArea.rows,
        by_estado: byEstado.rows,
        top_sources: topSources.rows,
        ai_cost_today: aiCosts.rows[0].cost_today,
        ai_cost_7d: aiCosts.rows[0].cost_7d,
        ai_errors_today: aiCosts.rows[0].errors_today,
      });
    } finally {
      client.release();
    }
  });

  // GET /admin/prompts
  fastify.get('/admin/prompts', async (_request: FastifyRequest, reply: FastifyReply) => {
    const client = await fastify.pg.connect();
    try {
      const result = await client.query(
        'SELECT * FROM ai_prompts ORDER BY updated_at DESC',
      );
      return reply.send(result.rows);
    } finally {
      client.release();
    }
  });

  // GET /admin/prompts/:key
  fastify.get('/admin/prompts/:key', async (request: FastifyRequest, reply: FastifyReply) => {
    const { key } = promptKeyParamSchema.parse(request.params);
    const client = await fastify.pg.connect();
    try {
      const result = await client.query(
        'SELECT * FROM ai_prompts WHERE key = $1',
        [key],
      );
      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Prompt não encontrado' });
      }
      return reply.send(result.rows[0]);
    } finally {
      client.release();
    }
  });

  // POST /admin/prompts
  fastify.post('/admin/prompts', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = promptBodySchema.parse(request.body);
    const client = await fastify.pg.connect();
    try {
      const result = await client.query(
        `INSERT INTO ai_prompts (key, system_prompt, user_prompt_template, description, is_active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [body.key, body.system_prompt, body.user_prompt_template,
         body.description ?? null, body.is_active],
      );
      return reply.status(201).send(result.rows[0]);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('unique')) {
        return reply.status(409).send({ error: 'Chave de prompt já existe' });
      }
      throw err;
    } finally {
      client.release();
    }
  });

  // PUT /admin/prompts/:key
  fastify.put('/admin/prompts/:key', async (request: FastifyRequest, reply: FastifyReply) => {
    const { key } = promptKeyParamSchema.parse(request.params);
    const body = promptBodySchema.partial().parse(request.body);
    const client = await fastify.pg.connect();
    try {
      const sets: string[] = ['updated_at = NOW()'];
      const params: unknown[] = [];
      let pi = 1;

      if (body.system_prompt != null) { sets.push(`system_prompt = $${pi++}`); params.push(body.system_prompt); }
      if (body.user_prompt_template != null) { sets.push(`user_prompt_template = $${pi++}`); params.push(body.user_prompt_template); }
      if (body.description !== undefined) { sets.push(`description = $${pi++}`); params.push(body.description); }
      if (body.is_active != null) { sets.push(`is_active = $${pi++}`); params.push(body.is_active); }

      params.push(key);
      const result = await client.query(
        `UPDATE ai_prompts SET ${sets.join(', ')} WHERE key = $${pi} RETURNING *`,
        params,
      );
      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Prompt não encontrado' });
      }
      return reply.send(result.rows[0]);
    } finally {
      client.release();
    }
  });

  // DELETE /admin/prompts/:key
  fastify.delete('/admin/prompts/:key', async (request: FastifyRequest, reply: FastifyReply) => {
    const { key } = promptKeyParamSchema.parse(request.params);
    const client = await fastify.pg.connect();
    try {
      const result = await client.query(
        'DELETE FROM ai_prompts WHERE key = $1 RETURNING key',
        [key],
      );
      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Prompt não encontrado' });
      }
      return reply.status(204).send();
    } finally {
      client.release();
    }
  });

  // GET /admin/fila — AI processing queue review
  fastify.get('/admin/fila', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = z.object({
      page: z.coerce.number().int().min(1).default(1),
      per_page: z.coerce.number().int().min(1).max(100).default(20),
      ai_status: z.enum(['pending', 'processing', 'done', 'error']).optional(),
    }).parse(request.query);

    const { page, per_page, ai_status } = query;
    const offset = (page - 1) * per_page;
    const client = await fastify.pg.connect();
    try {
      const conditions = ai_status ? [`c.ai_status = '${ai_status}'`] : [];
      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await client.query(
        `SELECT COUNT(*)::integer as total FROM concursos c ${where}`,
      );
      const total = countResult.rows[0].total;

      const dataResult = await client.query(
        `SELECT c.id, c.slug, c.titulo, c.orgao, c.ai_status, c.ai_error,
                c.status, c.created_at, c.updated_at,
                s.name as source_name
         FROM concursos c
         LEFT JOIN sources s ON c.source_id = s.id
         ${where}
         ORDER BY c.created_at DESC
         LIMIT $1 OFFSET $2`,
        [per_page, offset],
      );

      return reply.send({
        data: dataResult.rows,
        total,
        page,
        per_page,
        total_pages: Math.ceil(total / per_page),
      });
    } finally {
      client.release();
    }
  });
}
