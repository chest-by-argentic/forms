import { Forms } from "./service.js";
import { memberView, visitorView } from "./view.js";
import type { RecordRepository } from "../../../packages/chest-client/src/record.js";
import { FormsError } from "./model.js";
import type { Invocation } from "../../../packages/chest-client/src/requests.js";
import { ChestServiceError } from "../../../packages/chest-client/src/channel.js";

// Called only with an envelope received on the Core's private channel. User
// input is a separate field and never supplies the authenticated actor/rights.
export async function invoke(request: Invocation, repository: RecordRepository): Promise<{ status: number; body: unknown }> {
  if (request.deadline <= Date.now()) return { status: 503, body: { error: "expired" } };
  const { actor } = request;
  const app = new Forms(repository, async (subject, action) => subject === actor.subject && actor.manage && (action === "manage" || actor.publish));
  try {
    if (actor.subject === "" && !actor.manage && !actor.publish) {
      switch (request.operation) {
        case "public-interface":
          if (request.input !== null) throw new FormsError("invalid");
          return { status: 200, body: visitorView() };
        case "public-form":
          if (request.input !== null) throw new FormsError("invalid");
          return { status: 200, body: await app.publicForm() };
        case "public-submit":
          await app.submit(request.input, true);
          return { status: 204, body: null };
        default: throw new FormsError("forbidden");
      }
    }
    if (!actor.manage || !actor.subject) throw new FormsError("forbidden");
    switch (request.operation) {
      case "interface":
        if (request.input !== null) throw new FormsError("invalid");
        return { status: 200, body: memberView(actor.publish) };
      case "create": await app.create(actor.subject, request.input); break;
      case "submit": await app.submit(request.input); break;
      case "publish": if (request.input !== null) throw new FormsError("invalid"); await app.publish(actor.subject); break;
      case "share": if (request.input !== null) throw new FormsError("invalid"); await app.share(actor.subject); break;
      case "close": if (request.input !== null) throw new FormsError("invalid"); await app.close(actor.subject); break;
      case "snapshot":
        if (request.input !== null) throw new FormsError("invalid");
        return { status: 200, body: await app.snapshot(actor.subject) };
      case "responses":
        if (request.input !== null) throw new FormsError("invalid");
        return { status: 200, body: await app.responses(actor.subject) };
      default: throw new FormsError("invalid");
    }
    return { status: 204, body: null };
  } catch (error) {
    if (error instanceof FormsError) {
      if (actor.subject === "" && error.code === "unavailable") return { status: 404, body: { error: "unavailable" } };
      const statuses = { forbidden: 403, invalid: 400, unavailable: 503, conflict: 409, busy: 429 };
      return { status: statuses[error.code], body: { error: error.code } };
    }
    if (error instanceof ChestServiceError && error.status === 413) return { status: 413, body: { error: "storage-full" } };
    return { status: 503, body: { error: "operation-not-confirmed" } };
  }
}
