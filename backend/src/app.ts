import express from 'express';
import cors from 'cors';
import apiRouter from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { orsEnabled } from './config/env';

export function createApp() {
  const app = express();

  app.use(cors());
  // CSV uploads arrive as JSON strings; allow a generous body size.
  app.use(express.json({ limit: '5mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', matrix: orsEnabled ? 'openrouteservice' : 'haversine' });
  });

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
