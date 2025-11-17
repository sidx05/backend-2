// Clean existing articles in database
// Run this with: ts-node backend/scripts/clean-articles-content.ts

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Article Schema (minimal version for cleaning)
const articleSchema = new mongoose.Schema({
  title: String,
  content: String,
  summary: String,
}, { timestamps: true, strict: false });

const Article = mongoose.model('Article', articleSchema);

/**
 * Remove unwanted patterns from text
 */
function removeUnwantedPatterns(text: string): string {
  if (!text) return "";

  const unwantedPatterns = [
    // Cookie notices (English)
    /We use cookies to.*?cookies\./gi,
    /This (?:site|website) uses cookies.*?(?:accept|continue|agree)\./gi,
    /By (?:clicking|using|continuing).*?(?:cookies|privacy policy)\./gi,
    /Cookie (?:policy|notice|consent).*?(?:\.|\n)/gi,
    
    // Cookie notices (Multi-language)
    /కుకీ.*?(?:ఉపయోగిస్తాము|అంగీకరిస్తున్నారు).*?[\.\।]/gi,
    /कुकी.*?(?:उपयोग|सहमत).*?[\.\।]/gi,
    /குக்கீ.*?(?:பயன்படுத்து|ஒப்புக்கொள்).*?[\.\।]/gi,
    
    // Twitter/X links
    /pic\.twitter\.com\/[a-zA-Z0-9]+/gi,
    /x\.com\/[a-zA-Z0-9_]+/gi,
    /twitter\.com\/[a-zA-Z0-9_]+/gi,
    /@[a-zA-Z0-9_]+\s*pic\.twitter/gi,
    
    // Social media
    /(?:Follow|Like|Share).*?(?:Facebook|Twitter|Instagram|LinkedIn).*?[\.\n]/gi,
    
    // Newsletter prompts
    /Subscribe.*?newsletter.*?[\.\n]/gi,
    /Sign up.*?(?:updates|newsletter).*?[\.\n]/gi,
    
    // Ads
    /\[?Advertisement\]?/gi,
    /\[?Sponsored\]?/gi,
    
    // Read more prompts
    /Click here to read more\.?/gi,
    /Continue reading.*?[\.\n]/gi,
    
    // Related articles
    /Also read:.*?[\.\n]/gi,
    /Related:.*?[\.\n]/gi,
    
    // Incomplete sentences with links
    /…\s*(?:pic|http|www)\.[a-zA-Z0-9\/.]+/gi,
    
    // Photo credits
    /Photo (?:Credit|by):.*?[\.\n]/gi,
    /Image (?:Credit|by|source):.*?[\.\n]/gi,
    
    // Copyright
    /©.*?All rights reserved.*?[\.\n]/gi,
    
    // Excessive whitespace
    /\s{3,}/g,
  ];

  let cleaned = text;
  
  for (const pattern of unwantedPatterns) {
    cleaned = cleaned.replace(pattern, ' ');
  }

  // Remove incomplete sentences
  cleaned = cleaned.replace(/[^\.!?]+…\s*$/gm, '');
  
  // Clean up spaces
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  return cleaned;
}

/**
 * Format text into paragraphs
 */
function formatParagraphs(text: string): string {
  if (!text) return "";

  let formatted = text;

  // Add line breaks after sentences
  formatted = formatted.replace(/([\.!?])\s+([A-Z])/g, '$1\n\n$2');

  // Remove too-short lines
  const lines = formatted.split('\n');
  const meaningfulLines = lines.filter(line => {
    const trimmed = line.trim();
    return trimmed.length > 30 || 
           (trimmed.length >= 15 && /[\.!?]$/.test(trimmed));
  });

  formatted = meaningfulLines.join('\n\n');
  formatted = formatted.replace(/\n{3,}/g, '\n\n');
  formatted = formatted.split('\n').map(p => p.trim()).join('\n');

  return formatted.trim();
}

/**
 * Clean article content
 */
function cleanArticleContent(content: string): string {
  if (!content) return "";
  
  let cleaned = removeUnwantedPatterns(content);
  cleaned = formatParagraphs(cleaned);
  
  return cleaned;
}

/**
 * Main cleaning function
 */
async function cleanAllArticles() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/newshub');
    console.log('✅ Connected to MongoDB');

    console.log('\n📊 Fetching articles...');
    const articles = await Article.find({}).select('_id title content summary');
    console.log(`📄 Found ${articles.length} articles to process`);

    let cleaned = 0;
    let skipped = 0;
    let updated = 0;

    for (const article of articles) {
      try {
        const originalContent = article.content || '';
        const originalSummary = article.summary || '';

        if (!originalContent && !originalSummary) {
          skipped++;
          continue;
        }

        // Clean content and summary
        const cleanedContent = cleanArticleContent(originalContent);
        const cleanedSummary = removeUnwantedPatterns(originalSummary);

        // Check if content actually changed
        const contentChanged = cleanedContent !== originalContent;
        const summaryChanged = cleanedSummary !== originalSummary;

        if (contentChanged || summaryChanged) {
          article.content = cleanedContent;
          article.summary = cleanedSummary;
          await article.save();
          updated++;
          console.log(`✅ Cleaned: ${article.title?.substring(0, 50)}...`);
        } else {
          skipped++;
        }

        cleaned++;
        
        // Progress indicator
        if (cleaned % 100 === 0) {
          console.log(`📊 Progress: ${cleaned}/${articles.length} processed, ${updated} updated`);
        }

      } catch (err) {
        console.error(`❌ Error cleaning article ${article._id}:`, err);
      }
    }

    console.log('\n✅ CLEANING COMPLETE!');
    console.log(`📊 Statistics:`);
    console.log(`   Total articles: ${articles.length}`);
    console.log(`   Processed: ${cleaned}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the script
cleanAllArticles();
