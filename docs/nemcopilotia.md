# NemCopilotIA : suivi des sprints

NemCopilotIA est le nom de l'assistant, **dans le back-office et sur le chatbot des visiteurs** (décision du propriétaire).
Palier gratuit Gemini uniquement. Le modèle ne modifie, n'envoie ni ne publie rien : il lit, prépare des brouillons, et seul le bouton « Appliquer » (avec confirmation) écrit une clé du site. Les e-mails restent des brouillons que l'administrateur envoie lui-même.

## Décisions

| Sujet | Décision |
| --- | --- |
| Nom | NemCopilotIA partout (admin, chat visiteur, prompts, page de confidentialité). |
| Prix sur les cartes de prestations | Prix de base de CHAQUE offre, calculé à partir de ses propres données : son minimum chiffré (`priceHTMin`, affiché « HT ») s'il existe, sinon le premier montant de son libellé de prix (« 350 000 – 600 000 FCFA » donne 350 000), sinon « Sur devis ». Toute offre ajoutée ou modifiée dans le back-office est reprise sans changer le code. Toujours accompagné de « Prix indicatif : le devis fait foi », avec la fourchette complète de l'offre à côté. Fonction : `basePrice`. |
| Style | Carré, noir et blanc, ombre dure au survol. Les couleurs viennent des variables du site (clair / sombre). Un test interdit tout arrondi dans l'interface de l'assistant. |
| Relances | Gabarit rédigé par le code, 3 tons (courtois, direct, dernier rappel), FR ou EN selon le devis. Zéro requête Gemini, aucune donnée client envoyée à Google. |
| Tri des chats | Règles à la lecture, sans IA, donc sans quota ni donnée envoyée. |
| Offres du chat | Chargées à la demande par une action publique limitée aux champs que la page « Offres » affiche déjà (le contexte public est volontairement allégé). |

## Sprints

| # | Contenu | État |
| --- | --- | --- |
| 1 | Back-office : accueil du chat (salutation, briefing, 4 cartes), commandes « / », jauge de quota compacte, traces d'outils repliables, copier et régénérer, Ctrl+K, diff avant / après | Livré |
| 2 | Contexte de page, outils `listPendingQuotes` et `draftQuoteReminder`, brouillons d'e-mail (copier, ouvrir dans la messagerie), blocage de « Appliquer » pour ce type de brouillon | Livré |
| 3 | `/admin/chats` : tag, contact possible, sans réponse, filtres, adresse masquée dans le résumé | Livré |
| 4 | Chat visiteurs : bulle d'invitation, suggestions, cartes de prestations, suivi de devis, progression, passage à l'humain, message de contact prérempli | Livré |
| 5 | Documentation, vérification complète (types, lint, tests, build, navigateur réel), nettoyage | Livré |

## Critères d'acceptation vérifiés

- Une carte ou une commande « fill » ne consomme aucune requête : elle remplit le champ. Une commande « send » en consomme une, comme une question.
- Un brouillon d'e-mail n'a pas de bouton « Appliquer au site » ; le planificateur d'application le refuse aussi côté serveur (`planApply`).
- `listPendingQuotes` et `draftQuoteReminder` ne renvoient au modèle ni nom, ni adresse, ni jeton de signature.
- `pageKey` envoyé par le navigateur est ignoré s'il n'est pas dans la table (`contextForKey`).
- Les cartes de prestations n'utilisent que les offres publiées ; si la lecture échoue, un message neutre propose de demander un devis.
- La bulle d'invitation ne s'affiche ni sur les pages de signature, de recette, de suivi, ni dans l'admin ; une fois par session.
- Mobile : aucun défilement horizontal, panneau du chat dans l'écran.

## Tests

- `tests/assistant-commands-diff.test.ts` : commandes, diff.
- `tests/assistant-reminders.test.ts` : gabarits, outils de relance, blocage d'application, contexte de page.
- `tests/chat-triage.test.ts` : tri des conversations.
- `tests/chat-services.test.ts` : prix indicatif, cartes, code de suivi, progression, liens de contact, bulle.
- `tests/assistant-ui-style.test.ts` : aucun arrondi.
- `tests/actions-auth.test.ts` : `getPublicOffers` est la seule nouvelle action publique, et elle est déclarée.

## Limites connues

- Les modifications faites dans le brouillon d'e-mail (objet, message) ne sont pas enregistrées : il faut copier avant de fermer.
- Le tri des chats repose sur des mots-clés FR/EN : une formulation inhabituelle tombe dans « Autre ».
- Le chat visiteur utilise toujours la clé Gemini gratuite du site : quota atteint ou panne, les liens de passage à l'humain s'affichent à la place d'une réponse.
- Les envois automatiques (relances planifiées) ne sont pas implémentés, volontairement.
