import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../server.js";

describe("API Health Check", () => {
  beforeAll(async () => {
    // Importing server.js runs startServer() which initializes the DB.
    await import("../server.js");
  });

  it("GET /api/health returns ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    const body = res.body as any;
    expect(body.status).toBe("ok");
  });
});

describe("Auth API", () => {
  it("POST /api/auth/login with invalid credentials returns 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nonexistent@test.com", password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("POST /api/auth/login with valid demo credentials returns token", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@nimbo.com", password: "123456" });
    expect(res.status).toBe(200);
    const body = res.body as any;
    expect(body).toHaveProperty("token");
    expect(body).toHaveProperty("user");
    expect(body.user).not.toHaveProperty("password");
  });

  it("POST /api/auth/register with missing fields returns 400", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "test@test.com" });
    expect(res.status).toBe(400);
  });
});

describe("Products API", () => {
  let token: string;

  beforeAll(async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@nimbo.com", password: "123456" });
    token = (login.body as any).token;
  });

  it("GET /api/products returns 401 without token", async () => {
    const res = await request(app).get("/api/products");
    expect(res.status).toBe(401);
  });

  it("GET /api/products returns array with token", async () => {
    const res = await request(app)
      .get("/api/products")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
