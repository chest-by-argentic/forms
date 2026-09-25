import type { ReactNode } from "react";
import { canEdit, canRead } from "../../lib/forms.ts";
import { currentMember } from "../../lib/session.ts";

const roleLabels: Record<string, string> = { editeur: "éditeur", lecteur: "lecteur" };

// The members' part: the Chest admits the member and asserts who they are
// (proxy.ts refuses a request without that assertion); their role here
// says what they may do.
export default async function MembersLayout({ children }: { children: ReactNode }) {
  const actor = await currentMember();
  return (
    <div className="page">
      <header className="bar">
        <a className="brand" href="/chest"><i>F</i>ormulaires</a>
        {actor && <span className="who">{actor.name} · {roleLabels[actor.role ?? ""] ?? "sans rôle"}{canEdit(actor) ? "" : " · lecture seule"}</span>}
      </header>
      {canRead(actor) ? children : <main><h1>Accès limité</h1><p>Votre rôle ne donne pas accès aux formulaires. Demandez à un administrateur du Chest de vous nommer éditeur ou lecteur.</p></main>}
    </div>
  );
}
