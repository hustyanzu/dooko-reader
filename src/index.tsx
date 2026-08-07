import React, { useState } from "react";
import ReactDOM from "react-dom";
import "./assets/styles/reset.css";
import "./assets/styles/global.css";
import "./assets/styles/style.css";
import { Provider } from "react-redux";
import "./i18n";
import store from "./store";
import Router from "./router/index";
import StyleUtil from "./utils/reader/styleUtil";
import {
  initSystemFont,
  initTheme,
  applyCustomSystemCSS,
  applyAppBackgroundImage,
} from "./utils/reader/launchUtil";
import { migrateConfig } from "./utils/common";
import {
  ensureSelfHostedBinding,
  getSelfHostedBinding,
  isSelfHostedMode,
  isWebAuthed,
} from "./utils/selfHosted";
import ConfigUtil from "./utils/file/configUtil";
import LoginGate from "./components/loginGate/component";
import {
  ConfigService,
} from "./assets/lib/kookit-extra-browser.min";
const container = document.getElementById("root")!;
const AppEntry = () => {
  const [authed, setAuthed] = useState(
    !isSelfHostedMode() || isWebAuthed()
  );
  if (isSelfHostedMode() && !authed) {
    return <LoginGate onSuccess={() => setAuthed(true)} />;
  }
  return (
    <Provider store={store}>
      <Router />
    </Provider>
  );
};
const patchSettingsWriteThrough = async () => {
  const binding = await getSelfHostedBinding();
  const originalSetReaderConfig = ConfigService.setReaderConfig.bind(
    ConfigService
  );
  let timer: any = null;
  let pending = false;
  const uploadNow = async () => {
    pending = false;
    try {
      await ConfigUtil.uploadConfig("config");
    } catch (error) {
      console.error("Failed to upload config:", error);
    }
  };
  const scheduleUpload = () => {
    clearTimeout(timer);
    pending = true;
    timer = setTimeout(uploadNow, 2000);
  };
  const flushBeforeExit = () => {
    if (!pending) {
      return;
    }
    clearTimeout(timer);
    pending = false;
    try {
      const config = JSON.stringify(ConfigUtil.dumpConfig("config"));
      const formData = new FormData();
      formData.append(
        "file",
        new Blob([config], { type: "application/json" }),
        "config.json"
      );
      fetch(window.location.origin + "/upload?dir=config", {
        method: "POST",
        body: formData,
        keepalive: true,
        headers: binding
          ? {
              Authorization:
                "Basic " +
                btoa(binding.username + ":" + binding.password),
            }
          : {},
      }).catch(() => {});
    } catch (error) {
      console.error("Failed to flush config before exit:", error);
    }
  };
  (ConfigService as any).setReaderConfig = (...args: any[]) => {
    originalSetReaderConfig(...args);
    scheduleUpload();
  };
  window.addEventListener("pagehide", flushBeforeExit);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushBeforeExit();
    }
  });
};
const bootstrap = async () => {
  await ensureSelfHostedBinding();
  if (isSelfHostedMode()) {
    try {
      const configStr = await ConfigUtil.downloadConfig("config");
      await ConfigUtil.loadConfig("config", configStr || "{}");
    } catch (error) {
      console.error("Failed to load server config:", error);
    }
    await patchSettingsWriteThrough();
  }
  initTheme();
  initSystemFont();
  migrateConfig();
  applyCustomSystemCSS();
  applyAppBackgroundImage();
  ReactDOM.render(<AppEntry />, container);
  StyleUtil.applyTheme();
};
bootstrap();
