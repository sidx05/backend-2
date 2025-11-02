/*
  Copy all collections from a source MongoDB database to a destination database.
  - Uses native MongoDB driver for speed and reliability
  - Preserves _id values
  - Re-creates indexes on destination
  - Skips system collections

  Environment variables (recommended):
    SOURCE_MONGODB_URI=mongodb+srv://.../test?...
    DEST_MONGODB_URI=mongodb+srv://.../newshub?...

  PowerShell example:
    $env:SOURCE_MONGODB_URI="mongodb+srv://.../test?..."; $env:DEST_MONGODB_URI="mongodb+srv://.../newshub?..."; npm run copy-db
*/
import { MongoClient } from "mongodb";

function mask(uri: string): string {
  try { return uri.replace(/\/\/(.+@)/, "//***@"); } catch { return uri; }
}

const BATCH_SIZE = 1000;

async function ensureIndexes(src: any, dst: any, collName: string) {
  try {
    const srcIndexes = await src.collection(collName).listIndexes().toArray();
    if (!srcIndexes || srcIndexes.length === 0) return;
    const dstColl = dst.collection(collName);
    for (const idx of srcIndexes) {
      // Skip default _id index
      if (!idx.key || (idx.name === "_id_")) continue;
      const { key, name, unique, sparse, expireAfterSeconds, partialFilterExpression } = idx as any;
      try {
        await dstColl.createIndex(key, { name, unique, sparse, expireAfterSeconds, partialFilterExpression } as any);
      } catch (e) {
        console.warn(`Index create failed on ${collName}.${name}:`, (e as Error).message);
      }
    }
  } catch (e) {
    console.warn(`Index copy skipped for ${collName}:`, (e as Error).message);
  }
}

async function copyCollection(src: any, dst: any, collName: string) {
  const srcColl = src.collection(collName);
  const dstColl = dst.collection(collName);

  // Ensure destination collection exists
  const existing = await dst.listCollections({ name: collName }).toArray();
  if (existing.length === 0) {
    await dst.createCollection(collName).catch(()=>{});
  }

  await ensureIndexes(src, dst, collName);

  const count = await srcColl.estimatedDocumentCount();
  console.log(`→ ${collName}: copying ~${count} docs`);

  const cursor = srcColl.find({}, { batchSize: BATCH_SIZE });
  let batch: any[] = [];
  let copied = 0; let skippedDup = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    try {
      // Use unordered insertMany for speed; ignore duplicate key errors
      await dstColl.insertMany(batch, { ordered: false });
      copied += batch.length;
    } catch (e: any) {
      // BulkWriteError may contain writeErrors with code 11000 for duplicates
      if (e?.writeErrors?.length) {
        const dup = e.writeErrors.filter((w: any) => w.code === 11000).length;
        skippedDup += dup;
        copied += batch.length - dup;
      } else {
        console.error(`  ✖ Error inserting batch into ${collName}:`, e.message || e);
      }
    } finally {
      batch = [];
    }
  };

  for await (const doc of cursor) {
    batch.push(doc);
    if (batch.length >= BATCH_SIZE) {
      await flush();
    }
  }
  await flush();

  console.log(`  ✓ ${collName}: copied=${copied}, duplicatesSkipped=${skippedDup}`);
}

async function main() {
  const SRC = process.env.SOURCE_MONGODB_URI;
  const DST = process.env.DEST_MONGODB_URI;
  if (!SRC || !DST) {
    console.error("Please set SOURCE_MONGODB_URI and DEST_MONGODB_URI env vars.");
    process.exit(1);
  }
  console.log("Source:", mask(SRC));
  console.log("Destination:", mask(DST));

  const srcClient = new MongoClient(SRC);
  const dstClient = new MongoClient(DST);
  try {
    await srcClient.connect();
    await dstClient.connect();
    const srcDb = srcClient.db();
    const dstDb = dstClient.db();

    const colls = await srcDb.listCollections({}, { nameOnly: true }).toArray();
    const names = colls
      .map((c: any) => c.name as string)
      .filter((n: string) => !n.startsWith("system."));

    console.log(`Collections to copy (${names.length}):`, names.join(", "));

    for (const name of names) {
      await copyCollection(srcDb, dstDb, name);
    }

    console.log("Done. Verify the destination DB in Atlas.");
  } catch (e: any) {
    console.error("Migration failed:", e.message || e);
    process.exit(1);
  } finally {
    await srcClient.close().catch(()=>{});
    await dstClient.close().catch(()=>{});
  }
}

main();
