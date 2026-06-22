import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { depotController } from '../controllers/depotController';
import { vehicleController } from '../controllers/vehicleController';
import { deliveryController } from '../controllers/deliveryController';
import { routeController } from '../controllers/routeController';
import { geocodeController } from '../controllers/geocodeController';

const router = Router();

// Depots
router.get('/depots', asyncHandler(depotController.list));
router.post('/depots', asyncHandler(depotController.create));
router.get('/depots/:id', asyncHandler(depotController.get));
router.put('/depots/:id', asyncHandler(depotController.update));
router.delete('/depots/:id', asyncHandler(depotController.remove));

// Vehicles
router.get('/vehicles', asyncHandler(vehicleController.list));
router.post('/vehicles', asyncHandler(vehicleController.create));
router.get('/vehicles/:id', asyncHandler(vehicleController.get));
router.put('/vehicles/:id', asyncHandler(vehicleController.update));
router.delete('/vehicles/:id', asyncHandler(vehicleController.remove));

// Deliveries (+ CSV)
router.get('/deliveries', asyncHandler(deliveryController.list));
router.post('/deliveries', asyncHandler(deliveryController.create));
router.post('/deliveries/validate', asyncHandler(deliveryController.validate));
router.post('/deliveries/import', asyncHandler(deliveryController.import));
router.get('/deliveries/:id', asyncHandler(deliveryController.get));
router.put('/deliveries/:id', asyncHandler(deliveryController.update));
router.delete('/deliveries/:id', asyncHandler(deliveryController.remove));

// Routes / optimisation
router.get('/routes', asyncHandler(routeController.list));
router.get('/routes/:id', asyncHandler(routeController.get));
router.delete('/routes/:id', asyncHandler(routeController.remove));
router.post('/optimize', asyncHandler(routeController.optimize));

// Dashboard
router.get('/dashboard', asyncHandler(routeController.dashboard));

// Geocoding (address → coordinates)
router.get('/geocode', asyncHandler(geocodeController.search));

export default router;
