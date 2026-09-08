/**
 * Minimal D1Database shim backed by Node's built-in `node:sqlite`.
 * Used by the HTTP tenant-isolation harness (no Miniflare/Wrangler required in CI).
 */
import { DatabaseSync } from "node:sqlite";

type StmtResult = {
  success: boolean;
  meta: { changes: number; last_row_id: number; duration: number };
  results?: unknown[];
};

/** Minimal D1-like surface used by the IDOR harness (not the full Workers D1 API). */
export type HarnessD1 = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      first<T = unknown>(colName?: string): Promise<T | null>;
      run(): Promise<StmtResult>;
      all<T = unknown>(): Promise<StmtResult & { results: T[] }>;
    };
  };
};

function wrapRun(db: DatabaseSync, sql: string, binds: unknown[]): StmtResult {
  const info = db.prepare(sql).run(...(binds as never[]));
  return {
    success: true,
    meta: {
      changes: Number(info.changes ?? 0),
      last_row_id: Number(info.lastInsertRowid ?? 0),
      duration: 0,
    },
  };
}

function wrapAll(db: DatabaseSync, sql: string, binds: unknown[]): StmtResult {
  const rows = db.prepare(sql).all(...(binds as never[]));
  return {
    success: true,
    meta: { changes: 0, last_row_id: 0, duration: 0 },
    results: rows as unknown[],
  };
}

function wrapFirst(db: DatabaseSync, sql: string, binds: unknown[]): unknown {
  return db.prepare(sql).get(...(binds as never[])) ?? null;
}

class MemoryD1PreparedStatement {
  #db: DatabaseSync;
  #sql: string;
  #binds: unknown[] = [];

  constructor(db: DatabaseSync, sql: string) {
    this.#db = db;
    this.#sql = sql;
  }

  bind(...values: unknown[]): MemoryD1PreparedStatement {
    this.#binds = values;
    return this;
  }

  async first<T = unknown>(colName?: string): Promise<T | null> {
    const row = wrapFirst(this.#db, this.#sql, this.#binds) as Record<string, unknown> | null;
    if (!row) return null;
    if (colName) return (row[colName] as T) ?? null;
    return row as T;
  }

  async run(): Promise<StmtResult> {
    return wrapRun(this.#db, this.#sql, this.#binds);
  }

  async all<T = unknown>(): Promise<StmtResult & { results: T[] }> {
    const out = wrapAll(this.#db, this.#sql, this.#binds);
    return { ...out, results: (out.results ?? []) as T[] };
  }
}

export class MemoryD1Database implements HarnessD1 {
  #db: DatabaseSync;

  constructor() {
    this.#db = new DatabaseSync(":memory:");
    this.#db.exec("PRAGMA foreign_keys = ON");
  }

  prepare(sql: string): MemoryD1PreparedStatement {
    return new MemoryD1PreparedStatement(this.#db, sql);
  }

  exec(sql: string): void {
    this.#db.exec(sql);
  }
}
