# OpenWA — Campagnes WhatsApp

Interface simple pour envoyer des **notifications et campagnes WhatsApp** à partir de votre propre serveur. Pensé pour une **petite équipe non technique** (2–5 personnes), sans code.

Fork personnalisé basé sur [OpenWA](https://github.com/rmyndharis/OpenWA) (API open source + moteur WhatsApp Web).

---

## À quoi sert ce projet ?

| Cas d’usage | Supporté |
|-------------|----------|
| Même message à ~1000 contacts | Oui |
| Texte, image, document, vidéo | Oui |
| Modèles avec `{{name}}` | Oui |
| Import CSV / liste / contacts WhatsApp | Oui |
| Plusieurs numéros WhatsApp (2–3) | Oui |
| Réception / webhooks / chat live | Non (phase actuelle) |
| Planification date/heure | Prévu (roadmap) |

---

## Démarrage rapide

### Prérequis

- **Node.js 22+**
- **Windows / macOS / Linux**
- Un téléphone avec WhatsApp pour scanner le QR code

### Installation

```bash
git clone https://github.com/yongvic/OpenWA.git
cd OpenWA
npm install
```

Copiez la configuration minimale :

```bash
copy .env.minimal .env
```

Sur macOS/Linux : `cp .env.minimal .env`

### Lancer en développement

```bash
npm run dev
```

| Service | URL |
|---------|-----|
| **Dashboard** | http://localhost:2886 |
| **API** | http://localhost:2785 |
| **Documentation API** | http://localhost:2785/api/docs |

Au premier démarrage, une clé API est créée dans `data/.api-key`. Collez-la sur l’écran de connexion du dashboard.

### Production (une seule commande)

```bash
npm run prod
```

Le dashboard compilé est servi sur le port **2785** avec l’API.

---

## Utilisation (3 écrans)

1. **Sessions** — Connectez vos numéros WhatsApp (QR code ou code sur téléphone).
2. **Templates** — Créez des modèles de message (variables `{{name}}`, etc.).
3. **Campagnes** — Choisissez les contacts, le message, vérifiez, envoyez.

Le menu ne contient que ces trois entrées.

---

## Configuration importante

Fichier `.env` (voir `.env.minimal`) :

| Variable | Rôle |
|----------|------|
| `ENGINE_TYPE=baileys` | Moteur WhatsApp recommandé (sans Chrome, envoi de médias plus fiable) |
| `DATABASE_TYPE=sqlite` | Base locale, sans Postgres |
| `CAMPAIGN_MINIMAL_BACKEND=true` | API allégée (sans plugins, infra, stats…) |
| `QUEUE_ENABLED=false` | Pas de Redis requis |
| `BAILEYS_AUTH_DIR=./data/baileys` | Stockage local de la connexion WhatsApp |

Si vous choisissez manuellement l’ancien moteur `whatsapp-web.js` sous Windows et que la connexion
QR est lente, ajoutez :

```env
WWEBJS_AUTH_TIMEOUT_MS=120000
```

### Dépannage installation (Windows, npm 11+)

**Beaucoup de lignes `npm warn deprecated`** : normal, ce n’est pas une erreur. L’installation peut prendre **10–15 minutes** (téléchargement Chromium pour Puppeteer + dépendances du dashboard).

**Message `allow-scripts` / scripts bloqués** : avec npm 11, les scripts d’install de `puppeteer`, `sqlite3`, etc. doivent être approuvés une fois :

```powershell
npm approve-scripts --allow-scripts-pending
```

Ou, si PowerShell refuse d’exécuter `npm` :

```powershell
npm.cmd approve-scripts --allow-scripts-pending
npm.cmd install
```

Puis relancez si besoin :

```powershell
npm rebuild puppeteer sqlite3
```

**`npm` bloqué par la stratégie d’exécution PowerShell** : utilisez `npm.cmd` au lieu de `npm`, ou ouvrez **Invite de commandes (cmd)**.

**Vérifier que tout est OK** :

```powershell
copy .env.minimal .env
npm run build
npm run dev
```

---

## Données et confidentialité

- Tout reste sur **votre machine** (`data/`, SQLite).
- Ne commitez **jamais** `.env` ni `data/` (déjà dans `.gitignore`).
- Le nom de l’appareil lié affiché par WhatsApp est une identité technique de la bibliothèque.

---

## Structure du dépôt (ce qui compte pour vous)

```
dashboard/          Interface Campagnes / Sessions / Templates
src/                API NestJS + moteur WhatsApp
data/               Sessions, clé API, base SQLite (local, ignoré par git)
CAMPAIGN-SCOPE.md   Périmètre produit et configuration
```

---

## Mises à jour upstream

Le dépôt original reste disponible en remote `upstream` :

```bash
git fetch upstream
git merge upstream/main
```

Résolvez les conflits éventuels sur `dashboard/src/pages/Campaigns*` et `config/uiMode.ts`.

---

## Licence

MIT — voir [LICENSE](LICENSE). Projet dérivé d’OpenWA ; les marques WhatsApp appartiennent à Meta.
