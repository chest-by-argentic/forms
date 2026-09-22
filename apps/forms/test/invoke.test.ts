import assert from "node:assert/strict";
import { test } from "node:test";
import { invoke } from "../src/invoke.js";
import { invocation } from "../../../packages/chest-client/src/requests.js";
import type { Invocation } from "../../../packages/chest-client/src/requests.js";

test("only the trusted envelope grants publication; input cannot supply rights", async () => {
  let value = "";
  const repository = { async read() { return value; }, async write(next: string) { value = next; } };
  const command: Invocation = { id: "aaaaaaaaaaaaaaaa", operation: "create", input: { title: "Contact", description: "", fields: [{ name: "message", label: "Message", required: true }] }, actor: { subject: "alex", manage: true, publish: false }, deadline: Date.now() + 5000 };
  assert.equal((await invoke(command, repository)).status, 204);
  assert.equal((await invoke({ ...command, operation: "publish", input: null }, repository)).status, 403);
  assert.equal((await invoke({ ...command, operation: "publish", input: { publish: true, subject: "camille" } }, repository)).status, 400);
  assert.equal((await invoke({ ...command, operation: "publish", input: null, actor: { subject: "camille", manage: true, publish: true } }, repository)).status, 204);
  const before = value;
  assert.equal((await invoke({ ...command, operation: "submit", input: { message: "late" }, deadline: 1 }, repository)).status, 503);
  assert.equal(value, before);
  assert.equal((await invoke({ ...command, operation: "responses", input: null, actor: { subject: "sam", manage: false, publish: false } }, repository)).status, 403);
});
test("unexpected identity envelope fields and non-boolean rights are refused", () => {
  const good = { id: "aaaaaaaaaaaaaaaa", operation: "responses", input: null, actor: { subject: "alex", manage: true, publish: false }, deadline: Date.now() + 5000 };
  assert.deepEqual(invocation(good), good);
  assert.throws(() => invocation({ ...good, cookie: "session-secret" }));
  assert.throws(() => invocation({ ...good, actor: { ...good.actor, publish: "true" } }));
  // The role is optional, an identifier, and never carried by an anonymous visitor.
  assert.deepEqual(invocation({ ...good, actor: { ...good.actor, role: "vendeur" } }), { ...good, actor: { ...good.actor, role: "vendeur" } });
  assert.throws(() => invocation({ ...good, actor: { ...good.actor, role: "Vendeur" } }));
  assert.throws(() => invocation({ ...good, actor: { ...good.actor, role: 1 } }));
  assert.throws(() => invocation({ ...good, actor: { ...good.actor, admin: true } }));
  assert.throws(() => invocation({ ...good, actor: { subject: "", manage: false, publish: false, role: "vendeur" } }));
});

test("snapshot is protected, reflects persisted transitions, and never replaces corrupt state", async () => {
  let value = ""; let reads = 0;
  const repository = { async read() { reads++; return value; }, async write(next: string) { value = next; } };
  const command: Invocation = { id: "aaaaaaaaaaaaaaaa", operation: "snapshot", input: null, actor: { subject: "alice", manage: true, publish: true }, deadline: Date.now() + 5000 };
  assert.deepEqual(await invoke(command, repository), { status: 200, body: null });
  const previousReads = reads;
  assert.equal((await invoke({ ...command, actor: { ...command.actor, manage: false } }, repository)).status, 403);
  assert.equal(reads, previousReads);
  const draft = { title: "<img src=x onerror=alert(1)>", description: "", fields: [{ name: "message", label: "Message", required: true }] };
  await invoke({ ...command, operation: "create", input: draft }, repository);
  assert.deepEqual((await invoke(command, repository)).body, { version: 1, status: "draft", definition: draft, responses: [] });
  await invoke({ ...command, operation: "publish" }, repository);
  const result = await invoke(command, repository);
  assert.equal((result.body as { status: string }).status, "open");
  value = "corrupt";
  assert.equal((await invoke(command, repository)).status, 503);
  assert.equal(value, "corrupt");
});

test("anonymous envelope only reads a shared definition and submits; management stays private", async () => {
  let value = "";
  const repository = { async read() { return value; }, async write(next: string) { value = next; } };
  const member: Invocation = { id: "aaaaaaaaaaaaaaaa", operation: "create", input: { title: "Contact", description: "", fields: [{ name: "message", label: "Message", required: true }] }, actor: { subject: "alice", manage: true, publish: true }, deadline: Date.now() + 5000 };
  const visitor: Invocation = { ...member, actor: { subject: "", manage: false, publish: false }, operation: "public-form", input: null };
  assert.deepEqual(invocation(visitor), visitor);
  assert.throws(() => invocation({ ...visitor, actor: { ...visitor.actor, manage: true } }));
  await invoke(member, repository);
  assert.equal((await invoke(visitor, repository)).status, 404);
  await invoke({ ...member, operation: "publish", input: null }, repository);
  assert.equal((await invoke(visitor, repository)).status, 404);
  assert.equal((await invoke({ ...visitor, operation: "public-submit", input: { message: "too early" } }, repository)).status, 404);
  await invoke({ ...member, operation: "share", input: null }, repository);
  assert.deepEqual((await invoke(visitor, repository)).body, member.input);
  assert.equal((await invoke({ ...visitor, operation: "public-submit", input: { message: "external" } }, repository)).status, 204);
  const before = value;
  for (const operation of ["create", "publish", "share", "close", "snapshot", "responses", "submit", "interface"]) {
    assert.equal((await invoke({ ...visitor, operation }, repository)).status, 403);
  }
  assert.equal(value, before);
  assert.deepEqual((await invoke(visitor, repository)).body, member.input);
  await invoke({ ...member, operation: "close", input: null }, repository);
  assert.equal((await invoke(visitor, repository)).status, 404);
  assert.equal((await invoke({ ...visitor, operation: "public-submit", input: { message: "late" } }, repository)).status, 404);
});

test("both interfaces are delivered by the package, bounded, and never read business storage", async () => {
  let reads = 0;
  const repository = { async read() { reads++; return ""; }, async write() { reads++; } };
  const member: Invocation = { id: "aaaaaaaaaaaaaaaa", operation: "interface", input: null, actor: { subject: "alice", manage: true, publish: false }, deadline: Date.now() + 5000 };
  const visitor: Invocation = { ...member, operation: "public-interface", actor: { subject: "", manage: false, publish: false } };
  for (const request of [member, visitor]) {
    const reply = await invoke(request, repository);
    assert.equal(reply.status, 200);
    assert.deepEqual(Object.keys(reply.body as object).sort(), ["css", "html", "script"]);
    // Same bound as the Core accepts for an interface document.
    assert.ok(Buffer.byteLength(JSON.stringify(reply.body)) < 32 * 1024);
    assert.equal((await invoke({ ...request, input: { actor: "alice" } }, repository)).status, 400);
    assert.equal((await invoke({ ...request, deadline: 1 }, repository)).status, 503);
  }
  // The publish right only adapts the display of the member interface.
  const script = (reply: { body: unknown }): string => (reply.body as { script: string }).script;
  assert.ok(script(await invoke(member, repository)).endsWith("(window.chest,false);"));
  assert.ok(script(await invoke({ ...member, actor: { ...member.actor, publish: true } }, repository)).endsWith("(window.chest,true);"));
  // The member interface is not served to a visitor, nor to a member without access.
  assert.equal((await invoke({ ...visitor, operation: "interface" }, repository)).status, 403);
  assert.equal((await invoke({ ...member, actor: { subject: "bob", manage: false, publish: false } }, repository)).status, 403);
  // A member session is not a visitor: the public interface stays on the public entry.
  assert.equal((await invoke({ ...member, operation: "public-interface" }, repository)).status, 400);
  assert.equal(reads, 0);
});
