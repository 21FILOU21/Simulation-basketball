# Calendrier de saison régulière — intégration

Le générateur de calendrier est maintenant connecté à la section « Saison régulière » de `index.html`, sans supprimer les fonctions de simulation, de classement, de playoffs, de trophées ou d'intersaison déjà présentes.

## Fonctionnement intégré

- Le module `src/season-calendar.js` est chargé par la page.
- Le bouton « Simuler la saison régulière » génère un calendrier de 82 matchs par équipe, y compris les équipes personnalisées.
- Chaque rencontre reçoit un score et passe à l'état `completed`.
- Les victoires, défaites, points marqués/encaissés et moyennes d'équipe du classement sont calculés à partir des scores des mêmes rencontres affichées dans le calendrier.
- Le calendrier des 82 matchs est affiché en tuiles, regroupées par étape d'octobre à avril. Le sélecteur permet de consulter le calendrier de chaque équipe.
- Les codes internes du calendrier sont rendus uniques si une équipe personnalisée réutilise le code d'une franchise NBA; les noms d'équipes restent visibles dans les tuiles.
- Le calendrier généré est validé avant de simuler les matchs. En cas d'erreur de validation, la saison n'est pas lancée.

## Contrat du module

- Chaque équipe reçoit exactement 82 rencontres (ou `gamesPerTeam` dans les tests).
- Les équipes à domicile et à l'extérieur sont indiquées séparément.
- Chaque match possède un identifiant unique, une ronde, un adversaire, un statut initial `scheduled`, des scores vides et une étape de saison.
- Le calendrier fonctionne avec un nombre pair ou impair d'équipes, y compris les franchises personnalisées. Les exemptions ne deviennent pas des matchs affichés.
- `validateSeasonCalendar()` vérifie les volumes, la numérotation, les identifiants et l'équilibre domicile/extérieur.

## Tests

Depuis la racine du dépôt, avec Node.js :

```sh
node tests/season-calendar.test.js
```

Le test couvre 30 équipes, 31 équipes, une petite ligue, 82 rencontres par équipe, les identifiants uniques, les matchs contre soi-même, l'équilibre domicile/extérieur et les configurations invalides.

La syntaxe JavaScript de la page et les tests du générateur ont aussi été vérifiés dans le runtime JavaScript de l'assistant. L'exécution native Node.js et un test navigateur automatisé restent à faire.

## Limites connues

- Les statistiques individuelles de saison (`genSeasonLines()`) restent générées par le modèle existant séparément des statistiques agrégées de l'équipe. Le calendrier et le classement partagent bien les scores des rencontres, mais les totaux individuels ne sont pas encore réconciliés avec les totaux collectifs.
- Les résultats sont simulés lorsque l'utilisateur lance une saison complète; il n'y a pas encore de bouton pour simuler un seul match à la fois.
- Les playoffs existants sont conservés et démarrent après la saison régulière. Leur moteur n'a pas été remplacé par le calendrier de saison régulière.
