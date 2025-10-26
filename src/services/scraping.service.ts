import Parser from "rss-parser";
import axios from "axios";
import * as cheerio from "cheerio";
import crypto from "crypto";
import connectDB from "../config/database";
import { logger } from "../utils/logger"; // make sure this exists
import { Source } from "../models/Source";
import { Article } from "../models/Article";

// Proxy rotation system
const PROXY_LIST = [
  // Free proxy servers (you can add more)
  { host: '8.8.8.8', port: 80, protocol: 'http' },
  { host: '1.1.1.1', port: 80, protocol: 'http' },
  // Add more proxies as needed
];

// User agent rotation
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0 Safari/537.36'
];

let currentProxyIndex = 0;
let currentUserAgentIndex = 0;

// Rate limiting
const RATE_LIMIT_DELAY = 2000; // 2 seconds between requests
let lastRequestTime = 0;

export interface ScrapedArticle {
  title: string;
  summary: string;
  content: string;
  images: {
    url: string;
    alt: string;
    caption?: string;
    width?: number;
    height?: number;
    source: "scraped" | "opengraph" | "ai_generated" | "api";
  }[];
  category: string;
  categories?: string[]; // New field for multiple categories
  tags: string[];
  author?: string; // Made optional
  lang: string;
  sourceUrl: string;
  url?: string; // Alternative field name
  canonicalUrl?: string; // For deduplication
  publishedAt: Date;
  hash: string;
  thumbnail?: string; // New field for thumbnail URL
  languageConfidence?: number; // New field for language detection confidence
  originalHtml?: string; // New field for raw HTML
  rawText?: string; // New field for raw text
  wordCount?: number; // Word count for content
  readingTime?: number; // Estimated reading time in minutes
  openGraph?: {
    image?: string;
    title?: string;
    description?: string;
  };
}

export class ScrapingService {
  private rssParser: Parser;

  constructor() {
    this.rssParser = new Parser();
  }

  // Get next proxy in rotation
  private getNextProxy() {
    const proxy = PROXY_LIST[currentProxyIndex];
    currentProxyIndex = (currentProxyIndex + 1) % PROXY_LIST.length;
    return proxy;
  }

  // Get next user agent in rotation
  private getNextUserAgent() {
    const userAgent = USER_AGENTS[currentUserAgentIndex];
    currentUserAgentIndex = (currentUserAgentIndex + 1) % USER_AGENTS.length;
    return userAgent;
  }

  // Create axios instance with proper headers and proxy
  private createAxiosInstance(useProxy = false) {
    const config: any = {
      timeout: 15000,
      headers: {
        'User-Agent': this.getNextUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0',
        'DNT': '1',
        'Referer': 'https://www.google.com/'
      },
      maxRedirects: 5,
      validateStatus: (status: number) => status < 400
    };

    if (useProxy && PROXY_LIST.length > 0) {
      const proxy = this.getNextProxy();
      config.proxy = {
        host: proxy.host,
        port: proxy.port,
        protocol: proxy.protocol
      };
    }

    return axios.create(config);
  }

  // Rate limiting function
  private async rateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    
    if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
      const delay = RATE_LIMIT_DELAY - timeSinceLastRequest;
      logger.debug(`Rate limiting: waiting ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    lastRequestTime = Date.now();
  }

  // Retry logic with exponential backoff
  private async retryRequest<T>(
    requestFn: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await this.rateLimit(); // Apply rate limiting before each request
        return await requestFn();
      } catch (error: any) {
        const isLastAttempt = attempt === maxRetries - 1;
        const isRetryableError = error.response?.status >= 500 || 
                                error.response?.status === 429 || 
                                error.code === 'ECONNRESET' ||
                                error.code === 'ETIMEDOUT';

        if (isLastAttempt || !isRetryableError) {
          throw error;
        }

        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        logger.warn(`Request failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Max retries exceeded');
  }

  async scrapeAllSources(): Promise<ScrapedArticle[]> {
    try {
      logger.info("🔹 Starting scraping for all sources");
      const sources = await Source.find({ active: true });

      let allArticles: ScrapedArticle[] = [];

      for (const source of sources) {
        try {
          const articles = await this.scrapeSource(source);
          for (const scraped of articles) {
            await Article.create({
              title: scraped.title,
              summary: scraped.summary,
              content: scraped.content,
              url: scraped.sourceUrl,
              hash: scraped.hash,
              category: scraped.category,
              images: scraped.images || [],
              publishedAt: scraped.publishedAt,
            });
          }

          allArticles = allArticles.concat(articles);

          await Source.findByIdAndUpdate(source._id, {
            lastScraped: new Date(),
          });
        } catch (err: unknown) {
          logger.error(`❌ Error scraping source ${source.name}: ${(err as Error).message}`);
        }
      }

      logger.info(`✅ Scraping completed. Total articles: ${allArticles.length}`);
      return allArticles;
    } catch (err: unknown) {
      logger.error(`❌ scrapeAllSources error: ${(err as Error).message}`);
      return [];
    }
  }

  async scrapeSource(source: any): Promise<ScrapedArticle[]> {
    try {
      logger.info(`🔹 Scraping source: ${source.name}`);
      const articles: ScrapedArticle[] = [];

      // RSS scraping
      if (source.rssUrls && source.rssUrls.length > 0) {
        for (const rssUrl of source.rssUrls) {
          try {
            const feed = await this.retryRequest(async () => {
              return await this.rssParser.parseURL(rssUrl);
            });
            
            for (const item of feed.items) {
              const scraped = await this.scrapeArticle(item, source);
              if (scraped) articles.push(scraped);
            }
          } catch (err: unknown) {
            logger.error(`❌ Error parsing RSS feed ${rssUrl}: ${(err as Error).message}`);
          }
        }
      }

      // API scraping (e.g., NewsAPI)
      if (source.type === "api" && source.apiUrl) {
        try {
          const resp = await this.retryRequest(async () => {
            const axiosInstance = this.createAxiosInstance();
            return await axiosInstance.get(source.apiUrl, {
              params: { apiKey: process.env.NEWS_API_KEY },
            });
          });

          logger.info(`DEBUG API articles count: ${resp.data?.articles?.length || 0}`);

          for (const item of resp.data.articles || []) {
            const scraped = await this.scrapeArticle(item, source);
            if (scraped) articles.push(scraped);
          }
        } catch (err: unknown) {
          logger.error(`❌ Error fetching API for ${source.name}: ${(err as Error).message}`);
        }
      }

      logger.info(`✅ Scraped ${articles.length} articles from ${source.name}`);
      return articles;
    } catch (err: unknown) {
      logger.error(`❌ scrapeSource error for ${source.name}: ${(err as Error).message}`);
      return [];
    }
  }

  async scrapeArticle(item: any, source: any): Promise<ScrapedArticle | null> {
    try {
      const title = item.title || "";
      const link = item.link || item.url || "";
      const summary = item.contentSnippet || item.description || item.content || "";
      const publishedAt = item.pubDate
        ? new Date(item.pubDate)
        : item.publishedAt
        ? new Date(item.publishedAt)
        : new Date();

      if (!title || !link) {
        logger.warn(`❌ Skipping item: Missing title/link. Source: ${source.name}`);
        return null;
      }

      const hash = this.generateHash(title + summary + source.id.toString());

      // Skip duplicates
      const existing = await Article.findOne({ hash });
      if (existing) return null;

      const fullContent = source.type === "api" ? summary : await this.fetchArticleContent(link);
      const openGraphData = await this.extractOpenGraphData(link);

      let images: ScrapedArticle["images"] = item.urlToImage
        ? [{ url: item.urlToImage, alt: title, source: "api" }]
        : this.extractImages(fullContent, link, openGraphData);

      if (images.length === 0 && openGraphData && 'image' in openGraphData && openGraphData.image) {
        images.push({ url: openGraphData.image, alt: title, caption: "Open Graph image", source: "opengraph" });
      }

      const category = await this.determineCategory(title, summary, source.categories);

      const tags = this.extractTags(title, summary, fullContent);

      return {
        title,
        summary: summary.substring(0, 300),
        content: this.cleanContent(fullContent),
        images,
        category: category ?? "general",
        tags,
        author: item.author || this.extractAuthor(fullContent) || source.name,
        lang: source.lang || "en",
        sourceUrl: link,
        publishedAt,
        hash,
        openGraph: openGraphData,
      };

    } catch (err: unknown) {
      logger.error(`❌ scrapeArticle error: ${(err as Error).message}`);
      return null;
    }
  }

  private async fetchArticleContent(url: string): Promise<string> {
    return this.retryRequest(async () => {
      const axiosInstance = this.createAxiosInstance();
      const resp = await axiosInstance.get(url);
      return resp.data;
    }).catch((err: unknown) => {
      logger.error(`❌ fetchArticleContent failed: ${url} - ${(err as Error).message}`);
      return "";
    });
  }

  private extractImages(html: string, baseUrl: string, openGraphData?: any) {
    const $ = cheerio.load(html);
    const images: any[] = [];

    $("img").each((_, el) => {
      const src = $(el).attr("src");
      const alt = $(el).attr("alt") || "Article image";
      if (src) {
        const fullUrl = src.startsWith("http") ? src : new URL(src, baseUrl).href;
        images.push({ url: fullUrl, alt, source: "scraped" });
      }
    });

    return [...new Map(images.map((img) => [img.url, img])).values()].slice(0, 5);
  }

  private generateHash(content: string) {
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  private async extractOpenGraphData(url: string) {
    return this.retryRequest(async () => {
      const axiosInstance = this.createAxiosInstance();
      const resp = await axiosInstance.get(url);
      const $ = cheerio.load(resp.data);

      return {
        image: $('meta[property="og:image"]').attr("content") || $('meta[name="twitter:image"]').attr("content"),
        title: $('meta[property="og:title"]').attr("content") || $("title").text(),
        description: $('meta[property="og:description"]').attr("content") || $('meta[name="description"]').attr("content"),
      };
    }).catch(() => {
      return {};
    });
  }

  private async determineCategory(title: string, summary: string, sourceCategories: any[]) {
    const text = (title + " " + summary).toLowerCase();

    const keywords: Record<string, string[]> = {
      politics: ["politics", "government", "election", "president", "senate"],
      world: ["world", "international", "global", "foreign"],
      sports: ["sports", "football", "basketball", "soccer", "tennis"],
      tech: ["technology", "tech", "software", "ai", "computer", "internet"],
      health: ["health", "medical", "doctor", "hospital", "medicine"],
      ai: ["ai", "artificial intelligence", "machine learning"],
      cyber: ["cybersecurity", "hacking", "malware", "ransomware", "breach"],
      movies: ["movies", "film", "cinema", "bollywood", "hollywood"],
      stocks: ["stocks", "market", "shares", "trading", "equity"],
      hindi: ["hindi"],
      telugu: ["telugu"],
    };

    for (const [key, kws] of Object.entries(keywords)) {
      if (kws.some((kw) => text.includes(kw))) {
        return key; // just return string
      }
    }

    return sourceCategories?.[0] ?? null;
  }

  private extractTags(title: string, summary: string, content: string) {
    const words = (title + " " + summary + " " + content).toLowerCase().split(/\W+/).filter(w => w.length > 4);
    return Array.from(new Set(words.slice(0, 10)));
  }

  private extractAuthor(content: string): string | null {
    const match = content.match(/By ([A-Z][a-z]+ [A-Z][a-z]+)/);
    return match ? match[1] : null;
  }

  private cleanContent(html: string): string {
    return cheerio.load(html).text().replace(/\s+/g, " ").trim();
  }
}
