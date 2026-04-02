FROM node:20-alpine AS base

RUN npm install -g pnpm

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @concursohub/api

# Copy source
COPY apps/api/ ./apps/api/
COPY packages/db/ ./packages/db/

# Build
WORKDIR /app/apps/api
RUN pnpm build

FROM node:20-alpine AS runner

RUN npm install -g pnpm

WORKDIR /app

COPY --from=base /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=base /app/apps/api/package.json ./apps/api/
COPY --from=base /app/packages/db/package.json ./packages/db/

RUN pnpm install --frozen-lockfile --filter @concursohub/api --prod

COPY --from=base /app/apps/api/dist ./apps/api/dist
COPY --from=base /app/packages/db/ ./packages/db/

WORKDIR /app/apps/api

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "dist/server.js"]
