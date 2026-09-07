/**
 * PLACEHOLDER — à remplacer par la génération automatique.
 *
 * Ce fichier est normalement produit par `npm run db:types`, qui interroge le
 * schéma réel. Cette commande a besoin dune base accessible : en local Docker
 * est bloqué (cf. CLAUDE.md), donc la génération se fait contre le projet
 * Supabase hébergé dès quil est créé :
 *
 *   npx supabase link --project-ref <ref>
 *   npx supabase gen types typescript --linked > packages/db/src/database.types.ts
 *
 * Jusque-là, seuls les types transverses ci-dessous sont disponibles. Ne pas
 * écrire ici de définition de table à la main : elle divergerait du schéma sans
 * que rien ne le signale, ce qui est pire que labsence de type.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
