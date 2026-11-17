import { useEffect, useRef } from "react";
import "./settingDialog.css";
import { useAppStore } from "../../../store/useAppStore";
import { Trans } from "react-i18next";
import GeneralSetting from "../../../containers/settings/generalSetting";
import ReadingSetting from "../../../containers/settings/readingSetting";
import AppearanceSetting from "../../../containers/settings/appearanceSetting";
import DataSetting from "../../../containers/settings/dataSetting";
import AISetting from "../../../containers/settings/aiSetting";
import BackgroundSetting from "../../../containers/settings/backgroundSetting";
import FontSetting from "../../../containers/settings/fontSetting";
import ChapterSetting from "../../../containers/settings/chapterSetting";
import TextSetting from "../../../containers/settings/textSetting";
import DictSetting from "../../../containers/settings/dictSetting";
import ShortcutSetting from "../../../containers/settings/shortcutSetting";
import { isElectron } from "react-device-detect";
const SettingDialog = () => {
  const settingMode = useAppStore((s) => s.manager.settingMode);
  const handleSetting = useAppStore((s) => s.handleSetting);
  const handleFetchPlugins = useAppStore((s) => s.handleFetchPlugins);
  const handleFetchDataSourceList = useAppStore(
    (s) => s.handleFetchDataSourceList
  );
  const handleFetchDefaultSyncOption = useAppStore(
    (s) => s.handleFetchDefaultSyncOption
  );
  const handleSettingMode = useAppStore((s) => s.handleSettingMode);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    handleFetchPlugins();
    handleFetchDataSourceList();
    handleFetchDefaultSyncOption();
  }, []);

  useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
  }, [settingMode]);

  const renderSidebarItem = (
    mode: string,
    iconClass: string,
    labelKey: string,
    fontSize: string
  ) => {
    const isActive = settingMode === mode;
    return (
      <div
        className={"setting-dialog-sidebar-item" + (isActive ? " active" : "")}
        onClick={() => {
          handleSettingMode(mode);
        }}
      >
        <span
          className={"setting-dialog-sidebar-icon " + iconClass}
          style={fontSize ? { fontSize } : {}}
        ></span>
        <Trans>{labelKey}</Trans>
      </div>
    );
  };

  const getCurrentPageTitle = () => {
    switch (settingMode) {
      case "general":
        return "General";
      case "reading":
        return "Reading";
      case "shortcut":
        return "Shortcuts";
      case "appearance":
        return "Appearance";
      case "ai":
        return "AI service";
      case "background":
        return "Background";
      case "font":
        return "Font management";
      case "chapter":
        return "TXT parser";
      case "text":
        return "Text rules";
      case "dict":
        return "Local dictionary";
      default:
        return "Setting";
    }
  };

  return (
      <div className="setting-dialog-container">
        {/* Left sidebar */}
        <div className="setting-dialog-sidebar">
          <div className="setting-dialog-sidebar-title">
            <Trans>Setting</Trans>
          </div>

          {/* First group */}
          <div className="setting-dialog-sidebar-group">
            {renderSidebarItem("general", "icon-setting", "General", "")}
            {renderSidebarItem("data", "icon-archive", "Data", "15px")}
            {renderSidebarItem(
              "reading",
              "icon-bookshelf-line",
              "Reading",
              ""
            )}
            {renderSidebarItem(
              "shortcut",
              "icon-keyboard",
              "Shortcuts",
              ""
            )}
            {renderSidebarItem(
              "appearance",
              "icon-highlight-line",
              "Appearance",
              "20px"
            )}
          </div>

          <hr className="setting-dialog-sidebar-divider" />

          {/* Second group */}
          <div className="setting-dialog-sidebar-group">
            {renderSidebarItem(
              "ai",
              "icon-idea-line",
              "AI service",
              "18px"
            )}
            {renderSidebarItem(
              "background",
              "icon-image",
              "Background",
              "18px"
            )}
            {renderSidebarItem(
              "font",
              "icon-font",
              "Font management",
              "18px"
            )}
            {renderSidebarItem(
              "chapter",
              "icon-convert-text",
              "TXT parser",
              "19px"
            )}
            {renderSidebarItem(
              "text",
              "icon-edit-line",
              "Text rules",
              "18px"
            )}
            {isElectron &&
              renderSidebarItem(
                "dict",
                "icon-address-book",
                "Local dictionary",
                "18px"
              )}
          </div>
        </div>

        {/* 右侧主内容区 */}
        <div className="setting-dialog-main">
          <div className="setting-dialog-main-header">
            <Trans>{getCurrentPageTitle()}</Trans>
          </div>

          <div
            className="setting-close-container"
            onClick={() => {
              handleSetting(false);
              handleSettingMode("general");
            }}
          >
            <span className="icon-close setting-close"></span>
          </div>

          <div className="setting-dialog-info" ref={contentRef}>
            {settingMode === "general" ? (
              <GeneralSetting />
            ) : settingMode === "reading" ? (
              <ReadingSetting />
            ) : settingMode === "shortcut" ? (
              <ShortcutSetting />
            ) : settingMode === "appearance" ? (
              <AppearanceSetting />
            ) : settingMode === "data" ? (
              <DataSetting />
            ) : settingMode === "ai" ? (
              <AISetting />
            ) : settingMode === "background" ? (
              <BackgroundSetting />
            ) : settingMode === "font" ? (
              <FontSetting />
            ) : settingMode === "chapter" ? (
              <ChapterSetting />
            ) : settingMode === "text" ? (
              <TextSetting />
            ) : settingMode === "dict" ? (
              <DictSetting />
            ) : (
              <GeneralSetting />
            )}
          </div>
        </div>
      </div>
  );
};

export default SettingDialog;
