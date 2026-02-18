// API 迁移代码片段 - 供参考
// 这些代码展示了如何将 LeanCloud API 调用替换为 MongoDB 调用

// ==========================================
// 1. 基础查询示例
// ==========================================

// LeanCloud 查询方式
// const query = new AV.Query("Comment");
// query.equalTo("slug", "my-post");
// query.descending("createdAt");
// query.limit(10);
// const results = await query.find();

// MongoDB 查询方式
// const collection = await getCollection("comments");
// const results = await collection
//   .find({ slug: "my-post" })
//   .sort({ createdAt: -1 })
//   .limit(10)
//   .toArray();

// ==========================================
// 2. 带条件的查询
// ==========================================

// LeanCloud
// const query = new AV.Query("Comment");
// query.equalTo("slug", slug);
// query.greaterThan("createdAt", new Date("2025-01-01"));
// const count = await query.count();

// MongoDB
// const collection = await getCollection("comments");
// const count = await collection.countDocuments({
//   slug: slug,
//   createdAt: { $gt: new Date("2025-01-01") }
// });

// ==========================================
// 3. 创建/插入数据
// ==========================================

// LeanCloud
// const Comment = AV.Object.extend("Comment");
// const comment = new Comment();
// comment.set("slug", "my-post");
// comment.set("content", "Hello");
// comment.set("author", "User");
// const result = await comment.save();

// MongoDB
// const collection = await getCollection("comments");
// const result = await collection.insertOne({
//   slug: "my-post",
//   content: "Hello",
//   author: "User",
//   createdAt: new Date(),
//   updatedAt: new Date()
// });

// ==========================================
// 4. 更新数据
// ==========================================

// LeanCloud
// const query = new AV.Query("Comment");
// const comment = await query.get(objectId);
// comment.set("content", "Updated content");
// await comment.save();

// MongoDB
// const collection = await getCollection("comments");
// await collection.updateOne(
//   { _id: objectId },
//   {
//     $set: {
//       content: "Updated content",
//       updatedAt: new Date()
//     }
//   }
// );

// ==========================================
// 5. 删除数据
// ==========================================

// LeanCloud
// const query = new AV.Query("Comment");
// const comment = await query.get(objectId);
// await comment.destroy();

// MongoDB
// const collection = await getCollection("comments");
// await collection.deleteOne({ _id: objectId });

// ==========================================
// 6. 聚合查询
// ==========================================

// 统计每篇文章的评论数
// LeanCloud
// const query = new AV.Query("Comment");
// query.equalTo("slug", slug);
// const count = await query.count();

// MongoDB
// const collection = await getCollection("comments");
// const count = await collection.countDocuments({ slug });

// ==========================================
// 7. 批量操作
// ==========================================

// MongoDB 批量插入
// const collection = await getCollection("comments");
// await collection.insertMany([
//   { slug: "post1", content: "Comment 1", createdAt: new Date() },
//   { slug: "post1", content: "Comment 2", createdAt: new Date() },
//   { slug: "post2", content: "Comment 3", createdAt: new Date() }
// ]);

// ==========================================
// 8. 分页查询
// ==========================================

// MongoDB 分页
// const collection = await getCollection("comments");
// const page = 2;
// const pageSize = 10;
// const comments = await collection
//   .find({ slug: "my-post" })
//   .sort({ createdAt: -1 })
//   .skip((page - 1) * pageSize)
//   .limit(pageSize)
//   .toArray();

// ==========================================
// 9. 数组操作
// ==========================================

// 向数组字段添加元素
// await collection.updateOne(
//   { _id: postId },
//   { $push: { tags: "new-tag" } }
// );

// 从数组字段删除元素
// await collection.updateOne(
//   { _id: postId },
//   { $pull: { tags: "old-tag" } }
// );

// ==========================================
// 10. 事务处理（多集合更新）
// ==========================================

// const client = await getMongoClient(); // 获取 MongoClient
// const session = client.startSession();

// try {
//   await session.withTransaction(async () => {
//     const commentsCollection = client.db("saroprock").collection("comments");
//     const likesCollection = client.db("saroprock").collection("comment_likes");

//     // 在同一个事务中执行多个操作
//     await commentsCollection.insertOne(
//       { slug: "my-post", content: "Comment", createdAt: new Date() },
//       { session }
//     );

//     await likesCollection.updateOne(
//       { slug: "my-post" },
//       { $inc: { count: 1 } },
//       { session }
//     );
//   });
// } catch (error) {
//   console.error("Transaction failed:", error);
// } finally {
//   await session.endSession();
// }

// ==========================================
// 11. 索引示例
// ==========================================

// 创建索引
// await collection.createIndex({ slug: 1 });  // 单字段索引
// await collection.createIndex({ slug: 1, createdAt: -1 });  // 复合索引
// await collection.createIndex({ email: 1 }, { unique: true });  // 唯一索引

// 查看索引
// const indexes = await collection.getIndexes();

// ==========================================
// 12. 复杂查询
// ==========================================

// 查询多个条件
// const results = await collection.find({
//   slug: "my-post",
//   createdAt: { $gte: new Date("2025-01-01") },
//   $or: [
//     { author: "User1" },
//     { author: "User2" }
//   ]
// }).toArray();

// 使用正则表达式
// const results = await collection.find({
//   content: { $regex: /hello/i }  // i 表示不区分大小写
// }).toArray();

// ==========================================
// 13. 聚合查询（高级）
// ==========================================

// 统计每篇文章的评论数量
// const results = await collection.aggregate([
//   { $group: { _id: "$slug", count: { $sum: 1 } } },
//   { $sort: { count: -1 } }
// ]).toArray();

// ==========================================
// 14. 错误处理
// ==========================================

// try {
//   const collection = await getCollection("comments");
//   const result = await collection.insertOne(data);
//   return result;
// } catch (error) {
//   if (error.code === 11000) {  // 唯一索引冲突
//     console.error("Duplicate key error");
//   } else if (error.name === "MongoError") {
//     console.error("Database error:", error.message);
//   } else {
//     console.error("Unknown error:", error);
//   }
//   throw error;
// }

// ==========================================
// 15. 数据验证（Schema）
// ==========================================

// 在 MongoDB 中，可以在应用层实现数据验证

// interface Comment {
//   slug: string;
//   content: string;
//   author: string;
//   email: string;
//   createdAt: Date;
//   updatedAt: Date;
// }

// function validateComment(data: any): data is Comment {
//   return (
//     typeof data.slug === "string" &&s
//     typeof data.content === "string" &&
//     typeof data.author === "string" &&
//     typeof data.email === "string" &&
//     data.createdAt instanceof Date &&
//     data.updatedAt instanceof Date
//   );
// }

// ==========================================
// 快速参考表
// ==========================================

/*
LeanCloud Query    -> MongoDB Query
----------------   -----------------
query.equalTo()    -> { field: value }
query.notEqualTo() -> { field: { $ne: value } }
query.greaterThan() -> { field: { $gt: value } }
query.lessThan() -> { field: { $lt: value } }
query.containedIn() -> { field: { $in: array } }
query.notContainedIn() -> { field: { $nin: array } }
query.exists() -> { field: { $exists: true } }
query.matches() -> { field: { $regex: pattern } }
query.ascending() -> .sort({ field: 1 })
query.descending() -> .sort({ field: -1 })
query.limit() -> .limit(n)
query.skip() -> .skip(n)
query.count() -> .countDocuments(query)
query.find() -> .find(query).toArray()
query.first() -> .findOne(query)
query.get(id) -> .findOne({ _id: id })

LeanCloud Operation -> MongoDB Operation
-------------------  --------------------
object.set() -> $set
object.increment() -> $inc
object.add() -> $push
object.remove() -> $pull
object.destroy() -> deleteOne()
*/
