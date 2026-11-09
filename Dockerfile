# Stage 1: Build Frontend
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Production Runtime
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV SERVE_STATIC=true
ENV PORT=3333

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY server ./server
COPY .env.example ./.env.example

EXPOSE 3333

CMD ["node", "server/index.js"]
