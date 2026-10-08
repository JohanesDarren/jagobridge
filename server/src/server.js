import app from './app.js';
import { pool, checkDbConnection } from './config/db.js';

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, async () => {
  console.log(`===============================================`);
  console.log(`🚀 JagoBridge Server running on http://localhost:${PORT}`);
  console.log(`⚡ Health check: http://localhost:${PORT}/api/health`);
  console.log(`===============================================`);

  // Initial DB check on startup
  const dbStatus = await checkDbConnection();
  if (dbStatus.connected) {
    console.log(`✅ PostgreSQL Connected successfully (DB: ${dbStatus.database})`);
  } else {
    console.warn(`⚠️ PostgreSQL Connection Warning: ${dbStatus.error}`);
    console.warn(`👉 Update server/.env with your PostgreSQL credentials when ready.`);
  }
});

// Graceful Shutdown
const shutdown = async () => {
  console.log('\nGracefully shutting down...');
  server.close(async () => {
    console.log('HTTP server closed.');
    try {
      await pool.end();
      console.log('PostgreSQL pool connection closed.');
    } catch (err) {
      console.error('Error closing PostgreSQL pool:', err);
    }
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
