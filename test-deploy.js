const http = require("http");
http.createServer((req, res) => {
  res.writeHead(200, {"Content-Type":"text/plain"});
  res.end("OK");
}).listen(3000, "0.0.0.0", () => console.log("UP"));
