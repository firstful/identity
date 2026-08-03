# Identity — user/pass auth service (better-auth)
FROM docker.io/library/node:22

WORKDIR /app
RUN npm config set registry https://registry.npmjs.org/

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY server/ ./server/

ENV PORT=3002
ENV NODE_ENV=production
ENV DATA_DIR=/app/data

RUN mkdir -p /app/data

EXPOSE 3002
CMD ["npx", "tsx", "server/index.ts"]
