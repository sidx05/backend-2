import Parser from "rss-parser";
import axios from "axios";
import * as cheerio from "cheerio";
import crypto from "crypto";
import slugify from "slugify";
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

// Rate limiting (tuned down to speed up overall throughput)
const RATE_LIMIT_DELAY = 250; // 0.25s between HTTP requests
let lastRequestTime = 0;

// Timeout settings (tighter to avoid long hangs)
const REQUEST_TIMEOUT = 6000; // 6 seconds max per request
const ARTICLE_SCRAPE_TIMEOUT = 8000; // 8 seconds max per article

// Concurrency for sources scraping
const SOURCE_BATCH_SIZE = 5;

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
      timeout: REQUEST_TIMEOUT,
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

  async scrapeAllSources(options?: { mode?: 'fast' | 'full' }): Promise<{ articles: ScrapedArticle[]; stats: any }> {
    try {
      logger.info("🔹 Starting scraping for all sources");
      const sources = await Source.find({ active: true });
      logger.info(`📋 Found ${sources.length} active sources to scrape`);

      let allArticles: ScrapedArticle[] = [];
      let successCount = 0;
      let failCount = 0;
      const perSource: Array<{ sourceId: string; name: string; rssUrls: number; rssFetched: number; rssFailed: number; itemsSeen: number; scrapedOk: number; inserted: number; error?: string }> = [];

      // Process sources in small batches to improve throughput
      for (let i = 0; i < sources.length; i += SOURCE_BATCH_SIZE) {
        const batch = sources.slice(i, i + SOURCE_BATCH_SIZE);
        const results = await Promise.allSettled(batch.map(async (source) => {
          try {
            logger.info(`🔄 Scraping source ${successCount + failCount + 1}/${sources.length}: ${source.name}`);
            const { articles, meta } = await this.scrapeSource(source, options);
            return { source, articles, meta };
          } catch (err) {
            throw { source, err };
          }
        }));

        for (const r of results) {
          if (r.status === 'fulfilled') {
            const { source, articles, meta } = r.value as any;
          let insertedCount = 0;
          
          for (const scraped of articles) {
            try {
              // Validate required fields
              if (!scraped.sourceUrl) {
                logger.warn(`❌ Skipping article: Missing canonicalUrl/sourceUrl for '${scraped.title}'`);
                continue;
              }
              if (!source._id) {
                logger.warn(`❌ Skipping article: Missing sourceId for source '${source.name}'`);
                continue;
              }
              
              // Quick duplicate check by canonicalUrl
              const existingByUrl = await Article.findOne({ canonicalUrl: scraped.sourceUrl });
              if (existingByUrl) {
                continue; // Skip duplicates silently
              }
              
              // Check for slug collision
              let baseSlug = slugify(scraped.title || "untitled", { lower: true, strict: true });
              let slug = baseSlug;
              let slugCollision = await Article.findOne({ slug });
              let slugSuffix = 1;
              while (slugCollision) {
                slug = `${baseSlug}-${Date.now()}-${slugSuffix}`;
                slugCollision = await Article.findOne({ slug });
                slugSuffix++;
              }
              const wc = (scraped.content || "").split(/\s+/).filter(Boolean).length;
              await Article.create({
                title: scraped.title,
                slug,
                summary: scraped.summary?.substring(0, 300) || "",
                content: scraped.content || "",
                images: scraped.images || [],
                categories: scraped.category ? [scraped.category] : [],
                categoryDetected: scraped.category || undefined,
                tags: scraped.tags || [],
                author: scraped.author || source.name,
                language: source.lang || "en",
                source: { name: source.name, url: source.url, sourceId: source._id },
                status: "scraped",
                publishedAt: scraped.publishedAt,
                scrapedAt: new Date(),
                canonicalUrl: scraped.sourceUrl,
                thumbnail: scraped.images && scraped.images[0] ? scraped.images[0].url : undefined,
                wordCount: wc,
                readingTime: Math.ceil(wc / 200) || 1,
                seo: { metaDescription: (scraped.summary || scraped.content || scraped.title || "").slice(0, 160), keywords: [] },
                hash: scraped.hash,
              } as any);
              insertedCount++;
            } catch (e) {
              logger.error(`❌ Failed to insert article '${scraped.title}': ${(e as Error).message}`);
            }
          }
            allArticles = allArticles.concat(articles);
            logger.info(`✅ ${source.name}: ${insertedCount} new articles inserted (${articles.length} total scraped)`);
            successCount++;

            await Source.findByIdAndUpdate(source._id, {
              lastScraped: new Date(),
            });
            perSource.push({
              sourceId: String(source._id),
              name: source.name,
              rssUrls: Array.isArray(source.rssUrls) ? source.rssUrls.length : 0,
              rssFetched: meta?.rssFetched ?? 0,
              rssFailed: meta?.rssFailed ?? 0,
              itemsSeen: meta?.itemsSeen ?? articles.length,
              scrapedOk: articles.length,
              inserted: insertedCount,
            });
          } else {
            const { source, err } = (r as any).reason || {};
            logger.error(`❌ Error scraping source ${source?.name || 'unknown'}: ${(err as Error)?.message || err}`);
            failCount++;
            if (source) {
              perSource.push({
                sourceId: String(source._id),
                name: source.name,
                rssUrls: Array.isArray(source.rssUrls) ? source.rssUrls.length : 0,
                rssFetched: 0,
                rssFailed: Array.isArray(source.rssUrls) ? source.rssUrls.length : 1,
                itemsSeen: 0,
                scrapedOk: 0,
                inserted: 0,
                error: (err as Error)?.message || String(err),
              });
            }
          }
        }
      }

      const stats = {
        sources: sources.length,
        success: successCount,
        failed: failCount,
        total: {
          itemsSeen: perSource.reduce((a, s) => a + (s.itemsSeen || 0), 0),
          scrapedOk: perSource.reduce((a, s) => a + (s.scrapedOk || 0), 0),
          inserted: perSource.reduce((a, s) => a + (s.inserted || 0), 0),
        },
        perSource,
      };
      logger.info(`✅ Scraping completed. Success: ${successCount}, Failed: ${failCount}, Inserted: ${stats.total.inserted}, Scraped: ${stats.total.scrapedOk}`);
      return { articles: allArticles, stats };
    } catch (err: unknown) {
      logger.error(`❌ scrapeAllSources error: ${(err as Error).message}`);
      return { articles: [], stats: { error: (err as Error).message } };
    }
  }

  async scrapeSource(source: any, options?: { mode?: 'fast' | 'full' }): Promise<{ articles: ScrapedArticle[]; meta: { rssUrls: number; rssFetched: number; rssFailed: number; itemsSeen: number } }> {
    try {
      logger.info(`🔹 Scraping source: ${source.name}`);
      const articles: ScrapedArticle[] = [];
      let rssFetched = 0;
      let rssFailed = 0;
      let itemsSeen = 0;

      // RSS scraping
      if (source.rssUrls && source.rssUrls.length > 0) {
        for (const rssUrl of source.rssUrls) {
          try {
            logger.info(`📡 Fetching RSS: ${source.name} -> ${rssUrl}`);
            const feed = await this.retryRequest(async () => {
              try {
                return await this.rssParser.parseURL(rssUrl);
              } catch (e) {
                // Fallback: fetch XML manually and parse string
                const axiosInstance = this.createAxiosInstance();
                const resp = await axiosInstance.get(rssUrl, {
                  headers: { Accept: 'application/rss+xml, application/xml, text/xml;q=0.9,*/*;q=0.8' },
                  responseType: 'text',
                });
                return await this.rssParser.parseString(resp.data);
              }
            });
            rssFetched++;
            const items = Array.isArray(feed.items) ? feed.items : [];
            itemsSeen += items.length;
            
            for (const item of items) {
              const scraped = await Promise.race([
                this.scrapeArticle(item, source, options),
                new Promise<null>((_, reject) => 
                  setTimeout(() => reject(new Error('Article scrape timeout')), ARTICLE_SCRAPE_TIMEOUT)
                )
              ]).catch(err => {
                logger.warn(`⏱️ Timeout or error scraping article from ${source.name}: ${err.message}`);
                return null;
              });
              if (scraped) articles.push(scraped);
            }
          } catch (err: unknown) {
            logger.error(`❌ Error parsing RSS feed ${rssUrl}: ${(err as Error).message}`);
            rssFailed++;
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
            const scraped = await Promise.race([
              this.scrapeArticle(item, source, options),
              new Promise<null>((_, reject) => 
                setTimeout(() => reject(new Error('Article scrape timeout')), ARTICLE_SCRAPE_TIMEOUT)
              )
            ]).catch(err => {
              logger.warn(`⏱️ Timeout or error scraping article from ${source.name}: ${err.message}`);
              return null;
            });
            if (scraped) articles.push(scraped);
          }
        } catch (err: unknown) {
          logger.error(`❌ Error fetching API for ${source.name}: ${(err as Error).message}`);
        }
      }

      logger.info(`✅ Scraped ${articles.length} articles from ${source.name} (feeds ok: ${rssFetched}, failed: ${rssFailed}, items seen: ${itemsSeen})`);
      return { articles, meta: { rssUrls: Array.isArray(source.rssUrls) ? source.rssUrls.length : 0, rssFetched, rssFailed, itemsSeen } };
    } catch (err: unknown) {
      logger.error(`❌ scrapeSource error for ${source.name}: ${(err as Error).message}`);
      return { articles: [], meta: { rssUrls: Array.isArray(source.rssUrls) ? source.rssUrls.length : 0, rssFetched: 0, rssFailed: Array.isArray(source.rssUrls) ? source.rssUrls.length : 1, itemsSeen: 0 } };
    }
  }

  async scrapeArticle(item: any, source: any, options?: { mode?: 'fast' | 'full' }): Promise<ScrapedArticle | null> {
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

  const fastMode = options?.mode === 'fast';
  // In fast mode, we don't fetch full HTML or OG upfront
  const fullContent = fastMode || source.type === "api" ? "" : await this.fetchArticleContent(link);
  const openGraphData = fastMode ? {} : (fullContent ? this.extractOpenGraphFromHtml(fullContent) : await this.extractOpenGraphData(link));

      // Priority: scraped article images > RSS enclosure/media images > API images > Open Graph images
      let images: ScrapedArticle["images"] = [];

      // 1) Extract from article HTML
      if (!fastMode && fullContent) {
        images = this.extractImages(fullContent, link, openGraphData);
      }

      // 2) RSS enclosure/media:content
      if (images.length === 0) {
        const enclosureUrl = (item as any)?.enclosure?.url || (item as any)?.enclosure?.url || (item as any)?.enclosureUrl;
        const mediaContent = (item as any)?.["media:content"]?.url || (item as any)?.media?.content?.url || (item as any)?.mediaContentUrl;
        const thumb = (item as any)?.thumbnail || (item as any)?.image;
        const rssImg = enclosureUrl || mediaContent || thumb;
        if (rssImg && this.isValidArticleImage(String(rssImg), title, 0, 0)) {
          try {
            const fullUrl = String(rssImg).startsWith('http') ? String(rssImg) : new URL(String(rssImg), link).href;
            images.push({ url: fullUrl, alt: title, source: 'rss' as any });
          } catch {}
        }
      }

      // 3) Fallback to API-provided image
      if (images.length === 0 && (item as any).urlToImage) {
        images.push({ url: (item as any).urlToImage, alt: title, source: "api" });
      }

      // 4) Last resort: Open Graph image (avoid obvious placeholders/logos)
      if (!fastMode && images.length === 0 && openGraphData && 'image' in openGraphData && (openGraphData as any).image) {
        const ogImage = String((openGraphData as any).image);
        const ogLower = ogImage.toLowerCase();
        const looksLikePlaceholder = ogLower.includes('logo') || ogLower.includes('icon') || ogLower.includes('placeholder') || ogLower.includes('default') || (ogLower.includes('google') && ogLower.includes('preferred'));
        if (!looksLikePlaceholder) {
          images.push({ url: ogImage, alt: title, caption: "Open Graph image", source: "opengraph" });
        }
      }

      const category = await this.determineCategory(title, summary, source.categories);

      const tags = this.extractTags(title, summary, fullContent);

      return {
        title,
        summary: summary.substring(0, 300),
        content: fastMode ? summary.substring(0, 1000) : this.cleanContent(fullContent),
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

  // If we already fetched HTML, pull OG tags from it instead of another request
  private extractOpenGraphFromHtml(html: string) {
    try {
      const $ = cheerio.load(html);
      return {
        image: $('meta[property="og:image"]').attr("content") || $('meta[name="twitter:image"]').attr("content"),
        title: $('meta[property="og:title"]').attr("content") || $('title').text(),
        description: $('meta[property="og:description"]').attr("content") || $('meta[name="description"]').attr("content"),
      };
    } catch {
      return {};
    }
  }

  // Enrich already-scraped articles by fetching full HTML and updating content/images
  async enrichArticles(params?: { limit?: number; minWords?: number; concurrency?: number }) {
    const limit = params?.limit ?? 200;
    const minWords = params?.minWords ?? 80;
    const concurrency = params?.concurrency ?? 5;

    const candidates = await Article.find({
      status: { $in: ["scraped", "processed", null as any] },
      $or: [
        { wordCount: { $exists: false } },
        { wordCount: { $lt: minWords } },
        { content: { $exists: false } },
        { content: "" },
      ],
    })
      .sort({ scrapedAt: -1 })
      .limit(limit);

    let processed = 0;
    let improved = 0;
    let failed = 0;

    for (let i = 0; i < candidates.length; i += concurrency) {
      const batch = candidates.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        batch.map(async (doc) => {
          const url = (doc as any).canonicalUrl || (doc as any).sourceUrl || "";
          if (!url) return false;
          // Fetch full HTML
          const html = await this.fetchArticleContent(url);
          if (!html) return false;
          const og = this.extractOpenGraphFromHtml(html);
          // Extract content and images
          const images = this.extractImages(html, url, og);
          const content = this.cleanContent(html);
          const wc = (content || "").split(/\s+/).filter(Boolean).length;

          const update: any = {
            content: content || (doc as any).content || "",
            images: images?.length ? images : (doc as any).images || [],
            thumbnail: images?.length ? images[0].url : (doc as any).thumbnail,
            wordCount: wc,
            readingTime: Math.max(1, Math.ceil(wc / 200)),
            openGraph: { ...(doc as any).openGraph, ...og },
            status: "processed",
            updatedAt: new Date(),
          };
          const beforeWC = (doc as any).wordCount || 0;
          await Article.updateOne({ _id: (doc as any)._id }, { $set: update });
          return wc > beforeWC + 30; // consider improved if word count meaningfully higher
        })
      );

      for (const r of results) {
        processed++;
        if (r.status === "fulfilled") {
          if (r.value) improved++;
        } else {
          failed++;
        }
      }
    }

    logger.info(`✅ Enrichment finished. Processed: ${processed}, Improved: ${improved}, Failed: ${failed}`);
    return { processed, improved, failed, limit, minWords };
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

    // Look for images in article content first
    const articleSelectors = [
      'article img',
      '[itemprop="articleBody"] img',
      '.article-content img',
      '.post-content img',
      '.entry-content img',
      'main img'
    ];
    
    for (const selector of articleSelectors) {
      $(selector).each((_, el) => {
        const src = $(el).attr("src") || $(el).attr("data-src");
        const alt = $(el).attr("alt") || "Article image";
        const width = parseInt($(el).attr("width") || "0");
        const height = parseInt($(el).attr("height") || "0");
        
        if (src && this.isValidArticleImage(src, alt, width, height)) {
          try {
            const fullUrl = src.startsWith("http") ? src : new URL(src, baseUrl).href;
            images.push({ url: fullUrl, alt, source: "scraped", width, height });
          } catch (e) {
            // Skip invalid URLs
          }
        }
      });
      
      if (images.length > 0) break; // Found images in article content
    }
    
    // Fallback to all images if no article images found
    if (images.length === 0) {
      $("img").each((_, el) => {
        const src = $(el).attr("src") || $(el).attr("data-src");
        const alt = $(el).attr("alt") || "Article image";
        const width = parseInt($(el).attr("width") || "0");
        const height = parseInt($(el).attr("height") || "0");
        
        if (src && this.isValidArticleImage(src, alt, width, height)) {
          try {
            const fullUrl = src.startsWith("http") ? src : new URL(src, baseUrl).href;
            images.push({ url: fullUrl, alt, source: "scraped", width, height });
          } catch (e) {
            // Skip invalid URLs
          }
        }
      });
    }

    // De-duplicate and further filter placeholders
    const deduped = [...new Map(images.map((img) => [img.url, img])).values()]
      .filter(img => !/placeholder|default|sprite|spacer|1x1/i.test(img.url) && !(img.url.toLowerCase().includes('google') && img.url.toLowerCase().includes('preferred')));
    return deduped.slice(0, 5);
  }
  
  private isValidArticleImage(src: string, alt: string, width: number, height: number): boolean {
    const srcLower = src.toLowerCase();
    const altLower = alt.toLowerCase();
    
    // Filter out logos, icons, ads, and tracking pixels
    const excludePatterns = [
      'logo',
      'icon',
      'avatar',
      'badge',
      'button',
      'banner',
      'ad',
      'advertisement',
      'sprite',
      'pixel',
      'tracking',
      '1x1',
      'blank.gif',
      'spacer.gif'
    ];
    
    for (const pattern of excludePatterns) {
      if (srcLower.includes(pattern) || altLower.includes(pattern)) {
        return false;
      }
    }
    
    // Filter out very small images (likely icons/logos)
    if ((width > 0 && width < 200) || (height > 0 && height < 200)) {
      return false;
    }
    
    return true;
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
    if (!html) return "";
    
    const $ = cheerio.load(html);
    
    // Remove script, style, noscript, iframe, and other non-content elements
    $('script, style, noscript, iframe, nav, header, footer, aside, .advertisement, .ad, .ads').remove();
    
    // Remove JSON-LD structured data
    $('script[type="application/ld+json"]').remove();
    
    // Remove comments
    $('*').contents().filter(function() {
      return this.type === 'comment';
    }).remove();
    
    // Try to find the main article content
    // Common article containers
    let content = '';
    const contentSelectors = [
      'article',
      '[itemprop="articleBody"]',
      '.article-content',
      '.post-content',
      '.entry-content',
      'main',
      '.content',
      '#content'
    ];
    
    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        content = element.text();
        break;
      }
    }
    
    // Fallback to body if no article container found
    if (!content) {
      content = $('body').text();
    }
    
    // Clean up whitespace
    return content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim()
      .substring(0, 5000); // Limit content length
  }
}
