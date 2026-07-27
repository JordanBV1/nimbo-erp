FROM node:22-alpine
WORKDIR /app
RUN echo 'const http=require("http");const s=http.createServer((r,w)=>{w.writeHead(200,{"Content-Type":"text/plain"});w.end("nimbo-erp-ok")});s.listen(3000,"0.0.0.0",()=>console.log("OK"))' > server.js
EXPOSE 3000
CMD ["node", "server.js"]
