import { canEdit } from "../../../lib/forms.ts";
import { currentMember } from "../../../lib/session.ts";
import { createForm } from "../../actions.ts";
import { Editor } from "../editor.tsx";

export default async function NewForm() {
  if (!canEdit(await currentMember())) {
    return <main><h1>Nouveau formulaire</h1><p>Votre rôle ne permet pas de créer un formulaire.</p></main>;
  }
  return (
    <main>
      <div className="lead"><div><h1>Nouveau formulaire</h1><p>Il reste un brouillon, invisible hors du Chest, jusqu’à ce que vous le publiiez.</p></div></div>
      <Editor initial={{ title: "", description: "", fields: [{ label: "", kind: "text", required: true }] }} action={createForm} submit="Enregistrer le brouillon" />
    </main>
  );
}
