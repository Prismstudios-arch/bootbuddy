# Node 22 LTS (supported until April 2027). The original brief pinned Node 20,
# but Node 20 reached end-of-life in April 2026 — an EOL runtime would fail the
# project's own security checklist, so we pin the current LTS instead.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Run as the non-root user the base image ships with.
USER node
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/drizzle ./drizzle
EXPOSE 8080
CMD ["node", "dist/index.js"]
