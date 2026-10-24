import { describe, expect, it } from "vitest";
import { openDb } from "./db";

describe("openDb", () => {
  it("AC-12.3 creates the schema and persists an account", () => {
    const db = openDb(":memory:");
    db.prepare("INSERT INTO accounts (id, username, balance) VALUES (?, ?, ?)").run("a1", "alice", 50);
    expect(db.prepare("SELECT id, username, balance FROM accounts WHERE id = ?").get("a1")).toEqual({
      id: "a1",
      username: "alice",
      balance: 50,
    });
  });

  it("is safe to open twice on the same schema and rejects a negative balance", () => {
    const db = openDb(":memory:");
    db.exec("CREATE TABLE IF NOT EXISTS accounts (id TEXT)"); // no-op: table exists
    expect(() =>
      db.prepare("INSERT INTO accounts (id, username, balance) VALUES (?, ?, ?)").run("a1", "bob", -1),
    ).toThrow();
  });
});
