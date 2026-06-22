import { Request, Response } from 'express';
import { routeService } from '../services/routeService';
import { parseBody } from '../middleware/validate';
import { optimizeSchema } from '../validation/schemas';

export const routeController = {
  list: async (_req: Request, res: Response) => {
    res.json(await routeService.listJobs());
  },
  get: async (req: Request, res: Response) => {
    res.json(await routeService.getJob(req.params.id));
  },
  remove: async (req: Request, res: Response) => {
    await routeService.removeJob(req.params.id);
    res.status(204).send();
  },
  optimize: async (req: Request, res: Response) => {
    const input = parseBody(optimizeSchema, req);
    res.status(201).json(await routeService.optimize(input));
  },
  dashboard: async (_req: Request, res: Response) => {
    res.json(await routeService.dashboard());
  },
};
