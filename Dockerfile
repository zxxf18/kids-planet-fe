FROM node:22-bookworm-slim AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder

WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

WORKDIR /app
COPY --from=builder --chown=node:node /app/dist/standalone ./
# Vinext standalone does not currently expose basePath metadata to its Node
# static-file handler. Nginx strips /kidstar for _next requests, so keep the
# same small static bundle available at the handler's root lookup path.
RUN cp -a ./dist/client/kidstar/_next ./dist/client/_next
COPY --from=dependencies --chown=node:node /app/node_modules/react ./node_modules/react
COPY --from=dependencies --chown=node:node /app/node_modules/react-dom ./node_modules/react-dom
COPY --from=dependencies --chown=node:node /app/node_modules/scheduler ./node_modules/scheduler

USER node
EXPOSE 3000

CMD ["node", "server.js"]
