import { vehicleRepository } from '../repositories/vehicleRepository';
import { AppError } from '../utils/AppError';
import { VehicleInput } from '../validation/schemas';

export const vehicleService = {
  list: () => vehicleRepository.findAll(),

  get: async (id: string) => {
    const vehicle = await vehicleRepository.findById(id);
    if (!vehicle) throw AppError.notFound('Vehicle not found');
    return vehicle;
  },

  create: (input: VehicleInput) => vehicleRepository.create(input),

  createMany: (rows: VehicleInput[]) => vehicleRepository.createMany(rows),

  update: async (id: string, input: VehicleInput) => {
    const updated = await vehicleRepository.update(id, input);
    if (!updated) throw AppError.notFound('Vehicle not found');
    return updated;
  },

  remove: async (id: string) => {
    const removed = await vehicleRepository.remove(id);
    if (!removed) throw AppError.notFound('Vehicle not found');
  },
};
