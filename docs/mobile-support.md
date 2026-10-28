# Support mobile — première passe

## Changements
- Ajout d'un menu de navigation rapide mobile/tablette vers les huit sections principales.
- Le menu expose `aria-expanded`, se ferme après le choix d'une section et peut être fermé avec Échap.
- Cibles tactiles principales portées à au moins 44 px sur petits écrans.
- Champs de formulaire à 16 px sur mobile pour limiter le zoom automatique de certains navigateurs.
- Tableaux et tableau des séries défilables horizontalement au doigt.
- Grilles de statistiques, éditeur, roue de sélection et calendrier adaptés aux petits écrans.
- Focus clavier visible et prise en compte de `prefers-reduced-motion`.
- Les fonctionnalités du simulateur existant sont conservées.
- Le calendrier des 82 matchs est maintenant généré dès l’ouverture et reste visible, y compris à l’intersaison.
- Les tuiles sont cliquables : choisir un match futur simule tous les tours précédents jusqu’à ce match, afin de garder un ordre cohérent.
- Le bouton « Simuler partie » avance la prochaine rencontre de l’équipe sélectionnée dans le calendrier.
- Les scores ont été retirés des tuiles; les défaites sont affichées en rouge et les libellés Victoire/Défaite sont masqués à l’intersaison.

## Vérifications effectuées
- Syntaxe du JavaScript intégré vérifiée.
- Nouveau test statique `tests/season-calendar-ui.test.js` pour les tuiles, l’ordre de progression, le bouton connecté, l’absence de scores et le style des défaites.
- Tests existants du générateur de calendrier exécutés dans le runtime JavaScript disponible.
- Vérification statique : aucun identifiant HTML dupliqué, toutes les ancres de navigation pointent vers une section existante.
- Les règles responsive et les cibles tactiles sont présentes.

## À vérifier avant de considérer le support mobile comme entièrement validé
- Essai réel sur Safari iOS et Chrome Android, en portrait et paysage.
- Vérification tactile de la roue, des formulaires longs, des tableaux et des 82 tuiles du calendrier.
- Test navigateur automatisé et contrôle visuel sur plusieurs largeurs d'écran.
