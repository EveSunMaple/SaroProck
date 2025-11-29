import md5 from "md5";
import { useCallback, useEffect, useState } from "react";

export interface User {
  nickname: string;
  email: string;
  website?: string;
  avatar: string;
  isAdmin: boolean;
}

const GUEST_USER_STORAGE_KEY = "guest_user";

export const useUser = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const checkUserStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      // 检查管理员登录状态
      const response = await fetch("/api/me");
      const data = await response.json();

      if (response.ok && data.isLoggedIn) {
        setUser({
          nickname: data.nickname,
          email: data.email,
          website: data.website,
          avatar: data.avatar,
          isAdmin: true,
        });
        setIsLoggedIn(true);
      } else {
        // 如果不是管理员，检查本地访客信息
        const storedGuest = localStorage.getItem(GUEST_USER_STORAGE_KEY);
        if (storedGuest) {
          const guestUser = JSON.parse(storedGuest);
          setUser(guestUser);
          setIsLoggedIn(true); // 访客也视为“已登录”状态
        } else {
          setUser(null);
          setIsLoggedIn(false);
        }
      }
    } catch (error) {
      console.error("Error checking user status:", error);
      setUser(null);
      setIsLoggedIn(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 在 hook 初始化时自动检查一次状态
  useEffect(() => {
    checkUserStatus();
  }, [checkUserStatus]);

  const saveGuestUser = (userInfo: {
    nickname: string;
    email: string;
    website?: string;
  }) => {
    const emailHash = md5(userInfo.email.trim().toLowerCase());
    const avatar = `https://cravatar.cn/avatar/${emailHash}?d=mp`;

    const guestData: User = {
      ...userInfo,
      avatar,
      isAdmin: false,
    };

    localStorage.setItem(GUEST_USER_STORAGE_KEY, JSON.stringify(guestData));
    setUser(guestData);
    setIsLoggedIn(true);
  };

  const logout = useCallback(async () => {
    // 首先调用后端登出接口，清除 httpOnly cookie
    await fetch("/api/logout", { method: "POST" });

    // 然后清除本地的访客信息
    localStorage.removeItem(GUEST_USER_STORAGE_KEY);

    // 最后重置前端状态
    setUser(null);
    setIsLoggedIn(false);
  }, []);

  return {
    user,
    isLoggedIn,
    isLoading,
    checkUserStatus,
    saveGuestUser,
    logout,
  };
};
