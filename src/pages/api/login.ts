// src/pages/api/login.ts
import type { APIContext } from "astro";
import { ADMIN_USER } from "@/config";
import { setAuthCookie, signJwt } from "@/lib/auth";

export async function POST({ request }: APIContext): Promise<Response> {
  try {
    const { nickname, email, password } = await request.json();

    const secretPassword = import.meta.env.SECRET_ADMIN_PASSWORD;
    const SENSITIVE_USERS = ["ericzhao", "ericzhao3366", "EricZhao3366", "ERICZHAO","EricZhao", "admin", "博主", "ericzhao3366@dingtalk.com"];

    // 检查是否为敏感用户
    const isSensitive = SENSITIVE_USERS.includes(nickname.trim().toLowerCase()) || SENSITIVE_USERS.includes(email.trim().toLowerCase());

    if (!isSensitive) {
      // 对于非管理员，我们不进行密码验证，也不设置cookie，直接返回成功让前端处理
      // 或者您也可以在这里为普通用户创建一种不同的会话
      return new Response(JSON.stringify({ success: true, isAdmin: false }), { status: 200 });
    }

    // 是管理员，则必须验证密码
    if (!secretPassword) {
      return new Response(JSON.stringify({ success: false, message: "服务器未配置密码。" }), { status: 500 });
    }

    if (password === secretPassword) {
      // 密码正确，生成JWT
      const adminPayload = {
        nickname: ADMIN_USER.nickname,
        email: ADMIN_USER.email,
        website: ADMIN_USER.website,
        avatar: ADMIN_USER.avatar,
        isAdmin: true,
      };
      const token = signJwt(adminPayload);

      // 创建响应并设置HttpOnly cookie
      const response = new Response(JSON.stringify({ success: true, isAdmin: true, message: "验证成功" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
      setAuthCookie(response, token);

      return response;
    }
    else {
      // 密码错误
      return new Response(JSON.stringify({ success: false, message: "密码不正确" }), { status: 401 });
    }
  }
  catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ success: false, message: "无效的请求" }), { status: 400 });
  }
}
