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

  for (const e of ecrituresDemoData) {
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
  }
  console.log(`✅ ${ecrituresDemoData.length} écritures comptables créées`);

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

  for (let i = 0; i < relevesDemoData.length; i++) {
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
  }
  console.log(`✅ ${relevesDemoData.length} lignes de relevé créées`);

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
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
