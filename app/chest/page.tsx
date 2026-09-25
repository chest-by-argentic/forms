import { canEdit } from "../../lib/forms.ts";
import { currentMember, forms } from "../../lib/session.ts";
import { count, number, statusLabels } from "./labels.ts";

export default async function FormsList() {
  const actor = await currentMember();
  const list = await forms.list(actor);
  return (
    <main>
      <div className="lead">
        <div>
          <h1>Formulaires</h1>
          <p>Créez un formulaire, publiez-le, puis retrouvez ses réponses ici.</p>
        </div>
        {canEdit(actor) && <a className="button" href="/chest/nouveau">Nouveau formulaire</a>}
      </div>
      {list.length === 0 ? (
        <p>Aucun formulaire pour l’instant.</p>
      ) : (
        <ol className="list">
          {list.map((form, i) => (
            <li key={form.id}>
              <span className="num">{number(i)}</span>
              <a href={"/chest/" + form.id}>{form.title}</a>
              <span className="status">{statusLabels[form.status]}</span>
              <span className="status">{count(form.responses)}</span>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
