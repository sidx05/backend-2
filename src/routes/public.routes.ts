// backend/src/routes/public.routes.ts
console.log("=== PUBLIC.ROUTES: Loading module ===");
import { Router } from "express";
console.log("=== PUBLIC.ROUTES: Router imported ===");
import { PublicController } from "../controllers/public.controller";
console.log("=== PUBLIC.ROUTES: PublicController imported ===");

const router = Router();
console.log("=== PUBLIC.ROUTES: Router instance created ===");
const publicController = new PublicController();
console.log("=== PUBLIC.ROUTES: PublicController instance created ===");

// Keep the same paths you used in the controller
router.get("/health", publicController.getHealth);

// Articles - using different paths to avoid conflicts
router.get("/public/articles", publicController.getArticles);
router.get("/public/articles/:slug", publicController.getArticleBySlug);
router.get("/public/article/:id", publicController.getArticleById);

// Also support the singular form that frontend expects
router.get("/article/:id", publicController.getArticleById);

// Categories
router.get("/categories", publicController.getCategories);

// Trending
router.get("/trending", publicController.getTrending);

// Tickers
router.get("/ticker/active", publicController.getActiveTickers);

export default router;
