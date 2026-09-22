// Executable acceptance fixture: identity decisions are controlled by this test,
// not by a login system. No browser entry or production authentication is claimed.
import assert from "node:assert/strict";
import { ChestRecord } from "../../../packages/chest-client/src/record.js";
import { ChestServiceError } from "../../../packages/chest-client/src/channel.js";
import { Forms } from "../src/service.js";
import { FormsError } from "../src/model.js";

const record = ChestRecord.stdio();
const members = new Set(["camille", "alex"]);
const app = new Forms(record, async (actor, action) => members.has(actor) && (action === "manage" || actor === "camille"));
const fails = (code: string) => (error: unknown) => error instanceof FormsError && error.code === code;
try {
  const phase = process.env["FORMS_PHASE"];
  if (phase === "denied") {
    await assert.rejects(record.read(), (e: unknown) => e instanceof ChestServiceError && e.status === 403);
    await assert.rejects(record.write("forbidden"), (e: unknown) => e instanceof ChestServiceError && e.status === 403);
  } else if (phase === "write") {
    assert.equal(await record.read(), "");
    await assert.rejects(app.create("sam", {}), fails("forbidden"));
    await app.create("alex", { title: "Contact", description: "", fields: [{ name: "message", label: "Votre message", required: true }] });
    await assert.rejects(app.publicForm(), fails("unavailable"));
    await assert.rejects(app.publish("alex"), fails("forbidden"));
    await app.publish("camille");
    await assert.rejects(app.submit({ message: "Bonjour", actor: "camille" }), fails("invalid"));
    await app.submit({ message: "Bonjour Chest" });
    await assert.rejects(app.responses("sam"), fails("forbidden"));
    await assert.rejects(app.responses("visitor"), fails("forbidden"));
    assert.equal((await app.responses("alex"))[0]?.answers["message"], "Bonjour Chest");
    members.delete("alex");
    await assert.rejects(app.responses("alex"), fails("forbidden"));
    // Fill the existing laboratory quota. A failed write must not be reported
    // as success or overwrite earlier submissions. No quota extension is hidden.
    let quotaHit = false;
    for (let i = 0; i < 8; i++) {
      const before = await record.read();
      try { await app.submit({ message: "x".repeat(240) }); }
      catch (error) {
        assert.ok(error instanceof ChestServiceError && error.status === 413);
        assert.equal(await record.read(), before);
        quotaHit = true; break;
      }
    }
    assert.ok(quotaHit);
    await app.close("camille");
    await assert.rejects(app.submit({ message: "late" }), fails("unavailable"));
  } else if (phase === "verify") {
    await assert.rejects(app.publicForm(), fails("unavailable"));
    await assert.rejects(app.responses("sam"), fails("forbidden"));
    assert.equal((await app.responses("camille"))[0]?.answers["message"], "Bonjour Chest");
  } else { throw new Error("Unknown fixture phase"); }
} catch {
  // Avoid writing data, paths or errors to the protocol or container logs.
  process.exitCode = 1;
} finally { record.close(); }
