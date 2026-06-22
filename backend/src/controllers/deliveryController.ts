import { Request, Response } from 'express';
import { deliveryService } from '../services/deliveryService';
import { validateCsv } from '../services/csvService';
import { parseBody } from '../middleware/validate';
import { deliverySchema, csvSchema } from '../validation/schemas';

export const deliveryController = {
  list: async (_req: Request, res: Response) => {
    res.json(await deliveryService.list());
  },
  get: async (req: Request, res: Response) => {
    res.json(await deliveryService.get(req.params.id));
  },
  create: async (req: Request, res: Response) => {
    res.status(201).json(await deliveryService.create(parseBody(deliverySchema, req)));
  },
  update: async (req: Request, res: Response) => {
    res.json(await deliveryService.update(req.params.id, parseBody(deliverySchema, req)));
  },
  remove: async (req: Request, res: Response) => {
    await deliveryService.remove(req.params.id);
    res.status(204).send();
  },

  /** Dry-run: parse + validate CSV, return rows/valid/errors without inserting. */
  validate: async (req: Request, res: Response) => {
    const { csv } = parseBody(csvSchema, req);
    const result = validateCsv(csv);
    res.json({
      rows: result.rows,
      valid: result.valid.length,
      errors: result.errors,
    });
  },

  /** Import only the valid rows; reports how many were inserted + any errors. */
  import: async (req: Request, res: Response) => {
    const { csv } = parseBody(csvSchema, req);
    const result = validateCsv(csv);
    const imported = await deliveryService.createMany(result.valid);
    res.status(201).json({ imported, errors: result.errors });
  },
};
