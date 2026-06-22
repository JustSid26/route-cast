import { depotRepository } from '../repositories/depotRepository';
import { AppError } from '../utils/AppError';
import { DepotInput } from '../validation/schemas';

export const depotService = {
  list: () => depotRepository.findAll(),

  get: async (id: string) => {
    const depot = await depotRepository.findById(id);
    if (!depot) throw AppError.notFound('Depot not found');
    return depot;
  },

  create: (input: DepotInput) => depotRepository.create(input),

  update: async (id: string, input: DepotInput) => {
    const updated = await depotRepository.update(id, input);
    if (!updated) throw AppError.notFound('Depot not found');
    return updated;
  },

  remove: async (id: string) => {
    const removed = await depotRepository.remove(id);
    if (!removed) throw AppError.notFound('Depot not found');
  },
};
