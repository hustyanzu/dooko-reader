import { isElectron } from "react-device-detect";
import { ConfigService } from "../assets/lib/kookit-extra-browser.min";
import TokenService from "./storage/tokenService";

export const SELF_HOSTED_SERVICE = "docker";
const CONFIG_URL = "koodo-config.json";

export interface SelfHostedConfig {
  enabled?: boolean;
  username?: string;
  password?: string;
}

let cachedConfig: SelfHostedConfig | null = null;
let configPromise: Promise<SelfHostedConfig | null> | null = null;

export const getSelfHostedConfig = async (): Promise<SelfHostedConfig | null> => {
  if (cachedConfig !== null) {
    return cachedConfig;
  }
  if (!configPromise) {
    configPromise = (async () => {
      try {
        const response = await fetch(CONFIG_URL, {
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) {
          cachedConfig = {};
          return cachedConfig;
        }
        cachedConfig = await response.json();
      } catch (error) {
        console.error("Failed to load koodo-config.json:", error);
        cachedConfig = {};
      }
      return cachedConfig;
    })();
  }
  return configPromise;
};

export const isSelfHosted = async (): Promise<boolean> => {
  if (isElectron) {
    return false;
  }
  const config = await getSelfHostedConfig();
  return !!config && config.enabled === true;
};

export const isSelfHostedMode = (): boolean => {
  return ConfigService.getItem("isSelfHosted") === "yes";
};

const getBinding = async (): Promise<{
  url: string;
  username: string;
  password: string;
}> => {
  const config = await getSelfHostedConfig();
  return {
    url: window.location.origin,
    username: config?.username || "admin",
    password: config?.password || "securePass123",
  };
};

export const ensureSelfHostedBinding = async (): Promise<void> => {
  const selfHosted = await isSelfHosted();
  ConfigService.setItem("isSelfHosted", selfHosted ? "yes" : "no");
  if (!selfHosted) {
    return;
  }
  const binding = await getBinding();
  await TokenService.setToken(
    SELF_HOSTED_SERVICE + "_token",
    JSON.stringify(binding)
  );
  // Self-hosted deployments have no Koodo account, but the reading engine
  // gates book download/upload on the is_authed token. Treat self-hosted
  // users as authed so books can be opened, uploaded and covers synced.
  await TokenService.setToken("is_authed", "yes");
  const dataSourceList =
    ConfigService.getAllListConfig("dataSourceList") || [];
  if (!dataSourceList.includes(SELF_HOSTED_SERVICE)) {
    ConfigService.setListConfig(SELF_HOSTED_SERVICE, "dataSourceList");
  }
  ConfigService.setItem("defaultSyncOption", SELF_HOSTED_SERVICE);
};

export const getSelfHostedBinding = async (): Promise<{
  url: string;
  username: string;
  password: string;
} | null> => {
  if (!(await isSelfHosted())) {
    return null;
  }
  return getBinding();
};

const AUTH_COOKIE = "dooko_auth";

export const isWebAuthed = (): boolean => {
  if (document.cookie.indexOf(AUTH_COOKIE + "=1") > -1) {
    return true;
  }
  return localStorage.getItem(AUTH_COOKIE) === "1";
};

export const setWebAuthed = (): void => {
  document.cookie = AUTH_COOKIE + "=1; max-age=2592000; path=/; SameSite=Lax";
  localStorage.setItem(AUTH_COOKIE, "1");
};

export const clearWebAuth = (): void => {
  document.cookie = AUTH_COOKIE + "=; max-age=0; path=/";
  localStorage.removeItem(AUTH_COOKIE);
};

// 从服务器重建本站浏览器状态：清空 localStorage 与 IndexedDB 后重新加载。
// 全新客户端在 bootstrap 时只会从服务器拉取，不会把旧记录推回覆盖服务器。
export const resetLocalFromServer = async (): Promise<void> => {
  localStorage.clear();
  try {
    const dbs = await indexedDB.databases();
    for (const db of dbs) {
      if (db.name) {
        indexedDB.deleteDatabase(db.name);
      }
    }
  } catch (error) {
    console.error("Failed to delete IndexedDB databases:", error);
  }
  window.location.reload();
};

export const verifyWebPassword = async (password: string): Promise<boolean> => {
  const config = await getSelfHostedConfig();
  const expected = config?.password || "securePass123";
  return password === expected;
};
