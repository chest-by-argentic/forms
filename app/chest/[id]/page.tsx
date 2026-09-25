import { canEdit } from "../../../lib/forms.ts";
import { currentMember, publicAddress } from "../../../lib/session.ts";
import { closeForm, publishForm, removeForm } from "../../actions.ts";
import { count, kindLabels, number, statusLabels, when } from "../labels.ts";
import { loadForm } from "../load.ts";

const refusals: Record<string, string> = {
  conflict: "Ce changement ne s’applique plus : le formulaire a changé d’état entre-temps.",
  forbidden: "Votre rôle ne permet pas de changer ce formulaire.",
};

export default async function FormPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const refus = (await searchParams)["refus"];
  const form = await loadForm(id);
  const editor = canEdit(await currentMember());
  const address = await publicAddress(form.slug);
  return (
    <main>
      <p className="small"><a href="/chest">Formulaires</a></p>
      <div className="lead">
        <div>
          <h1>{form.title}</h1>
          {form.description && <p>{form.description}</p>}
        </div>
      </div>
      {typeof refus === "string" && refusals[refus] && <p className="notice" role="alert">{refusals[refus]}</p>}
      <dl className="facts">
        <dt>État</dt>
        <dd>{statusLabels[form.status]}{form.status === "draft" ? " — invisible hors du Chest" : form.status === "closed" ? " — la collecte est arrêtée, les réponses restent" : ""}</dd>
        <dt>Adresse publique</dt>
        <dd>{form.status === "draft" ? <>{address} <span className="small">— ne mène à rien avant la publication</span></> : <a href={address} target="_blank" rel="noopener noreferrer">{address}</a>}</dd>
        <dt>Réponses</dt>
        <dd><a href={"/chest/" + form.id + "/reponses"}>{count(form.responses)}</a></dd>
        <dt>Modifié le</dt>
        <dd>{when(form.updated)}</dd>
      </dl>
      <h2 className="section">Champs</h2>
      <ol className="list">
        {form.fields.map((field, i) => (
          <li key={field.id}>
            <span className="num">{number(i)}</span>
            <span>{field.label}</span>
            <span className="status">{kindLabels[field.kind]}</span>
            <span className="status">{field.required ? "Requis" : "Facultatif"}</span>
          </li>
        ))}
      </ol>
      {editor && (
        <div className="actions">
          {form.status === "draft" && <a className="button quiet" href={"/chest/" + form.id + "/modifier"}>Modifier</a>}
          {form.status === "draft" && <form action={publishForm.bind(null, form.id)}><button className="button" type="submit">Publier</button></form>}
          {form.status === "published" && <form action={closeForm.bind(null, form.id)}><button className="button" type="submit">Fermer la collecte</button></form>}
          {form.status === "draft" && <form action={removeForm.bind(null, form.id)}><button className="button quiet" type="submit">Supprimer le brouillon</button></form>}
        </div>
      )}
    </main>
  );
}
