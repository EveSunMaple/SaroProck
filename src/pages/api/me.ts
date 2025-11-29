// src/pages/api/me.ts
import type { APIContext } from "astro";
import { getAdminUser } from "@/lib/auth";

export async function GET(context: APIContext): Promise<Response> {
  const adminUser = getAdminUser(context);

  if (adminUser) {
    // 如果 token 有效，返回管理员信息
    return new Response(
      JSON.stringify({
        isLoggedIn: true,
        isAdmin: true,
        nickname: adminUser.nickname,
        website: adminUser.website,
        email: adminUser.email,
        avatar: adminUser.avatar,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // 如果没有 token 或 token 无效，返回未登录状态
  return new Response(JSON.stringify({ isLoggedIn: false, isAdmin: false }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
