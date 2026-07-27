console.log("Starting Nimbo ERP...");
try {
  require("./dist/server.cjs");
} catch (e) {
  console.error("FATAL:", e.message, e.stack);
  process.exit(1);
}
