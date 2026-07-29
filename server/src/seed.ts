import prisma from './config/db';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  console.log('🌱 Seeding LedgerSync database...');

  // ── Theme ──────────────────────────────────────────────────
  const theme = await prisma.theme.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nom: 'LedgerSync Default',
      couleur_primaire: '#0f3460',
      couleur_secondaire: '#16213e',
      couleur_accent: '#e94560',
      mode_sombre: false,
      etat: 'ACTIF',
      created_by: null,
      updated_by: null,
    },
  });
  console.log('✅ Theme created:', theme.nom);

  // ── Catalogue de thèmes prédéfinis ──────────────────────────
  const presetThemes = [
    { nom: 'Midnight Finance', couleur_primaire: '#1e40af', couleur_secondaire: '#0f172a', couleur_accent: '#7c3aed', mode_sombre: true },
    { nom: 'Emerald Banking', couleur_primaire: '#065f46', couleur_secondaire: '#f0fdf4', couleur_accent: '#10b981', mode_sombre: false },
    { nom: 'Royal Gold', couleur_primaire: '#78350f', couleur_secondaire: '#fffbeb', couleur_accent: '#f59e0b', mode_sombre: false },
    { nom: 'Slate Pro', couleur_primaire: '#1e293b', couleur_secondaire: '#f8fafc', couleur_accent: '#38bdf8', mode_sombre: false },
    { nom: 'Carbon Dark', couleur_primaire: '#374151', couleur_secondaire: '#111827', couleur_accent: '#6366f1', mode_sombre: true },
  ];
  for (const preset of presetThemes) {
    const found = await prisma.theme.findFirst({ where: { nom: preset.nom } });
    if (!found) {
      await prisma.theme.create({ data: { ...preset, etat: 'ACTIF', created_by: null, updated_by: null } });
    }
  }
  console.log(`✅ ${presetThemes.length} thèmes prédéfinis vérifiés/créés`);

  // ── Pays ───────────────────────────────────────────────────
  const pays = await prisma.pays.upsert({
    where: { code_iso: 'SN' },
    update: {},
    create: {
      code_iso: 'SN',
      nom: 'Sénégal',
      devise: 'XOF',
      etat: 'ACTIF',
      created_by: null,
      updated_by: null,
    },
  });
  console.log('✅ Pays created:', pays.nom);

  // ── Tenant ─────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { code: 'DEMO' },
    update: {},
    create: {
      code: 'DEMO',
      nom: 'Organisation Démo',
      plan: 'ENTERPRISE',
      theme_id: theme.id,
      etat: 'ACTIF',
      created_by: null,
      updated_by: null,
    },
  });
  console.log('✅ Tenant created:', tenant.nom);

  // ── Entreprise ─────────────────────────────────────────────
  const entreprise = await prisma.entreprise.upsert({
    where: { id: 1 },
    update: {},
    create: {
      tenant_id: tenant.id,
      pays_id: pays.id,
      theme_id: theme.id,
      code: 'ENT001',
      nom: 'SARL Démo Finances',
      siret: 'SN-001-2024',
      adresse: '123 Avenue de la République, Dakar, Sénégal',
      etat: 'ACTIF',
      created_by: null,
      updated_by: null,
    },
  });
  console.log('✅ Entreprise created:', entreprise.nom);

  // ── Super Admin ────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Admin@2026!', 12);
  const adminUser = await prisma.utilisateur.upsert({
    where: { id: 1 },
    update: {},
    create: {
      tenant_id: tenant.id,
      entreprise_id: entreprise.id,
      email: 'admin@ledgersync.demo',
      nom: 'Administrateur',
      prenom: 'Super',
      password_hash: passwordHash,
      role: 'SUPER_ADMIN',
      etat: 'ACTIF',
      created_by: null,
      updated_by: null,
    },
  });
  console.log('✅ Super Admin created:', adminUser.email);

  // ── DAF ────────────────────────────────────────────────────
  const dafHash = await bcrypt.hash('Daf@2026!', 12);
  const dafUser = await prisma.utilisateur.upsert({
    where: { id: 2 },
    update: {},
    create: {
      tenant_id: tenant.id,
      entreprise_id: entreprise.id,
      email: 'daf@ledgersync.demo',
      nom: 'FALL',
      prenom: 'Amadou',
      password_hash: dafHash,
      role: 'DAF',
      etat: 'ACTIF',
      created_by: 1,
      updated_by: 1,
    },
  });
  console.log('✅ DAF created:', dafUser.email);

  // ── Comptable User ─────────────────────────────────────────
  const userHash = await bcrypt.hash('User@2026!', 12);
  const comptable = await prisma.utilisateur.upsert({
    where: { id: 3 },
    update: {},
    create: {
      tenant_id: tenant.id,
      entreprise_id: entreprise.id,
      email: 'comptable@ledgersync.demo',
      nom: 'DIOP',
      prenom: 'Fatou',
      password_hash: userHash,
      role: 'USER',
      etat: 'ACTIF',
      created_by: 1,
      updated_by: 1,
    },
  });
  console.log('✅ Comptable created:', comptable.email);

  // ── Superviseur ────────────────────────────────────────────
  const superviseurHash = await bcrypt.hash('Superviseur@2026!', 12);
  const superviseur = await prisma.utilisateur.upsert({
    where: { id: 4 },
    update: {},
    create: {
      tenant_id: tenant.id,
      entreprise_id: entreprise.id,
      email: 'superviseur@ledgersync.demo',
      nom: 'NDIAYE',
      prenom: 'Cheikh',
      password_hash: superviseurHash,
      role: 'SUPERVISEUR',
      etat: 'ACTIF',
      created_by: 1,
      updated_by: 1,
    },
  });
  console.log('✅ Superviseur created:', superviseur.email);

  // ── Manager ────────────────────────────────────────────────
  const managerHash = await bcrypt.hash('Manager@2026!', 12);
  const manager = await prisma.utilisateur.upsert({
    where: { id: 5 },
    update: {},
    create: {
      tenant_id: tenant.id,
      entreprise_id: entreprise.id,
      email: 'manager@ledgersync.demo',
      nom: 'SARR',
      prenom: 'Aïssatou',
      password_hash: managerHash,
      role: 'MANAGER',
      etat: 'ACTIF',
      created_by: 1,
      updated_by: 1,
    },
  });
  console.log('✅ Manager created:', manager.email);

  // ── Catégories d'imputation (apurement automatique des micro-écarts) ──
  const imputationCategories = [
    { code: 'FRAIS_BQ', libelle: 'Frais bancaires', type: 'DEBIT' as const, compte_imputation: '627100' },
    { code: 'PERTE_CHG', libelle: 'Pertes de change', type: 'DEBIT' as const, compte_imputation: '666000' },
    { code: 'GAIN_CHG', libelle: 'Gains de change', type: 'CREDIT' as const, compte_imputation: '766000' },
  ];
  for (const cat of imputationCategories) {
    const found = await prisma.imputationCategorie.findFirst({ where: { tenant_id: tenant.id, code: cat.code } });
    if (!found) {
      await prisma.imputationCategorie.create({ data: { ...cat, tenant_id: tenant.id, etat: 'ACTIF', created_by: 1, updated_by: 1 } });
    }
  }
  console.log(`✅ ${imputationCategories.length} catégories d'imputation vérifiées/créées`);

  // ── Banque ─────────────────────────────────────────────────
  const banque = await prisma.banque.upsert({
    where: { id: 1 },
    update: {},
    create: {
      tenant_id: tenant.id,
      code_swift: 'CBSASNDA',
      nom: 'Banque de Dakar',
      pays_code: 'SN',
      etat: 'ACTIF',
      created_by: 1,
      updated_by: 1,
    },
  });
  console.log('✅ Banque created:', banque.nom);

  // ── Compte Bancaire ────────────────────────────────────────
  const compte = await prisma.compteBancaire.upsert({
    where: { id: 1 },
    update: {},
    create: {
      entreprise_id: entreprise.id,
      banque_id: banque.id,
      numero_compte: 'SN28-0001-0000-0123456789',
      intitule: 'Compte Principal XOF',
      devise: 'XOF',
      solde_initial: 50000000,
      etat: 'ACTIF',
      created_by: 1,
      updated_by: 1,
    },
  });
  console.log('✅ Compte Bancaire created:', compte.intitule);

  // ── Période Comptable ──────────────────────────────────────
  const now = new Date();
  await prisma.periodeComptable.upsert({
    where: { entreprise_id_mois_annee: { entreprise_id: entreprise.id, mois: now.getMonth() + 1, annee: now.getFullYear() } },
    update: {},
    create: {
      entreprise_id: entreprise.id,
      mois: now.getMonth() + 1,
      annee: now.getFullYear(),
      statut: 'OUVERT',
      etat: 'ACTIF',
      created_by: 1,
      updated_by: 1,
    },
  });
  console.log(`✅ Période ${now.getMonth() + 1}/${now.getFullYear()} créée`);

  // ── Ecritures Comptables Demo ──────────────────────────────
  const ecrituresDemoData = [
    { reference: 'FAC-2026-001', libelle: 'Règlement fournisseur SARL TECH', montant: 1500000, type: 'DEBIT' as const, date_ecriture: new Date(now.getFullYear(), now.getMonth(), 5) },
    { reference: 'REC-2026-001', libelle: 'Encaissement client ACME Corp', montant: 2800000, type: 'CREDIT' as const, date_ecriture: new Date(now.getFullYear(), now.getMonth(), 8) },
    { reference: 'FAC-2026-002', libelle: 'Paiement loyer bureau', montant: 450000, type: 'DEBIT' as const, date_ecriture: new Date(now.getFullYear(), now.getMonth(), 10) },
    { reference: 'REC-2026-002', libelle: 'Virement client NDOX SA', montant: 3200000, type: 'CREDIT' as const, date_ecriture: new Date(now.getFullYear(), now.getMonth(), 12) },
    { reference: 'FAC-2026-003', libelle: 'Salaires du mois', montant: 5600000, type: 'DEBIT' as const, date_ecriture: new Date(now.getFullYear(), now.getMonth(), 15) },
    { reference: 'REC-2026-003', libelle: 'Encaissement commande #789', montant: 890000, type: 'CREDIT' as const, date_ecriture: new Date(now.getFullYear(), now.getMonth(), 18) },
    { reference: 'FAC-2026-004', libelle: 'Achat fournitures bureau', montant: 125000, type: 'DEBIT' as const, date_ecriture: new Date(now.getFullYear(), now.getMonth(), 20) },
    { reference: 'REC-2026-004', libelle: 'Remboursement TVA État', montant: 680000, type: 'CREDIT' as const, date_ecriture: new Date(now.getFullYear(), now.getMonth(), 22) },
  ];

  let ecrituresCreees = 0;
  for (const e of ecrituresDemoData) {
    const found = await prisma.ecritureComptable.findFirst({ where: { compte_bancaire_id: compte.id, reference: e.reference } });
    if (found) continue;
    await prisma.ecritureComptable.create({
      data: {
        entreprise_id: entreprise.id,
        compte_bancaire_id: compte.id,
        ...e,
        periode_mois: now.getMonth() + 1,
        periode_annee: now.getFullYear(),
        etat: 'VALIDE',
        created_by: 3,
        updated_by: 3,
      },
    });
    ecrituresCreees++;
  }
  console.log(`✅ ${ecrituresCreees}/${ecrituresDemoData.length} écritures comptables créées (déjà présentes ignorées)`);

  // ── Lignes Relevé Bancaire Demo ────────────────────────────
  const relevesDemoData = [
    { reference: 'OP-001', libelle: 'VIR SARL TECH remb.', montant: 1500000, type: 'DEBIT' as const, date_operation: new Date(now.getFullYear(), now.getMonth(), 5) },
    { reference: 'OP-002', libelle: 'Virement ACME Corp reçu', montant: 2800000, type: 'CREDIT' as const, date_operation: new Date(now.getFullYear(), now.getMonth(), 8) },
    { reference: 'OP-003', libelle: 'CHQ loyer Jan', montant: 450000, type: 'DEBIT' as const, date_operation: new Date(now.getFullYear(), now.getMonth(), 10) },
    { reference: 'OP-004', libelle: 'VIR NDOX SA commande', montant: 3200000, type: 'CREDIT' as const, date_operation: new Date(now.getFullYear(), now.getMonth(), 13) },
    { reference: 'OP-005', libelle: 'VIRT salaires', montant: 5600000, type: 'DEBIT' as const, date_operation: new Date(now.getFullYear(), now.getMonth(), 16) },
    { reference: 'OP-006', libelle: 'VIR CMD-789', montant: 890000, type: 'CREDIT' as const, date_operation: new Date(now.getFullYear(), now.getMonth(), 18) },
    { reference: 'OP-007', libelle: 'CHQ fournitures', montant: 125000, type: 'DEBIT' as const, date_operation: new Date(now.getFullYear(), now.getMonth(), 21) },
    { reference: 'OP-008', libelle: 'VIR TVA DGID', montant: 680000, type: 'CREDIT' as const, date_operation: new Date(now.getFullYear(), now.getMonth(), 22) },
    // Ligne non lettrée (écart)
    { reference: 'OP-009', libelle: 'FRAIS BANCAIRES GESTION', montant: 15000, type: 'DEBIT' as const, date_operation: new Date(now.getFullYear(), now.getMonth(), 25) },
  ];

  let relevesCrees = 0;
  for (let i = 0; i < relevesDemoData.length; i++) {
    const found = await prisma.releveBancaireLigne.findFirst({ where: { compte_bancaire_id: compte.id, reference: relevesDemoData[i]!.reference } });
    if (found) continue;
    await prisma.releveBancaireLigne.create({
      data: {
        compte_bancaire_id: compte.id,
        ...relevesDemoData[i],
        num_ligne: i + 1,
        etat: 'VALIDE',
        created_by: 3,
        updated_by: 3,
      },
    });
    relevesCrees++;
  }
  console.log(`✅ ${relevesCrees}/${relevesDemoData.length} lignes de relevé créées (déjà présentes ignorées)`);

  // ── Rapprochement ──────────────────────────────────────────
  await prisma.rapprochement.upsert({
    where: { entreprise_id_compte_bancaire_id_periode_mois_periode_annee: { entreprise_id: entreprise.id, compte_bancaire_id: compte.id, periode_mois: now.getMonth() + 1, periode_annee: now.getFullYear() } },
    update: {},
    create: {
      entreprise_id: entreprise.id,
      compte_bancaire_id: compte.id,
      periode_mois: now.getMonth() + 1,
      periode_annee: now.getFullYear(),
      statut: 'EN_COURS',
      montant_ecart: 15000,
      etat: 'BROUILLON',
      created_by: 3,
      updated_by: 3,
    },
  });
  console.log('✅ Rapprochement créé');

  console.log('\n🎉 Seed terminé avec succès!');
  console.log('\n📋 Comptes de connexion:');
  console.log('   Super Admin : admin@ledgersync.demo / Admin@2026!');
  console.log('   DAF         : daf@ledgersync.demo / Daf@2026!');
  console.log('   Comptable   : comptable@ledgersync.demo / User@2026!');
  console.log('   Superviseur : superviseur@ledgersync.demo / Superviseur@2026!');
  console.log('   Manager     : manager@ledgersync.demo / Manager@2026!');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
