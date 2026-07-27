FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts=false
COPY test-deploy.js .
EXPOSE 3000
CMD ["node", "test-deploy.js"]
