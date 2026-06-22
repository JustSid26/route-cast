import { deliveryRepository } from '../repositories/deliveryRepository';
import { AppError } from '../utils/AppError';
import { DeliveryInput } from '../validation/schemas';

export const deliveryService = {
  list: () => deliveryRepository.findAll(),

  get: async (id: string) => {
    const delivery = await deliveryRepository.findById(id);
    if (!delivery) throw AppError.notFound('Delivery not found');
    return delivery;
  },

  create: (input: DeliveryInput) => deliveryRepository.create(input),

  createMany: (rows: DeliveryInput[]) => deliveryRepository.createMany(rows),

  update: async (id: string, input: DeliveryInput) => {
    const updated = await deliveryRepository.update(id, input);
    if (!updated) throw AppError.notFound('Delivery not found');
    return updated;
  },

  remove: async (id: string) => {
    const removed = await deliveryRepository.remove(id);
    if (!removed) throw AppError.notFound('Delivery not found');
  },
};
