import { Request, Response } from 'express';
import { inventoryService } from '../services/inventoryService';
import { parseBody } from '../middleware/validate';
import { inventoryImportSchema } from '../validation/schemas';

export const inventoryController = {
  /** Persist a parsed Excel workbook (sheets/columns/rows as JSON). */
  import: async (req: Request, res: Response) => {
    const input = parseBody(inventoryImportSchema, req);
    res.status(201).json(await inventoryService.create(input));
  },

  /** Latest uploaded workbook (full data) for the inventory tab, or null. */
  latest: async (_req: Request, res: Response) => {
    res.json(await inventoryService.latest());
  },

  list: async (_req: Request, res: Response) => {
    res.json(await inventoryService.list());
  },

  get: async (req: Request, res: Response) => {
    res.json(await inventoryService.get(req.params.id));
  },

  remove: async (req: Request, res: Response) => {
    await inventoryService.remove(req.params.id);
    res.status(204).send();
  },
};
