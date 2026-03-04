import { z } from 'zod';

// User validation schemas
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['reader', 'editor', 'admin']).optional().default('reader'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Article validation schemas
export const createArticleSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  summary: z.string().min(1, 'Summary is required').max(300, 'Summary must be less than 300 characters'),
  content: z.string().min(1, 'Content is required'),
  images: z.array(z.string().url('Invalid image URL')).optional().default([]),
  category: z.string().min(1, 'Category is required'),
  tags: z.array(z.string()).optional().default([]),
  author: z.string().min(1, 'Author is required'),
  lang: z.string().min(1, 'Language is required').default('en'),
  sourceId: z.string().min(1, 'Source ID is required'),
  seo: z.object({
    metaDescription: z.string().max(160, 'Meta description must be less than 160 characters').optional(),
    keywords: z.array(z.string()).optional().default([]),
  }).optional(),
});

export const updateArticleSchema = createArticleSchema.partial();

// Category validation schemas
export const createCategorySchema = z.object({
  key: z.string().min(1, 'Key is required').regex(/^[a-z0-9-]+$/, 'Key must contain only lowercase letters, numbers, and hyphens'),
  label: z.string().min(1, 'Label is required'),
  icon: z.string().min(1, 'Icon is required').default('newspaper'),
  color: z.string().min(1, 'Color is required').default('#6366f1'),
  parent: z.string().optional(),
  order: z.number().min(0, 'Order must be a positive number').default(0),
});

export const updateCategorySchema = createCategorySchema.partial();

// Source validation schemas
export const createSourceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  url: z.string().url('Invalid URL'),
  rssUrls: z.array(z.string().url('Invalid RSS URL')).min(1, 'At least one RSS URL is required'),
  lang: z.string().min(1, 'Language is required').default('en'),
  categories: z.array(z.string()).optional().default([]),
  active: z.boolean().default(true),
});

export const updateSourceSchema = createSourceSchema.partial();

// Ticker validation schemas
export const createTickerSchema = z.object({
  text: z.string().min(1, 'Text is required').max(200, 'Text must be less than 200 characters'),
  priority: z.number().min(1, 'Priority must be at least 1').max(10, 'Priority must be at most 10').default(1),
  expiry: z.string().datetime('Invalid expiry date'),
});

export const updateTickerSchema = createTickerSchema.partial();

// Query validation schemas
export const getArticlesSchema = z.object({
  category: z.string().optional(),
  lang: z.string().optional(),
  // media/content type filter e.g., "video", "photo-gallery"
  type: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(['latest', 'popular', 'trending']).optional().default('latest'),
  page: z.string().regex(/^\d+$/, 'Page must be a number').optional().default('1'),
  limit: z.string().regex(/^\d+$/, 'Limit must be a number').optional().default('10'),
});

export const getTrendingSchema = z.object({
  limit: z.string().regex(/^\d+$/, 'Limit must be a number').optional().default('10'),
});

// Export types
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateArticleInput = z.infer<typeof createArticleSchema>;
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateSourceInput = z.infer<typeof createSourceSchema>;
export type UpdateSourceInput = z.infer<typeof updateSourceSchema>;
export type CreateTickerInput = z.infer<typeof createTickerSchema>;
export type UpdateTickerInput = z.infer<typeof updateTickerSchema>;
export type GetArticlesQuery = z.infer<typeof getArticlesSchema>;
export type GetTrendingQuery = z.infer<typeof getTrendingSchema>;