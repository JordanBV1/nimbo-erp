FROM node:22-alpine
WORKDIR /app
COPY test-deploy.js .
EXPOSE 3000
CMD ["node", "test-deploy.js"]
