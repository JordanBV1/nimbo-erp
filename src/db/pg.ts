import pg from "pg";

let _pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!_pool) {
    _pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return _pool;
}

// Convert sqlite-style ? placeholders to postgres $1..$n
export function toPgSql(sql: string): string {
  let idx = 0;
  let out = "";
  let inStr = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'") {
      if (inStr && sql[i + 1] === "'") {
        out += "''";
        i += 1;
        continue;
      }
      inStr = !inStr;
      out += ch;
      continue;
    }
    if (!inStr && ch === "?") {
      idx += 1;
      out += `$${idx}`;
      continue;
    }
    out += ch;
  }
  return out
    .replace(/datetime\('now'\)/g, "CURRENT_TIMESTAMP")
    .replace(/strftime\('%Y-%m-%dT%H:%M:%fZ','now'\)/g, "to_char(now() at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')");
}

export async function pgQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const res = await getPool().query(toPgSql(sql), params);
  return res.rows as T[];
}

export async function pgRun(sql: string, params: any[] = []): Promise<void> {
  await getPool().query(toPgSql(sql), params);
}

export async function pgGet<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const res = await getPool().query(toPgSql(sql), params);
  return (res.rows[0] as T) ?? null;
}

export async function pgCount(table: string): Promise<number> {
  const res = await getPool().query(`SELECT COUNT(*)::int AS c FROM ${table}`);
  return res.rows[0]?.c ?? 0;
}