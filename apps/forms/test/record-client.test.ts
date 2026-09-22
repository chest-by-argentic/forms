import assert from "node:assert/strict";
import { test } from "node:test";
import { Duplex, PassThrough } from "node:stream";
import { ChestRecord } from "../../../packages/chest-client/src/record.js";
import { ChestChannel, ChestServiceError } from "../../../packages/chest-client/src/channel.js";

function wire(replies: string[]) {
  const requests = new PassThrough(); const responses = new PassThrough();
  // The simulated Core observes transport closure separately from the client.
  requests.on("error", () => undefined);
  responses.on("error", () => undefined);
  const client = new ChestRecord(new ChestChannel(Duplex.from({ readable: responses, writable: requests })));
  let pending = Buffer.alloc(0);
  const seen: string[] = [];
  requests.on("data", (chunk: Buffer) => {
    pending = Buffer.concat([pending, chunk]);
    const end = pending.indexOf("\r\n\r\n");
    if (end < 0) return;
    const header = pending.subarray(0, end).toString();
    const length = Number(/content-length: (\d+)/iu.exec(header)?.[1] ?? 0);
    if (pending.length < end + 4 + length) return;
    seen.push(pending.toString());
    pending = pending.subarray(end + 4 + length);
    const reply = replies.shift();
    if (reply === undefined) responses.end(); else responses.write(reply);
  });
  return { client, seen };
}
test("client uses one private channel for sequential requests", async () => {
  const { client, seen } = wire(["HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\n{}", "HTTP/1.1 204 No Content\r\n\r\n"]);
  try { assert.equal(await client.read(), "{}"); await client.write("é"); }
  finally { client.close(); }
  assert.match(seen[0] ?? "", /^GET \/record HTTP\/1.1/u);
  assert.match(seen[1] ?? "", /Content-Length: 2/iu);
});
test("permission and quota errors are propagated without response contents", async () => {
  const { client } = wire(["HTTP/1.1 403 Forbidden\r\nContent-Length: 6\r\n\r\nsecret", "HTTP/1.1 413 Too Large\r\nContent-Length: 0\r\n\r\n"]);
  try {
    await assert.rejects(client.read(), (e: unknown) => e instanceof ChestServiceError && e.status === 403 && !e.message.includes("secret"));
    await assert.rejects(client.write("x"), (e: unknown) => e instanceof ChestServiceError && e.status === 413);
  } finally { client.close(); }
});
test("oversized response and missing response fail closed", async () => {
  for (const reply of ["HTTP/1.1 200 OK\r\nContent-Length: 65537\r\n\r\n" + "x".repeat(65537), "HTTP/1.1 200 OK\r\nContent-Length: 20\r\n\r\nshort"]) {
    const { client } = wire([reply]);
    try { await assert.rejects(client.read()); } finally { client.close(); }
  }
});
