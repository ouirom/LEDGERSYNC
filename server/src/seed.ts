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

  // ── Hiérarchie organisationnelle (Succursale > Direction > Service) ──
  let siege = await prisma.succursale.findFirst({ where: { entreprise_id: entreprise.id, code: 'SIEGE' } });
  if (!siege) {
    siege = await prisma.succursale.create({
      data: { entreprise_id: entreprise.id, nom: 'Siège Dakar', code: 'SIEGE', etat: 'ACTIF', created_by: 1, updated_by: 1 },
    });
  }
  console.log('✅ Succursale créée/vérifiée:', siege.nom);

  let dirFinance = await prisma.direction.findFirst({ where: { succursale_id: siege.id, code: 'DIRFIN' } });
  if (!dirFinance) {
    dirFinance = await prisma.direction.create({
      data: { succursale_id: siege.id, nom: 'Direction Financière', code: 'DIRFIN', etat: 'ACTIF', created_by: 1, updated_by: 1 },
    });
  }
  let dirCommerce = await prisma.direction.findFirst({ where: { succursale_id: siege.id, code: 'DIRCOM' } });
  if (!dirCommerce) {
    dirCommerce = await prisma.direction.create({
      data: { succursale_id: siege.id, nom: 'Direction Commerciale', code: 'DIRCOM', etat: 'ACTIF', created_by: 1, updated_by: 1 },
    });
  }
  console.log('✅ 2 directions créées/vérifiées');

  const servicesData = [
    { direction_id: dirFinance.id, code: 'COMPTA', nom: 'Comptabilité' },
    { direction_id: dirFinance.id, code: 'TRESO', nom: 'Trésorerie' },
    { direction_id: dirCommerce.id, code: 'VENTES', nom: 'Ventes' },
    { direction_id: dirCommerce.id, code: 'MKTG', nom: 'Marketing' },
  ];
  const services: Record<string, { id: number }> = {};
  for (const s of servicesData) {
    let svc = await prisma.service.findFirst({ where: { direction_id: s.direction_id, code: s.code } });
    if (!svc) {
      svc = await prisma.service.create({ data: { direction_id: s.direction_id, nom: s.nom, code: s.code, etat: 'ACTIF', created_by: 1, updated_by: 1 } });
    }
    services[s.code] = svc;
  }
  console.log(`✅ ${servicesData.length} services créés/vérifiés`);

  // ── Comptable User ─────────────────────────────────────────
  const userHash = await bcrypt.hash('User@2026!', 12);
  const comptable = await prisma.utilisateur.upsert({
    where: { id: 3 },
    update: { service_id: services['COMPTA']!.id },
    create: {
      tenant_id: tenant.id,
      entreprise_id: entreprise.id,
      service_id: services['COMPTA']!.id,
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
    update: { service_id: services['TRESO']!.id },
    create: {
      tenant_id: tenant.id,
      entreprise_id: entreprise.id,
      service_id: services['TRESO']!.id,
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
    update: { service_id: services['VENTES']!.id },
    create: {
      tenant_id: tenant.id,
      entreprise_id: entreprise.id,
      service_id: services['VENTES']!.id,
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

  // ── Banques (rattachées à la succursale Siège Dakar — voir orgScope.ts) ──
  const banque = await prisma.banque.upsert({
    where: { id: 1 },
    update: { entreprise_id: entreprise.id, succursale_id: siege.id },
    create: {
      tenant_id: tenant.id,
      entreprise_id: entreprise.id,
      succursale_id: siege.id,
      code_swift: 'CBSASNDA',
      nom: 'Banque de Dakar',
      pays_code: 'SN',
      etat: 'ACTIF',
      created_by: 1,
      updated_by: 1,
    },
  });
  console.log('✅ Banque created:', banque.nom);

  let ecobank = await prisma.banque.findFirst({ where: { tenant_id: tenant.id, code_swift: 'ECOCSNDA' } });
  if (!ecobank) {
    ecobank = await prisma.banque.create({
      data: { tenant_id: tenant.id, entreprise_id: entreprise.id, succursale_id: siege.id, code_swift: 'ECOCSNDA', nom: 'Ecobank Sénégal', pays_code: 'SN', etat: 'ACTIF', created_by: 1, updated_by: 1 },
    });
  } else if (!ecobank.succursale_id) {
    ecobank = await prisma.banque.update({ where: { id: ecobank.id }, data: { entreprise_id: entreprise.id, succursale_id: siege.id } });
  }
  console.log('✅ Banque créée/vérifiée:', ecobank.nom);

  // ── Comptes Bancaires (Siège Dakar) ───────────────────────────
  const compte = await prisma.compteBancaire.upsert({
    where: { id: 1 },
    update: { succursale_id: siege.id },
    create: {
      entreprise_id: entreprise.id,
      succursale_id: siege.id,
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

  let compteEpargne = await prisma.compteBancaire.findFirst({ where: { entreprise_id: entreprise.id, numero_compte: 'SN28-0001-0000-0987654321' } });
  if (!compteEpargne) {
    compteEpargne = await prisma.compteBancaire.create({
      data: {
        entreprise_id: entreprise.id,
        succursale_id: siege.id,
        banque_id: banque.id,
        numero_compte: 'SN28-0001-0000-0987654321',
        intitule: 'Compte Épargne XOF',
        devise: 'XOF',
        solde_initial: 20000000,
        etat: 'ACTIF',
        created_by: 1,
        updated_by: 1,
      },
    });
  } else if (!compteEpargne.succursale_id) {
    compteEpargne = await prisma.compteBancaire.update({ where: { id: compteEpargne.id }, data: { succursale_id: siege.id } });
  }
  console.log('✅ Compte Bancaire créé/vérifié:', compteEpargne.intitule);

  let compteEur = await prisma.compteBancaire.findFirst({ where: { entreprise_id: entreprise.id, numero_compte: 'SN28-0002-0000-0112233445' } });
  if (!compteEur) {
    compteEur = await prisma.compteBancaire.create({
      data: {
        entreprise_id: entreprise.id,
        succursale_id: siege.id,
        banque_id: ecobank.id,
        numero_compte: 'SN28-0002-0000-0112233445',
        intitule: 'Compte Opérations EUR',
        devise: 'EUR',
        solde_initial: 45000,
        etat: 'ACTIF',
        created_by: 1,
        updated_by: 1,
      },
    });
  } else if (!compteEur.succursale_id) {
    compteEur = await prisma.compteBancaire.update({ where: { id: compteEur.id }, data: { succursale_id: siege.id } });
  }
  console.log('✅ Compte Bancaire créé/vérifié:', compteEur.intitule);

  // ── Template d'import Excel pour Ecobank ─────────────────────
  const ecobankTemplate = await prisma.banqueReleveTemplate.findFirst({ where: { banque_id: ecobank.id, nom: 'Relevé standard Ecobank' } });
  if (!ecobankTemplate) {
    await prisma.banqueReleveTemplate.create({
      data: {
        banque_id: ecobank.id,
        nom: 'Relevé standard Ecobank',
        mapping_colonnes: { date_operation: 'Date Opération', montant: 'Montant', libelle: 'Libellé', reference: 'Référence', date_valeur: 'Date Valeur' },
        ligne_entete: 1,
        separateur: ';',
        format_date: 'DD/MM/YYYY',
        etat: 'ACTIF',
        created_by: 1,
        updated_by: 1,
      },
    });
  }
  console.log('✅ Template Ecobank créé/vérifié');

  // ── Périodes Comptables ──────────────────────────────────────
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

  const moisPrecedent = (offset: number) => {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    return { mois: d.getMonth() + 1, annee: d.getFullYear() };
  };
  for (const offset of [1, 2]) {
    const { mois, annee } = moisPrecedent(offset);
    await prisma.periodeComptable.upsert({
      where: { entreprise_id_mois_annee: { entreprise_id: entreprise.id, mois, annee } },
      update: {},
      create: {
        entreprise_id: entreprise.id,
        mois, annee,
        statut: 'CLOS',
        date_cloture: new Date(annee, mois, 0),
        clos_par: dafUser.id,
        etat: 'ACTIF',
        created_by: 1,
        updated_by: 1,
      },
    });
  }
  console.log('✅ 2 périodes clôturées créées/vérifiées');

  // ── Ecritures Comptables Demo (Compte Principal XOF) ────────
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

  // ── Lignes Relevé Bancaire Demo (Compte Principal XOF) ──────
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

  // ── Ecritures + Relevé Demo (Compte Épargne XOF) — entièrement lettré ──
  const ecrituresEpargne = [
    { reference: 'EPG-2026-001', libelle: 'Frais tenue de compte épargne', montant: 200000, type: 'DEBIT' as const, date_ecriture: new Date(now.getFullYear(), now.getMonth(), 3) },
    { reference: 'EPG-2026-002', libelle: 'Virement interne depuis compte principal', montant: 1000000, type: 'CREDIT' as const, date_ecriture: new Date(now.getFullYear(), now.getMonth(), 10) },
    { reference: 'EPG-2026-003', libelle: 'Intérêts trimestriels', montant: 350000, type: 'CREDIT' as const, date_ecriture: new Date(now.getFullYear(), now.getMonth(), 20) },
  ];
  let ecrituresEpargneCreees = 0;
  for (const e of ecrituresEpargne) {
    const found = await prisma.ecritureComptable.findFirst({ where: { compte_bancaire_id: compteEpargne.id, reference: e.reference } });
    if (found) continue;
    await prisma.ecritureComptable.create({
      data: { entreprise_id: entreprise.id, compte_bancaire_id: compteEpargne.id, ...e, periode_mois: now.getMonth() + 1, periode_annee: now.getFullYear(), etat: 'VALIDE', lettree: true, lettrage_ref: `LTR-EPG-${e.reference}`, created_by: 3, updated_by: 3 },
    });
    ecrituresEpargneCreees++;
  }

  const relevesEpargne = [
    { reference: 'OPE-EPG-001', libelle: 'FRAIS TENUE CPTE', montant: 200000, type: 'DEBIT' as const, date_operation: new Date(now.getFullYear(), now.getMonth(), 3) },
    { reference: 'OPE-EPG-002', libelle: 'VIR INTERNE CPTE PRINCIPAL', montant: 1000000, type: 'CREDIT' as const, date_operation: new Date(now.getFullYear(), now.getMonth(), 10) },
    { reference: 'OPE-EPG-003', libelle: 'INTERETS TRIM', montant: 350000, type: 'CREDIT' as const, date_operation: new Date(now.getFullYear(), now.getMonth(), 20) },
  ];
  let relevesEpargneCrees = 0;
  for (let i = 0; i < relevesEpargne.length; i++) {
    const found = await prisma.releveBancaireLigne.findFirst({ where: { compte_bancaire_id: compteEpargne.id, reference: relevesEpargne[i]!.reference } });
    if (found) continue;
    await prisma.releveBancaireLigne.create({
      data: { compte_bancaire_id: compteEpargne.id, ...relevesEpargne[i], num_ligne: i + 1, etat: 'VALIDE', lettree: true, lettrage_ref: `LTR-EPG-${relevesEpargne[i]!.reference}`, created_by: 3, updated_by: 3 },
    });
    relevesEpargneCrees++;
  }
  console.log(`✅ Compte Épargne : ${ecrituresEpargneCreees}/${ecrituresEpargne.length} écritures, ${relevesEpargneCrees}/${relevesEpargne.length} lignes de relevé créées (déjà présentes ignorées)`);

  // ── Ecritures + Relevé Demo (Compte Opérations EUR) — rapprochement en cours avec écarts ──
  const ecrituresEur = [
    { reference: 'EUR-2026-001', libelle: 'Paiement fournisseur EU Logistics', montant: 3200, type: 'DEBIT' as const, date_ecriture: new Date(now.getFullYear(), now.getMonth(), 6) },
    { reference: 'EUR-2026-002', libelle: 'Encaissement client European Partners', montant: 8500, type: 'CREDIT' as const, date_ecriture: new Date(now.getFullYear(), now.getMonth(), 14) },
    { reference: 'EUR-2026-003', libelle: 'Frais virement SWIFT', montant: 450, type: 'DEBIT' as const, date_ecriture: new Date(now.getFullYear(), now.getMonth(), 14) },
  ];
  let ecrituresEurCreees = 0;
  for (const e of ecrituresEur) {
    const found = await prisma.ecritureComptable.findFirst({ where: { compte_bancaire_id: compteEur.id, reference: e.reference } });
    if (found) continue;
    await prisma.ecritureComptable.create({
      data: { entreprise_id: entreprise.id, compte_bancaire_id: compteEur.id, ...e, periode_mois: now.getMonth() + 1, periode_annee: now.getFullYear(), etat: 'VALIDE', created_by: 3, updated_by: 3 },
    });
    ecrituresEurCreees++;
  }

  const relevesEur = [
    { reference: 'OPE-EUR-001', libelle: 'VIR EU LOGISTICS', montant: 3200, type: 'DEBIT' as const, date_operation: new Date(now.getFullYear(), now.getMonth(), 6) },
    { reference: 'OPE-EUR-002', libelle: 'VIR EUROPEAN PARTNERS', montant: 8500, type: 'CREDIT' as const, date_operation: new Date(now.getFullYear(), now.getMonth(), 15) },
    // Frais SWIFT pas encore débité côté banque (écart en attente)
    { reference: 'OPE-EUR-003', libelle: 'COMMISSION CHANGE', montant: 120, type: 'DEBIT' as const, date_operation: new Date(now.getFullYear(), now.getMonth(), 20) },
  ];
  let relevesEurCrees = 0;
  for (let i = 0; i < relevesEur.length; i++) {
    const found = await prisma.releveBancaireLigne.findFirst({ where: { compte_bancaire_id: compteEur.id, reference: relevesEur[i]!.reference } });
    if (found) continue;
    await prisma.releveBancaireLigne.create({
      data: { compte_bancaire_id: compteEur.id, ...relevesEur[i], num_ligne: i + 1, etat: 'VALIDE', created_by: 3, updated_by: 3 },
    });
    relevesEurCrees++;
  }
  console.log(`✅ Compte EUR : ${ecrituresEurCreees}/${ecrituresEur.length} écritures, ${relevesEurCrees}/${relevesEur.length} lignes de relevé créées (déjà présentes ignorées)`);

  // Rattache au Siège Dakar les écritures créées avant l'introduction du
  // rattachement multi-niveau (succursale_id encore null) — nécessaire car
  // GET /api/ecritures filtre directement sur ce champ (voir orgScope.ts).
  await prisma.ecritureComptable.updateMany({
    where: { compte_bancaire_id: { in: [compte.id, compteEpargne.id, compteEur.id] }, succursale_id: null },
    data: { succursale_id: siege.id },
  });

  // ── Rapprochements ───────────────────────────────────────────
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

  await prisma.rapprochement.upsert({
    where: { entreprise_id_compte_bancaire_id_periode_mois_periode_annee: { entreprise_id: entreprise.id, compte_bancaire_id: compteEpargne.id, periode_mois: now.getMonth() + 1, periode_annee: now.getFullYear() } },
    update: {},
    create: {
      entreprise_id: entreprise.id,
      compte_bancaire_id: compteEpargne.id,
      periode_mois: now.getMonth() + 1,
      periode_annee: now.getFullYear(),
      statut: 'VALIDE_FINAL',
      montant_ecart: 0,
      soumis_par: comptable.id,
      valide_n1_par: superviseur.id,
      valide_n2_par: manager.id,
      valide_final_par: dafUser.id,
      date_validation_final: new Date(now.getFullYear(), now.getMonth(), 27),
      etat: 'VALIDE',
      created_by: 3,
      updated_by: 2,
    },
  });

  await prisma.rapprochement.upsert({
    where: { entreprise_id_compte_bancaire_id_periode_mois_periode_annee: { entreprise_id: entreprise.id, compte_bancaire_id: compteEur.id, periode_mois: now.getMonth() + 1, periode_annee: now.getFullYear() } },
    update: {},
    create: {
      entreprise_id: entreprise.id,
      compte_bancaire_id: compteEur.id,
      periode_mois: now.getMonth() + 1,
      periode_annee: now.getFullYear(),
      statut: 'EN_COURS',
      montant_ecart: 570,
      etat: 'BROUILLON',
      created_by: 3,
      updated_by: 3,
    },
  });
  console.log('✅ 3 rapprochements créés/vérifiés (1 en cours, 1 clôturé, 1 avec écart)');

  // ============================================================
  // RATTACHEMENT MULTI-NIVEAU : succursale Thiès + utilisateurs de test
  // par niveau (démonstration de l'isolation des données bancaires —
  // voir server/src/utils/orgScope.ts). Siège Dakar sert de référence
  // "à qui appartiennent déjà des données" ; Thiès est une 2e succursale
  // de la même entreprise, avec sa propre banque/compte/écritures, pour
  // vérifier qu'un utilisateur d'une succursale ne voit pas l'autre.
  // ============================================================
  let succursaleThies = await prisma.succursale.findFirst({ where: { entreprise_id: entreprise.id, code: 'THIES' } });
  if (!succursaleThies) {
    succursaleThies = await prisma.succursale.create({
      data: { entreprise_id: entreprise.id, nom: 'Succursale Thiès', code: 'THIES', etat: 'ACTIF', created_by: 1, updated_by: 1 },
    });
  }
  console.log('✅ Succursale créée/vérifiée:', succursaleThies.nom);

  let banqueThies = await prisma.banque.findFirst({ where: { tenant_id: tenant.id, code_swift: 'BACISNTH' } });
  if (!banqueThies) {
    banqueThies = await prisma.banque.create({
      data: { tenant_id: tenant.id, entreprise_id: entreprise.id, succursale_id: succursaleThies.id, code_swift: 'BACISNTH', nom: 'Banque Atlantique Thiès', pays_code: 'SN', etat: 'ACTIF', created_by: 1, updated_by: 1 },
    });
  }
  console.log('✅ Banque créée/vérifiée:', banqueThies.nom);

  let compteThies = await prisma.compteBancaire.findFirst({ where: { entreprise_id: entreprise.id, numero_compte: 'SN28-0003-0000-0223344556' } });
  if (!compteThies) {
    compteThies = await prisma.compteBancaire.create({
      data: {
        entreprise_id: entreprise.id,
        succursale_id: succursaleThies.id,
        banque_id: banqueThies.id,
        numero_compte: 'SN28-0003-0000-0223344556',
        intitule: 'Compte Régional Thiès XOF',
        devise: 'XOF',
        solde_initial: 8000000,
        etat: 'ACTIF',
        created_by: 1,
        updated_by: 1,
      },
    });
  }
  console.log('✅ Compte Bancaire créé/vérifié:', compteThies.intitule);

  const ecrituresThies = [
    { reference: 'THI-2026-001', libelle: 'Règlement fournisseur local Thiès', montant: 380000, type: 'DEBIT' as const, date_ecriture: new Date(now.getFullYear(), now.getMonth(), 7) },
    { reference: 'THI-2026-002', libelle: 'Encaissement client marché Thiès', montant: 620000, type: 'CREDIT' as const, date_ecriture: new Date(now.getFullYear(), now.getMonth(), 17) },
  ];
  let ecrituresThiesCreees = 0;
  for (const e of ecrituresThies) {
    const found = await prisma.ecritureComptable.findFirst({ where: { compte_bancaire_id: compteThies.id, reference: e.reference } });
    if (found) continue;
    await prisma.ecritureComptable.create({
      data: { entreprise_id: entreprise.id, succursale_id: succursaleThies.id, compte_bancaire_id: compteThies.id, ...e, periode_mois: now.getMonth() + 1, periode_annee: now.getFullYear(), etat: 'VALIDE', created_by: 1, updated_by: 1 },
    });
    ecrituresThiesCreees++;
  }

  const relevesThies = [
    { reference: 'OPE-THI-001', libelle: 'VIR FOURNISSEUR THIES', montant: 380000, type: 'DEBIT' as const, date_operation: new Date(now.getFullYear(), now.getMonth(), 7) },
    { reference: 'OPE-THI-002', libelle: 'VIR CLIENT MARCHE THIES', montant: 620000, type: 'CREDIT' as const, date_operation: new Date(now.getFullYear(), now.getMonth(), 17) },
  ];
  let relevesThiesCrees = 0;
  for (let i = 0; i < relevesThies.length; i++) {
    const found = await prisma.releveBancaireLigne.findFirst({ where: { compte_bancaire_id: compteThies.id, reference: relevesThies[i]!.reference } });
    if (found) continue;
    await prisma.releveBancaireLigne.create({
      data: { compte_bancaire_id: compteThies.id, ...relevesThies[i], num_ligne: i + 1, etat: 'VALIDE', created_by: 1, updated_by: 1 },
    });
    relevesThiesCrees++;
  }
  console.log(`✅ Compte Thiès : ${ecrituresThiesCreees}/${ecrituresThies.length} écritures, ${relevesThiesCrees}/${relevesThies.length} lignes de relevé créées (déjà présentes ignorées)`);

  // ── Utilisateurs de test par niveau de rattachement ───────────
  // entreprise : daf@ledgersync.demo (déjà existant, entreprise_id seul)
  // service    : comptable/superviseur/manager@ledgersync.demo (déjà existants)
  const succursaleHash = await bcrypt.hash('Succursale@2026!', 12);
  const succursaleDakarUser = await prisma.utilisateur.upsert({
    where: { tenant_id_email: { tenant_id: tenant.id, email: 'succursale.dakar@ledgersync.demo' } },
    update: { succursale_id: siege.id, entreprise_id: null, direction_id: null, service_id: null },
    create: {
      tenant_id: tenant.id,
      succursale_id: siege.id,
      email: 'succursale.dakar@ledgersync.demo',
      nom: 'GUEYE',
      prenom: 'Moussa',
      password_hash: succursaleHash,
      role: 'MANAGER',
      etat: 'ACTIF',
      created_by: 1,
      updated_by: 1,
    },
  });
  console.log('✅ Utilisateur succursale (Dakar) créé/vérifié:', succursaleDakarUser.email);

  const succursaleThiesUser = await prisma.utilisateur.upsert({
    where: { tenant_id_email: { tenant_id: tenant.id, email: 'succursale.thies@ledgersync.demo' } },
    update: { succursale_id: succursaleThies.id, entreprise_id: null, direction_id: null, service_id: null },
    create: {
      tenant_id: tenant.id,
      succursale_id: succursaleThies.id,
      email: 'succursale.thies@ledgersync.demo',
      nom: 'DIALLO',
      prenom: 'Aminata',
      password_hash: succursaleHash,
      role: 'MANAGER',
      etat: 'ACTIF',
      created_by: 1,
      updated_by: 1,
    },
  });
  console.log('✅ Utilisateur succursale (Thiès) créé/vérifié:', succursaleThiesUser.email);

  const directionHash = await bcrypt.hash('Direction@2026!', 12);
  const directionFinanceUser = await prisma.utilisateur.upsert({
    where: { tenant_id_email: { tenant_id: tenant.id, email: 'direction.finance@ledgersync.demo' } },
    update: { direction_id: dirFinance.id, entreprise_id: null, succursale_id: null, service_id: null },
    create: {
      tenant_id: tenant.id,
      direction_id: dirFinance.id,
      email: 'direction.finance@ledgersync.demo',
      nom: 'THIAM',
      prenom: 'Ousmane',
      password_hash: directionHash,
      role: 'SUPERVISEUR',
      etat: 'ACTIF',
      created_by: 1,
      updated_by: 1,
    },
  });
  console.log('✅ Utilisateur direction (Finance) créé/vérifié:', directionFinanceUser.email);

  // ── Sous-succursale (Agence Dakar Plateau, sous Siège Dakar) ──
  let agencePlateau = await prisma.sousSuccursale.findFirst({ where: { succursale_id: siege.id, code: 'PLATEAU' } });
  if (!agencePlateau) {
    agencePlateau = await prisma.sousSuccursale.create({
      data: { succursale_id: siege.id, nom: 'Agence Dakar Plateau', code: 'PLATEAU', etat: 'ACTIF', created_by: 1, updated_by: 1 },
    });
  }
  console.log('✅ Sous-succursale créée/vérifiée:', agencePlateau.nom);

  let banquePlateau = await prisma.banque.findFirst({ where: { tenant_id: tenant.id, code_swift: 'CBSASNPL' } });
  if (!banquePlateau) {
    banquePlateau = await prisma.banque.create({
      data: { tenant_id: tenant.id, entreprise_id: entreprise.id, succursale_id: siege.id, sous_succursale_id: agencePlateau.id, code_swift: 'CBSASNPL', nom: 'Banque de Dakar — Agence Plateau', pays_code: 'SN', etat: 'ACTIF', created_by: 1, updated_by: 1 },
    });
  }
  console.log('✅ Banque créée/vérifiée:', banquePlateau.nom);

  let comptePlateau = await prisma.compteBancaire.findFirst({ where: { entreprise_id: entreprise.id, numero_compte: 'SN28-0004-0000-0334455667' } });
  if (!comptePlateau) {
    comptePlateau = await prisma.compteBancaire.create({
      data: {
        entreprise_id: entreprise.id,
        succursale_id: siege.id,
        sous_succursale_id: agencePlateau.id,
        banque_id: banquePlateau.id,
        numero_compte: 'SN28-0004-0000-0334455667',
        intitule: 'Compte Agence Plateau XOF',
        devise: 'XOF',
        solde_initial: 5000000,
        etat: 'ACTIF',
        created_by: 1,
        updated_by: 1,
      },
    });
  }
  console.log('✅ Compte Bancaire créé/vérifié:', comptePlateau.intitule);

  const ecrituresPlateau = [
    { reference: 'PLT-2026-001', libelle: 'Encaissement guichet Plateau', montant: 275000, type: 'CREDIT' as const, date_ecriture: new Date(now.getFullYear(), now.getMonth(), 6) },
    { reference: 'PLT-2026-002', libelle: 'Retrait espèces client', montant: 120000, type: 'DEBIT' as const, date_ecriture: new Date(now.getFullYear(), now.getMonth(), 13) },
  ];
  let ecrituresPlateauCreees = 0;
  for (const e of ecrituresPlateau) {
    const found = await prisma.ecritureComptable.findFirst({ where: { compte_bancaire_id: comptePlateau.id, reference: e.reference } });
    if (found) continue;
    await prisma.ecritureComptable.create({
      data: { entreprise_id: entreprise.id, succursale_id: siege.id, sous_succursale_id: agencePlateau.id, compte_bancaire_id: comptePlateau.id, ...e, periode_mois: now.getMonth() + 1, periode_annee: now.getFullYear(), etat: 'VALIDE', created_by: 1, updated_by: 1 },
    });
    ecrituresPlateauCreees++;
  }
  console.log(`✅ Compte Agence Plateau : ${ecrituresPlateauCreees}/${ecrituresPlateau.length} écritures créées (déjà présentes ignorées)`);

  const sousSuccursaleHash = await bcrypt.hash('SousSuccursale@2026!', 12);
  const sousSuccursalePlateauUser = await prisma.utilisateur.upsert({
    where: { tenant_id_email: { tenant_id: tenant.id, email: 'sous-succursale.plateau@ledgersync.demo' } },
    update: { sous_succursale_id: agencePlateau.id, entreprise_id: null, succursale_id: null, direction_id: null, service_id: null },
    create: {
      tenant_id: tenant.id,
      sous_succursale_id: agencePlateau.id,
      email: 'sous-succursale.plateau@ledgersync.demo',
      nom: 'BA',
      prenom: 'Ibrahima',
      password_hash: sousSuccursaleHash,
      role: 'MANAGER',
      etat: 'ACTIF',
      created_by: 1,
      updated_by: 1,
    },
  });
  console.log('✅ Utilisateur sous-succursale (Plateau) créé/vérifié:', sousSuccursalePlateauUser.email);

  // ── Administrateurs (ADMIN_TENANT) rattachés à différents niveaux ──
  // Contrairement à SUPER_ADMIN (toujours non restreint), un ADMIN_TENANT ne
  // gère et ne voit (utilisateurs, banques, comptes, écritures) que le
  // périmètre de son propre rattachement — voir server/src/utils/orgScope.ts.
  const adminHash = await bcrypt.hash('AdminTenant@2026!', 12);
  const adminEntrepriseUser = await prisma.utilisateur.upsert({
    where: { tenant_id_email: { tenant_id: tenant.id, email: 'admin.entreprise@ledgersync.demo' } },
    update: { entreprise_id: entreprise.id, succursale_id: null, sous_succursale_id: null, direction_id: null, service_id: null },
    create: {
      tenant_id: tenant.id,
      entreprise_id: entreprise.id,
      email: 'admin.entreprise@ledgersync.demo',
      nom: 'SECK',
      prenom: 'Mariama',
      password_hash: adminHash,
      role: 'ADMIN_TENANT',
      etat: 'ACTIF',
      created_by: 1,
      updated_by: 1,
    },
  });
  console.log('✅ Admin entreprise créé/vérifié:', adminEntrepriseUser.email);

  const adminSuccursaleUser = await prisma.utilisateur.upsert({
    where: { tenant_id_email: { tenant_id: tenant.id, email: 'admin.succursale@ledgersync.demo' } },
    update: { succursale_id: siege.id, entreprise_id: null, sous_succursale_id: null, direction_id: null, service_id: null },
    create: {
      tenant_id: tenant.id,
      succursale_id: siege.id,
      email: 'admin.succursale@ledgersync.demo',
      nom: 'NIANG',
      prenom: 'Babacar',
      password_hash: adminHash,
      role: 'ADMIN_TENANT',
      etat: 'ACTIF',
      created_by: 1,
      updated_by: 1,
    },
  });
  console.log('✅ Admin succursale créé/vérifié:', adminSuccursaleUser.email);

  const adminSousSuccursaleUser = await prisma.utilisateur.upsert({
    where: { tenant_id_email: { tenant_id: tenant.id, email: 'admin.sous-succursale@ledgersync.demo' } },
    update: { sous_succursale_id: agencePlateau.id, entreprise_id: null, succursale_id: null, direction_id: null, service_id: null },
    create: {
      tenant_id: tenant.id,
      sous_succursale_id: agencePlateau.id,
      email: 'admin.sous-succursale@ledgersync.demo',
      nom: 'FAYE',
      prenom: 'Coumba',
      password_hash: adminHash,
      role: 'ADMIN_TENANT',
      etat: 'ACTIF',
      created_by: 1,
      updated_by: 1,
    },
  });
  console.log('✅ Admin sous-succursale créé/vérifié:', adminSousSuccursaleUser.email);

  // ============================================================
  // ENTREPRISE 2 : CÔTE D'IVOIRE (démonstration multi-entreprise / multi-pays)
  // ============================================================

  // ── Pays : Côte d'Ivoire ─────────────────────────────────────
  const paysCI = await prisma.pays.upsert({
    where: { code_iso: 'CI' },
    update: {},
    create: { code_iso: 'CI', nom: "Côte d'Ivoire", devise: 'XOF', etat: 'ACTIF', created_by: null, updated_by: null },
  });
  console.log('✅ Pays created:', paysCI.nom);

  // ── Entreprise Abidjan (même tenant, pays et devise partagés XOF) ──
  const themeGold = await prisma.theme.findFirst({ where: { nom: 'Royal Gold' } });
  let entrepriseCI = await prisma.entreprise.findFirst({ where: { tenant_id: tenant.id, code: 'ENT002' } });
  if (!entrepriseCI) {
    entrepriseCI = await prisma.entreprise.create({
      data: {
        tenant_id: tenant.id,
        pays_id: paysCI.id,
        theme_id: themeGold?.id ?? null,
        code: 'ENT002',
        nom: 'SARL Abidjan Négoce',
        siret: 'CI-002-2024',
        adresse: "Boulevard de la République, Plateau, Abidjan, Côte d'Ivoire",
        etat: 'ACTIF',
        created_by: 1,
        updated_by: 1,
      },
    });
  }
  console.log('✅ Entreprise créée/vérifiée:', entrepriseCI.nom);

  // ── Hiérarchie Abidjan ───────────────────────────────────────
  let siegeAbidjan = await prisma.succursale.findFirst({ where: { entreprise_id: entrepriseCI.id, code: 'SIEGECI' } });
  if (!siegeAbidjan) {
    siegeAbidjan = await prisma.succursale.create({
      data: { entreprise_id: entrepriseCI.id, nom: 'Siège Abidjan', code: 'SIEGECI', etat: 'ACTIF', created_by: 1, updated_by: 1 },
    });
  }
  let dirFinanceCI = await prisma.direction.findFirst({ where: { succursale_id: siegeAbidjan.id, code: 'DIRFINCI' } });
  if (!dirFinanceCI) {
    dirFinanceCI = await prisma.direction.create({
      data: { succursale_id: siegeAbidjan.id, nom: 'Direction Financière', code: 'DIRFINCI', etat: 'ACTIF', created_by: 1, updated_by: 1 },
    });
  }
  let dirCommerceCI = await prisma.direction.findFirst({ where: { succursale_id: siegeAbidjan.id, code: 'DIRCOMCI' } });
  if (!dirCommerceCI) {
    dirCommerceCI = await prisma.direction.create({
      data: { succursale_id: siegeAbidjan.id, nom: 'Direction Commerciale', code: 'DIRCOMCI', etat: 'ACTIF', created_by: 1, updated_by: 1 },
    });
  }
  console.log('✅ Succursale + 2 directions Abidjan créées/vérifiées');

  const servicesDataCI = [
    { direction_id: dirFinanceCI.id, code: 'COMPTACI', nom: 'Comptabilité' },
    { direction_id: dirCommerceCI.id, code: 'VENTESCI', nom: 'Ventes' },
  ];
  const servicesCI: Record<string, { id: number }> = {};
  for (const s of servicesDataCI) {
    let svc = await prisma.service.findFirst({ where: { direction_id: s.direction_id, code: s.code } });
    if (!svc) {
      svc = await prisma.service.create({ data: { direction_id: s.direction_id, nom: s.nom, code: s.code, etat: 'ACTIF', created_by: 1, updated_by: 1 } });
    }
    servicesCI[s.code] = svc;
  }
  console.log(`✅ ${servicesDataCI.length} services Abidjan créés/vérifiés`);

  // ── Utilisateurs Abidjan ─────────────────────────────────────
  const comptableCIHash = await bcrypt.hash('User@2026!', 12);
  const comptableCI = await prisma.utilisateur.upsert({
    where: { tenant_id_email: { tenant_id: tenant.id, email: 'comptable.ci@ledgersync.demo' } },
    update: { service_id: servicesCI['COMPTACI']!.id, entreprise_id: entrepriseCI.id },
    create: {
      tenant_id: tenant.id,
      entreprise_id: entrepriseCI.id,
      service_id: servicesCI['COMPTACI']!.id,
      email: 'comptable.ci@ledgersync.demo',
      nom: 'KOUAME',
      prenom: 'Serge',
      password_hash: comptableCIHash,
      role: 'USER',
      etat: 'ACTIF',
      created_by: 1,
      updated_by: 1,
    },
  });
  console.log('✅ Comptable Abidjan créé/vérifié:', comptableCI.email);

  const managerCIHash = await bcrypt.hash('Manager@2026!', 12);
  const managerCI = await prisma.utilisateur.upsert({
    where: { tenant_id_email: { tenant_id: tenant.id, email: 'manager.ci@ledgersync.demo' } },
    update: { service_id: servicesCI['VENTESCI']!.id, entreprise_id: entrepriseCI.id },
    create: {
      tenant_id: tenant.id,
      entreprise_id: entrepriseCI.id,
      service_id: servicesCI['VENTESCI']!.id,
      email: 'manager.ci@ledgersync.demo',
      nom: 'YAO',
      prenom: 'Marie-Claire',
      password_hash: managerCIHash,
      role: 'MANAGER',
      etat: 'ACTIF',
      created_by: 1,
      updated_by: 1,
    },
  });
  console.log('✅ Manager Abidjan créé/vérifié:', managerCI.email);

  // ── Banque + Compte Abidjan (rattachés au Siège Abidjan) ──────
  let banqueCI = await prisma.banque.findFirst({ where: { tenant_id: tenant.id, code_swift: 'SGCICIAB' } });
  if (!banqueCI) {
    banqueCI = await prisma.banque.create({
      data: { tenant_id: tenant.id, entreprise_id: entrepriseCI.id, succursale_id: siegeAbidjan.id, code_swift: 'SGCICIAB', nom: "Société Générale Côte d'Ivoire", pays_code: 'CI', etat: 'ACTIF', created_by: 1, updated_by: 1 },
    });
  } else if (!banqueCI.succursale_id) {
    banqueCI = await prisma.banque.update({ where: { id: banqueCI.id }, data: { entreprise_id: entrepriseCI.id, succursale_id: siegeAbidjan.id } });
  }
  console.log('✅ Banque créée/vérifiée:', banqueCI.nom);

  let compteCI = await prisma.compteBancaire.findFirst({ where: { entreprise_id: entrepriseCI.id, numero_compte: 'CI93-0001-0000-0556677889' } });
  if (!compteCI) {
    compteCI = await prisma.compteBancaire.create({
      data: {
        entreprise_id: entrepriseCI.id,
        succursale_id: siegeAbidjan.id,
        banque_id: banqueCI.id,
        numero_compte: 'CI93-0001-0000-0556677889',
        intitule: 'Compte Principal CFA',
        devise: 'XOF',
        solde_initial: 30000000,
        etat: 'ACTIF',
        created_by: 1,
        updated_by: 1,
      },
    });
  } else if (!compteCI.succursale_id) {
    compteCI = await prisma.compteBancaire.update({ where: { id: compteCI.id }, data: { succursale_id: siegeAbidjan.id } });
  }
  console.log('✅ Compte Bancaire créé/vérifié:', compteCI.intitule);

  // ── Période comptable Abidjan (mois courant) ────────────────
  await prisma.periodeComptable.upsert({
    where: { entreprise_id_mois_annee: { entreprise_id: entrepriseCI.id, mois: now.getMonth() + 1, annee: now.getFullYear() } },
    update: {},
    create: {
      entreprise_id: entrepriseCI.id,
      mois: now.getMonth() + 1,
      annee: now.getFullYear(),
      statut: 'OUVERT',
      etat: 'ACTIF',
      created_by: 1,
      updated_by: 1,
    },
  });
  console.log(`✅ Période ${now.getMonth() + 1}/${now.getFullYear()} Abidjan créée/vérifiée`);

  // ── Ecritures + Relevé Abidjan — rapprochement en cours avec écart ──
  const ecrituresCI = [
    { reference: 'CI-2026-001', libelle: 'Paiement fournisseur import textile', montant: 950000, type: 'DEBIT' as const, date_ecriture: new Date(now.getFullYear(), now.getMonth(), 4) },
    { reference: 'CI-2026-002', libelle: 'Encaissement client Abidjan Distribution', montant: 2200000, type: 'CREDIT' as const, date_ecriture: new Date(now.getFullYear(), now.getMonth(), 9) },
    { reference: 'CI-2026-003', libelle: 'Charges sociales CNPS', montant: 320000, type: 'DEBIT' as const, date_ecriture: new Date(now.getFullYear(), now.getMonth(), 15) },
    { reference: 'CI-2026-004', libelle: 'Vente grossiste Yamoussoukro', montant: 1100000, type: 'CREDIT' as const, date_ecriture: new Date(now.getFullYear(), now.getMonth(), 19) },
  ];
  let ecrituresCICreees = 0;
  for (const e of ecrituresCI) {
    const found = await prisma.ecritureComptable.findFirst({ where: { compte_bancaire_id: compteCI.id, reference: e.reference } });
    if (found) continue;
    await prisma.ecritureComptable.create({
      data: { entreprise_id: entrepriseCI.id, compte_bancaire_id: compteCI.id, ...e, periode_mois: now.getMonth() + 1, periode_annee: now.getFullYear(), etat: 'VALIDE', created_by: comptableCI.id, updated_by: comptableCI.id },
    });
    ecrituresCICreees++;
  }

  const relevesCI = [
    { reference: 'OPE-CI-001', libelle: 'VIR FOURNISSEUR TEXTILE', montant: 950000, type: 'DEBIT' as const, date_operation: new Date(now.getFullYear(), now.getMonth(), 4) },
    { reference: 'OPE-CI-002', libelle: 'VIR ABIDJAN DISTRIBUTION', montant: 2200000, type: 'CREDIT' as const, date_operation: new Date(now.getFullYear(), now.getMonth(), 9) },
    { reference: 'OPE-CI-003', libelle: 'PRLV CNPS', montant: 320000, type: 'DEBIT' as const, date_operation: new Date(now.getFullYear(), now.getMonth(), 16) },
    { reference: 'OPE-CI-004', libelle: 'VIR YAMOUSSOUKRO', montant: 1100000, type: 'CREDIT' as const, date_operation: new Date(now.getFullYear(), now.getMonth(), 19) },
    // Frais bancaires pas encore comptabilisés côté entreprise (écart en attente)
    { reference: 'OPE-CI-005', libelle: 'FRAIS TENUE COMPTE', montant: 8500, type: 'DEBIT' as const, date_operation: new Date(now.getFullYear(), now.getMonth(), 28) },
  ];
  let relevesCICrees = 0;
  for (let i = 0; i < relevesCI.length; i++) {
    const found = await prisma.releveBancaireLigne.findFirst({ where: { compte_bancaire_id: compteCI.id, reference: relevesCI[i]!.reference } });
    if (found) continue;
    await prisma.releveBancaireLigne.create({
      data: { compte_bancaire_id: compteCI.id, ...relevesCI[i], num_ligne: i + 1, etat: 'VALIDE', created_by: comptableCI.id, updated_by: comptableCI.id },
    });
    relevesCICrees++;
  }
  console.log(`✅ Compte Abidjan : ${ecrituresCICreees}/${ecrituresCI.length} écritures, ${relevesCICrees}/${relevesCI.length} lignes de relevé créées (déjà présentes ignorées)`);

  await prisma.ecritureComptable.updateMany({
    where: { compte_bancaire_id: compteCI.id, succursale_id: null },
    data: { succursale_id: siegeAbidjan.id },
  });

  await prisma.rapprochement.upsert({
    where: { entreprise_id_compte_bancaire_id_periode_mois_periode_annee: { entreprise_id: entrepriseCI.id, compte_bancaire_id: compteCI.id, periode_mois: now.getMonth() + 1, periode_annee: now.getFullYear() } },
    update: {},
    create: {
      entreprise_id: entrepriseCI.id,
      compte_bancaire_id: compteCI.id,
      periode_mois: now.getMonth() + 1,
      periode_annee: now.getFullYear(),
      statut: 'EN_COURS',
      montant_ecart: 8500,
      etat: 'BROUILLON',
      created_by: comptableCI.id,
      updated_by: comptableCI.id,
    },
  });
  console.log('✅ Rapprochement Abidjan créé/vérifié (en cours, écart 8 500 XOF)');

  console.log('\n🎉 Seed terminé avec succès!');
  console.log('\n📋 Comptes de connexion:');
  console.log('   Super Admin : admin@ledgersync.demo / Admin@2026!');
  console.log('   DAF         : daf@ledgersync.demo / Daf@2026!');
  console.log('   Comptable   : comptable@ledgersync.demo / User@2026!');
  console.log('   Superviseur : superviseur@ledgersync.demo / Superviseur@2026!');
  console.log('   Manager     : manager@ledgersync.demo / Manager@2026!');
  console.log('   Comptable CI: comptable.ci@ledgersync.demo / User@2026!');
  console.log('   Manager CI  : manager.ci@ledgersync.demo / Manager@2026!');
  console.log('\n📋 Comptes de test — rattachement multi-niveau (isolation des données) :');
  console.log('   Succursale Dakar     : succursale.dakar@ledgersync.demo / Succursale@2026! (voit uniquement le Siège Dakar)');
  console.log('   Succursale Thiès     : succursale.thies@ledgersync.demo / Succursale@2026! (voit uniquement la Succursale Thiès)');
  console.log('   Direction Finance    : direction.finance@ledgersync.demo / Direction@2026! (voit le Siège Dakar via la Direction Financière)');
  console.log('   Sous-succ. Plateau   : sous-succursale.plateau@ledgersync.demo / SousSuccursale@2026! (voit uniquement l\'Agence Dakar Plateau)');
  console.log('\n📋 Comptes de test — administrateurs (ADMIN_TENANT) scopés par rattachement :');
  console.log('   Admin Entreprise     : admin.entreprise@ledgersync.demo / AdminTenant@2026! (gère tous les utilisateurs de SARL Démo Finances)');
  console.log('   Admin Succursale     : admin.succursale@ledgersync.demo / AdminTenant@2026! (gère uniquement les utilisateurs du Siège Dakar)');
  console.log('   Admin Sous-succ.     : admin.sous-succursale@ledgersync.demo / AdminTenant@2026! (gère uniquement les utilisateurs de l\'Agence Dakar Plateau)');
  console.log('\n🏢 Hiérarchie SN : Siège Dakar (Direction Financière, Direction Commerciale, Agence Plateau) + Succursale Thiès');
  console.log('🏦 Banques SN    : Banque de Dakar + Ecobank Sénégal (Siège Dakar), Banque Agence Plateau (Agence Plateau), Banque Atlantique Thiès (Succursale Thiès)');
  console.log("\n🏢 Hiérarchie CI : Siège Abidjan > Direction Financière (Comptabilité) / Direction Commerciale (Ventes)");
  console.log("🏦 Banque CI     : Société Générale Côte d'Ivoire (Compte Principal CFA)");
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
