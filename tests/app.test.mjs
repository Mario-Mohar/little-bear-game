/**
 * Loads the real Express app, which CI never did before. After the Express 5
 * upgrade the catch-all route threw while the module loaded, so the server
 * could not start while every other test stayed green.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createRequire } from "node:module";
import jwt from "jsonwebtoken";

const require = createRequire(import.meta.url);
const app = require("../server/app.js");
const { pool } = require("../server/config/db.js");

let server;
let base;

beforeAll(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

describe("app", () => {
  it("answers the health check", async () => {
    const res = await fetch(`${base}/api/health`);
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("ok");
  });

  it("serves the game for unknown paths", async () => {
    const res = await fetch(`${base}/some/deep/link`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
  });

  it("searches friends with the trimmed term", async () => {
    const query = vi.spyOn(pool, "query").mockResolvedValue({ rows: [] });
    const token = jwt.sign({ id: 7, username: "bear" }, process.env.JWT_SECRET);

    const res = await fetch(`${base}/api/friends/search?query=${encodeURIComponent("  Bear ")}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    expect(query).toHaveBeenCalledWith(expect.any(String), ["%bear%", "bear", 7]);
    query.mockRestore();
  });

  async function addCoins(coins, upgrades) {
    const query = vi.spyOn(pool, "query").mockImplementation(async (sql) => {
      if (sql.startsWith("SELECT purchased_upgrades")) return { rows: [{ purchased_upgrades: upgrades, total_coins: 1000 }] };
      return { rows: [{ total_coins: 1234 }] };
    });
    const token = jwt.sign({ id: 7, username: "bear" }, process.env.JWT_SECRET);
    const res = await fetch(`${base}/api/users/coins`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ coins, level: 1 }),
    });
    const update = query.mock.calls.find(([sql]) => sql.startsWith("UPDATE users SET total_coins"));
    query.mockRestore();
    return { res, added: update?.[1][0] };
  }

  it("applies the coin multiplier once, on the server (#16)", async () => {
    expect((await addCoins(30, [])).added).toBe(30);
    expect((await addCoins(30, ["double_coins"])).added).toBe(60);
    expect((await addCoins(30, ["double_coins", "triple_coins"])).added).toBe(90);
  });

  it("refuses negative coins before touching the database", async () => {
    const { res, added } = await addCoins(-500, []);
    expect(res.status).toBe(400);
    expect(added).toBeUndefined();
  });
});
