require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect(process.env.DATABASE_URL);
    const Article = mongoose.model('Article', new mongoose.Schema({}, { strict: false }));
    const sourceId = new mongoose.Types.ObjectId('690324df3f94739e7cb14a48');
    const count = await Article.countDocuments({ 'source.sourceId': sourceId });
    const latest = await Article.find({ 'source.sourceId': sourceId })
      .sort({ publishedAt: -1 })
      .limit(10)
      .select('title publishedAt canonicalUrl')
      .lean();
    console.log('Total latest-source articles:', count);
    console.log('Latest sample:', latest.map(a => ({ title: a.title, at: a.publishedAt, url: a.canonicalUrl })));
  } catch (e) {
    console.error(e);
  } finally {
    await mongoose.connection.close().catch(() => {});
  }
}

run();
