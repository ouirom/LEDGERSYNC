import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { rateLimit } from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

import { initSocketIO } from './sockets/socketServer';
import authRoutes from './modules/auth/auth.routes';
import tenantRoutes from './modules/tenants/tenant.routes';
import entrepriseRoutes from './modules/tenants/entreprise.routes';
import periodRoutes from './modules/periods/period.routes';
import banqueRoutes from './modules/accounts/banque.routes';
import compteRoutes from './modules/accounts/compte.routes';
import ecritureRoutes from './modules/entries/ecriture.routes';
import releveRoutes from './modules/statements/releve.routes';
import reconciliationRoutes from './modules/reconciliation/reconciliation.routes';
import jobRoutes from './modules/jobs/job.routes';
import reportRoutes from './modules/reports/report.routes';
import auditRoutes from './modules/audit/audit.routes';

const app = express();
const httpServer = createServer(app);

// ── Ensure upload directory exists ─────────────────────────
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ── Rate Limiting ───────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Middlewares ─────────────────────────────────────────────
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id'],
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(limiter);

// ── Static Files (uploads) ──────────────────────────────────
app.use('/uploads', express.static(path.resolve(uploadDir)));

// ── Health Check ────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ── API Routes ──────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/entreprises', entrepriseRoutes);
app.use('/api/periods', periodRoutes);
app.use('/api/banques', banqueRoutes);
app.use('/api/comptes', compteRoutes);
app.use('/api/ecritures', ecritureRoutes);
app.use('/api/releves', releveRoutes);
app.use('/api/reconciliation', reconciliationRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit', auditRoutes);

// ── 404 Handler ─────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Error Handler ───────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ success: false, message: 'Internal Server Error', error: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

// ── Initialize Socket.IO ────────────────────────────────────
initSocketIO(httpServer);

// ── Start Server ────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '5000', 10);
httpServer.listen(PORT, () => {
  console.log(`🚀 LedgerSync Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket Server ready`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
});

export { app, httpServer };
