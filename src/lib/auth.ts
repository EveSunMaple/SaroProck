import type { APIContext } from "astro";
import { parse, serialize } from "cookie";
import jwt from "jsonwebtoken";

const JWT_SECRET = import.meta.env.JWT_SECRET;
const COOKIE_NAME = "auth_token";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 天

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined in environment variables.");
}

// 加密用户信息为 JWT
export function signJwt(payload: object): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: MAX_AGE });
}

// 解密并验证 JWT
export function verifyJwt(token: string): any | null {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error("JWT verification error:", error);
    return null;
  }
}

// 在响应中设置认证 cookie
export function setAuthCookie(response: Response, token: string): void {
  const cookie = serialize(COOKIE_NAME, token, {
    httpOnly: true, // 关键：防止客户端脚本访问
    secure: import.meta.env.PROD, // 生产环境中使用 HTTPS
    maxAge: MAX_AGE,
    path: "/",
    sameSite: "lax",
  });
  response.headers.set("Set-Cookie", cookie);
}

// 清除认证 cookie
export function clearAuthCookie(response: Response): void {
  const cookie = serialize(COOKIE_NAME, "", {
    maxAge: -1,
    path: "/",
  });
  response.headers.set("Set-Cookie", cookie);
}

// 从请求中获取管理员信息
export function getAdminUser(
  context: APIContext,
): { nickname: string; email: string; website: string; avatar: string } | null {
  const cookies = parse(context.request.headers.get("cookie") || "");
  const token = cookies[COOKIE_NAME];

  if (!token) {
    return null;
  }

  const payload = verifyJwt(token);

  if (payload && payload.isAdmin) {
    return {
      nickname: payload.nickname,
      email: payload.email,
      website: payload.website,
      avatar: payload.avatar,
    };
  }

  return null;
}
