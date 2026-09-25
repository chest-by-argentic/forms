"use client";

import { useActionState, useState } from "react";
import { limits } from "../../lib/model.ts";
import type { Kind } from "../../lib/model.ts";
import type { EditorState } from "../actions.ts";
import { kindLabels, number } from "./labels.ts";

type Draft = { title: string; description: string; fields: { label: string; kind: Kind; required: boolean }[] };

// Editor writes a draft: its title, its description and its fields, sent
// as one JSON text that the server checks whole.
export function Editor({ initial, action, submit }: { initial: Draft; action: (state: EditorState, data: FormData) => Promise<EditorState>; submit: string }) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [draft, setDraft] = useState<Draft>(initial);
  const setField = (i: number, change: Partial<Draft["fields"][number]>) =>
    setDraft(d => ({ ...d, fields: d.fields.map((f, j) => (j === i ? { ...f, ...change } : f)) }));
  const move = (i: number, by: number) =>
    setDraft(d => {
      const fields = [...d.fields];
      const [field] = fields.splice(i, 1);
      if (field) fields.splice(i + by, 0, field);
      return { ...d, fields };
    });
  return (
    <form action={formAction}>
      <input type="hidden" name="definition" value={JSON.stringify(draft)} />
      {state.error && <p className="notice" role="alert">{state.error}</p>}
      <label className="field">
        <span>Titre</span>
        <input type="text" required maxLength={limits.title} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
      </label>
      <label className="field">
        <span>Description</span>
        <textarea maxLength={limits.description} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
      </label>
      <h2>Champs</h2>
      <p className="small">{draft.fields.length} sur {limits.fields} au plus.</p>
      <ol className="fields">
        {draft.fields.map((field, i) => (
          <li key={i}>
            <span className="small">{number(i)}</span>
            <div>
              <label className="field tight">
                <span className="small">Libellé</span>
                <input type="text" required maxLength={limits.label} aria-label={"Libellé du champ " + number(i)} value={field.label} onChange={e => setField(i, { label: e.target.value })} />
              </label>
              <div className="row">
                <select aria-label={"Type du champ " + number(i)} value={field.kind} onChange={e => setField(i, { kind: e.target.value as Kind })}>
                  {(Object.keys(kindLabels) as Kind[]).map(kind => <option key={kind} value={kind}>{kindLabels[kind]}</option>)}
                </select>
                <label className="check"><input type="checkbox" checked={field.required} onChange={e => setField(i, { required: e.target.checked })} /> Réponse requise</label>
                <button type="button" className="button quiet" disabled={i === 0} onClick={() => move(i, -1)}>Monter</button>
                <button type="button" className="button quiet" disabled={draft.fields.length === 1} onClick={() => setDraft({ ...draft, fields: draft.fields.filter((_, j) => j !== i) })}>Retirer</button>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <div className="actions">
        <button type="button" className="button quiet" disabled={draft.fields.length >= limits.fields} onClick={() => setDraft({ ...draft, fields: [...draft.fields, { label: "", kind: "text", required: false }] })}>Ajouter un champ</button>
        <button type="submit" className="button" disabled={pending}>{submit}</button>
      </div>
    </form>
  );
}
