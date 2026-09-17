# Périmètre produit — Campagnes WhatsApp (équipe non technique)

Ce document fixe ce qui est **nécessaire** pour ton usage et ce que tu peux **ignorer ou supprimer** sans casser les campagnes sortantes.

## Ton usage (rappel)

- Petite équipe (2–5), ~1000 contacts, envois **sortants** (notifications / campagnes)
- Même message à beaucoup de contacts, médias, templates `{{name}}`, import CSV / contacts WA
- Comptes : 2–3 numéros WhatsApp
- **Pas** de webhooks / alertes sur les réponses (pour l’instant)
- UI : **Campagnes**, **Sessions**, **Templates** uniquement

## Fonctionnalités OpenWA dont tu n’as plus besoin (côté métier)

| Fonctionnalité | Verdict | Pourquoi |
|----------------|---------|----------|
| Dashboard analytics | Inutile | Tu n’envoies pas depuis les stats |
| Chats (messagerie live) | Inutile | Pas de support conversationnel |
| Webhooks | Inutile (phase A) | Pas d’automatisation entrante |
| Message Tester | Inutile | Les campagnes remplacent les tests manuels |
| Logs (UI) | Optionnel | Utile seulement pour un admin technique |
| Clés API (UI) | Optionnel | Une clé dans `data/.api-key` suffit pour l’équipe |
| Infrastructure / Docker / Postgres | Inutile (setup minimal) | SQLite + `.env.minimal` |
| Plugins / MCP / Intégrations CRM | Inutile | Pas dans ton scope |
| Groupes, labels, channels, catalog | Inutile (UI) | Pas de campagnes groupes pour l’instant |
| SDK Java / PHP / Python / JS | Inutile | Tu passes par le dashboard, pas par du code |
| Moteur whatsapp-web.js (Chrome) | Inutile | Baileys est le défaut et envoie mieux les médias |
| Files d’attente Redis / Bull | Inutile (minimal) | `QUEUE_ENABLED=false` |

## Ce qu’il faut **garder** (strict minimum)

### Racine

```
.env / .env.minimal
package.json, package-lock.json
data/                    # sessions WA, clé API, sqlite (gitignored)
src/                     # API NestJS (voir modules ci-dessous)
dashboard/               # UI (pages réduites)
```

### Backend (`src/`) — modules réellement utilisés par les campagnes

| Module | Rôle |
|--------|------|
| `engine/` | Connexion WhatsApp (baileys par défaut) |
| `modules/session/` | QR, sessions, 2–3 numéros |
| `modules/message/` | Envoi texte / média / **bulk** |
| `modules/contact/` | Liste WA, validation numéros |
| `modules/template/` | Templates avec variables |
| `modules/auth/` | Login dashboard (clé API) |
| `modules/health/` | Santé du serveur |
| `config/`, `database/`, `common/` | Config, SQLite, fichiers |

Les autres modules (`webhook`, `plugins`, `integration`, `mcp`, `group`, …) restent dans le code upstream pour l’instant : les retirer du `AppModule` NestJS est possible mais **gros chantier** (risque de régression). En mode minimal ils ne sont **pas utilisés** si tu ne les configures pas.

### Dashboard (`dashboard/src/`)

| Garder | Rôle |
|--------|------|
| `pages/Campaigns.*` | Assistant campagne |
| `pages/Sessions.*` | Connecter les numéros |
| `pages/Templates.*` | Modèles de message |
| `pages/Login.*` | Connexion |
| `components/Layout.*`, `PageHeader`, `Toast`, … | Coque UI |
| `config/uiMode.ts` | Mode campagne |
| `services/api.ts`, `hooks/queries.ts` | Appels API |
| `utils/campaign*.ts` | Logique campagnes |

Pages **supprimées** de ce fork (voir commit associé) : Chats, Webhooks, Message Tester, Logs, ApiKeys, Infrastructure, Plugins, Dashboard home.

### Dossiers retirés de ce fork

Supprimés pour alléger le dépôt campagnes : `sdk/`, `docs/`, `test/` (e2e), `.agents/`.

Le mock Jest Baileys est conservé dans `src/__mocks__/`. `.github/` reste pour la CI si besoin.

Ne **commit jamais** : `data/`, `.env`, secrets.

## Roadmap utile (pas encore fait)

- Planification d’envoi (date/heure)
- Import CRM / Excel polish
- Simplifier les pages Sessions & Templates (même UX que Campagnes)
- Optionnel : retirer modules NestJS morts (fork avancé)

## Config recommandée (`.env`)

Voir `.env.minimal` : SQLite, `ENGINE_TYPE=baileys`, pas de Redis/queue, pas de MCP.

```env
CAMPAIGN_MINIMAL_BACKEND=true
```

Désactive au démarrage NestJS : groupes, labels, channels, stats, metrics, status, catalog, plugins API, agent tools, integration fabric, infra export. **WebhookModule reste chargé** (dépendance de `SessionModule`).

## UI produit partagée

Styles communs : `dashboard/src/styles/campaignProduct.css` (pages Campagnes, Sessions, Templates).
