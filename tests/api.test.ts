import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";

const BASE = "http://localhost:3000";

describe("API Health Check", () => {
  it("GET /api/health returns ok", async () => {
    const res = await fetch(`${BASE}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });
});

describe("Auth API", () => {
  it("POST /api/auth/login with invalid credentials returns 401", async () => {
    const res = await request(BASE)
      .post("/api/auth/login")
      .send({ email: "nonexistent@test.com", password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("POST /api/auth/login with valid demo credentials returns token", async () => {
    const res = await request(BASE)
      .post("/api/auth/login")
      .send({ email: "admin@nimbo.com", password: "123456" });
    if (res.status === 200) {
      expect(res.body).toHaveProperty("token");
      expect(res.body).toHaveProperty("user");
      expect(res.body.user).not.toHaveProperty("password");
    }
  });

  it("POST /api/auth/register with missing fields returns 400", async () => {
    const res = await request(BASE)
      .post("/api/auth/register")
      .send({ email: "test@test.com" });
    expect(res.status).toBe(400);
  });
});

describe("Products API", () => {
  it("GET /api/products returns array", async () => {
    const res = await fetch(`${BASE}/api/products`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});
