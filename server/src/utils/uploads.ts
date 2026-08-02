import fs from 'fs';
import path from 'path';

// Supprime un fichier précédemment uploadé (avatar, logo...) — n'échoue jamais
// silencieusement de façon bloquante : le fichier a pu être déjà supprimé
// manuellement, ou UPLOAD_DIR changé entre-temps.
export function deleteUploadedFile(url: string | null | undefined): void {
  if (!url) return;
  const filePath = path.join(process.env.UPLOAD_DIR || './uploads', path.basename(url));
  fs.unlink(filePath, () => {});
}
