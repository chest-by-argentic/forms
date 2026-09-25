import type { Kind, Status } from "../../lib/model.ts";

export const kindLabels: Record<Kind, string> = { text: "Texte court", long: "Texte long", email: "Adresse e-mail" };

export const statusLabels: Record<Status, string> = { draft: "Brouillon", published: "Publié", closed: "Fermé" };

export const number = (i: number): string => String(i + 1).padStart(3, "0");

export const count = (n: number): string => (n === 0 ? "Aucune réponse" : n === 1 ? "1 réponse" : `${n} réponses`);

const format = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" });
export const when = (iso: string): string => format.format(new Date(iso));
