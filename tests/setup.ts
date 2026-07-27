import { beforeAll, afterAll } from "vitest";

beforeAll(() => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test-secret-key";
});

afterAll(() => {
  // cleanup
});
