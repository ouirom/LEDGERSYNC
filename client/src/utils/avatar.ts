// /uploads est protégé par authentification (voir server/src/index.ts) : une
// <img> chargée directement par le navigateur ne peut pas envoyer d'en-tête
// Authorization, on passe donc le token en query string (accepté en plus de
// l'en-tête par authenticateFile côté serveur, seulement sur cette route).
export function resolveAvatarUrl(avatarUrl: string | null | undefined): string | undefined {
  if (!avatarUrl) return undefined;
  const token = localStorage.getItem('accessToken');
  return token ? `${avatarUrl}?token=${encodeURIComponent(token)}` : avatarUrl;
}
