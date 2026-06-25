import { Request, Response } from 'express';
import { vehicleService } from '../services/vehicleService';
import { validateVehicleCsv } from '../services/csvService';
import { parseBody } from '../middleware/validate';
import { vehicleSchema, csvSchema } from '../validation/schemas';

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

  /** Dry-run: parse + validate a Vehicles CSV without inserting. */
  validate: async (req: Request, res: Response) => {
    const { csv } = parseBody(csvSchema, req);
    const result = validateVehicleCsv(csv);
    res.json({ rows: result.rows, valid: result.valid.length, errors: result.errors });
  },

  /** Import only the valid rows; reports how many were inserted + any errors. */
  import: async (req: Request, res: Response) => {
    const { csv } = parseBody(csvSchema, req);
    const result = validateVehicleCsv(csv);
    const imported = await vehicleService.createMany(result.valid);
    res.status(201).json({ imported, errors: result.errors });
  },
};
