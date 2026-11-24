# monkeyscripts

Scripts maison pour Violentmonkey (ou Tampermonkey). Page de présentation et
d'installation : https://9mp.org/userscripts/

## Installer et mettre à jour

Installer chaque script **depuis son lien** ci-dessous, pas depuis un fichier
local : Violentmonkey garde une copie du script et ne relit jamais un fichier
du disque. Installé depuis le lien (repris dans `@downloadURL` et `@updateURL`
de chaque script), il revérifie ce lien chaque jour et prend la nouvelle
version dès que `@version` augmente. Pour ne pas attendre : tableau de bord →
« Vérifier les mises à jour ». Recharger ensuite les onglets déjà ouverts, qui
gardent l'ancienne version.

Changer `@name` ou `@namespace` fait d'un script un nouveau script pour
Violentmonkey : supprimer alors l'ancien.

| Script | Lien d'installation |
| --- | --- |
| TROP : pause forcée à la Gaspar Noé | https://github.com/grafmik/monkeyscripts/raw/refs/heads/main/trop/trop.user.js |
| X : fil sans politique ni religion | https://github.com/grafmik/monkeyscripts/raw/refs/heads/main/x-feed-filter/x-feed-filter.user.js |
| Instagram : barre de contrôle vidéo | https://github.com/grafmik/monkeyscripts/raw/refs/heads/main/instagram-video-controls/instagram-video-controls.user.js |
| Uber Eats : masquer les plats en double | https://github.com/grafmik/monkeyscripts/raw/refs/heads/main/ubereats-dedup/ubereats-dedup.user.js |
| Gemini Quick Delete & Next | https://github.com/grafmik/monkeyscripts/raw/refs/heads/main/gemini-delete-chat-keyb-shortcut/gemini-delete-chat-keyb-shortcut.user.js |
| VSC Controller Persistent Resizer | https://github.com/grafmik/monkeyscripts/raw/refs/heads/main/video-speed-controller-bigger-font/video-speed-controller-bigger-font.user.js |
| Controleur Vitesse MarcBluerSky | https://github.com/grafmik/monkeyscripts/raw/refs/heads/main/marcbluersky-speeder/marcbluersky-speeder.user.js |
| Panneau Score / Injection — Soi 6 Starship | https://github.com/grafmik/monkeyscripts/raw/refs/heads/main/soi-6-starship-injection/soi-6-starship-injection.user.js |

À chaque modification d'un script : augmenter `@version`, sinon personne ne
reçoit la mise à jour. La page 9mp.org/userscripts/ (dépôt
grafmik/9mp.org.github.io) ne liste que les six premiers.
