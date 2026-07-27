const fs = require("fs");
try {
  require("./dist/server.cjs");
} catch (e) {
  fs.writeFileSync("/debug-error.txt", e.stack || e.message);
  process.exit(1);
}
// If server doesn't crash but returns, write debug
setTimeout(() => {
  fs.writeFileSync("/debug-no-listen.txt", "Server did not crash but may not be listening");
}, 5000);
