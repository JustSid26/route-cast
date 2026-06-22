import { Request, Response } from 'express';
import { vehicleService } from '../services/vehicleService';
import { parseBody } from '../middleware/validate';
import { vehicleSchema } from '../validation/schemas';

export const vehicleController = {
  list: async (_req: Request, res: Response) => {
    res.json(await vehicleService.list());
  },
  get: async (req: Request, res: Response) => {
    res.json(await vehicleService.get(req.params.id));
  },
  create: async (req: Request, res: Response) => {
    res.status(201).json(await vehicleService.create(parseBody(vehicleSchema, req)));
  },
  update: async (req: Request, res: Response) => {
    res.json(await vehicleService.update(req.params.id, parseBody(vehicleSchema, req)));
  },
  remove: async (req: Request, res: Response) => {
    await vehicleService.remove(req.params.id);
    res.status(204).send();
  },
};
