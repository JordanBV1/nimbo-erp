FROM node:22-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts=false
COPY . .
EXPOSE 3000
ENV NODE_ENV=production
ENV JWT_SECRET=REDACTED_ROTATE_ME
ENV PORT=3000
ENV SITE_USERNAME=JordanBV
ENV SITE_PASSWORD=Jordan*06061561047
CMD ["node", "dist/server.cjs"]
