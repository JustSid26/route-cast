import { inventoryRepository } from '../repositories/inventoryRepository';
import { AppError } from '../utils/AppError';
import { InventoryImportInput } from '../validation/schemas';

export const inventoryService = {
  /** Persist a parsed workbook; returns its summary. */
  create: (input: InventoryImportInput) => inventoryRepository.create(input),

  /** Most recently uploaded workbook (full data), or null if none yet. */
  latest: () => inventoryRepository.latest(),

  list: () => inventoryRepository.list(),

  get: async (id: string) => {
    const found = await inventoryRepository.findById(id);
    if (!found) throw AppError.notFound('Inventory import not found');
    return found;
  },

  remove: async (id: string) => {
    const removed = await inventoryRepository.remove(id);
    if (!removed) throw AppError.notFound('Inventory import not found');
  },
};
