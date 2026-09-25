"use client";

import { useActionState } from "react";
import { limits } from "../../../lib/model.ts";
import type { Field } from "../../../lib/model.ts";
import type { AnswerState } from "../../actions.ts";

// AnswerForm is the form a visitor fills; the server checks every answer
// again and says what to correct.
export function AnswerForm({ fields, action }: { fields: Field[]; action: (state: AnswerState, data: FormData) => Promise<AnswerState> }) {
  const [state, formAction, pending] = useActionState(action, { errors: {}, values: {}, closed: false, failed: null });
  if (state.closed) return <p className="notice">Ce formulaire est fermé.</p>;
  return (
    <form action={formAction} noValidate>
      {state.failed && <p className="notice" role="alert">{state.failed}</p>}
      {fields.map(field => {
        const error = state.errors[field.id];
        const common = { name: field.id, defaultValue: state.values[field.id] ?? "", required: field.required, maxLength: limits.answer, "aria-invalid": error ? true : undefined, "aria-describedby": error ? field.id + "-error" : undefined };
        return (
          <label className="field" key={field.id}>
            <span>{field.label}{field.required ? <span className="required"> (requis)</span> : null}</span>
            {field.kind === "long" ? <textarea {...common} /> : <input type={field.kind === "email" ? "email" : "text"} {...common} />}
            {error && <span className="error" id={field.id + "-error"}>{error}</span>}
          </label>
        );
      })}
      <div className="actions">
        <button type="submit" className="button" disabled={pending}>Envoyer</button>
      </div>
    </form>
  );
}
