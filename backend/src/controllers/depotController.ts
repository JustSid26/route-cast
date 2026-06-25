import { Request, Response } from 'express';
import { depotService } from '../services/depotService';
import { validateDepotCsv } from '../services/csvService';
import { parseBody } from '../middleware/validate';
import { depotSchema, csvSchema } from '../validation/schemas';

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

  /** Dry-run: parse + validate a Depots CSV without inserting. */
  validate: async (req: Request, res: Response) => {
    const { csv } = parseBody(csvSchema, req);
    const result = validateDepotCsv(csv);
    res.json({ rows: result.rows, valid: result.valid.length, errors: result.errors });
  },

  /** Import only the valid rows; reports how many were inserted + any errors. */
  import: async (req: Request, res: Response) => {
    const { csv } = parseBody(csvSchema, req);
    const result = validateDepotCsv(csv);
    const imported = await depotService.createMany(result.valid);
    res.status(201).json({ imported, errors: result.errors });
  },
};
