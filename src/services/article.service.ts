import { Article, Category } from '../models';
import { GetArticlesQuery, GetTrendingQuery } from '../utils/validation';
import { redisClient } from '../index';
import { logger } from '../utils/logger';

export class ArticleService {
  async getArticles(query: GetArticlesQuery) {
    try {
      const {
        category,
        lang,
        search,
        sort = 'latest',
        page = '1',
        limit = '10',
      } = query;

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Build query
      // Include scraped, processed, and published articles so content shows immediately
      const filter: any = { status: { $in: ['scraped', 'processed', 'published'] } };

      if (category) {
        // Check if category is a valid ObjectId (24 hex characters)
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(category);
        
        if (isObjectId) {
          // If it's an ObjectId, search in the category field
          filter.category = category;
        } else {
          // If it's a string, search in the categories array
          filter.categories = { $in: [category.toLowerCase()] };
        }
      }

      if (lang) {
        filter.language = lang;
      }

      if (search) {
        filter.$text = { $search: search };
      }

      // Build sort
      let sortOptions: any = {};
      switch (sort) {
        case 'popular':
          sortOptions = { viewCount: -1, publishedAt: -1 };
          break;
        case 'trending':
          sortOptions = { viewCount: -1, publishedAt: -1 };
          break;
        case 'latest':
        default:
          sortOptions = { publishedAt: -1 };
          break;
      }

      // Get articles
      const articles = await Article.find(filter)
        .select('title summary slug publishedAt images category source')
        .populate('category', 'key label icon color')
        .populate('source.sourceId', 'name')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum);

      // Get total count
      const total = await Article.countDocuments(filter);

      return {
        articles,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      };
    } catch (error) {
      logger.error('Get articles error:', error);
      throw error;
    }
  }

  async getArticleBySlug(slug: string) {
    try {
      // Try to get from cache first
      const cacheKey = `article:${slug}`;
      if (redisClient) {
        const cachedArticle = await redisClient.get(cacheKey);
        if (cachedArticle) {
          return JSON.parse(cachedArticle);
        }
      }

      // Get from database - include scraped/processed/published
      const article = await Article.findOne({ 
        slug, 
        status: { $in: ['scraped', 'processed', 'published'] } 
      })
        .populate('category', 'key label icon color')
        .populate('source.sourceId', 'name');

      if (!article) {
        throw new Error('Article not found');
      }

      // Increment view count
      await Article.findByIdAndUpdate(article._id, { $inc: { viewCount: 1 } });

      // Cache for 1 hour
      if (redisClient) {
        await redisClient.setEx(cacheKey, 3600, JSON.stringify(article));
      }

      return article;
    } catch (error) {
      logger.error('Get article by slug error:', error);
      throw error;
    }
  }

  async getArticleById(id: string) {
    try {
      // Try to get from cache first
      const cacheKey = `article:id:${id}`;
      if (redisClient) {
        const cachedArticle = await redisClient.get(cacheKey);
        if (cachedArticle) {
          return JSON.parse(cachedArticle);
        }
      }

      // Get from database
      const article = await Article.findById(id)
        .populate('category', 'key label icon color')
        .populate('source.sourceId', 'name');

      if (!article) {
        throw new Error('Article not found');
      }

      // Increment view count
      await Article.findByIdAndUpdate(article._id, { $inc: { viewCount: 1 } });

      // Cache for 1 hour
      if (redisClient) {
        await redisClient.setEx(cacheKey, 3600, JSON.stringify(article));
      }

      return article;
    } catch (error) {
      logger.error('Get article by ID error:', error);
      throw error;
    }
  }

  async getTrending(query: GetTrendingQuery) {
    try {
      const { limit = '10' } = query;
      const limitNum = parseInt(limit);

      // Try to get from cache first
      const cacheKey = `trending:${limit}`;
      if (redisClient) {
        const cachedTrending = await redisClient.get(cacheKey);
        if (cachedTrending) {
          return JSON.parse(cachedTrending);
        }
      }

      // Get trending articles (any status, last 7 days, most views)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const trending = await Article.find({
        status: { $in: ['scraped', 'processed', 'published'] },
        publishedAt: { $gte: sevenDaysAgo },
      })
        .populate('category', 'key label icon color')
        .populate('source.sourceId', 'name')
        .sort({ viewCount: -1, publishedAt: -1 })
        .limit(limitNum);

      // Cache for 30 minutes
      if (redisClient) {
        await redisClient.setEx(cacheKey, 1800, JSON.stringify(trending));
      }

      return trending;
    } catch (error) {
      logger.error('Get trending error:', error);
      throw error;
    }
  }

  async createArticle(data: any) {
    try {
      const article = new Article(data);
      await article.save();
      return article;
    } catch (error) {
      logger.error('Create article error:', error);
      throw error;
    }
  }

  async updateArticle(id: string, data: any) {
    try {
      const article = await Article.findByIdAndUpdate(id, data, { new: true });
      if (!article) {
        throw new Error('Article not found');
      }
      return article;
    } catch (error) {
      logger.error('Update article error:', error);
      throw error;
    }
  }

  async publishArticle(id: string) {
    try {
      const article = await Article.findByIdAndUpdate(
        id,
        { 
          status: 'published',
          publishedAt: new Date(),
        },
        { new: true }
      );
      
      if (!article) {
        throw new Error('Article not found');
      }

      // Clear relevant caches
      await this.clearArticleCaches();

      return article;
    } catch (error) {
      logger.error('Publish article error:', error);
      throw error;
    }
  }

  private async clearArticleCaches() {
    try {
      if (!redisClient) return;
      
      // Clear trending cache
      const keys = await redisClient.keys('trending:*');
      if (keys.length > 0) {
        await redisClient.del(keys);
      }

      // Clear article caches (this could be more specific in production)
      const articleKeys = await redisClient.keys('article:*');
      if (articleKeys.length > 0) {
        await redisClient.del(articleKeys);
      }
    } catch (error) {
      logger.error('Clear article caches error:', error);
    }
  }
}