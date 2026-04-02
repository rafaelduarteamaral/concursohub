import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

const VALID_ESTADOS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO',
  'MA','MT','MS','MG','PA','PB','PR','PE','PI',
  'RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
  estado: z.string().toUpperCase().refine((v) => VALID_ESTADOS.includes(v), {
    message: 'Estado inválido',
  }).optional(),
  esfera: z.enum(['federal', 'estadual', 'municipal', 'distrital']).optional(),
  area: z.string().optional(),
  status: z.enum([
    'previsto', 'inscricoes_abertas', 'inscricoes_encerradas',
    'aguardando_prova', 'em_andamento', 'concluido', 'suspenso', 'cancelado',
  ]).optional(),
  salario_min: z.coerce.number().min(0).optional(),
  salario_max: z.coerce.number().min(0).optional(),
  nivel: z.string().optional(),
  banca: z.string().optional(),
});

const slugParamSchema = z.object({ slug: z.string().min(1) });
const searchQuerySchema = z.object({
  q: z.string().min(1),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

export default async function concursosRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /concursos — paginated list with filters
  fastify.get('/concursos', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = listQuerySchema.parse(request.query);
    const { page, per_page, estado, esfera, area, status, salario_min, salario_max, nivel, banca } = query;
    const offset = (page - 1) * per_page;

    const client = await fastify.pg.connect();
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let pi = 1;

      if (estado) { conditions.push(`c.estado = $${pi++}`); params.push(estado); }
      if (esfera) { conditions.push(`c.esfera = $${pi++}`); params.push(esfera); }
      if (area) { conditions.push(`c.area ILIKE $${pi++}`); params.push(`%${area}%`); }
      if (status) { conditions.push(`c.status = $${pi++}`); params.push(status); }
      if (salario_min != null) { conditions.push(`c.salario_max >= $${pi++}`); params.push(salario_min); }
      if (salario_max != null) { conditions.push(`c.salario_min <= $${pi++}`); params.push(salario_max); }
      if (nivel) { conditions.push(`$${pi++} = ANY(c.nivel_escolaridade)`); params.push(nivel); }
      if (banca) { conditions.push(`c.banca_organizadora ILIKE $${pi++}`); params.push(`%${banca}%`); }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await client.query(
        `SELECT COUNT(*)::integer as total FROM concursos c ${where}`,
        params,
      );
      const total = countResult.rows[0].total;

      const dataResult = await client.query(
        `SELECT
          c.id, c.slug, c.titulo, c.orgao, c.banca_organizadora,
          c.esfera, c.estado, c.cidade, c.regiao, c.area,
          c.cargos, c.nivel_escolaridade,
          c.salario_min, c.salario_max, c.remuneracao_texto,
          c.vagas_total, c.vagas_pcd,
          c.inscricoes_inicio, c.inscricoes_fim, c.data_prova,
          c.status, c.resumo, c.palavras_chave, c.edital_url,
          c.relevance_score, c.view_count, c.created_at, c.updated_at,
          s.name as source_name, s.type as source_type
        FROM concursos c
        LEFT JOIN sources s ON c.source_id = s.id
        ${where}
        ORDER BY
          CASE WHEN c.status = 'inscricoes_abertas' THEN 0
               WHEN c.status = 'previsto' THEN 1
               WHEN c.status = 'aguardando_prova' THEN 2
               ELSE 3 END ASC,
          c.inscricoes_fim ASC NULLS LAST,
          c.relevance_score DESC,
          c.created_at DESC
        LIMIT $${pi++} OFFSET $${pi++}`,
        [...params, per_page, offset],
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

  // GET /concursos/search?q=
  fastify.get('/concursos/search', async (request: FastifyRequest, reply: FastifyReply) => {
    const { q, page, per_page } = searchQuerySchema.parse(request.query);
    const offset = (page - 1) * per_page;

    const client = await fastify.pg.connect();
    try {
      const searchParam = `%${q}%`;
      const countResult = await client.query(
        `SELECT COUNT(*)::integer as total
         FROM concursos c
         WHERE c.titulo ILIKE $1
            OR c.orgao ILIKE $1
            OR c.banca_organizadora ILIKE $1
            OR c.area ILIKE $1
            OR $2 = ANY(c.palavras_chave)`,
        [searchParam, q.toLowerCase()],
      );
      const total = countResult.rows[0].total;

      const dataResult = await client.query(
        `SELECT
          c.id, c.slug, c.titulo, c.orgao, c.banca_organizadora,
          c.esfera, c.estado, c.cidade, c.regiao, c.area,
          c.cargos, c.nivel_escolaridade,
          c.salario_min, c.salario_max,
          c.vagas_total, c.inscricoes_fim, c.data_prova,
          c.status, c.resumo, c.relevance_score, c.view_count,
          c.created_at, s.name as source_name
        FROM concursos c
        LEFT JOIN sources s ON c.source_id = s.id
        WHERE c.titulo ILIKE $1
           OR c.orgao ILIKE $1
           OR c.banca_organizadora ILIKE $1
           OR c.area ILIKE $1
           OR $2 = ANY(c.palavras_chave)
        ORDER BY c.relevance_score DESC, c.created_at DESC
        LIMIT $3 OFFSET $4`,
        [searchParam, q.toLowerCase(), per_page, offset],
      );

      return reply.send({
        data: dataResult.rows,
        total,
        page,
        per_page,
        total_pages: Math.ceil(total / per_page),
        query: q,
      });
    } finally {
      client.release();
    }
  });

  // GET /concursos/:slug
  fastify.get('/concursos/:slug', async (request: FastifyRequest, reply: FastifyReply) => {
    const { slug } = slugParamSchema.parse(request.params);

    const client = await fastify.pg.connect();
    try {
      const result = await client.query(
        `SELECT c.*, s.name as source_name, s.type as source_type, s.url as source_url
         FROM concursos c
         LEFT JOIN sources s ON c.source_id = s.id
         WHERE c.slug = $1`,
        [slug],
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Concurso não encontrado' });
      }

      // Async view count increment
      client.query(
        'UPDATE concursos SET view_count = view_count + 1 WHERE slug = $1',
        [slug],
      ).catch((err) => fastify.log.error({ err }, 'Failed to increment view count'));

      // Fetch similar concursos (same area or estado, different status=done/cancelled)
      const main = result.rows[0];
      const similarResult = await client.query(
        `SELECT id, slug, titulo, orgao, estado, esfera, status,
                vagas_total, salario_min, salario_max, inscricoes_fim, area
         FROM concursos
         WHERE id != $1
           AND (area = $2 OR estado = $3)
           AND status IN ('inscricoes_abertas', 'previsto', 'aguardando_prova')
         ORDER BY relevance_score DESC, created_at DESC
         LIMIT 4`,
        [main.id, main.area, main.estado],
      );

      return reply.send({
        ...main,
        similar: similarResult.rows,
      });
    } finally {
      client.release();
    }
  });

  // PATCH /concursos/:slug/status
  fastify.patch('/concursos/:slug/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const { slug } = slugParamSchema.parse(request.params);
    const body = z.object({
      status: z.enum([
        'previsto', 'inscricoes_abertas', 'inscricoes_encerradas',
        'aguardando_prova', 'em_andamento', 'concluido', 'suspenso', 'cancelado',
      ]),
    }).parse(request.body);

    const client = await fastify.pg.connect();
    try {
      const result = await client.query(
        `UPDATE concursos SET status = $1, updated_at = NOW()
         WHERE slug = $2
         RETURNING id, slug, status`,
        [body.status, slug],
      );
      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Concurso não encontrado' });
      }
      return reply.send(result.rows[0]);
    } finally {
      client.release();
    }
  });

  // GET /stats — counts by status, area, estado
  fastify.get('/stats', async (_request: FastifyRequest, reply: FastifyReply) => {
    const client = await fastify.pg.connect();
    try {
      const [byStatus, byArea, byEstado, summary] = await Promise.all([
        client.query(
          `SELECT status, COUNT(*)::integer as count
           FROM concursos GROUP BY status ORDER BY count DESC`,
        ),
        client.query(
          `SELECT area, COUNT(*)::integer as count
           FROM concursos WHERE area IS NOT NULL
           GROUP BY area ORDER BY count DESC LIMIT 15`,
        ),
        client.query(
          `SELECT estado, COUNT(*)::integer as count
           FROM concursos WHERE estado IS NOT NULL
           GROUP BY estado ORDER BY count DESC`,
        ),
        client.query(
          `SELECT
            COUNT(*)::integer as total,
            COUNT(*) FILTER (WHERE status = 'inscricoes_abertas')::integer as inscricoes_abertas,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::integer as novos_hoje,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::integer as novos_7d
           FROM concursos`,
        ),
      ]);

      return reply.send({
        by_status: Object.fromEntries(byStatus.rows.map((r) => [r.status, r.count])),
        by_area: byArea.rows,
        by_estado: byEstado.rows,
        ...summary.rows[0],
      });
    } finally {
      client.release();
    }
  });
}
