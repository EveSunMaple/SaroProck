import fs from "node:fs";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const {
  LEANCLOUD_APP_ID,
  LEANCLOUD_MASTER_KEY,
  LEANCLOUD_SERVER_URL,
} = process.env;

// ====== 你的所有 Class ======
// 注意：PostLikeLog 是一个遗留Class，当前代码中未使用，已被移除
const CLASS_LIST = [
  "Comment",
  "CommentLike",
  "DailyViews",
  "PostLikes",
  "PostViews",
  "TelegramComment",
  "TelegramCommentLike",
];

if (!LEANCLOUD_APP_ID || !LEANCLOUD_MASTER_KEY || !LEANCLOUD_SERVER_URL) {
  console.error("缺少 LeanCloud 环境变量");
  process.exit(1);
}

const client = axios.create({
  baseURL: `${LEANCLOUD_SERVER_URL}/1.1`,
  headers: {
    "X-LC-Id": LEANCLOUD_APP_ID,
    "X-LC-Key": `${LEANCLOUD_MASTER_KEY},master`,
    "Content-Type": "application/json",
  },
});

async function fetchAll(className) {
  const limit = 100;
  let skip = 0;
  let all = [];

  while (true) {
    console.log(`Fetching ${className} skip=${skip}`);

    const res = await client.get(`/classes/${className}`, {
      params: {
        limit,
        skip,
        order: "createdAt",
      },
    });

    const data = res.data.results;
    all = all.concat(data);

    if (data.length < limit) break;
    skip += limit;

    // 防止限流
    await new Promise((r) => setTimeout(r, 200));
  }

  return all;
}

async function exportOne(className) {
  const data = await fetchAll(className);

  const dir = "leancloud-backup";
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  const filePath = `${dir}/${className}.json`;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");

  console.log(`✔ ${className} 导出完成，共 ${data.length} 条`);
}

async function main() {
  console.log("开始全量导出 LeanCloud…\n");

  for (const name of CLASS_LIST) {
    try {
      await exportOne(name);
    } catch (err) {
      console.error(`✘ ${name} 导出失败`, err.response?.data || err);
    }
  }

  console.log("\n全部导出完成！");
}

main();