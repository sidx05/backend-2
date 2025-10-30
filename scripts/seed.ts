import dotenv from "dotenv";
dotenv.config();

import { connectDB, disconnectDB } from "../src/lib/mongoose";
import { Article } from "../src/models/Article";
import { Source } from "../src/models/Source";
import { Category, ICategory } from "../src/models/Category";

async function seed() {
  await connectDB();

  try {
    console.log("🌱 Seeding database...");

    // ----------------------
    // ✅ Define categories in strict order
    // ----------------------
    const categoriesData: Partial<ICategory>[] = [
      // Main Categories
      { key: "news", label: "News", icon: "newspaper", color: "#2563eb", order: 1 },
      { key: "sports", label: "Sports", icon: "trophy", color: "#16a34a", order: 2 },
      { key: "business", label: "Business", icon: "briefcase", color: "#0ea5a4", order: 3 },
      { key: "entertainment", label: "Entertainment", icon: "film", color: "#ec4899", order: 4 },
      { key: "technology", label: "Technology", icon: "cpu", color: "#7c3aed", order: 5 },
      { key: "education", label: "Education", icon: "graduation-cap", color: "#06b6d4", order: 6 },
      { key: "lifestyle", label: "Lifestyle", icon: "heart", color: "#ef4444", order: 7 },
      { key: "religion", label: "Religion & Astro", icon: "star", color: "#f59e0b", order: 8 },
      { key: "brand-wire", label: "Brand Wire", icon: "megaphone", color: "#8b5cf6", order: 9 },
      
      // News Subcategories
      { key: "politics", label: "Politics", icon: "landmark", color: "#2563eb", order: 11 },
      { key: "world", label: "World", icon: "globe", color: "#2563eb", order: 12 },
      { key: "india", label: "India", icon: "flag", color: "#2563eb", order: 13 },
      { key: "cities", label: "Cities", icon: "building", color: "#2563eb", order: 14 },
      { key: "delhi-ncr", label: "Delhi NCR", icon: "map-pin", color: "#2563eb", order: 15 },
      { key: "andhra-pradesh", label: "Andhra Pradesh", icon: "map-pin", color: "#2563eb", order: 16 },
      { key: "trending", label: "Trending", icon: "trending-up", color: "#2563eb", order: 17 },
      { key: "offbeat", label: "Offbeat", icon: "zap", color: "#2563eb", order: 18 },
      { key: "fact-check", label: "Fact Check", icon: "check-circle", color: "#2563eb", order: 19 },
      { key: "explainers", label: "Explainers", icon: "book-open", color: "#2563eb", order: 20 },
      { key: "crime", label: "Crime", icon: "shield-alert", color: "#2563eb", order: 21 },
      { key: "elections", label: "Elections", icon: "vote", color: "#2563eb", order: 22 },
      
      // Sports Subcategories
      { key: "cricket", label: "Cricket", icon: "baseball", color: "#16a34a", order: 22 },
      { key: "ipl", label: "IPL", icon: "trophy", color: "#16a34a", order: 23 },
      { key: "football", label: "Football", icon: "soccer", color: "#16a34a", order: 24 },
      { key: "kabaddi", label: "Kabaddi", icon: "users", color: "#16a34a", order: 25 },
      
      // Business Subcategories
      { key: "personal-finance", label: "Personal Finance", icon: "wallet", color: "#0ea5a4", order: 26 },
      { key: "auto", label: "Auto", icon: "car", color: "#0ea5a4", order: 27 },
      { key: "mutual-funds", label: "Mutual Funds", icon: "trending-up", color: "#0ea5a4", order: 28 },
      
      // Entertainment Subcategories
      { key: "movies", label: "Movies", icon: "film", color: "#ec4899", order: 29 },
      { key: "celebrities", label: "Celebrities", icon: "star", color: "#ec4899", order: 30 },
      { key: "south-cinema", label: "South Cinema", icon: "camera", color: "#ec4899", order: 31 },
      { key: "ott", label: "OTT", icon: "tv", color: "#ec4899", order: 32 },
      { key: "movie-reviews", label: "Movie Reviews", icon: "star", color: "#ec4899", order: 33 },
      
      // Technology Subcategories
      { key: "gadgets", label: "Gadgets", icon: "smartphone", color: "#7c3aed", order: 34 },
      { key: "chatgpt", label: "ChatGPT", icon: "bot", color: "#7c3aed", order: 35 },
      { key: "science", label: "Science", icon: "microscope", color: "#7c3aed", order: 36 },
      
      // Education Subcategories
      { key: "jobs", label: "Jobs", icon: "briefcase", color: "#06b6d4", order: 37 },
      { key: "results", label: "Results", icon: "award", color: "#06b6d4", order: 38 },
      
      // Lifestyle Subcategories
      { key: "health", label: "Health", icon: "heart", color: "#ef4444", order: 39 },
      { key: "travel", label: "Travel", icon: "plane", color: "#ef4444", order: 40 },
      { key: "religion-spirituality", label: "Religion & Spirituality", icon: "star", color: "#ef4444", order: 41 },
      { key: "astro", label: "Astro", icon: "moon", color: "#ef4444", order: 42 },
      
      // Brand Wire Subcategories
      { key: "influential-personalities", label: "Influential Personalities", icon: "users", color: "#8b5cf6", order: 43 },
    ];

    // ----------------------
    // ✅ Upsert categories (keeps IDs stable for order)
    // ----------------------
    const categories: ICategory[] = [];
    for (const cat of categoriesData) {
      const updated = await Category.findOneAndUpdate(
        { key: cat.key },
        { $set: cat },
        { new: true, upsert: true }
      );
      if (updated) categories.push(updated);
    }

    // Set parent relationships for subcategories
    const mainCategories = {
      news: categories.find(c => c.key === 'news'),
      sports: categories.find(c => c.key === 'sports'),
      business: categories.find(c => c.key === 'business'),
      entertainment: categories.find(c => c.key === 'entertainment'),
      technology: categories.find(c => c.key === 'technology'),
      education: categories.find(c => c.key === 'education'),
      lifestyle: categories.find(c => c.key === 'lifestyle'),
      'brand-wire': categories.find(c => c.key === 'brand-wire')
    };

    // News subcategories
    const newsSubcategories = ['politics', 'world', 'india', 'cities', 'delhi-ncr', 'andhra-pradesh', 'trending', 'offbeat', 'fact-check', 'explainers', 'crime', 'elections'];
    for (const subKey of newsSubcategories) {
      const subCategory = categories.find(c => c.key === subKey);
      if (subCategory && mainCategories.news) {
        await Category.findByIdAndUpdate(subCategory._id, { $set: { parent: mainCategories.news._id } });
      }
    }

    // Sports subcategories
    const sportsSubcategories = ['cricket', 'ipl', 'football', 'kabaddi'];
    for (const subKey of sportsSubcategories) {
      const subCategory = categories.find(c => c.key === subKey);
      if (subCategory && mainCategories.sports) {
        await Category.findByIdAndUpdate(subCategory._id, { $set: { parent: mainCategories.sports._id } });
      }
    }

    // Business subcategories
    const businessSubcategories = ['personal-finance', 'auto', 'mutual-funds'];
    for (const subKey of businessSubcategories) {
      const subCategory = categories.find(c => c.key === subKey);
      if (subCategory && mainCategories.business) {
        await Category.findByIdAndUpdate(subCategory._id, { $set: { parent: mainCategories.business._id } });
      }
    }

    // Entertainment subcategories
    const entertainmentSubcategories = ['movies', 'celebrities', 'south-cinema', 'ott', 'movie-reviews'];
    for (const subKey of entertainmentSubcategories) {
      const subCategory = categories.find(c => c.key === subKey);
      if (subCategory && mainCategories.entertainment) {
        await Category.findByIdAndUpdate(subCategory._id, { $set: { parent: mainCategories.entertainment._id } });
      }
    }

    // Technology subcategories
    const technologySubcategories = ['gadgets', 'chatgpt', 'science'];
    for (const subKey of technologySubcategories) {
      const subCategory = categories.find(c => c.key === subKey);
      if (subCategory && mainCategories.technology) {
        await Category.findByIdAndUpdate(subCategory._id, { $set: { parent: mainCategories.technology._id } });
      }
    }

    // Education subcategories
    const educationSubcategories = ['jobs', 'results'];
    for (const subKey of educationSubcategories) {
      const subCategory = categories.find(c => c.key === subKey);
      if (subCategory && mainCategories.education) {
        await Category.findByIdAndUpdate(subCategory._id, { $set: { parent: mainCategories.education._id } });
      }
    }

    // Lifestyle subcategories
    const lifestyleSubcategories = ['health', 'travel', 'religion-spirituality', 'astro'];
    for (const subKey of lifestyleSubcategories) {
      const subCategory = categories.find(c => c.key === subKey);
      if (subCategory && mainCategories.lifestyle) {
        await Category.findByIdAndUpdate(subCategory._id, { $set: { parent: mainCategories.lifestyle._id } });
      }
    }

    // Brand Wire subcategories
    const brandWireSubcategories = ['influential-personalities'];
    for (const subKey of brandWireSubcategories) {
      const subCategory = categories.find(c => c.key === subKey);
      if (subCategory && mainCategories['brand-wire']) {
        await Category.findByIdAndUpdate(subCategory._id, { $set: { parent: mainCategories['brand-wire']._id } });
      }
    }

    // Build lookup helper
    const catByKey = (k: string) => {
      const found = categories.find((c) => c.key === k);
      if (!found) throw new Error(`Missing category key: ${k}`);
      return found._id;
    };

    // ----------------------
    // ✅ Reset articles and sources
    // ----------------------
    console.log("🌱 Clearing old articles and sources...");
    await Article.deleteMany({});
    await Source.deleteMany({});

    // ----------------------
    // ✅ Insert sources
    // ----------------------
    console.log("🌱 Inserting sources...");
    const sourcesData = [
      // 🌍 World
      {
        name: "BBC World",
        url: "https://www.bbc.com",
        rssUrls: ["http://feeds.bbci.co.uk/news/world/rss.xml"],
        lang: "en",
        categories: [catByKey("news")],
        active: true,
      },
      {
        name: "Reuters World News",
        url: "https://www.reuters.com/world/",
        rssUrls: ["https://feeds.reuters.com/Reuters/worldNews"],
        lang: "en",
        categories: [catByKey("news")],
        active: true,
      },

      // 🇮🇳 India
      {
        name: "The Hindu",
        url: "https://www.thehindu.com",
        rssUrls: ["https://www.thehindu.com/news/national/feeder/default.rss"],
        lang: "en",
        categories: [catByKey("news")],
        active: true,
      },
      // Scroll.in - Latest News (for Latest News section only)
      {
        name: "Scroll.in Latest News",
        url: "https://scroll.in",
        rssUrls: ["https://feeds.feedburner.com/ScrollinArticles.rss"],
        lang: "en",
        categories: [catByKey("trending")], // Use 'trending' category to separate from main news
        active: true,
        metadata: {
          isLatestNews: true, // Special flag to identify latest news articles
        }
      },
      {
        name: "Indian Express",
        url: "https://indianexpress.com",
        rssUrls: ["https://indianexpress.com/section/india/feed/"],
        lang: "en",
        categories: [catByKey("news")],
        active: true,
      },
      {
        name: "Times of India",
        url: "https://timesofindia.indiatimes.com",
        rssUrls: ["https://timesofindia.indiatimes.com/rssfeeds/296589292.cms"],
        lang: "en",
        categories: [catByKey("news")],
        active: true,
      },
      {
        name: "Hindustan Times",
        url: "https://www.hindustantimes.com",
        rssUrls: ["https://www.hindustantimes.com/rss/india/rssfeed.xml"],
        lang: "en",
        categories: [catByKey("news")],
        active: true,
      },
      {
        name: "Firstpost",
        url: "https://www.firstpost.com/",
        rssUrls: ["https://www.firstpost.com/commonfeeds/v1/mfp/rss/web-stories.xml"],
        lang: "hi",
        categories: [catByKey("news")],
        active: true,
      },
      {
        name: "DNA India",
        url: "https://www.dnaindia.com/",
        rssUrls: ["https://www.dnaindia.com/feeds/india.xml"],
        lang: "hi",
        categories: [catByKey("news")],
        active: true,
      },

      // 💼 Business
      {
        name: "Economic Times",
        url: "https://economictimes.indiatimes.com",
        rssUrls: ["https://economictimes.indiatimes.com/rssfeedsdefault.cms"],
        lang: "en",
        categories: [catByKey("business")],
        active: true,
      },

      // 🤖 Technology
      {
        name: "Hacker News",
        url: "https://news.ycombinator.com",
        rssUrls: ["https://news.ycombinator.com/rss"],
        lang: "en",
        categories: [catByKey("technology")],
        active: true,
      },
      {
        name: "TechCrunch",
        url: "https://techcrunch.com",
        rssUrls: ["https://techcrunch.com/feed/"],
        lang: "en",
        categories: [catByKey("technology")],
        active: true,
      },

      // 🧠 Artificial Intelligence
      {
        name: "Ars Technica",
        url: "https://arstechnica.com",
        rssUrls: ["https://feeds.arstechnica.com/arstechnica/index/"],
        lang: "en",
        categories: [catByKey("technology")],
        active: true,
      },
      {
        name: "Wired",
        url: "https://www.wired.com",
        rssUrls: ["https://www.wired.com/feed/rss"],
        lang: "en",
        categories: [catByKey("technology")],
        active: true,
      },
      {
        name: "The Verge - AI",
        url: "https://www.theverge.com/ai-artificial-intelligence",
        rssUrls: ["https://www.theverge.com/rss/ai/index.xml"],
        lang: "en",
        categories: [catByKey("technology")],
        active: true,
      },
      {
        name: "ZDNet AI",
        url: "https://www.zdnet.com/topic/artificial-intelligence/",
        rssUrls: ["https://www.zdnet.com/topic/artificial-intelligence/rss.xml"],
        lang: "en",
        categories: [catByKey("technology")],
        active: true,
      },

      // 🏅 Sports
      {
        name: "ESPN",
        url: "https://www.espn.com",
        rssUrls: ["https://www.espn.com/espn/rss/news"],
        lang: "en",
        categories: [catByKey("sports")],
        active: true,
      },

      // ⚔ War 
      {
        name: "Al Jazeera - Middle East",
        url: "https://www.aljazeera.com/middle-east/",
        rssUrls: ["https://www.aljazeera.com/xml/rss/middleeast.xml"],
        lang: "en",
        categories: [catByKey("news")],
        active: true,
      },
      {
        name: "Guardian - War & Conflict",
        url: "https://www.theguardian.com/world/series/ukraine-live",
        rssUrls: ["https://www.theguardian.com/world/series/ukraine-live/rss"],
        lang: "en",
        categories: [catByKey("news")],
        active: true,
      },
      {
        name: "Reuters - World News",
        url: "https://www.reuters.com/world/",
        rssUrls: ["https://feeds.reuters.com/Reuters/worldNews"],
        lang: "en",
        categories: [catByKey("news")],
        active: true,
      },
      {
        name: "Conflict News (Unofficial)",
        url: "https://conflictobserver.com",
        rssUrls: ["https://www.conflictobserver.com/rss"],
        lang: "en",
        categories: [catByKey("news")],
        active: true,
      },

      // 🔬 Science
      {
        name: "ScienceDaily",
        url: "https://www.sciencedaily.com",
        rssUrls: ["https://www.sciencedaily.com/rss/top/science.xml"],
        lang: "en",
        categories: [catByKey("education")],
        active: true,
      },

      // ❤️ Health
      {
        name: "WHO News",
        url: "https://www.who.int",
        rssUrls: ["https://www.who.int/feeds/entity/mediacentre/news/en/rss.xml"],
        lang: "en",
        categories: [catByKey("lifestyle")],
        active: true,
      },
      {
        name: "Healthline",
        url: "https://www.healthline.com/",
        rssUrls: ["https://www.healthline.com/health/feed"],
        lang: "en",
        categories: [catByKey("lifestyle")],
        active: true,
      },
      {
        name: "MedCity News",
        url: "https://medcitynews.com/",
        rssUrls: ["https://medcitynews.com/feed/"],
        lang: "en",
        categories: [catByKey("lifestyle")],
        active: true,
      },
      { name: "manatelangana news",
        url: "https://www.manatelangana.news/",
        rssUrls: ["https://www.manatelangana.news/feed/"],
        lang: "te",
        categories: [catByKey("politics")],
        active: true,
      },

      // 🎬 Entertainment
      {
        name: "Hollywood Reporter Entertainment",
        url: "https://www.hollywoodreporter.com",
        rssUrls: ["https://www.hollywoodreporter.com/t/entertainment/feed/"],
        lang: "en",
        categories: [catByKey("entertainment")],
        active: true,
      },

      // 🎥 Movies (child of entertainment)
      {
        name: "Hollywood Reporter Movies",
        url: "https://www.hollywoodreporter.com",
        rssUrls: ["https://www.hollywoodreporter.com/t/movies/feed/"],
        lang: "en",
        categories: [catByKey("entertainment")],
        active: true,
      },

      // 📰 Telugu
      {
        name: "Eenadu Telugu",
        url: "https://www.eenadu.net",
        rssUrls: ["https://telugu.hindustantimes.com/rss/andhra-pradesh"],
        lang: "te",
        categories: [catByKey("news")],
        active: true,
      },
      {
        name: "123Telugu",
        url: "https://www.123telugu.com",
        rssUrls: ["https://www.123telugu.com/feed/"],
        lang: "te",
        categories: [catByKey("entertainment")],
        active: true,
      },
      {
        name: "cinejosh",
        url: "https://www.cinejosh.com/",
        rssUrls: ["https://www.cinejosh.com/rss-feed/2/telugu.html"],
        lang: "te",
        categories: [catByKey("entertainment")],
        active: true,
      },
      {
        name: "Gulte",
        url: "https://www.gulte.com",
        rssUrls: ["https://www.gulte.com/feed/"],
        lang: "te",
        categories: [catByKey("entertainment")],
        active: true,
      },

      // Telugu Sports (OK Telugu)
      {
        name: "OK Telugu Sports",
        url: "https://oktelugu.com",
        rssUrls: ["https://oktelugu.com/sports/feed"],
        lang: "te",
        categories: [catByKey("sports")],
        active: true,
      },
      // Telugu Andhra Pradesh News (OK Telugu)
      {
        name: "OK Telugu Andhra Pradesh",
        url: "https://oktelugu.com",
        rssUrls: ["https://oktelugu.com/category/andhra-pradesh/feed"],
        lang: "te",
        categories: [catByKey("andhra-pradesh")],
        active: true,
      },

      // Telugu Health
      {
        name: "OneIndia Telugu - Health",
        url: "https://telugu.oneindia.com",
        rssUrls: ["https://telugu.oneindia.com/rss/feeds/telugu-health-fb.xml"],
        lang: "te",
        categories: [catByKey("health")],
        active: true,
      },
      {
        name: "Hindustan Times Telugu - Lifestyle",
        url: "https://telugu.hindustantimes.com",
        rssUrls: ["https://telugu.hindustantimes.com/rss/lifestyle"],
        lang: "te",
        categories: [catByKey("health")],
        active: true,
      },

      // Telugu Crime
      {
        name: "ABP Live Telugu - Crime",
        url: "https://telugu.abplive.com",
        rssUrls: ["https://telugu.abplive.com/crime/feed"],
        lang: "te",
        categories: [catByKey("crime")],
        active: true,
      },

      // Telugu Business
      {
        name: "ABP Live Telugu - Business",
        url: "https://telugu.abplive.com",
        rssUrls: ["https://telugu.abplive.com/business/feed"],
        lang: "te",
        categories: [catByKey("business")],
        active: true,
      },

      // 📰 Hindi
      {
        name: "Amar Ujala",
        url: "https://www.amarujala.com",
        rssUrls: ["https://feeds.feedburner.com/ndtvkhabar-latest"],
        lang: "hi",
        categories: [catByKey("news")],
        active: true,
      },
      {
        name: "NDTV",
        url: "https://www.ndtv.com/",
        rssUrls: ["https://feeds.feedburner.com/NDTV-LatestNews"],
        lang: "hi",
        categories: [catByKey("news")],
        active: true,
      },
      {
        name: "Navjivan India",
        url: "https://www.navjivanindia.com/",
        rssUrls: ["https://www.navjivanindia.com/stories.rss"],
        lang: "hi",
        categories: [catByKey("news")],
        active: true,
      },

      // 📰 Tamil
      {
        name: "BBC Tamil",
        url: "https://www.bbc.com/tamil",
        rssUrls: ["https://feeds.bbci.co.uk/tamil/rss.xml"],
        lang: "ta",
        categories: [catByKey("news")],
        active: true,
      },
      {
        name: "Vikatan Tamil",
        url: "https://www.vikatan.com/",
        rssUrls: ["https://www.vikatan.com/rss.xml"],
        lang: "ta",
        categories: [catByKey("news")],
        active: true,
      },
      // Tamil Hindustan Times (requested)
      {
        name: "HT Tamil - Tamil Nadu (Politics)",
        url: "https://tamil.hindustantimes.com",
        rssUrls: ["https://tamil.hindustantimes.com/rss/tamilnadu"],
        lang: "ta",
        categories: [catByKey("politics")],
        active: true,
      },
      {
        name: "HT Tamil - Entertainment",
        url: "https://tamil.hindustantimes.com",
        rssUrls: ["https://tamil.hindustantimes.com/rss/entertainment"],
        lang: "ta",
        categories: [catByKey("entertainment")],
        active: true,
      },
      {
        name: "HT Tamil - Sports",
        url: "https://tamil.hindustantimes.com",
        rssUrls: ["https://tamil.hindustantimes.com/rss/sports"],
        lang: "ta",
        categories: [catByKey("sports")],
        active: true,
      },
      {
        name: "HT Tamil - Health/Lifestyle",
        url: "https://tamil.hindustantimes.com",
        rssUrls: ["https://tamil.hindustantimes.com/rss/lifestyle"],
        lang: "ta",
        categories: [catByKey("health")],
        active: true,
      },

      // 📰 Malayalam
      {
        name: "BBC Malayalam",
        url: "https://www.bbc.com/malayalam",
        rssUrls: ["https://feeds.bbci.co.uk/malayalam/rss.xml"],
        lang: "ml",
        categories: [catByKey("news")],
        active: true,
      },

      // 📰 Bengali
      {
        name: "BBC Bengali",
        url: "https://www.bbc.com/bengali",
        rssUrls: ["https://feeds.bbci.co.uk/bengali/rss.xml"],
        lang: "bn",
        categories: [catByKey("news")],
        active: true,
      },
      // Bengali - working alternatives (BBC Bengali covers all categories)
      {
        name: "BBC Bengali - Sports",
        url: "https://www.bbc.com/bengali",
        rssUrls: ["https://feeds.bbci.co.uk/bengali/rss.xml"],
        lang: "bn",
        categories: [catByKey("sports")],
        active: true,
      },
      {
        name: "BBC Bengali - Entertainment",
        url: "https://www.bbc.com/bengali",
        rssUrls: ["https://feeds.bbci.co.uk/bengali/rss.xml"],
        lang: "bn",
        categories: [catByKey("entertainment")],
        active: true,
      },
      {
        name: "BBC Bengali - Health",
        url: "https://www.bbc.com/bengali",
        rssUrls: ["https://feeds.bbci.co.uk/bengali/rss.xml"],
        lang: "bn",
        categories: [catByKey("health")],
        active: true,
      },

      // 📰 Gujarati
      {
        name: "BBC Gujarati",
        url: "https://www.bbc.com/gujarati",
        rssUrls: ["https://feeds.bbci.co.uk/gujarati/rss.xml"],
        lang: "gu",
        categories: [catByKey("news")],
        active: true,
      },
      // Gujarati - working alternatives (Indian Express)
      {
        name: "Indian Express Gujarati - Sports",
        url: "https://gujarati.indianexpress.com",
        rssUrls: ["https://gujarati.indianexpress.com/sports/feed/rssfeed"],
        lang: "gu",
        categories: [catByKey("sports")],
        active: true,
      },
      {
        name: "Indian Express Gujarati - Entertainment",
        url: "https://gujarati.indianexpress.com",
        rssUrls: ["https://gujarati.indianexpress.com/entertainment/feed/rssfeed"],
        lang: "gu",
        categories: [catByKey("entertainment")],
        active: true,
      },
      {
        name: "Indian Express Gujarati - Lifestyle",
        url: "https://gujarati.indianexpress.com",
        rssUrls: ["https://gujarati.indianexpress.com/lifestyle/feed/rssfeed"],
        lang: "gu",
        categories: [catByKey("health")],
        active: true,
      },
      {
        name: "Gujarat Samachar - Top Stories",
        url: "https://www.gujaratsamachar.com",
        rssUrls: ["https://www.gujaratsamachar.com/rss/top-stories"],
        lang: "gu",
        categories: [catByKey("news")],
        active: true,
      },

      // 📰 Marathi
      {
        name: "BBC Marathi",
        url: "https://www.bbc.com/marathi",
        rssUrls: ["https://feeds.bbci.co.uk/marathi/rss.xml"],
        lang: "mr",
        categories: [catByKey("news")],
        active: true,
      },
      // Marathi - category specific (OneIndia)
      {
        name: "OneIndia Marathi - Sports",
        url: "https://marathi.oneindia.com",
        rssUrls: ["https://marathi.oneindia.com/rss/feeds/marathi-sports-fb.xml"],
        lang: "mr",
        categories: [catByKey("sports")],
        active: true,
      },
      {
        name: "OneIndia Marathi - Entertainment",
        url: "https://marathi.oneindia.com",
        rssUrls: ["https://marathi.oneindia.com/rss/feeds/marathi-entertainment-fb.xml"],
        lang: "mr",
        categories: [catByKey("entertainment")],
        active: true,
      },
      {
        name: "OneIndia Marathi - Health",
        url: "https://marathi.oneindia.com",
        rssUrls: ["https://marathi.oneindia.com/rss/feeds/marathi-health-fb.xml"],
        lang: "mr",
        categories: [catByKey("health")],
        active: true,
      }
    ];

    // Insert all sources
    await Source.insertMany(sourcesData);

    console.log("✅ Seeding complete.");
  } catch (err) {
    console.error("❌ Error seeding:", err);
  } finally {
    await disconnectDB();
  }
}

seed();