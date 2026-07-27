FROM node:22-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts=false
COPY . .
EXPOSE 3000
ENV NODE_ENV=production
ENV JWT_SECRET=test123
ENV PORT=3000
CMD node -e "require('./dist/server.cjs')"
