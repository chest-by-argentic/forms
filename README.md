# Formulaires — créez vos formulaires et retrouvez les réponses.

Outil du catalogue Chest by Argentic. Un Chest le construit lui-même depuis ce
dépôt, à un commit épinglé : c’est un serveur Next.js (contrat v2 : `chest.json`
`"version": 2`), avec sa base PostgreSQL propre.

Pour l’adapter : forkez ce dépôt, modifiez-le avec votre agent, liez votre fork
à votre Chest.

## Ce que fait l’outil

- **Partie membres** (`/chest`, sur l’hôte d’équipe `forms-chest.<chest>`) :
  la liste des formulaires, l’éditeur d’un brouillon (titre, description,
  1 à 50 champs : texte court, texte long ou adresse e-mail, requis ou non),
  la publication explicite, la fermeture de la collecte, les réponses d’un
  formulaire (les 200 dernières à l’écran, toutes en CSV).
- **Partie publique** (`/f/<adresse>`, sur l’hôte public `forms.<chest>`,
  une fois la partie publique ouverte dans le Chest, onglet « Public ») : un
  formulaire publié se remplit sans compte, puis « Merci » ; un formulaire
  fermé dit « Ce formulaire est fermé. » et garde ses réponses ; un brouillon
  ou une adresse inconnue n’est rien (404).

**Rôles** (`roles` du manifeste) : `editeur` crée, modifie, publie, ferme et
supprime un brouillon ; `lecteur` lit les formulaires et leurs réponses. Le
propriétaire, les admins et le Builder entrent avec le premier, `editeur`.
Le Chest les montre « Éditeur » et « Lecteur » (`role_labels`, présentation
seulement) ; l’outil reçoit toujours l’identifiant.
Un membre sans accès à l’outil n’atteint jamais `/chest` : le Chest répond
« Accès retiré » avant l’outil ; une requête sans assertion `Chest-Member`
valide reçoit aussi 401 de l’outil lui-même (`proxy.ts`), et chaque page et
chaque action relit le rôle (`lib/forms.ts`).

**Bornes**, vérifiées côté serveur (`lib/model.ts`) : titre 200 caractères,
description 1000, 50 champs, libellé 200, réponse 5000, 10 000 réponses par
formulaire. Toutes les requêtes SQL sont paramétrées (`lib/store.ts`), le
schéma est `migrations/0001_forms.sql`, joué par le Chest avant la première
version ; une réponse ne peut pas être supprimée (clé étrangère `RESTRICT`),
seul un brouillon — qui n’en a pas — se supprime.

## Sur un Chest

`chest.json` déclare ce que l’outil demande, montré à l’approbation :

- `public: true` — « Partie publique » ;
- `csp: "tool"` — « Politique de sécurité propre » : Next.js exécute des
  scripts en ligne (l’hydratation), que la politique par défaut du Chest
  interdit. `proxy.ts` envoie sur chaque page sa propre
  `Content-Security-Policy` avec un nonce par réponse (`script-src 'self'
  'nonce-…' 'strict-dynamic'`, `frame-ancestors 'none'`…) ; le Chest ajoute
  alors seulement `frame-ancestors 'none'; base-uri 'self'; object-src
  'none'` sur l’hôte public. Une page sans politique garde celle, stricte,
  du Chest ;
- `capabilities: ["database"]` — « Base de données » : le Chest donne
  `DATABASE_URL`.

Ce que le Chest impose à un serveur, et comment l’outil s’y tient :

- **Système de fichiers en lecture seule** (et `/tmp` de 64 Mio) : toutes les
  pages sont rendues à la demande (`dynamic = "force-dynamic"`), sans
  optimiseur d’images (`images.unoptimized`) — rien n’est écrit dans
  `.next/cache` à l’exécution ;
- **construction à 512 Mio et 1 CPU** : `npm run build` vérifie les types
  (`next typegen`, `tsc`) puis construit avec webpack (`next build --webpack`,
  un seul processus, sans cache laissé dans l’image) plutôt qu’avec
  Turbopack, dont la mémoire ne se borne pas ;
- **serveur** : `next start -H 127.0.0.1` sur `PORT` (3000, que fixe le
  Chest), télémétrie de Next.js coupée ;
- `npm prune --omit=dev` après la construction : `next`, `react`,
  `react-dom` et `postgres` sont des dépendances, TypeScript et les types ne
  le sont pas.

`packages/chest-client` est une copie vendue du SDK
(`chest-by-argentic/Chest-SDK`, voir son `VENDORED.md`) : `member(request)`
lit l’assertion du Chest. Les imports relatifs portent l’extension `.ts`
(`allowImportingTsExtensions`) : webpack et Turbopack ne résolvent pas
`./x.js` vers `./x.ts`.

## Développer

```sh
npm ci
npm test           # modèle et service (node:test, stockage en mémoire)
npm run build      # types puis construction, comme le Chest
```

`npm run dev` sert l’outil sur `localhost:3000` ; la partie membres attend
l’assertion signée du Chest (`CHEST_TOKEN`, `CHEST_TOOL`) et une base
(`DATABASE_URL`).

## Depuis la version 1

La version 1 était un worker (contrat v1 : un canal privé, un enregistrement
de 1 Kio, un seul formulaire). Un Chest refuse de mettre à jour un outil
d’un contrat vers l’autre : un Formulaires v1 installé se **retire puis se
réinstalle** depuis le catalogue ; ses réponses v1 ne sont pas reprises.
