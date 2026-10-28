# Support mobile — première passe

## Changements
- Ajout d'un menu de navigation rapide mobile/tablette vers les huit sections principales.
- Le menu expose `aria-expanded`, se ferme après le choix d'une section et peut être fermé avec Échap.
- Cibles tactiles principales portées à au moins 44 px sur petits écrans.
- Champs de formulaire à 16 px sur mobile pour limiter le zoom automatique de certains navigateurs.
- Tableaux et tableau des séries défilables horizontalement au doigt.
- Grilles de statistiques, éditeur, roue de sélection et calendrier adaptés aux petits écrans.
- Focus clavier visible et prise en compte de `prefers-reduced-motion`.
- Les fonctionnalités du simulateur existant sont conservées; les changements concernent principalement la présentation et la navigation.

## Vérifications effectuées
- Syntaxe du JavaScript intégré vérifiée.
- Tests existants du générateur de calendrier exécutés dans le runtime JavaScript disponible.
- Vérification statique : aucun identifiant HTML dupliqué, toutes les ancres de navigation pointent vers une section existante.
- Les règles responsive et les cibles tactiles sont présentes.

## À vérifier avant de considérer le support mobile comme entièrement validé
- Essai réel sur Safari iOS et Chrome Android, en portrait et paysage.
- Vérification tactile de la roue, des formulaires longs, des tableaux et des 82 tuiles du calendrier.
- Test navigateur automatisé et contrôle visuel sur plusieurs largeurs d'écran.
