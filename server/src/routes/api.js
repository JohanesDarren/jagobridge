import { Router } from 'express';
import healthRouter from './health.js';

const apiRouter = Router();

// Health check endpoint
apiRouter.use('/health', healthRouter);

// Root API info endpoint
apiRouter.get('/', (req, res) => {
  res.json({
    message: 'Welcome to JagoBridge API',
    endpoints: {
      health: '/api/health',
    },
  });
});

export default apiRouter;
