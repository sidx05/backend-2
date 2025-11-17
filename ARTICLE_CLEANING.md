# Article Content Cleaning

This guide explains how to clean unwanted content from articles (cookie notices, social media links, etc.)

## What Gets Removed

The cleaning process removes:

### 1. Cookie Notices
- "We use cookies to improve your experience..."
- Multi-language cookie notices (Telugu, Hindi, Tamil, etc.)
- "By clicking Accept, you agree to our use of cookies"

### 2. Social Media Content
- Twitter/X links: `pic.twitter.com/xxx`
- Social media handles and incomplete tweets
- "Follow us on Facebook/Twitter/Instagram"

### 3. Advertisement Content
- [Advertisement], [Sponsored] markers
- "This is a sponsored post"

### 4. Navigation/Prompts
- "Click here to read more"
- "Subscribe to our newsletter"
- "Sign up for updates"
- "Also read:", "Related:", "Trending:"

### 5. Media Credits
- "Photo Credit: Getty Images"
- "Image source: Reuters"
- Photo attribution lines

### 6. Incomplete Sentences
- Text ending with "..." followed by links
- Truncated sentences with social media URLs

## How to Use

### For NEW Articles (Automatic)

All newly scraped articles will automatically be cleaned. The cleaning happens in:
- `backend/src/services/scraping.service.ts`
- Method: `cleanContent()`, `removeUnwantedPatterns()`, `formatParagraphs()`

### For EXISTING Articles (Manual Cleanup)

To clean articles already in your database:

```bash
# Navigate to backend directory
cd backend

# Run the cleanup script
ts-node scripts/clean-articles-content.ts
```

**What it does:**
- Connects to your MongoDB database
- Processes all existing articles
- Removes unwanted patterns from content and summary
- Updates only changed articles
- Shows progress and statistics

**Sample Output:**
```
🔌 Connecting to MongoDB...
✅ Connected to MongoDB

📊 Fetching articles...
📄 Found 1523 articles to process

✅ Cleaned: Bihar election results: NDA heads for landslid...
✅ Cleaned: Karnataka: Woman alleges radiologist sexually...
📊 Progress: 100/1523 processed, 87 updated
...

✅ CLEANING COMPLETE!
📊 Statistics:
   Total articles: 1523
   Processed: 1523
   Updated: 432
   Skipped: 1091
```

## Content Formatting

The system also formats content properly:

### Before:
```
This is a sentence.Another sentence starts here.Yet another one.
```

### After:
```
This is a sentence.

Another sentence starts here.

Yet another one.
```

**Features:**
- Adds paragraph breaks between sentences
- Removes lines that are too short (fragments)
- Maintains proper punctuation
- Cleans excessive whitespace

## Supported Languages

The cleaning works for:
- English
- Telugu (తెలుగు)
- Hindi (हिंदी)
- Tamil (தமிழ்)
- Bengali (বাংলা)
- Gujarati (ગુજરાતી)
- Marathi (मराठी)

## Testing

After cleaning, verify articles by:

1. **Check a few articles manually:**
   ```
   Visit: http://localhost:3000/article/[slug]
   ```

2. **Look for removed patterns:**
   - No cookie notices
   - No Twitter links in middle of sentences
   - Proper paragraph formatting

3. **Check database directly:**
   ```javascript
   // In MongoDB shell or Compass
   db.articles.find({}).limit(5).pretty()
   ```

## Customization

To add more patterns to remove, edit:
- `backend/src/services/scraping.service.ts`
- Method: `removeUnwantedPatterns()`
- Add new regex patterns to the `unwantedPatterns` array

Example:
```typescript
unwantedPatterns.push(
  /Your custom pattern here/gi
);
```

## Production Deployment

The cleaning happens automatically for new articles. For existing production articles:

1. **Backup your database first!**
   ```bash
   mongodump --uri="your-mongodb-uri" --out=backup
   ```

2. **Run cleanup on production:**
   ```bash
   # SSH to your server
   cd backend
   NODE_ENV=production ts-node scripts/clean-articles-content.ts
   ```

3. **Verify results**

## Troubleshooting

**Script fails to connect:**
- Check `MONGODB_URI` in `.env`
- Ensure MongoDB is running
- Verify network access

**No articles updated:**
- Articles might already be clean
- Check console output for details

**Content looks wrong:**
- Adjust regex patterns in `removeUnwantedPatterns()`
- Test with sample text first

## Performance

- Processes ~100-200 articles per second
- Updates only changed articles
- Shows progress every 100 articles
- Safe to interrupt (Ctrl+C) - already processed articles are saved

## Need Help?

Check the console logs for detailed error messages and processing statistics.
