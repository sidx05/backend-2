import { Category } from '../models';
import { redisClient } from '../index';
import { logger } from '../utils/logger';

export class CategoryService {
  async getCategories() {
    try {
      // Try to get from cache first
      const cacheKey = 'categories:all';
      if (redisClient) {
        const cachedCategories = await redisClient.get(cacheKey);
        if (cachedCategories) {
          return JSON.parse(cachedCategories);
        }
      }

      // Get from database
      const categories = await Category.find()
        .sort({ order: 1, label: 1 })
        .populate('parent', 'key label');

      // Cache for 1 hour
      if (redisClient) {
        await redisClient.setEx(cacheKey, 3600, JSON.stringify(categories));
      }

      return categories;
    } catch (error) {
      logger.error('Get categories error:', error);
      throw error;
    }
  }

  async getCategoryByKey(key: string) {
    try {
      const category = await Category.findOne({ key }).populate('parent', 'key label');
      if (!category) {
        throw new Error('Category not found');
      }
      return category;
    } catch (error) {
      logger.error('Get category by key error:', error);
      throw error;
    }
  }

  async createCategory(data: any) {
    try {
      const category = new Category(data);
      await category.save();
      
      // Clear categories cache
      await this.clearCategoriesCache();
      
      return category;
    } catch (error) {
      logger.error('Create category error:', error);
      throw error;
    }
  }

  async updateCategory(id: string, data: any) {
    try {
      const category = await Category.findByIdAndUpdate(id, data, { new: true });
      if (!category) {
        throw new Error('Category not found');
      }
      
      // Clear categories cache
      await this.clearCategoriesCache();
      
      return category;
    } catch (error) {
      logger.error('Update category error:', error);
      throw error;
    }
  }

  async deleteCategory(id: string) {
    try {
      const category = await Category.findByIdAndDelete(id);
      if (!category) {
        throw new Error('Category not found');
      }
      
      // Clear categories cache
      await this.clearCategoriesCache();
      
      return category;
    } catch (error) {
      logger.error('Delete category error:', error);
      throw error;
    }
  }

  private async clearCategoriesCache() {
    try {
      if (redisClient) {
        await redisClient.del('categories:all');
      }
    } catch (error) {
      logger.error('Clear categories cache error:', error);
    }
  }
}