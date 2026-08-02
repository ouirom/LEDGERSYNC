// /uploads est protégé par authentification (voir server/src/index.ts) : une
// <img> chargée directement par le navigateur ne peut pas envoyer d'en-tête
// Authorization, on passe donc le token en query string (accepté en plus de
// l'en-tête par authenticateFile côté serveur, seulement sur cette route).
// Utilisé pour tout fichier /uploads affiché en <img> (avatar utilisateur,
// logo d'entreprise...).
export function resolveUploadUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const token = localStorage.getItem('accessToken');
  return token ? `${url}?token=${encodeURIComponent(token)}` : url;
}
