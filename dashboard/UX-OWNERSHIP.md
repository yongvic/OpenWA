# Décisions d’interface — dashboard campagnes OpenWA

Document de propriété front. Les faits produit sont inférés du code et de `CAMPAIGN-SCOPE.md` / `README.md` (pas d’interview).

## Contexte d’usage

| Rôle | Appareil | Posture | Pression | Mains | Fréquence |
|------|----------|---------|----------|-------|-----------|
| **Operator / Admin** (peuvent écrire) | Laptop 13–15" au bureau (maître). Téléphone seulement pour scanner le QR. | Assis, écran à bout de bras, lumière de bureau | Haute au moment de l’envoi (~1000 contacts, irréversible) | Libres sur clavier/souris ; une main possible sur téléphone en secours | Quotidien faible, pics le jour d’envoi |
| **Viewer** | Même laptop, accès lecture | Contrôle / formation | Basse | Libres | Rare dans une équipe de 2–5 |

Le téléphone n’est **pas** un poste de composition. Le dashboard mobile est un secours (vérifier un numéro, relancer un QR).

Ne jamais montrer selon le rôle : boutons d’envoi/modification actifs pour un viewer ; identifiants techniques (ID de session, « kill ») ; 7 palettes de décoration ; pages amont (chats, webhooks, stats).

## Surfaces (inventaire)

1. **Login** — vide (code manquant), chargement, code refusé, serveur injoignable.
2. **Coque (Layout)** — sidebar desktop, barre du bas mobile, tiroir Compte, hors-ligne, thèmes.
3. **Campagnes** — vide (pas de numéro connecté), chargement, compose étapes 1–3, validation, envoi, terminé / arrêté / échoué, lecture seule, brouillon restauré.
4. **Numéros** — vide, chargement, liste (2–3 cartes), création, QR, code téléphone, suppression, erreur.
5. **Modèles** — vide (pas de numéro / pas de modèle), chargement, liste + éditeur + aperçu, suppression, lecture seule.
6. **ErrorBoundary** — crash d’écran.

Modales : créer un numéro, QR/jumelage, confirmer suppression, confirmer kill (hors mode campagne), confirmer suppression de modèle. Feuille mobile : Compte.

## Décisions structurantes

### Navigation
**Retenu :** 3 destinations métier (Campagnes, Numéros, Modèles). Desktop = sidebar. Mobile = barre du bas + titre d’écran dans le chrome. Compte (langue, thème, sortie) séparé de la nav.
**Écarté A :** hamburger pour tout (on ne sait pas où on est, +1 tap).
**Écarté B :** une seule page fourre-tout (1000 contacts + message + revue = surcharge).
**Motif :** trois jobs distincts ; le téléphone de secours doit montrer l’écran courant sans ouvrir un menu.

### Carte des destinataires (cœur campagne)
**Retenu :** liste dense (nom / numéro). Photo inutile (l’API ne fournit pas de visuel fiable). Recherche seulement à partir de **20** contacts WhatsApp. Coller / fichier / carnet = 3 sources, pas des catégories décoratives. Articles « épuisés » = numéros absents de WhatsApp, comptés à part, non envoyés. Quantité = présence dans la liste (case à cocher), pas un stepper +/−.
**Écarté A :** grille photo (0 information, 3× moins d’items à l’écran).
**Écarté B :** recherche/filtre sur 2–3 numéros WhatsApp (parasite : 0 gain, 1 hésitation).
**Chiffres (laptop 14", ~900px utiles) :** grille photo ~6–8 visuels ; liste dense ~12–14 contacts sans défilement dans le panneau 320px ; coller 8 lignes visibles. Trouver un contact connu : liste + recherche = 1 champ + scroll, ~2 s vs grille + hunt visuel. Taps pour ajouter depuis le carnet : 1 (case) après chargement.

### Composition / note / envoi
**Retenu :** 3 étapes cliquables en arrière. Bandeau permanent « N destinataires · numéro · étape ». Étape 3 = note : ce n’est **pas encore envoyé**. Envoi = action définitive, unique, verte. Brouillon dans `sessionStorage` (rechargement). Changer de numéro vide la liste, **garde le message**, après confirm. QR : overlay ne ferme plus (un tap à côté pendant qu’on tient le téléphone cassait le jumelage).
**Écarté A :** tout sur un écran (on envoie sans relire).
**Écarté B :** URL par étape (changement de logique de routage, hors mandat métier ; le brouillon couvre le rechargement).

### Système visuel
**Retenu :** identité OpenWA existante (vert #25D366, Plus Jakarta Sans, jetons `--space`, `--touch` 44px, `--radius-*`). Palette unique en mode campagne. Contraste secondary relevé (`--text-muted` slate 500). Un `ScreenStatus` pour vide / erreur / hors-ligne / chargement.
**Écarté :** refonte de marque, 7 palettes, dashboard tuiles.

## Ce qui reste à toi

- Faut-il un écran d’historique des campagnes déjà envoyées ? (n’existe pas côté UI actuelle ; exigerait des données.)
- Le nom technique kebab-case à la création d’un numéro : la règle serveur l’impose ; seule la copie a changé.
- Traductions ar/he/zh/te des nouveaux textes : repli anglais (parity OK, pas traduit).

## Non vérifié

- Parcours réel dans le navigateur (pas d’outil browser dans cette session).
- Contraste mesuré au dropper (jetons choisis pour ≥4.5:1 sur fond blanc, pas mesurés pixel par pixel).
- Envoi réel d’une campagne de 1000 contacts.
- Lecteur d’écran VoiceOver/NVDA de bout en bout.
