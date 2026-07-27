FROM node:22-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts=false

COPY . .

RUN mkdir -p /app/db-data

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/server.cjs"]
