import assert from "node:assert/strict";
import { test } from "node:test";
import { Forms } from "../src/service.js";
import type { RecordRepository } from "../../../packages/chest-client/src/record.js";
import { FormsError } from "../src/model.js";

const form = { title: "Contact", description: "", fields: [{ name: "message", label: "Message", required: true }] };
const code = (expected: string) => (error: unknown) => error instanceof FormsError && error.code === expected;
function setup() {
  let raw = ""; let failed = false;
  const members = new Set(["camille", "alex"]);
  const repository: RecordRepository = {
    async read() { return raw; },
    async write(value) { if (failed) throw new Error("storage unavailable"); raw = value; },
  };
  const authorize = async (actor: string, action: string) => members.has(actor) && (action === "manage" || actor === "camille");
  return { app: new Forms(repository, authorize), members, repository, authorize, fail: () => { failed = true; } };
}
test("draft, explicit publication, anonymous response, protected reading and closure", async () => {
  const { app, members } = setup();
  await assert.rejects(app.create("sam", form), code("forbidden"));
  await app.create("alex", form);
  await assert.rejects(app.publicForm(), code("unavailable"));
  await assert.rejects(app.submit({ message: "premature" }), code("unavailable"));
  await assert.rejects(app.publish("alex"), code("forbidden"));
  await app.publish("camille");
  await assert.rejects(app.publicForm(), code("unavailable"));
  await assert.rejects(app.submit({ message: "anonymous" }, true), code("unavailable"));
  await assert.rejects(app.share("alex"), code("forbidden"));
  await app.share("camille");
  assert.deepEqual(await app.publicForm(), form);
  await app.submit({ message: "Bonjour" }, true);
  await assert.rejects(app.responses("visitor"), code("forbidden"));
  await assert.rejects(app.responses("sam"), code("forbidden"));
  assert.equal((await app.responses("alex"))[0]?.answers.message, "Bonjour");
  members.delete("alex");
  await assert.rejects(app.responses("alex"), code("forbidden"));
  await app.close("camille");
  await assert.rejects(app.submit({ message: "late" }), code("unavailable"));
  await assert.rejects(app.publicForm(), code("unavailable"));
  assert.equal((await app.responses("camille")).length, 1);
});
test("reject unexpected input without changing stored data", async () => {
  const { app, repository } = setup();
  await app.create("camille", form); await app.publish("camille");
  const before = await repository.read();
  for (const input of [null, [], {}, { message: "" }, { message: 7 }, { message: "x".repeat(241) }, { message: "ok", actor: "camille" }, JSON.parse('{"message":"ok","__proto__":{"admin":true}}') as unknown]) {
    await assert.rejects(app.submit(input), code("invalid"));
  }
  assert.equal(await repository.read(), before);
});
test("concurrent submissions do not overwrite each other; reopening preserves state", async () => {
  const { app, repository, authorize } = setup();
  await app.create("camille", form); await app.publish("camille");
  await Promise.all([app.submit({ message: "one" }), app.submit({ message: "two" })]);
  const reopened = new Forms(repository, authorize);
  assert.deepEqual((await reopened.responses("alex")).map(r => r.answers.message), ["one", "two"]);
});
test("failed persistence never reports successful publication", async () => {
  const { app, fail } = setup();
  await app.create("camille", form); fail();
  await assert.rejects(app.publish("camille"));
  await assert.rejects(app.publicForm(), code("unavailable"));
});
test("corrupt persisted state is not replaced or exposed", async () => {
  const { app, repository } = setup();
  await repository.write('{"version":9000}');
  await assert.rejects(app.create("camille", form), code("unavailable"));
  await assert.rejects(app.publicForm(), code("unavailable"));
  assert.equal(await repository.read(), '{"version":9000}');
});
test("access is checked when a queued operation runs, not before", async () => {
  const { app, members } = setup();
  await app.create("camille", form);
  const reading = app.responses("alex");
  members.delete("alex");
  await assert.rejects(reading, code("forbidden"));
});
test("draft definitions reject duplicate fields and unsolicited properties", async () => {
  const { app, repository } = setup();
  for (const input of [{ ...form, permissions: ["admin"] }, { ...form, title: "" }, { ...form, fields: [form.fields[0], form.fields[0]] }, { ...form, fields: [{ name: "constructor", label: "x", required: true }] }]) {
    await assert.rejects(app.create("camille", input), code("invalid"));
    assert.equal(await repository.read(), "");
  }
});
test("unavailable authorization cannot open access or touch storage", async () => {
  let touched = false;
  const app = new Forms({ async read() { touched = true; return ""; }, async write() { touched = true; } }, async () => { throw new Error("policy unavailable"); });
  await assert.rejects(app.create("camille", form));
  await assert.rejects(app.responses("camille"));
  assert.equal(touched, false);
});
test("a record at its storage limit can still close collection", async () => {
  let raw = ""; let quota = Number.POSITIVE_INFINITY;
  const repository = {
    async read() { return raw; },
    async write(value: string) { if (Buffer.byteLength(value) > quota) throw new Error("quota exceeded"); raw = value; },
  };
  const app = new Forms(repository, async () => true);
  await app.create("camille", form); await app.publish("camille");
  await app.submit({ message: "saved" });
  quota = Buffer.byteLength(raw);
  await app.share("camille");
  await app.close("camille");
  await assert.rejects(app.submit({ message: "late" }), code("unavailable"));
  assert.equal((await app.responses("camille")).length, 1);
});
