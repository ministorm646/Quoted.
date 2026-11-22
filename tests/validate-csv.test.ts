import { test } from "node:test";
import assert from "node:assert/strict";
import { parseQuote } from "../server/lib/validate.js";
import { csvCell, toCsv } from "../server/lib/csv.js";
import { escapeHtml } from "../server/lib/util.js";

const good = { clientName: "  Sam  Taylor ", clientEmail: "SAM@Client.CO", amount: "£1,250.50", description: "Garden fence" };

test("quote input: tidies and accepts good input", () => {
  const r = parseQuote(good); assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.value, { clientName: "Sam  Taylor", clientEmail: "sam@client.co", amountPence: 125050, description: "Garden fence" });
});
test("quote input: rejects bad email, amount, empty name or job", () => {
  for (const bad of [{ clientEmail: "nope" }, { amount: "-5" }, { amount: "12.345" }, { amount: "1e9" }, { amount: "" }, { clientName: "   " }, { description: "" }]) {
    assert.equal(parseQuote({ ...good, ...bad }).ok, false, JSON.stringify(bad));
  }
});
test("quote input: control characters and overlong text are cleaned", () => {
  const r = parseQuote({ ...good, description: "a\nb\u0000c".padEnd(300, "x") }); assert.ok(r.ok);
  if (r.ok) { assert.ok(r.value.description.length <= 140); assert.ok(!/[\u0000-\u001f]/.test(r.value.description)); }
});
test("csv: formulas are defused and quotes are escaped", () => {
  assert.equal(csvCell("=SUM(A1)"), "'=SUM(A1)"); assert.equal(csvCell("+44 7000"), "'+44 7000"); assert.equal(csvCell("@x"), "'@x");
  assert.equal(csvCell('say "hi", ok'), '"say ""hi"", ok"'); assert.equal(csvCell(null), ""); assert.equal(csvCell(450), "450");
  assert.equal(toCsv([["a", "b"], [1, "c,d"]]), 'a,b\r\n1,"c,d"\r\n');
});
test("html escaping covers the five dangerous characters", () => {
  assert.equal(escapeHtml(`<a href="x" onclick='y'>&`), "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;");
});
