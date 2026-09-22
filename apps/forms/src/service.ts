import { randomUUID } from "node:crypto";
import { answers, decode, definition, encode, FormsError } from "./model.js";
import type { Definition, Response, State } from "./model.js";

import type { RecordRepository } from "../../../packages/chest-client/src/record.js";
// Trusted platform adapter, invoked for every protected operation. The actor
// must come from an authenticated channel, never a form submission or header.
export type Authorize = (actor: string, action: "manage" | "publish") => Promise<boolean>;

export class Forms {
  #tail: Promise<unknown> = Promise.resolve();
  #pending = 0;
  constructor(private readonly repository: RecordRepository, private readonly authorize: Authorize) {}
  // One bounded queue protects read-modify-write in this single app process.
  // The Core's exclusive state lock prevents a second process on this instance.
  #run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.#pending >= 16) return Promise.reject(new FormsError("busy"));
    this.#pending++;
    const result = this.#tail.then(operation).finally(() => { this.#pending--; });
    this.#tail = result.catch(() => undefined);
    return result;
  }
  async #allowed(actor: string, action: "manage" | "publish"): Promise<void> {
    if (!(await this.authorize(actor, action))) throw new FormsError("forbidden");
  }
  async #state(): Promise<State> {
    const state = decode(await this.repository.read());
    if (state === null) throw new FormsError("unavailable");
    return state;
  }
  create(actor: string, input: unknown): Promise<void> {
    return this.#run(async () => {
      await this.#allowed(actor, "manage");
      const form = definition(input);
      if (decode(await this.repository.read()) !== null) throw new FormsError("conflict");
      await this.repository.write(encode({ version: 1, definition: form, status: "draft", responses: [] } satisfies State));
    });
  }
  publish(actor: string): Promise<void> { return this.#changeStatus(actor, ["draft"], "open"); }
  share(actor: string): Promise<void> { return this.#changeStatus(actor, ["open"], "public"); }
  close(actor: string): Promise<void> { return this.#changeStatus(actor, ["open", "public"], "closed"); }
  #changeStatus(actor: string, previous: State["status"][], next: State["status"]): Promise<void> {
    return this.#run(async () => {
      await this.#allowed(actor, "publish");
      const state = await this.#state();
      if (!previous.includes(state.status)) throw new FormsError("conflict");
      await this.repository.write(encode({ ...state, status: next }));
    });
  }
  publicForm(): Promise<Definition> {
    return this.#run(async () => {
      const state = await this.#state();
      if (state.status !== "public") throw new FormsError("unavailable");
      return state.definition;
    });
  }
  submit(input: unknown, publicOnly = false): Promise<void> {
    return this.#run(async () => {
      const state = await this.#state();
      if (state.status !== "public" && (publicOnly || state.status !== "open")) throw new FormsError("unavailable");
      if (state.responses.length >= 10) throw new FormsError("busy");
      const response = { id: randomUUID(), at: new Date().toISOString(), answers: answers(input, state.definition) };
      await this.repository.write(encode({ ...state, responses: [...state.responses, response] }));
    });
  }
  snapshot(actor: string): Promise<State | null> {
    return this.#run(async () => {
      await this.#allowed(actor, "manage");
      return decode(await this.repository.read());
    });
  }
  responses(actor: string): Promise<Response[]> {
    return this.#run(async () => {
      await this.#allowed(actor, "manage");
      return (await this.#state()).responses;
    });
  }
}
