import { createClient, type InValue, type ResultSet } from "@libsql/client/web";
import { SCHEMA, MIGRATIONS, MIGRATION_VERSION } from "./schema.js";

type Row = Record<string, unknown>;
const toRows = (r: ResultSet): Row[] =>
  r.rows.map((row) => Object.fromEntries(r.columns.map((c, i) => [c, row[i]])));

export type Stmt = {
  sql: string;
  args: InValue[];
  bind(...args: unknown[]): Stmt;
  first<T = Row>(): Promise<T | null>;
  all<T = Row>(): Promise<{ results: T[]; meta: { changes: number } }>;
  run(): Promise<{ meta: { changes: number } }>;
};
export type Db = {
  prepare(sql: string): Stmt;
  batch(stmts: Stmt[]): Promise<{ results: Row[]; meta: { changes: number } }[]>;
};

// A small wrapper that gives the Turso (SQLite) client the same shape the
// rest of the code uses: prepare().bind().first()/all()/run() and batch().
export function makeDb(url: string, authToken: string): Db {
  const client = createClient({ url, authToken });
  let ready: Promise<void> | null = null;
  // Creates any missing tables the first time the API runs after a cold start.
  const ensure = () =>
    (ready ??= (async () => {
      await client.batch(SCHEMA.map((sql) => ({ sql, args: [] })), "write");
      const v = Number((await client.execute("SELECT v FROM schema_meta WHERE k = 'version'")).rows[0]?.v ?? 0);
      if (v < MIGRATION_VERSION) {
        for (const [table, column, ddl] of MIGRATIONS) {
          try { await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`); }
          catch (e) { if (!/duplicate column/i.test(String(e))) throw e; } // already there
        }
        await client.execute({ sql: "INSERT OR REPLACE INTO schema_meta (k, v) VALUES ('version', ?)", args: [String(MIGRATION_VERSION)] });
      }
    })().catch((e) => { ready = null; throw e; }));
  const exec = async (sql: string, args: InValue[]) => { await ensure(); return client.execute({ sql, args }); };

  const make = (sql: string, args: InValue[] = []): Stmt => ({
    sql, args,
    bind: (...a) => make(sql, a as InValue[]),
    first: async <T = Row>() => ((toRows(await exec(sql, args))[0] as T) ?? null),
    all: async <T = Row>() => { const r = await exec(sql, args); return { results: toRows(r) as T[], meta: { changes: r.rowsAffected } }; },
    run: async () => ({ meta: { changes: (await exec(sql, args)).rowsAffected } }),
  });

  return {
    prepare: (sql) => make(sql),
    async batch(stmts) {
      await ensure();
      const rs = await client.batch(stmts.map((s) => ({ sql: s.sql, args: s.args })), "write");
      return rs.map((r) => ({ results: toRows(r), meta: { changes: r.rowsAffected } }));
    },
  };
}
