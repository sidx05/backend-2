const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/newshub').then(async () => {
  const Schema = mongoose.Schema;
  
  const sourceSchema = new Schema({
    name: String,
    url: String,
    rssUrls: [String],
    lang: String,
    categories: [Schema.Types.ObjectId],
    active: Boolean,
    type: String,
    metadata: Schema.Types.Mixed
  }, { timestamps: true, strict: false });
  
  const Source = mongoose.model('TestSource', sourceSchema);
  
  try {
    const result = await Source.create({
      name: "Scroll.in Latest News TEST",
      url: "https://scroll.in",
      rssUrls: ["https://feeds.feedburner.com/ScrollinArticles.rss"],
      lang: "en",
      categories: [],
      active: true,
      type: 'rss',
      metadata: {
        isLatestNews: true
      }
    });
    
    console.log('✅ Insert successful:', result._id);
    console.log('Metadata:', result.metadata);
    
    // Now check if we can find it
    const found = await Source.findOne({ 'metadata.isLatestNews': true });
    console.log('✅ Can query by metadata:', found ? 'YES' : 'NO');
    
  } catch (err) {
    console.error('❌ Insert failed:', err.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}).catch(console.error);
