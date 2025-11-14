// backend/src/routes/articles.ts
console.log("=== ARTICLES.ROUTES: Loading module ===");
import { Router } from "express";
console.log("=== ARTICLES.ROUTES: Router imported ===");
import { Article } from "../models/Article";
console.log("=== ARTICLES.ROUTES: Article model imported ===");
import { Category } from "../models/Category";
console.log("=== ARTICLES.ROUTES: Category model imported ===");

const router = Router();
console.log("=== ARTICLES.ROUTES: Router instance created ===");

/**
 * GET /api/articles
 * → Fetch all published articles (optionally filter by category, search, limit, exclude)
 * Query params:
 *    ?category=slug
 *    ?search=keyword
 *    ?limit=20
 *    ?exclude=articleId (to exclude specific article, useful for related articles)
 */
router.get("/", async (req, res) => {
  try {
    const { category, search, limit, exclude } = req.query;

    const query: any = { status: "published" };

    // Optional: exclude specific article (for related articles)
    if (exclude) {
      query._id = { $ne: exclude };
    }

    // Optional: filter by category slug
    if (category) {
      const cat = await Category.findOne({ key: category });
      if (cat) query.category = cat._id;
    }

    // Optional: text search
    if (search) {
      query.$or = [
        { title: { $regex: search as string, $options: "i" } },
        { content: { $regex: search as string, $options: "i" } },
      ];
    }

    const articles = await Article.find(query)
      .populate("category", "key label icon color")
      .populate("source.sourceId", "name")
      .sort({ publishedAt: -1 })
      .limit(limit ? parseInt(limit as string, 10) : 50)
      .select('_id slug title summary thumbnail images category readTime publishedAt language source');

    res.json({ success: true, data: articles });
  } catch (err) {
    console.error("Error fetching articles:", err);
    res.status(500).json({ success: false, error: "Failed to fetch articles" });
  }
});

/**
 * GET /api/articles/:id
 * → Fetch single article by ID
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const article = await Article.findOne({ _id: id })
      .populate("category", "key label icon color")
      .populate("source.sourceId", "name");

    if (!article) {
      return res.status(404).json({ success: false, error: "Article not found" });
    }

    res.json({ success: true, data: article });
  } catch (err) {
    console.error("Error fetching article:", err);
    res.status(500).json({ success: false, error: "Failed to fetch article" });
  }
});

export default router;
