import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { depotController } from '../controllers/depotController';
import { vehicleController } from '../controllers/vehicleController';
import { deliveryController } from '../controllers/deliveryController';
import { routeController } from '../controllers/routeController';
import { geocodeController } from '../controllers/geocodeController';
import { inventoryController } from '../controllers/inventoryController';

const router = Router();

// Depots (+ CSV)
router.get('/depots', asyncHandler(depotController.list));
router.post('/depots', asyncHandler(depotController.create));
router.post('/depots/validate', asyncHandler(depotController.validate));
router.post('/depots/import', asyncHandler(depotController.import));
router.get('/depots/:id', asyncHandler(depotController.get));
router.put('/depots/:id', asyncHandler(depotController.update));
router.delete('/depots/:id', asyncHandler(depotController.remove));

// Vehicles (+ CSV)
router.get('/vehicles', asyncHandler(vehicleController.list));
router.post('/vehicles', asyncHandler(vehicleController.create));
router.post('/vehicles/validate', asyncHandler(vehicleController.validate));
router.post('/vehicles/import', asyncHandler(vehicleController.import));
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
router.post('/routes/:id/baseline', asyncHandler(routeController.uploadBaseline));
router.post('/optimize', asyncHandler(routeController.optimize));

// Inventory imports (Excel upload → stored whole as JSON)
router.post('/inventory/import', asyncHandler(inventoryController.import));
router.get('/inventory', asyncHandler(inventoryController.latest));
router.get('/inventory/imports', asyncHandler(inventoryController.list));
router.get('/inventory/:id', asyncHandler(inventoryController.get));
router.delete('/inventory/:id', asyncHandler(inventoryController.remove));

// Dashboard
router.get('/dashboard', asyncHandler(routeController.dashboard));

// Geocoding (address → coordinates)
router.get('/geocode', asyncHandler(geocodeController.search));

export default router;
