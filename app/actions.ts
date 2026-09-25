"use server";

import { redirect } from "next/navigation";
import { FormsError, idPattern, limits, posted } from "../lib/model.ts";
import { currentMember, forms } from "../lib/session.ts";

// The actions of the pages. Each is an endpoint any request can call, on
// either host: each decides for itself, from the member the Chest asserts
// (none on the public host), never from what the page sends.

export type EditorState = { error: string | null };

const messages: Record<FormsError["code"], string> = {
  forbidden: "Votre rôle ne permet pas de modifier les formulaires.",
  invalid: "Vérifiez le formulaire : un titre, de 1 à 50 champs, chacun avec un libellé de 200 caractères au plus.",
  not_found: "Ce formulaire n’existe plus.",
  conflict: "Ce formulaire n’est plus un brouillon : il ne se modifie plus.",
  full: "Ce formulaire a reçu toutes les réponses qu’il peut garder.",
};

function message(error: unknown): string {
  if (error instanceof FormsError) return messages[error.code];
  throw error;
}

export async function createForm(_: EditorState, data: FormData): Promise<EditorState> {
  const actor = await currentMember();
  let id: string;
  try {
    if (!actor) throw new FormsError("forbidden");
    id = await forms.create(actor, posted(data.get("definition")));
  } catch (error) {
    return { error: message(error) };
  }
  redirect("/chest/" + id);
}

export async function updateForm(id: string, _: EditorState, data: FormData): Promise<EditorState> {
  try {
    await forms.update(await currentMember(), id, posted(data.get("definition")));
  } catch (error) {
    return { error: message(error) };
  }
  redirect(pageOf(id));
}

// The changes of status come back to the form's page, which says where it
// stands; a refusal leaves the form as it was.
const pageOf = (id: string): string => (idPattern.test(id) ? "/chest/" + id : "/chest");
async function change(step: () => Promise<void>, back: string): Promise<never> {
  try {
    await step();
  } catch (error) {
    if (!(error instanceof FormsError)) throw error;
    redirect(back + "?refus=" + error.code);
  }
  redirect(back);
}

export async function publishForm(id: string): Promise<void> {
  const actor = await currentMember();
  await change(() => forms.publish(actor, id), pageOf(id));
}

export async function closeForm(id: string): Promise<void> {
  const actor = await currentMember();
  await change(() => forms.close(actor, id), pageOf(id));
}

export async function removeForm(id: string): Promise<void> {
  const actor = await currentMember();
  await change(() => forms.remove(actor, id), "/chest");
}

// values give back what the visitor wrote, for them to correct it.
export type AnswerState = { errors: Record<string, string>; values: Record<string, string>; closed: boolean; failed: string | null };

// written is what the visitor wrote in the fields of a form (f1 to f50),
// bounded, to fill them again.
function written(data: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (let i = 1; i <= limits.fields; i++) {
    const value = data.get("f" + i);
    if (typeof value === "string") values["f" + i] = value.slice(0, limits.answer);
  }
  return values;
}

// answerForm takes an anonymous answer on the public host: no identity is
// read, the form must be published, every field is checked by the service.
export async function answerForm(slug: string, _: AnswerState, data: FormData): Promise<AnswerState> {
  let outcome;
  try {
    outcome = await forms.answer(slug, id => data.get(id));
  } catch (error) {
    if (error instanceof FormsError && error.code === "full") return { errors: {}, values: {}, closed: false, failed: messages.full };
    if (error instanceof FormsError && error.code === "not_found") return { errors: {}, values: {}, closed: false, failed: "Ce formulaire n’existe pas." };
    throw error;
  }
  if (outcome.ok) redirect("/f/" + slug + "/merci");
  if ("closed" in outcome) return { errors: {}, values: {}, closed: true, failed: null };
  return { errors: outcome.errors, values: written(data), closed: false, failed: null };
}
