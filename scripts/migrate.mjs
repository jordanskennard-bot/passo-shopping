// Applies db/migrations/*.sql in name order. Usage: DATABASE_URL=... npm run migrate
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false },
});
await client.connect();
await client.query(
  "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
);

const dir = path.join(process.cwd(), "db", "migrations");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const done = new Set((await client.query("select name from schema_migrations")).rows.map((r) => r.name));

for (const file of files) {
  if (done.has(file)) continue;
  const sql = fs.readFileSync(path.join(dir, file), "utf8");
  console.log(`Applying ${file}`);
  await client.query("begin");
  try {
    await client.query(sql);
    await client.query("insert into schema_migrations (name) values ($1)", [file]);
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    console.error(`Failed on ${file}:`, err.message);
    process.exit(1);
  }
}
console.log("Migrations up to date");
await client.end();
