# Fondation du calendrier de saison régulière

Cette étape ajoute un générateur de calendrier isolé sans remplacer le moteur de saison actuel.

## Contrat

- Chaque équipe reçoit exactement 82 rencontres (ou `gamesPerTeam` dans les tests).
- Les équipes à domicile et à l'extérieur sont indiquées séparément.
- Chaque match possède un identifiant stable dans le calendrier, un numéro de ronde, un adversaire, un statut initial `scheduled`, des scores encore vides et une étape de saison.
- Les équipes sont regroupées par étapes d'octobre à avril, réparties sur 82 rencontres.
- Le calendrier fonctionne avec un nombre pair ou impair d'équipes, y compris les franchises personnalisées. Les exemptions ne deviennent pas des matchs affichés.
- `validateSeasonCalendar()` vérifie les volumes, la numérotation, les identifiants et l'équilibre domicile/extérieur.
- Le module expose une API CommonJS pour les tests Node et `globalThis.NBASimSeasonCalendar` pour une future intégration navigateur.

## Test

Depuis la racine du dépôt, avec Node.js :

```sh
node tests/season-calendar.test.js
```

Le test couvre 30 équipes, 31 équipes, une petite ligue, 82 rencontres par équipe, les identifiants uniques, les matchs contre soi-même, l'équilibre domicile/extérieur et les configurations invalides.

## Limites de cette étape

Le module n'est pas encore branché à l'interface `index.html`. Il ne simule pas les scores et ne remplace pas encore `buildSeason()`. L'intégration suivante devra connecter ce calendrier à des résultats de matchs individuels, aux classements, aux tuiles du calendrier et aux playoffs, puis vérifier les anciennes fonctions.
