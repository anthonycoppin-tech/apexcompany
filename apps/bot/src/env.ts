function requis(nom: string): string {
  const valeur = process.env[nom];
  if (!valeur) {
    throw new Error(`Variable d'environnement manquante : ${nom}. Voir apps/bot/.env.example.`);
  }
  return valeur;
}

/**
 * Chargées une fois au démarrage — une variable manquante doit arrêter le
 * worker immédiatement, pas échouer silencieusement sur la première ligne
 * de la file traitée.
 */
export const env = {
  supabaseUrl: requis('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseServiceRoleKey: requis('SUPABASE_SERVICE_ROLE_KEY'),
  discordBotToken: requis('DISCORD_BOT_TOKEN'),
  discordGuildId: requis('DISCORD_GUILD_ID'),
};
