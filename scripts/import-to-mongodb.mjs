import fs from "node:fs";
import { MongoClient, ServerApiVersion } from "mongodb";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ 缺少 MONGODB_URI 环境变量");
  console.log("请确保在 .env 文件中设置 MONGODB_URI");
  console.log("格式: mongodb+srv://username:password@cluster.mongodb.net/databaseName");
  process.exit(1);
}

// MongoDB collection 映射
const COLLECTIONS = [
  { file: "Comment.json", collection: "comments" },
  { file: "CommentLike.json", collection: "comment_likes" },
  { file: "DailyViews.json", collection: "daily_views" },
  { file: "PostLikes.json", collection: "post_likes" },
  { file: "PostViews.json", collection: "post_views" },
  { file: "TelegramComment.json", collection: "telegram_comments" },
  { file: "TelegramCommentLike.json", collection: "telegram_comment_likes" },
];

async function connectToMongoDB() {
  const client = new MongoClient(MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

  try {
    await client.connect();
    console.log("✅ 成功连接到 MongoDB");
    return client;
  } catch (error) {
    console.error("❌ 连接 MongoDB 失败:", error.message);
    process.exit(1);
  }
}

async function importCollection(client, filePath, collectionName) {
  try {
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  跳过: ${filePath} 不存在`);
      return;
    }

    // 读取JSON文件
    const rawData = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(rawData);

    if (!Array.isArray(data) || data.length === 0) {
      console.log(`⚠️  跳过: ${collectionName} 没有数据`);
      return;
    }

    const collection = client.db().collection(collectionName);

    // 清空现有数据
    await collection.deleteMany({});
    console.log(`🗑️  已清空 ${collectionName} 集合`);

    // 转换LeanCloud的objectId为MongoDB的_id
    const documents = data.map((item) => {
      const { objectId, ...rest } = item;
      return {
        _id: objectId,
        ...rest,
        // 确保createdAt和updatedAt是Date对象
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      };
    });

    // 批量插入数据
    const result = await collection.insertMany(documents);
    console.log(`✅ ${collectionName}: 成功导入 ${result.insertedCount} 条记录`);

    // 创建索引
    await createIndexes(collection, collectionName);

  } catch (error) {
    console.error(`❌ 导入 ${collectionName} 失败:`, error.message);
  }
}

async function createIndexes(collection, collectionName) {
  try {
    switch (collectionName) {
      case "comments":
        await collection.createIndex({ slug: 1 });
        await collection.createIndex({ email: 1 });
        await collection.createIndex({ createdAt: -1 });
        console.log(`   🗂️  创建索引: slug, email, createdAt`);
        break;
      case "telegram_comments":
        await collection.createIndex({ postId: 1 });
        await collection.createIndex({ createdAt: -1 });
        console.log(`   🗂️  创建索引: postId, createdAt`);
        break;
      case "comment_likes":
        await collection.createIndex({ commentId: 1 });
        await collection.createIndex({ slug: 1 });
        console.log(`   🗂️  创建索引: commentId, slug`);
        break;
      case "telegram_comment_likes":
        await collection.createIndex({ commentId: 1 });
        await collection.createIndex({ postId: 1 });
        console.log(`   🗂️  创建索引: commentId, postId`);
        break;
      case "post_likes":
        await collection.createIndex({ postId: 1 }, { unique: true });
        console.log(`   🗂️  创建索引: postId (唯一)`);
        break;
      case "post_views":
        await collection.createIndex({ slug: 1 }, { unique: true });
        console.log(`   🗂️  创建索引: slug (唯一)`);
        break;
      case "daily_views":
        await collection.createIndex({ date: 1 }, { unique: true });
        await collection.createIndex({ createdAt: -1 });
        console.log(`   🗂️  创建索引: date (唯一), createdAt`);
        break;
    }
  } catch (error) {
    console.error(`   ❌ 创建索引失败:`, error.message);
  }
}

async function main() {
  console.log("🚀 开始导入 LeanCloud 数据到 MongoDB...\n");

  // 检查备份目录
  const backupDir = "leancloud-backup";
  if (!fs.existsSync(backupDir)) {
    console.error(`❌ 找不到备份目录: ${backupDir}`);
    console.log("请先运行: node scripts/export-all-leancloud.mjs");
    process.exit(1);
  }

  const client = await connectToMongoDB();

  try {
    // 遍历所有集合
    for (const { file, collection } of COLLECTIONS) {
      const filePath = path.join(backupDir, file);
      console.log(`\n📄 处理: ${file} → ${collection}`);
      await importCollection(client, filePath, collection);
    }

    console.log("\n✨ 数据导入完成！");

    // 显示数据库统计
    const collections = await client.db().listCollections().toArray();

    console.log("\n📊 数据库统计:");
    for (const colInfo of collections) {
      const count = await client.db().collection(colInfo.name).countDocuments();
      console.log(`   ${colInfo.name}: ${count} 条记录`);
    }

  } catch (error) {
    console.error("❌ 导入过程出错:", error);
  } finally {
    await client.close();
    console.log("\n👋 数据库连接已关闭");
  }
}

main();
