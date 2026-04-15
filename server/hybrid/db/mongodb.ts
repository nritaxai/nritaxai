import mongoose from "mongoose";

export type KnowledgeChunkMetadata = {
  source: string;
  documentTitle?: string;
  jurisdiction?: string;
  section?: string;
  page?: number;
  effectiveDate?: string;
  tags?: string[];
  [key: string]: unknown;
};

export type KnowledgeChunkRecord = {
  _id?: string;
  content: string;
  embedding: number[];
  metadata: KnowledgeChunkMetadata;
  score?: number;
};

const DEFAULT_COLLECTION = "knowledge_chunks";
const DEFAULT_VECTOR_INDEX = "vector_index";

let mongoConnectionPromise: Promise<typeof mongoose> | null = null;

const getMongoUri = (): string => {
  const mongoUri = String(process.env.MONGO_URI || "").trim();

  if (!mongoUri) {
    throw new Error("Missing required environment variable: MONGO_URI");
  }

  return mongoUri;
};

export const getHybridDbName = (): string | undefined => {
  const explicitName = String(process.env.HYBRID_MONGO_DB_NAME || process.env.MONGO_DB_NAME || "").trim();
  return explicitName || undefined;
};

export const getKnowledgeCollectionName = (): string => {
  return String(process.env.HYBRID_KNOWLEDGE_COLLECTION || DEFAULT_COLLECTION).trim() || DEFAULT_COLLECTION;
};

export const getVectorIndexName = (): string => {
  return String(process.env.HYBRID_VECTOR_INDEX || DEFAULT_VECTOR_INDEX).trim() || DEFAULT_VECTOR_INDEX;
};

export const connectHybridMongo = async (): Promise<typeof mongoose> => {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (!mongoConnectionPromise) {
    mongoConnectionPromise = mongoose.connect(getMongoUri(), {
      maxPoolSize: Number(process.env.HYBRID_MONGO_MAX_POOL_SIZE || 10),
      minPoolSize: Number(process.env.HYBRID_MONGO_MIN_POOL_SIZE || 1),
      serverSelectionTimeoutMS: Number(process.env.HYBRID_MONGO_SERVER_SELECTION_TIMEOUT_MS || 5000),
      socketTimeoutMS: Number(process.env.HYBRID_MONGO_SOCKET_TIMEOUT_MS || 15000),
    });
  }

  return mongoConnectionPromise;
};

const getHybridDb = () => {
  if (mongoose.connection.readyState !== 1) {
    throw new Error("MongoDB connection is not ready");
  }

  const dbName = getHybridDbName();
  return dbName ? mongoose.connection.useDb(dbName, { useCache: true }).db : mongoose.connection.db;
};

export const getKnowledgeCollection = async () => {
  await connectHybridMongo();

  const db = getHybridDb();
  if (!db) {
    throw new Error("MongoDB database handle is unavailable");
  }

  return db.collection<KnowledgeChunkRecord>(getKnowledgeCollectionName());
};

export const vectorSearchKnowledge = async ({
  queryVector,
  limit = 5,
  numCandidates = 100,
  minScore,
  filters,
}: {
  queryVector: number[];
  limit?: number;
  numCandidates?: number;
  minScore?: number;
  filters?: Record<string, unknown>;
}): Promise<KnowledgeChunkRecord[]> => {
  const collection = await getKnowledgeCollection();

  const pipeline: Record<string, unknown>[] = [
    {
      $vectorSearch: {
        index: getVectorIndexName(),
        path: "embedding",
        queryVector,
        numCandidates,
        limit,
        ...(filters ? { filter: filters } : {}),
      },
    },
    {
      $project: {
        content: 1,
        metadata: 1,
        embedding: 0,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ];

  if (typeof minScore === "number") {
    pipeline.push({
      $match: {
        score: { $gte: minScore },
      },
    });
  }

  const results = await collection.aggregate<KnowledgeChunkRecord>(pipeline).toArray();

  return results.map((item) => ({
    ...item,
    _id: item._id ? String(item._id) : undefined,
    score: typeof item.score === "number" ? item.score : 0,
  }));
};

export const upsertKnowledgeChunks = async (chunks: KnowledgeChunkRecord[]): Promise<number> => {
  if (!chunks.length) {
    return 0;
  }

  const collection = await getKnowledgeCollection();
  const operations = chunks.map((chunk) => ({
    updateOne: {
      filter: {
        "metadata.source": chunk.metadata.source,
        "metadata.chunkIndex": chunk.metadata.chunkIndex,
      },
      update: {
        $set: chunk,
      },
      upsert: true,
    },
  }));

  const result = await collection.bulkWrite(operations, { ordered: false });
  return result.upsertedCount + result.modifiedCount;
};
