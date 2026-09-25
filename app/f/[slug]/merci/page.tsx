import { notFound } from "next/navigation";
import { forms } from "../../../../lib/session.ts";

export default async function Thanks({ params }: { params: Promise<{ slug: string }> }) {
  const form = await forms.publicForm((await params).slug);
  if (!form) notFound();
  return (
    <main className="page public">
      <h1>Merci</h1>
      <p>Votre réponse à « {form.title} » est enregistrée.</p>
    </main>
  );
}
