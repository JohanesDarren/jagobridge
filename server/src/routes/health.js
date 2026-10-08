import { Router } from 'express';
import { checkDbConnection } from '../config/db.js';

const router = Router();

router.get('/', async (req, res) => {
  const dbStatus = await checkDbConnection();

  res.status(200).json({
    status: 'online',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    database: dbStatus,
  });
});

export default router;
