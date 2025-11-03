console.log("=== PUBLIC.CONTROLLER: Loading module ===");
import { Request, Response } from 'express';
console.log("=== PUBLIC.CONTROLLER: express imported ===");
import { ArticleService } from '../services/article.service';
console.log("=== PUBLIC.CONTROLLER: ArticleService imported ===");
import { CategoryService } from '../services/category.service';
console.log("=== PUBLIC.CONTROLLER: CategoryService imported ===");
import { TickerService } from '../services/ticker.service';
console.log("=== PUBLIC.CONTROLLER: TickerService imported ===");
import { getArticlesSchema, getTrendingSchema } from '../utils/validation';
console.log("=== PUBLIC.CONTROLLER: validation imported ===");
import { logger } from '../utils/logger';
console.log("=== PUBLIC.CONTROLLER: logger imported ===");

export class PublicController {
  private articleService: ArticleService;
  private categoryService: CategoryService;
  private tickerService: TickerService;

  constructor() {
    console.log("=== PUBLIC.CONTROLLER: Constructor started ===");
    this.articleService = new ArticleService();
    console.log("=== PUBLIC.CONTROLLER: ArticleService instantiated ===");
    this.categoryService = new CategoryService();
    console.log("=== PUBLIC.CONTROLLER: CategoryService instantiated ===");
    this.tickerService = new TickerService();
    console.log("=== PUBLIC.CONTROLLER: TickerService instantiated ===");
    console.log("=== PUBLIC.CONTROLLER: Constructor completed ===");
  }

  getHealth = async (req: Request, res: Response) => {
    try {
      res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
      });
    } catch (error) {
      logger.error('Health check error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Health check failed',
      });
    }
  };

  getArticles = async (req: Request, res: Response) => {
    try {
      // Validate query parameters
      const validatedQuery = getArticlesSchema.parse(req.query);

      const result = await this.articleService.getArticles(validatedQuery);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Get articles controller error:', error);

      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to get articles',
      });
    }
  };

  getArticleBySlug = async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;

      const article = await this.articleService.getArticleBySlug(slug);

      res.json({
        success: true,
        data: article,
      });
    } catch (error) {
      logger.error('Get article by slug controller error:', error);

      if (error instanceof Error) {
        if (error.message === 'Article not found') {
          return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: error.message,
          });
        }
      }

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to get article',
      });
    }
  };

  getArticleById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const article = await this.articleService.getArticleById(id);

      res.json({
        success: true,
        data: article,
      });
    } catch (error) {
      logger.error('Get article by ID controller error:', error);

      if (error instanceof Error) {
        if (error.message === 'Article not found') {
          return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: error.message,
          });
        }
      }

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to get article',
      });
    }
  };

  incrementViewCount = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const article = await this.articleService.incrementViewCount(id);

      res.json({
        success: true,
        data: {
          viewCount: article.viewCount,
        },
      });
    } catch (error) {
      logger.error('Increment view count controller error:', error);

      if (error instanceof Error) {
        if (error.message === 'Article not found') {
          return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: error.message,
          });
        }
      }

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to increment view count',
      });
    }
  };

  getCategories = async (req: Request, res: Response) => {
    try {
      const categories = await this.categoryService.getCategories();

      res.json({
        success: true,
        data: categories,
      });
    } catch (error) {
      logger.error('Get categories controller error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to get categories',
      });
    }
  };

  getTrending = async (req: Request, res: Response) => {
    try {
      // Validate query parameters
      const validatedQuery = getTrendingSchema.parse(req.query);

      const trending = await this.articleService.getTrending(validatedQuery);

      res.json({
        success: true,
        data: trending,
      });
    } catch (error) {
      logger.error('Get trending controller error:', error);

      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to get trending articles',
      });
    }
  };

  getActiveTickers = async (req: Request, res: Response) => {
    try {
      const tickers = await this.tickerService.getActiveTickers();

      res.json({
        success: true,
        data: tickers,
      });
    } catch (error) {
      logger.error('Get active tickers controller error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to get active tickers',
      });
    }
  };
}