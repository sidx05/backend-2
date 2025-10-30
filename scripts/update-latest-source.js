// Utility script to update the Latest News source to Scroll.in
require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  try {
    const uri = process.env.DATABASE_URL;
    if (!uri) {
      throw new Error('Missing DATABASE_URL in environment');
    }
    await mongoose.connect(uri);

    const Source = mongoose.model('Source', new mongoose.Schema({}, { strict: false }));

    const update = {
      name: 'Scroll.in Latest News',
      url: 'https://scroll.in',
      rssUrls: ['https://feeds.feedburner.com/ScrollinArticles.rss'],
      active: true,
    };

    const res = await Source.updateOne({ 'metadata.isLatestNews': true }, { $set: update });
    const doc = await Source.findOne({ 'metadata.isLatestNews': true }).lean();

    console.log('Update result:', res);
    console.log('Updated source:', JSON.stringify(doc, null, 2));
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close().catch(() => {});
  }
}

run();
