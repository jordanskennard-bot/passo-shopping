import fs from "node:fs";
import path from "node:path";

export type Row = Record<string, unknown>;

export interface Db {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
}

let current: Db | null = null;
let pending: Promise<Db> | null = null;

/** Tests and the local demo inject their own database. */
export function setDb(db: Db | null) {
  current = db;
  pending = null;
}

export async function getDb(): Promise<Db> {
  if (current) return current;
  if (pending) return pending;
  pending = createDb();
  current = await pending;
  return current;
}

async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: url,
      max: 5,
      ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false },
    });
    return {
      async query<T = Row>(sql: string, params: unknown[] = []) {
        const res = await pool.query(sql, params as unknown[]);
        return res.rows as T[];
      },
    };
  }
  if (process.env.PGLITE === "1" && process.env.NODE_ENV !== "production") {
    const db = await createPgliteDb();
    await migrate(db);
    const { seedDemo } = await import("./demo");
    await seedDemo(db);
    return db;
  }
  throw new Error("DATABASE_URL is not set");
}

/** In-memory Postgres for tests and the local demo only. */
export async function createPgliteDb(): Promise<Db> {
  const mod = await import(/* webpackIgnore: true */ "@electric-sql/pglite");
  const pg = new mod.PGlite();
  return {
    async query<T = Row>(sql: string, params: unknown[] = []) {
      if (params.length === 0 && sql.includes(";")) {
        await pg.exec(sql);
        return [] as T[];
      }
      const res = await pg.query(sql, params as unknown[]);
      return res.rows as T[];
    },
  };
}

export async function migrate(db: Db) {
  const dir = path.join(process.cwd(), "db", "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    await db.query(fs.readFileSync(path.join(dir, file), "utf8"));
  }
}
