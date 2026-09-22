export class FormsError extends Error {
  constructor(readonly code: "forbidden" | "invalid" | "unavailable" | "conflict" | "busy") {
    super(code);
  }
}
export type Field = { name: string; label: string; required: boolean };
export type Definition = { title: string; description: string; fields: Field[] };
export type Response = { id: string; at: string; answers: Record<string, string> };
export type State = { version: 1; definition: Definition; status: "draft" | "open" | "closed" | "public"; responses: Response[] };

function invalid(): never { throw new FormsError("invalid"); }
function object(input: unknown, keys: string[]): Record<string, unknown> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return invalid();
  if (Object.keys(input).length !== keys.length || !keys.every(k => Object.hasOwn(input, k))) return invalid();
  return input as Record<string, unknown>;
}
function text(input: unknown, max: number, required = true): string {
  if (typeof input !== "string" || input.length > max || (required && input.trim().length === 0) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(input)) return invalid();
  return input;
}
export function definition(input: unknown): Definition {
  const value = object(input, ["title", "description", "fields"]);
  if (!Array.isArray(value.fields) || value.fields.length < 1 || value.fields.length > 4) return invalid();
  const names = new Set<string>();
  const fields = value.fields.map((input: unknown): Field => {
    const field = object(input, ["name", "label", "required"]);
    const name = text(field.name, 24);
    if (!/^[a-z][a-z0-9_]*$/u.test(name) || ["constructor", "prototype", "__proto__"].includes(name) || names.has(name) || typeof field.required !== "boolean") return invalid();
    names.add(name);
    return { name, label: text(field.label, 60), required: field.required };
  });
  return { title: text(value.title, 80), description: text(value.description, 160, false), fields };
}
export function answers(input: unknown, form: Definition): Record<string, string> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return invalid();
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some(k => !form.fields.some(f => f.name === k))) return invalid();
  const result: Record<string, string> = {};
  for (const field of form.fields) {
    result[field.name] = text(Object.hasOwn(value, field.name) ? value[field.name] : "", 240, field.required);
  }
  return result;
}
const statuses = ["draft", "open", "closed", "public"] as const;
// A state transition must not require extra storage when the record is full.
export function encode(state: State): string {
  return JSON.stringify({ ...state, status: statuses.indexOf(state.status) });
}
// Validate both persisted state and the protected snapshot consumed by the UI.
export function state(input: unknown): State {
    const value = object(input, ["version", "definition", "status", "responses"]);
    const form = definition(value.definition);
    const status = value.status;
    if (value.version !== 1 || (status !== "draft" && status !== "open" && status !== "closed" && status !== "public") || !Array.isArray(value.responses) || value.responses.length > 10) return invalid();
    const ids = new Set<string>();
    const responses = value.responses.map((input: unknown): Response => {
      const response = object(input, ["id", "at", "answers"]);
      const id = text(response.id, 36); const at = text(response.at, 24);
      if (!/^[a-f0-9-]{36}$/u.test(id) || ids.has(id) || new Date(at).toISOString() !== at) return invalid();
      ids.add(id);
      return { id, at, answers: answers(response.answers, form) };
    });
    if (status === "draft" && responses.length !== 0) return invalid();
    return { version: 1, definition: form, status, responses };
}
export function decode(raw: string): State | null {
  if (raw === "") return null;
  try {
    const value = object(JSON.parse(raw) as unknown, ["version", "definition", "status", "responses"]);
    return state({ ...value, status: typeof value.status === "number" ? statuses[value.status] : undefined });
  } catch { throw new FormsError("unavailable"); }
}
