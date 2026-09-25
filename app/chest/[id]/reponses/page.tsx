import { currentMember, forms } from "../../../../lib/session.ts";
import { count, number, when } from "../../labels.ts";
import { loadForm } from "../../load.ts";

// The page shows the latest answers; the export holds them all.
const shown = 200;

export default async function Responses({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = await loadForm(id);
  const { responses } = await forms.responses(await currentMember(), form.id, shown);
  return (
    <main>
      <p className="small"><a href={"/chest/" + form.id}>{form.title}</a></p>
      <div className="lead">
        <div>
          <h1>Réponses</h1>
          <p>{count(form.responses)}{form.responses > shown ? ` — les ${shown} dernières ci-dessous` : ""}</p>
        </div>
        {form.responses > 0 && <a className="button quiet" href={"/chest/" + form.id + "/reponses.csv"} download>Exporter en CSV</a>}
      </div>
      {responses.length > 0 && (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">N°</th>
                <th scope="col">Reçue le</th>
                {form.fields.map(field => <th scope="col" key={field.id}>{field.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {responses.map((response, i) => (
                <tr key={response.id}>
                  <td className="small">{number(form.responses - 1 - i)}</td>
                  <td className="small">{when(response.at)}</td>
                  {form.fields.map(field => <td key={field.id}>{response.answers[field.id]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
