import { Router, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type { Prisma } from '@prisma/client';
import prisma from '../../config/db';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { createAuditEntry } from '../../middleware/auditLogger';
import { importQueue } from '../../workers/importWorker';
import { parseSourceFile, toPreviewLigne } from '../../utils/statementParser';
import { resolveOrgScope, orgScopeWhere } from '../../utils/orgScope';

const ligneSchema = z.object({
  compte_bancaire_id: z.number().int().positive(),
  reference: z.string().optional(),
  libelle: z.string().min(1),
  montant: z.number().positive(),
  type: z.enum(['DEBIT', 'CREDIT']),
  date_operation: z.string(),
  date_valeur: z.string().optional(),
});

const router = Router();
router.use(authenticate);

const storage = multer.diskStorage({
  destination: process.env.UPLOAD_DIR || './uploads',
  filename: (_req, file, cb) => {
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB || '50')) * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // .xls (format binaire Excel 97-2003) n'est plus accepté : la bibliothèque de lecture
    // (read-excel-file, sans vulnérabilité connue) ne supporte que le format .xlsx (OOXML) et .csv,
    // contrairement à l'ancienne dépendance xlsx/SheetJS qui présentait des failles non corrigées.
    const allowed = ['.xlsx', '.csv', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Format non supporté. Utilisez .xlsx, .csv ou .pdf (le format .xls hérité n\'est plus accepté).'));
  },
});

// POST /api/releves/preview — Parse une ou plusieurs pages sans rien persister,
// pour permettre à l'utilisateur de vérifier les données avant de valider l'import.
router.post('/preview', upload.array('files', 20), async (req: AuthRequest, res: Response): Promise<void> => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) { res.status(400).json({ success: false, message: 'Au moins un fichier requis' }); return; }

  try {
    const pages = await Promise.all(files.map(async f => {
      const rows = await parseSourceFile(f.path);
      return { nom: f.originalname, nb_lignes: rows.length, lignes: rows.map(toPreviewLigne) };
    }));

    const toutesLesLignes = pages.flatMap(p => p.lignes);
    const totalLignes = toutesLesLignes.length;
    const lignesValides = toutesLesLignes.filter(l => l.valide);
    const lignesInvalides = toutesLesLignes.length - lignesValides.length;
    const lignesIncertaines = lignesValides.filter(l => l.incertain).length;
    // Sommes calculées sur les seules lignes valides (celles qui seront
    // effectivement importées) — les lignes invalides ont un montant illisible.
    const totalDebit = lignesValides.reduce((sum, l) => sum + (l.debit ?? 0), 0);
    const totalCredit = lignesValides.reduce((sum, l) => sum + (l.credit ?? 0), 0);

    res.json({
      success: true,
      data: {
        nb_pages: files.length,
        total_lignes: totalLignes,
        lignes_invalides: lignesInvalides,
        lignes_incertaines: lignesIncertaines,
        total_debit: totalDebit,
        total_credit: totalCredit,
        pages: pages.map(p => ({ nom: p.nom, nb_lignes: p.nb_lignes })),
        apercu: toutesLesLignes.slice(0, 50),
      },
    });
  } catch (err) {
    console.error('[RELEVE/PREVIEW]', err);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'analyse du fichier' });
  } finally {
    // La prévisualisation ne persiste rien : les fichiers temporaires sont nettoyés immédiatement.
    for (const f of files || []) {
      if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
    }
  }
});

// POST /api/releves/import — Upload (une ou plusieurs pages) + création du relevé + enqueue BullMQ
router.post('/import', upload.array('files', 20), async (req: AuthRequest, res: Response): Promise<void> => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) { res.status(400).json({ success: false, message: 'Au moins un fichier requis' }); return; }

  const { compte_bancaire_id, template_id, reference, date_debut, date_fin } = req.body as Record<string, string | undefined>;
  if (!compte_bancaire_id) { res.status(400).json({ success: false, message: 'compte_bancaire_id requis' }); return; }

  const scope = await resolveOrgScope(req.user!);
  const compte = await prisma.compteBancaire.findFirst({
    where: { id: parseInt(compte_bancaire_id), entreprise: { tenant_id: req.user!.tenantId }, ...orgScopeWhere(scope) },
  });
  if (!compte) { res.status(404).json({ success: false, message: 'Compte bancaire non trouvé' }); return; }

  try {
    // Créer le job en base
    // Le compteId/templateId est stocké dès la création (dans `resultat`) afin que
    // le mécanisme de reprise (resume) puisse le retrouver même si le job échoue ou est annulé
    // avant d'atteindre son état COMPLETE (seul moment où `resultat` était renseigné auparavant).
    const jobRecord = await prisma.jobTraitement.create({
      data: {
        tenant_id: req.user!.tenantId,
        utilisateur_id: req.user!.userId,
        type_job: 'IMPORT_RELEVE',
        nom_fichier: files.length === 1 ? files[0]!.originalname : `${files.length} fichiers`,
        statut: 'EN_ATTENTE',
        resultat: { compteId: parseInt(compte_bancaire_id), templateId: template_id ? parseInt(template_id) : undefined },
        etat: 'BROUILLON',
        created_by: req.user!.userId,
        updated_by: req.user!.userId,
      },
    });

    // Un relevé bancaire regroupe toutes les pages de cet import sous une seule entité.
    const releveBancaire = await prisma.releveBancaire.create({
      data: {
        compte_bancaire_id: compte.id,
        job_id: jobRecord.id,
        reference: reference || null,
        date_debut: date_debut ? new Date(date_debut) : null,
        date_fin: date_fin ? new Date(date_fin) : null,
        nb_pages: files.length,
        etat: 'BROUILLON',
        created_by: req.user!.userId,
        updated_by: req.user!.userId,
      },
    });

    // Enregistrer chaque page comme fichier source
    await prisma.fichierSource.createMany({
      data: files.map(f => ({
        job_id: jobRecord.id,
        tenant_id: req.user!.tenantId,
        nom_original: f.originalname,
        nom_stockage: f.filename,
        url: `/uploads/${f.filename}`,
        type_fichier: path.extname(f.originalname).toLowerCase() === '.pdf' ? ('PDF' as const) : ('EXCEL' as const),
        taille_octets: f.size,
        etat: 'BROUILLON' as const,
        created_by: req.user!.userId,
        updated_by: req.user!.userId,
      })),
    });

    // Enqueue BullMQ job
    const bullJob = await importQueue.add(`import-${jobRecord.id}`, {
      jobId: jobRecord.id,
      tenantId: req.user!.tenantId,
      userId: req.user!.userId,
      filePaths: files.map(f => f.path),
      compteId: compte.id,
      releveBancaireId: releveBancaire.id,
      templateId: template_id ? parseInt(template_id) : undefined,
    });

    await prisma.jobTraitement.update({
      where: { id: jobRecord.id },
      data: { bull_job_id: bullJob.id?.toString(), updated_by: req.user!.userId },
    });

    res.status(202).json({
      success: true,
      message: 'Import démarré en arrière-plan',
      data: { jobId: jobRecord.id, bullJobId: bullJob.id, releveBancaireId: releveBancaire.id },
    });
  } catch (err) {
    console.error('[RELEVE/IMPORT]', err);
    res.status(500).json({ success: false, message: 'Erreur lors du démarrage de l\'import' });
  }
});

// GET /api/releves/statements?compte_bancaire_id=X — Liste des relevés (une banque, via ses comptes, peut en avoir plusieurs)
router.get('/statements', async (req: AuthRequest, res: Response): Promise<void> => {
  const { compte_bancaire_id, page = '1', limit = '50' } = req.query;
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

  try {
    const scope = await resolveOrgScope(req.user!);
    const where: Prisma.ReleveBancaireWhereInput = { compte_bancaire: { entreprise: { tenant_id: req.user!.tenantId }, ...orgScopeWhere(scope) } };
    if (compte_bancaire_id) where.compte_bancaire_id = parseInt(compte_bancaire_id as string);

    const [data, total] = await Promise.all([
      prisma.releveBancaire.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { created_at: 'desc' },
        include: {
          compte_bancaire: { select: { id: true, intitule: true, banque: { select: { nom: true } } } },
          _count: { select: { lignes: true } },
        },
      }),
      prisma.releveBancaire.count({ where }),
    ]);

    res.json({ success: true, data, meta: { total, page: parseInt(page as string), limit: parseInt(limit as string) } });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

// GET /api/releves/statements/:id — Détail d'un relevé + ses lignes
router.get('/statements/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params['id'] as string);
  try {
    const scope = await resolveOrgScope(req.user!);
    const releve = await prisma.releveBancaire.findFirst({
      where: { id, compte_bancaire: { entreprise: { tenant_id: req.user!.tenantId }, ...orgScopeWhere(scope) } },
      include: {
        compte_bancaire: { select: { id: true, intitule: true, banque: { select: { nom: true } } } },
        lignes: { orderBy: { num_ligne: 'asc' } },
      },
    });
    if (!releve) { res.status(404).json({ success: false, message: 'Relevé non trouvé' }); return; }
    res.json({ success: true, data: releve });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

// GET /api/releves?compte_bancaire_id=X&page=1
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { compte_bancaire_id, page = '1', limit = '100' } = req.query;
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

  try {
    const scope = await resolveOrgScope(req.user!);
    const where: Prisma.ReleveBancaireLigneWhereInput = {
      compte_bancaire: { entreprise: { tenant_id: req.user!.tenantId }, ...orgScopeWhere(scope) },
      etat: { not: 'ANNULE' },
    };
    if (compte_bancaire_id) where.compte_bancaire_id = parseInt(compte_bancaire_id as string);

    const [data, total] = await Promise.all([
      prisma.releveBancaireLigne.findMany({ where, skip, take: parseInt(limit as string), orderBy: { date_operation: 'desc' } }),
      prisma.releveBancaireLigne.count({ where }),
    ]);

    res.json({ success: true, data, meta: { total, page: parseInt(page as string), limit: parseInt(limit as string) } });
  } catch {
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
});

// GET /api/releves/export — Export CSV (respecte les mêmes filtres que la liste)
router.get('/export', async (req: AuthRequest, res: Response): Promise<void> => {
  const { compte_bancaire_id } = req.query;
  try {
    const scope = await resolveOrgScope(req.user!);
    const where: Prisma.ReleveBancaireLigneWhereInput = {
      compte_bancaire: { entreprise: { tenant_id: req.user!.tenantId }, ...orgScopeWhere(scope) },
      etat: { not: 'ANNULE' },
    };
    if (compte_bancaire_id) where.compte_bancaire_id = parseInt(compte_bancaire_id as string);

    const rows = await prisma.releveBancaireLigne.findMany({ where, orderBy: { date_operation: 'asc' } });
    const csvEscape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Date opération', 'Date valeur', 'Référence', 'Libellé', 'Débit', 'Crédit', 'Lettrage'];
    const lines = [header.map(csvEscape).join(';')];
    for (const r of rows) {
      lines.push([
        r.date_operation.toISOString().slice(0, 10),
        r.date_valeur ? r.date_valeur.toISOString().slice(0, 10) : '',
        r.reference ?? '',
        r.libelle,
        r.type === 'DEBIT' ? r.montant.toString() : '',
        r.type === 'CREDIT' ? r.montant.toString() : '',
        r.lettrage_ref ?? '',
      ].map(csvEscape).join(';'));
    }
    const csv = String.fromCharCode(0xfeff) + lines.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="releve.csv"');
    res.send(csv);
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

// POST /api/releves — Ajout manuel d'une ligne de relevé (ex. correction ou
// complément d'un import, saisie d'une opération non encore remontée par la banque).
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = ligneSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }

  const scope = await resolveOrgScope(req.user!);
  const compte = await prisma.compteBancaire.findFirst({
    where: { id: parsed.data.compte_bancaire_id, entreprise: { tenant_id: req.user!.tenantId }, ...orgScopeWhere(scope) },
  });
  if (!compte) { res.status(404).json({ success: false, message: 'Compte bancaire non trouvé ou hors de votre périmètre' }); return; }

  try {
    const maxLigne = await prisma.releveBancaireLigne.aggregate({ where: { compte_bancaire_id: compte.id }, _max: { num_ligne: true } });
    const data = await prisma.releveBancaireLigne.create({
      data: {
        compte_bancaire_id: compte.id,
        reference: parsed.data.reference || null,
        libelle: parsed.data.libelle,
        montant: parsed.data.montant,
        type: parsed.data.type,
        date_operation: new Date(parsed.data.date_operation),
        date_valeur: parsed.data.date_valeur ? new Date(parsed.data.date_valeur) : null,
        num_ligne: (maxLigne._max.num_ligne ?? 0) + 1,
        etat: 'VALIDE',
        created_by: req.user!.userId,
        updated_by: req.user!.userId,
      },
    });
    await createAuditEntry({ tenantId: req.user!.tenantId, userId: req.user!.userId, entite: 'RELEVE_LIGNE', entiteId: data.id, action: 'CREATE', apres: { reference: data.reference, libelle: data.libelle, montant: data.montant.toString(), type: data.type }, ipAddress: req.ip });
    res.status(201).json({ success: true, data });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

// PUT /api/releves/:id — Modifier une ligne de relevé. Réservé aux lignes non
// lettrées : une ligne déjà lettrée est solidaire d'un rapprochement et ne
// doit pas être modifiée sans passer par le délettrage.
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = ligneSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }
  const id = parseInt(req.params['id'] as string);

  const scope = await resolveOrgScope(req.user!);
  const existing = await prisma.releveBancaireLigne.findFirst({
    where: { id, compte_bancaire: { entreprise: { tenant_id: req.user!.tenantId }, ...orgScopeWhere(scope) } },
  });
  if (!existing) { res.status(404).json({ success: false, message: 'Ligne non trouvée' }); return; }
  if (existing.lettree) { res.status(409).json({ success: false, message: 'Ligne déjà lettrée, impossible de la modifier' }); return; }

  const compte = await prisma.compteBancaire.findFirst({
    where: { id: parsed.data.compte_bancaire_id, entreprise: { tenant_id: req.user!.tenantId }, ...orgScopeWhere(scope) },
  });
  if (!compte) { res.status(404).json({ success: false, message: 'Compte bancaire non trouvé ou hors de votre périmètre' }); return; }

  try {
    const data = await prisma.releveBancaireLigne.update({
      where: { id },
      data: {
        compte_bancaire_id: compte.id,
        reference: parsed.data.reference || null,
        libelle: parsed.data.libelle,
        montant: parsed.data.montant,
        type: parsed.data.type,
        date_operation: new Date(parsed.data.date_operation),
        date_valeur: parsed.data.date_valeur ? new Date(parsed.data.date_valeur) : null,
        updated_by: req.user!.userId,
      },
    });
    await createAuditEntry({
      tenantId: req.user!.tenantId, userId: req.user!.userId, entite: 'RELEVE_LIGNE', entiteId: id, action: 'UPDATE',
      avant: { libelle: existing.libelle, montant: existing.montant.toString(), type: existing.type },
      apres: { libelle: data.libelle, montant: data.montant.toString(), type: data.type },
      ipAddress: req.ip,
    });
    res.json({ success: true, data });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

// DELETE /api/releves/:id — Supprimer une ligne de relevé. Réservé aux lignes
// non lettrées.
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params['id'] as string);
  try {
    const scope = await resolveOrgScope(req.user!);
    const existing = await prisma.releveBancaireLigne.findFirst({
      where: { id, compte_bancaire: { entreprise: { tenant_id: req.user!.tenantId }, ...orgScopeWhere(scope) } },
    });
    if (!existing) { res.status(404).json({ success: false, message: 'Ligne non trouvée' }); return; }
    if (existing.lettree) { res.status(409).json({ success: false, message: 'Ligne lettrée, impossible de la supprimer' }); return; }

    await prisma.releveBancaireLigne.delete({ where: { id } });
    await createAuditEntry({ tenantId: req.user!.tenantId, userId: req.user!.userId, entite: 'RELEVE_LIGNE', entiteId: id, action: 'DELETE', avant: { libelle: existing.libelle, montant: existing.montant.toString() }, ipAddress: req.ip });
    res.json({ success: true, message: 'Ligne supprimée' });
  } catch { res.status(500).json({ success: false, message: 'Erreur interne' }); }
});

export default router;
