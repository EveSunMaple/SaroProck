// src/components/comments/LoginForm.tsx
import type React from "react";
import { useEffect, useState } from "react";
import { SENSITIVE_USERS } from "@/config";
import { useUser } from "@/hooks/useUser";

const LoginForm: React.FC = () => {
  const { saveGuestUser } = useUser();

  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordRequired, setIsPasswordRequired] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState("/");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect");
    if (redirect) setRedirectUrl(redirect);
  }, []);

  useEffect(() => {
    const lowerNickname = nickname.trim().toLowerCase();
    const lowerEmail = email.trim().toLowerCase();
    if (
      SENSITIVE_USERS.includes(lowerNickname) ||
      SENSITIVE_USERS.includes(lowerEmail)
    ) {
      setIsPasswordRequired(true);
    } else {
      setIsPasswordRequired(false);
      setPassword("");
    }
  }, [nickname, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname || !email) {
      setError("昵称和邮箱不能为空");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      // 不论是否为管理员，我们都调用后端API
      // 后端会根据昵称和邮箱判断是否需要验证密码
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname,
          email,
          password, // 如果是普通用户，这里会是空字符串，后端不在意
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (data.isAdmin) {
          window.location.href = redirectUrl;
        } else {
          saveGuestUser({ nickname, email, website });
          window.location.href = redirectUrl;
        }
      } else {
        // 登录失败，显示后端返回的错误信息
        setError(data.message || "验证失败，请重试。");
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("网络错误，请稍后重试。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-base-100/80 border border-base-content/10 rounded-2xl shadow-lg backdrop-blur-md">
      <form className="p-6 md:p-8 space-y-6" onSubmit={handleSubmit}>
        <header className="space-y-1">
          <h2 className="text-2xl font-semibold flex items-center gap-2 text-primary">
            <i className="ri-user-smile-line text-xl" />
            留下你的足迹
          </h2>
          <p className="text-sm text-base-content/70">
            你的信息会保存在本地浏览器中，方便下次自动填入。
          </p>
        </header>

        <div className="space-y-4">
          <div className="form-control">
            <label
              htmlFor="nickname"
              className="label font-medium text-base-content mb-2"
            >
              昵称
              <span className="text-error ml-0.5">*</span>
            </label>
            <input
              type="text"
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="input input-bordered rounded-xl w-full"
              required
              minLength={2}
              maxLength={50}
              placeholder="你的昵称"
            />
          </div>

          <div className="form-control">
            <label
              htmlFor="email"
              className="label font-medium text-base-content mb-2"
            >
              邮箱
              <span className="text-error ml-0.5">*</span>
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input input-bordered rounded-xl w-full"
              required
              placeholder="用于生成头像，不会公开"
            />
          </div>

          <div className="form-control">
            <label
              htmlFor="website"
              className="label font-medium text-base-content mb-2"
            >
              网站
              <span className="text-base-content/50">(可选)</span>
            </label>
            <input
              type="url"
              id="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="input input-bordered rounded-xl w-full"
              placeholder="https://your.site"
            />
          </div>

          {isPasswordRequired && (
            <div className="form-control transition-all duration-300 animate-fade-in">
              <label
                htmlFor="admin-password"
                className="label font-medium text-base-content mb-2"
              >
                管理员密码
                <span className="text-error ml-0.5">*</span>
              </label>
              <input
                type="password"
                id="admin-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input input-bordered input-primary rounded-xl w-full"
                required
                placeholder="检测到管理员账户，请输入密码"
              />
            </div>
          )}
        </div>

        {error && (
          <div className="text-error text-sm text-center animate-shake">
            {error}
          </div>
        )}

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            className={`btn btn-primary rounded-lg gap-1 ${isSubmitting ? "loading" : ""}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? "处理中..." : "保存并返回"}
            <i className="ri-arrow-right-line" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default LoginForm;
