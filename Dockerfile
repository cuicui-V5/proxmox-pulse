FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV SERVE_STATIC=true
ENV PORT=3333

COPY package*.json ./
RUN npm install --omit=dev

COPY dist ./dist
COPY server ./server
COPY .env ./.env

EXPOSE 3333

CMD ["node", "server/index.js"]
