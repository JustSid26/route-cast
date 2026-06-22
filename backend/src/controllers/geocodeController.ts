import { Request, Response } from 'express';
import { geocode } from '../services/geocodeService';
import { AppError } from '../utils/AppError';

export const geocodeController = {
  search: async (req: Request, res: Response) => {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 3) throw AppError.badRequest('Provide at least 3 characters to search (?q=)');

    // Optional focus point (e.g. the selected hub) biases results to its area.
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const focus =
      Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)
        ? { latitude: lat, longitude: lng }
        : undefined;

    res.json(await geocode(q, focus));
  },
};
