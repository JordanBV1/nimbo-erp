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
CMD node -e "try{require('./dist/server.cjs')}catch(e){const h=require('http');h.createServer((r,w)=>{w.end('FAIL:'+e.message)}).listen(3000,'0.0.0.0')}"
