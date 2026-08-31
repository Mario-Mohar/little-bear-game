/**
 * The middleware that decides who is signed in and who is an administrator.
 *
 * Worth testing above everything else in this server: it is the only place
 * where being wrong is a security problem rather than a wrong number on a
 * leaderboard, and it is pure -- no database, no network. The suite runs
 * against the real module with a throwaway secret supplied by vitest.config.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import jwt from "jsonwebtoken";

const require = createRequire(import.meta.url);
const auth = require("../server/middleware/auth.js");
const SECRET = process.env.JWT_SECRET;

function fakeResponse() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

function requestWith(token) {
  return { headers: token === undefined ? {} : { authorization: token } };
}

describe("generateToken", () => {
  it("carries the fields the rest of the server reads", () => {
    const token = auth.generateToken({
      id: 7,
      username: "bear",
      email: "bear@example.com",
      is_admin: false,
    });
    const payload = jwt.verify(token, SECRET);

    expect(payload.id).toBe(7);
    expect(payload.username).toBe("bear");
    expect(payload.email).toBe("bear@example.com");
    expect(payload.isAdmin).toBe(false);
  });

  it("never puts the password hash in the token", () => {
    const token = auth.generateToken({
      id: 7,
      username: "bear",
      password_hash: "$2b$10$notreal",
      is_admin: false,
    });
    // A JWT is signed, not encrypted: anyone holding it can read the payload.
    const payload = jwt.decode(token);
    expect(JSON.stringify(payload)).not.toContain("$2b$");
    expect(payload.password_hash).toBeUndefined();
  });

  it("grants admin only for a real boolean true", () => {
    // is_admin arrives from Postgres. Anything truthy-but-not-true -- 1, "t",
    // "true" -- must not become an administrator.
    for (const value of [true]) {
      expect(jwt.verify(auth.generateToken({ id: 1, is_admin: value }), SECRET).isAdmin).toBe(true);
    }
    for (const value of [1, "true", "t", "yes", {}, [], "false", 0, null, undefined]) {
      expect(jwt.verify(auth.generateToken({ id: 1, is_admin: value }), SECRET).isAdmin).toBe(false);
    }
  });

  it("expires", () => {
    const payload = jwt.verify(auth.generateToken({ id: 1, is_admin: false }), SECRET);
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });
});

describe("authenticateToken", () => {
  let next;
  beforeEach(() => {
    next = vi.fn();
  });

  it("refuses a request with no authorization header", () => {
    const res = fakeResponse();
    auth.authenticateToken(requestWith(undefined), res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("refuses a header with no token after the scheme", () => {
    const res = fakeResponse();
    auth.authenticateToken(requestWith("Bearer"), res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("refuses a token that is not a token", () => {
    const res = fakeResponse();
    auth.authenticateToken(requestWith("Bearer not-a-jwt"), res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("refuses a token signed with a different secret", () => {
    const forged = jwt.sign({ id: 1, isAdmin: true }, "some-other-secret");
    const res = fakeResponse();
    auth.authenticateToken(requestWith(`Bearer ${forged}`), res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("refuses an expired token", () => {
    const expired = jwt.sign({ id: 1, isAdmin: false }, SECRET, { expiresIn: "-1s" });
    const res = fakeResponse();
    auth.authenticateToken(requestWith(`Bearer ${expired}`), res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("refuses a token whose signature has been stripped", () => {
    // The alg=none attack: keep the header and payload, drop the signature.
    const real = auth.generateToken({ id: 1, username: "bear", is_admin: true });
    const [, payload] = real.split(".");
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const res = fakeResponse();
    auth.authenticateToken(requestWith(`Bearer ${header}.${payload}.`), res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("lets a valid token through and attaches the user", () => {
    const token = auth.generateToken({ id: 7, username: "bear", is_admin: false });
    const req = requestWith(`Bearer ${token}`);
    const res = fakeResponse();
    auth.authenticateToken(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBeNull();
    expect(req.user.id).toBe(7);
    expect(req.user.username).toBe("bear");
  });
});

describe("optionalAuth", () => {
  let next;
  beforeEach(() => {
    next = vi.fn();
  });

  it("continues as nobody when there is no token", () => {
    const req = requestWith(undefined);
    const res = fakeResponse();
    auth.optionalAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeNull();
    expect(res.statusCode).toBeNull();
  });

  it("continues as nobody when the token is bad, rather than refusing", () => {
    const req = requestWith("Bearer nonsense");
    const res = fakeResponse();
    auth.optionalAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeNull();
    expect(res.statusCode).toBeNull();
  });

  it("continues as nobody when the token has expired", () => {
    const expired = jwt.sign({ id: 1, isAdmin: true }, SECRET, { expiresIn: "-1s" });
    const req = requestWith(`Bearer ${expired}`);
    const res = fakeResponse();
    auth.optionalAuth(req, res, next);
    expect(req.user).toBeNull();
  });

  it("attaches the user when the token is good", () => {
    const token = auth.generateToken({ id: 3, username: "cub", is_admin: false });
    const req = requestWith(`Bearer ${token}`);
    auth.optionalAuth(req, fakeResponse(), next);
    expect(req.user.id).toBe(3);
  });
});

describe("requireAdmin", () => {
  let next;
  beforeEach(() => {
    next = vi.fn();
  });

  it("refuses when nothing has authenticated first", () => {
    // It has to hang behind authenticateToken, never stand alone: without
    // req.user there is nothing to check.
    const res = fakeResponse();
    auth.requireAdmin({}, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("refuses a signed-in user who is not an administrator", () => {
    const res = fakeResponse();
    auth.requireAdmin({ user: { id: 1, isAdmin: false } }, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("refuses anything merely truthy in place of true", () => {
    for (const value of [1, "true", "yes", {}, []]) {
      const res = fakeResponse();
      const spy = vi.fn();
      auth.requireAdmin({ user: { id: 1, isAdmin: value } }, res, spy);
      expect(res.statusCode).toBe(403);
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it("lets a real administrator through", () => {
    const res = fakeResponse();
    auth.requireAdmin({ user: { id: 1, isAdmin: true } }, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBeNull();
  });
});
