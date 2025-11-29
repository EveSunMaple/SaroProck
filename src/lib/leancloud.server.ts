// src/lib/leancloud.server.ts
import AV from "leancloud-storage";

// Initialize at module level
const appId = import.meta.env.LEANCLOUD_APP_ID;
const appKey = import.meta.env.LEANCLOUD_APP_KEY;
const masterKey = import.meta.env.LEANCLOUD_MASTER_KEY;
const serverURL = import.meta.env.LEANCLOUD_SERVER_URL;

if (!appId || !appKey || !serverURL) {
  throw new Error("Missing required environment variables for LeanCloud");
}

AV.init({
  appId,
  appKey,
  masterKey,
  serverURL,
});

// biome-ignore lint/correctness/useHookAtTopLevel: <>
AV.Cloud.useMasterKey();

export function initLeanCloud() {
  // Initialization is done at module level
  return AV;
}
