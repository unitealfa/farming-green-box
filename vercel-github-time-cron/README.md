# Vercel GitHub Time Cron

Cette app Next.js (App Router + TypeScript) tourne sur **Vercel** avec des **Cron Jobs**.
À chaque exécution, une route API sécurisée ajoute une ligne (date + heure **Africa/Algiers**) dans un fichier du repo GitHub, puis fait un commit via l’API GitHub.

## Horaires (heure Algérie)

Demandé: **00:05, 06:00, 12:00, 19:00** (Africa/Algiers).

⚠️ Sur Vercel, le timezone des cron est **toujours UTC**.
Le fichier `vercel.json` convertit ces horaires en UTC:

- 00:05 DZ → 23:05 UTC (jour précédent)
- 06:00 DZ → 05:00 UTC
- 12:00 DZ → 11:00 UTC
- 19:00 DZ → 18:00 UTC

## 1) Créer le repo GitHub

1. Crée un repo GitHub (public ou privé).
2. Push ce projet dedans.

## 2) Créer le token GitHub (recommandé: Fine-grained)

Crée un **Fine-grained personal access token** et donne:
- Repository access: sélectionne ce repo uniquement
- Permissions: **Contents: Read and write**

Garde le token (il sera ajouté dans Vercel).

## 3) Déployer sur Vercel

1. Import le repo dans Vercel.
2. Déploie en **Production** (les cron ne tournent que sur les déploiements production).

## 4) Ajouter les variables d’environnement sur Vercel

Dans Vercel → Project → Settings → Environment Variables:

- `CRON_SECRET` : une string aléatoire (ex: générée avec `openssl rand -hex 32`)
- `GITHUB_TOKEN` : ton token GitHub
- `GITHUB_OWNER` : owner (user ou org)
- `GITHUB_REPO` : nom du repo
- `GITHUB_BRANCH` : (optionnel) ex `main` (si vide, GitHub utilise la branche par défaut)
- `GITHUB_FILE_PATH` : (optionnel) par défaut `status.txt`
- `MODE` : (optionnel)
  - vide = exécute les 4 horaires
  - `random2or4` = certains jours 2 exécutions, certains jours 4 (déterministe par date)

Tu peux t’aider de `.env.example`.

## 5) Tester manuellement

Tu peux appeler un endpoint cron à la main (depuis ta machine) :

```bash
curl -i "https://TON-PROJET.vercel.app/api/cron/0600" \
  -H "Authorization: Bearer TON_CRON_SECRET"
```

Si tout est OK, tu verras un JSON `{ ok: true, ... }` et le fichier `status.txt` sera mis à jour dans GitHub.

## Notes importantes

- Les cron Vercel sont des requêtes HTTP GET vers tes endpoints.
- Évite les redirections (les cron ne suivent pas les 3xx).
- Selon ton plan Vercel, il peut y avoir des limites d’exécution / précision.
