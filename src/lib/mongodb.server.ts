import { type Collection, type Db, MongoClient, ObjectId } from "mongodb";

const uri = import.meta.env.MONGODB_URI;

if (!uri) {
  throw new Error("Missing MONGODB_URI environment variable");
}

const client = new MongoClient(uri);

let db: Db;

export async function getDb(): Promise<Db> {
  if (!db) {
    await client.connect();
    db = client.db();
  }
  return db;
}

export async function getCollection<T extends keyof Collections>(
  name: T,
): Promise<Collection<Collections[T]>> {
  const database = await getDb();
  return database.collection<Collections[T]>(name);
}

export function toObjectId(id: string): ObjectId {
  return new ObjectId(id);
}

export function fromObjectId(objectId: ObjectId): string {
  return objectId.toString();
}

// Document interfaces
export interface Comment {
  _id?: ObjectId | string;
  objectId?: string; // Keep for backward compatibility if needed
  slug: string;
  username: string;
  nickname?: string;
  email: string;
  content: string;
  html?: string;
  parent?: ObjectId | string | null;
  ip?: string;
  ua?: string;
  status?: "approved" | "pending" | "spam";
  isHost?: boolean;
  isAdmin?: boolean;
  avatar?: string;
  website?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CommentLike {
  _id?: ObjectId | string;
  objectId?: string;
  comment: ObjectId | string;
  ip?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TelegramComment {
  _id?: ObjectId | string;
  objectId?: string;
  slug: string;
  username: string;
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
  messageId: number;
  content: string;
  html?: string;
  parent?: ObjectId | string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TelegramCommentLike {
  _id?: ObjectId | string;
  objectId?: string;
  comment: ObjectId | string;
  telegramId?: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PostLikes {
  _id?: ObjectId | string;
  objectId?: string;
  postId: string;
  likes: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PostViews {
  _id?: ObjectId | string;
  objectId?: string;
  slug: string;
  views: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DailyViews {
  _id?: ObjectId | string;
  objectId?: string;
  date: string; // YYYY-MM-DD format
  views: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// Collections type map
export interface Collections {
  comments: Comment;
  comment_likes: CommentLike;
  telegram_comments: TelegramComment;
  telegram_comment_likes: TelegramCommentLike;
  post_likes: PostLikes;
  post_views: PostViews;
  daily_views: DailyViews;
}

// Graceful shutdown
export async function closeConnection(): Promise<void> {
  await client.close();
}

process.on("SIGINT", async () => {
  await closeConnection();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeConnection();
  process.exit(0);
});
