console.log("=== ADMIN.ROUTES: Loading module ===");
import { Router } from 'express';
console.log("=== ADMIN.ROUTES: Router imported ===");
import { AdminController } from '../controllers/admin.controller';
console.log("=== ADMIN.ROUTES: AdminController imported ===");
import { authenticate, authorize } from '../middleware/auth';
console.log("=== ADMIN.ROUTES: auth imported ===");

const router = Router();
console.log("=== ADMIN.ROUTES: Router instance created ===");
const adminController = new AdminController();
console.log("=== ADMIN.ROUTES: AdminController instance created ===");

// All admin routes require authentication and admin/editor role
router.use(authenticate);
router.use(authorize(['admin', 'editor']));

// Article management
router.post('/articles', adminController.createArticle);
router.patch('/articles/:id', adminController.updateArticle);
router.post('/articles/:id/publish', adminController.publishArticle);
router.get('/articles', adminController.getArticles);

// Source management
router.post('/sources', adminController.createSource);
router.patch('/sources/:id', adminController.updateSource);
router.get('/sources', adminController.getSources);
router.delete('/sources/:id', adminController.deleteSource);

// Category management
router.post('/categories', adminController.createCategory);
router.patch('/categories/:id', adminController.updateCategory);

// Ingest management
router.post("/scrape", adminController.triggerScrape.bind(adminController));

// Debug
router.get("/debug/db", adminController.dbInfo);
router.get("/scrape/status", adminController.scrapeStatus);


export default router;