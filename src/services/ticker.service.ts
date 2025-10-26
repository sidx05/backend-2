import { Ticker } from '../models';
import { redisClient } from '../index';
import { logger } from '../utils/logger';

export class TickerService {
  async getActiveTickers() {
    try {
      // Try to get from cache first
      const cacheKey = 'tickers:active';
      if (redisClient) {
        const cachedTickers = await redisClient.get(cacheKey);
        if (cachedTickers) {
          return JSON.parse(cachedTickers);
        }
      }

      // Get active tickers from database
      const now = new Date();
      const tickers = await Ticker.find({
        expiry: { $gt: now },
      })
        .sort({ priority: -1, createdAt: -1 });

      // Cache for 5 minutes
      if (redisClient) {
        await redisClient.setEx(cacheKey, 300, JSON.stringify(tickers));
      }

      return tickers;
    } catch (error) {
      logger.error('Get active tickers error:', error);
      throw error;
    }
  }

  async createTicker(data: any) {
    try {
      const ticker = new Ticker(data);
      await ticker.save();
      
      // Clear tickers cache
      await this.clearTickersCache();
      
      return ticker;
    } catch (error) {
      logger.error('Create ticker error:', error);
      throw error;
    }
  }

  async updateTicker(id: string, data: any) {
    try {
      const ticker = await Ticker.findByIdAndUpdate(id, data, { new: true });
      if (!ticker) {
        throw new Error('Ticker not found');
      }
      
      // Clear tickers cache
      await this.clearTickersCache();
      
      return ticker;
    } catch (error) {
      logger.error('Update ticker error:', error);
      throw error;
    }
  }

  async deleteTicker(id: string) {
    try {
      const ticker = await Ticker.findByIdAndDelete(id);
      if (!ticker) {
        throw new Error('Ticker not found');
      }
      
      // Clear tickers cache
      await this.clearTickersCache();
      
      return ticker;
    } catch (error) {
      logger.error('Delete ticker error:', error);
      throw error;
    }
  }

  async cleanupExpiredTickers() {
    try {
      const now = new Date();
      const result = await Ticker.deleteMany({
        expiry: { $lte: now },
      });

      if (result.deletedCount > 0) {
        logger.info(`Cleaned up ${result.deletedCount} expired tickers`);
        await this.clearTickersCache();
      }

      return result.deletedCount;
    } catch (error) {
      logger.error('Cleanup expired tickers error:', error);
      throw error;
    }
  }

  private async clearTickersCache() {
    try {
      if (redisClient) {
        await redisClient.del('tickers:active');
      }
    } catch (error) {
      logger.error('Clear tickers cache error:', error);
    }
  }
}