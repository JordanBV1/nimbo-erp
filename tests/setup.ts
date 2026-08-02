import fs from "fs";
import path from "path";

const TEST_DB = path.join(process.cwd(), "db-data", "nimbo-test.db");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-key";
process.env.DB_PATH = TEST_DB;
process.env.APP_URL = "http://localhost:3000";

if (fs.existsSync(TEST_DB)) {
  fs.rmSync(TEST_DB, { force: true });
}
