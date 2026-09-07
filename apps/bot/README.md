# @apex/bot

Worker qui consomme `discord_sync_queue` : accorde ou retire un rôle Discord
en fonction des inscriptions et paiements, sans jamais appeler l'API Discord
directement depuis le site (voir CLAUDE.md, « Discord passe par la file »).

Pas de connexion au Gateway Discord, pas de `discord.js` : deux appels REST
suffisent (`PUT`/`DELETE` sur `/guilds/{id}/members/{id}/roles/{id}`). La
liaison de compte (qui remplit `discord_links`) se fait côté web via l'OAuth
Discord de Supabase Auth — le rôle de ce worker s'arrête à la synchronisation
des rôles.

## Non testé en conditions réelles

Contrairement au reste du dépôt, cette partie n'a pas encore été vérifiée
contre un vrai serveur Discord — il n'existe pas encore d'application Discord
pour le projet. La logique suit le schéma au plus près et passe le typecheck,
mais mérite un test réel avant la phase 4.

Pour la débloquer :

1. Créer une application sur https://discord.com/developers/applications,
   y ajouter un Bot, copier son token → `DISCORD_BOT_TOKEN`.
2. Inviter le bot sur le serveur avec la permission **Gérer les rôles**
   (`Manage Roles`), via l'URL générée dans l'onglet OAuth2 → URL Generator
   (scope `bot`, permission `Manage Roles`).
3. **Le rôle du bot doit être positionné au-dessus, dans la hiérarchie des
   rôles du serveur, de tous les rôles qu'il doit attribuer** (`discord_role_id`
   des cohortes). C'est une règle Discord, pas un bug ici : sans ça, chaque
   appel échoue en 403 quel que soit le code.
4. Copier l'ID du serveur (mode développeur activé → clic droit sur le
   serveur → Copier l'ID) → `DISCORD_GUILD_ID`.
5. Copier `.env.example` en `.env` et renseigner les quatre valeurs.

## Développement

```bash
npm run dev --workspace=@apex/bot
```

## Ce qui manque avant la phase 4

- Test réel contre un serveur Discord de développement.
- La ligne `discord_sync_queue` insérée à la bonne étape du webhook Stripe/
  PayPal (phase 3) et de la synchronisation de cohorte (`cohorte_coachs` /
  `discord_role_id`, phase 2).
- Décider quoi faire d'un `MembreIntrouvable` répété : relancer une invite,
  ou juste laisser l'alerte dans `admin/logs` pour une action manuelle. Non
  tranché dans docs/06-PERIMETRE.md.
- Si le worker tourne un jour en plusieurs instances : remplacer la
  réclamation en deux étapes de `reclamerLot()` (src/worker.ts) par une
  fonction RPC `SELECT ... FOR UPDATE SKIP LOCKED` côté Postgres, qui seule
  garantit qu'une ligne n'est prise que par un worker à la fois.
