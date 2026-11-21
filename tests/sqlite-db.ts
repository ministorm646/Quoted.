import { DatabaseSync } from "node:sqlite";
import { SCHEMA } from "../server/schema.js";
import type { Db, Stmt } from "../server/db.js";

// An in-memory SQLite database that looks like the real Db wrapper, so the
// scheduler's real SQL runs in the tests.
export function memoryDb(): Db {
  const d = new DatabaseSync(":memory:");
  for (const s of SCHEMA) d.exec(s);
  const returnsRows = (sql: string) => /^\s*(select|with)/i.test(sql) || /\breturning\b/i.test(sql);
  const make = (sql: string, args: any[] = []): Stmt => ({
    sql, args,
    bind: (...a: unknown[]) => make(sql, a),
    first: async () => ((d.prepare(sql).get(...args) as any) ?? null),
    all: async () => ({ results: d.prepare(sql).all(...args) as any[], meta: { changes: 0 } }),
    run: async () => ({ meta: { changes: Number(d.prepare(sql).run(...args).changes) } }),
  });
  return {
    prepare: (sql) => make(sql),
    async batch(stmts) {
      d.exec("BEGIN");
      try {
        const out = stmts.map((s) => {
          const st = d.prepare(s.sql);
          if (returnsRows(s.sql)) return { results: st.all(...(s.args as any[])) as any[], meta: { changes: 0 } };
          return { results: [] as any[], meta: { changes: Number(st.run(...(s.args as any[])).changes) } };
        });
        d.exec("COMMIT");
        return out;
      } catch (e) { d.exec("ROLLBACK"); throw e; }
    },
  };
}
