import { Request, Response } from 'express';
import { depotService } from '../services/depotService';
import { parseBody } from '../middleware/validate';
import { depotSchema } from '../validation/schemas';

export const depotController = {
  list: async (_req: Request, res: Response) => {
    res.json(await depotService.list());
  },
  get: async (req: Request, res: Response) => {
    res.json(await depotService.get(req.params.id));
  },
  create: async (req: Request, res: Response) => {
    res.status(201).json(await depotService.create(parseBody(depotSchema, req)));
  },
  update: async (req: Request, res: Response) => {
    res.json(await depotService.update(req.params.id, parseBody(depotSchema, req)));
  },
  remove: async (req: Request, res: Response) => {
    await depotService.remove(req.params.id);
    res.status(204).send();
  },
};
