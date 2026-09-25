import { canEdit } from "../../../../lib/forms.ts";
import { currentMember } from "../../../../lib/session.ts";
import { updateForm } from "../../../actions.ts";
import { Editor } from "../../editor.tsx";
import { loadForm } from "../../load.ts";

export default async function EditForm({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = await loadForm(id);
  const back = <p className="small"><a href={"/chest/" + form.id}>{form.title}</a></p>;
  if (!canEdit(await currentMember()) || form.status !== "draft") {
    return <main>{back}<h1>Modifier</h1><p>Seul un brouillon se modifie, et seulement par un éditeur.</p></main>;
  }
  return (
    <main>
      {back}
      <div className="lead"><div><h1>Modifier le brouillon</h1></div></div>
      <Editor initial={{ title: form.title, description: form.description, fields: form.fields.map(({ label, kind, required }) => ({ label, kind, required })) }} action={updateForm.bind(null, form.id)} submit="Enregistrer" />
    </main>
  );
}
