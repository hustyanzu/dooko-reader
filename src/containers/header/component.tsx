import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import "./header.css";
import SearchBox from "../../components/searchBox";
import ImportLocal from "../../components/importLocal";
import {
  ConfigService,
  KookitConfig,
  KOReaderUtil,
  CollectionUtil,
} from "../../assets/lib/kookit-extra-browser.min";
import { isElectron } from "react-device-detect";
import {
  getCloudConfig,
  upgradeConfig,
  upgradeStorage,
} from "../../utils/file/common";
import toast from "react-hot-toast";
import { Trans } from "react-i18next";
import { SyncHelper } from "../../assets/lib/kookit-extra-browser.min";
import ConfigUtil from "../../utils/file/configUtil";
import DatabaseService from "../../utils/storage/databaseService";
import CoverUtil from "../../utils/file/coverUtil";
import BookUtil from "../../utils/file/bookUtil";
import {
  checkBrokenDatabase,
  checkMissingBook,
  getBookPartialMd5,
  getTaskStats,
  scanFolderForNewBooks,
  showTaskProgress,
  AUTO_IMPORT_FOLDERS_KEY,
} from "../../utils/common";
import { driveList } from "../../constants/driveList";
import { LocalFileManager } from "../../utils/file/localFile";
import { isSelfHostedMode } from "../../utils/selfHosted";
import TokenService from "../../utils/storage/tokenService";
import { useAppStore } from "../../store/useAppStore";

export interface HeaderProps {
  handleDrag: (isDrag: boolean) => void;
}

export interface HeaderState {
  isSync: boolean;
}

const collectionUtil = new CollectionUtil(ConfigService);
declare var window: any;

const Header = (props: HeaderProps) => {
  const isCollapsed = useAppStore((s) => s.sidebar.isCollapsed);
  const currentBook = useAppStore((s) => s.book.currentBook);
  const defaultSyncOption = useAppStore((s) => s.backupPage.defaultSyncOption);
  const userInfo = useAppStore((s) => s.manager.userInfo);
  const isSortDisplay = useAppStore((s) => s.manager.isSortDisplay);
  const handleSortDisplay = useAppStore((s) => s.handleSortDisplay);
  const handleLocalFileDialog = useAppStore((s) => s.handleLocalFileDialog);
  const handleSetting = useAppStore((s) => s.handleSetting);
  const handleSettingMode = useAppStore((s) => s.handleSettingMode);
  const handleAbout = useAppStore((s) => s.handleAbout);
  const handleFetchBooks = useAppStore((s) => s.handleFetchBooks);
  const handleFetchNotes = useAppStore((s) => s.handleFetchNotes);
  const handleFetchBookmarks = useAppStore((s) => s.handleFetchBookmarks);
  const handleFetchAuthed = useAppStore((s) => s.handleFetchAuthed);
  const handleFetchDefaultSyncOption = useAppStore(
    (s) => s.handleFetchDefaultSyncOption
  );
  const handleFetchDataSourceList = useAppStore(
    (s) => s.handleFetchDataSourceList
  );
  const handleCloudSyncFunc = useAppStore((s) => s.handleCloudSyncFunc);
  const handleFetchUserInfo = useAppStore((s) => s.handleFetchUserInfo);
  const handleReadingBook = useAppStore((s) => s.handleReadingBook);
  const handleCollectionDetailDialog = useAppStore(
    (s) => s.handleCollectionDetailDialog
  );
  const handleCurrentCollectionKey = useAppStore(
    (s) => s.handleCurrentCollectionKey
  );
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [state, setState] = useState<HeaderState>({
    isSync: false,
  });

  const timerRef = useRef<any>(null);
  const scheduledSyncTimerRef = useRef<any>(null);
  const isSyncingRef = useRef<boolean>(false);
  const isSyncRef = useRef<boolean>(false);
  const hasRunAutoImportRef = useRef<boolean>(false);
  const readingFinishedHandlerRef = useRef<((config?: any) => void) | null>(
    null
  );
  const handleCloudSyncRef = useRef<
    (userInfo?: any) => Promise<false | undefined>
  >(async () => undefined);
  const handleFinishReadingRef = useRef<() => Promise<void>>(
    async () => undefined
  );

  const setPartialState = (partial: Partial<HeaderState>) => {
    setState((prevState) => ({ ...prevState, ...partial }));
  };

  const setIsSync = (value: boolean) => {
    isSyncRef.current = value;
    setState((prevState) => ({ ...prevState, isSync: value }));
  };

  const startScheduledSync = () => {
    if (scheduledSyncTimerRef.current) {
      clearInterval(scheduledSyncTimerRef.current);
      scheduledSyncTimerRef.current = null;
    }
    const intervalMinutes = parseInt(
      ConfigService.getReaderConfig("scheduledSyncInterval") || "0"
    );
    if (!intervalMinutes || intervalMinutes <= 0) {
      return;
    }
    const intervalMs = intervalMinutes * 60 * 1000;
    scheduledSyncTimerRef.current = setInterval(async () => {
      const currentInterval = parseInt(
        ConfigService.getReaderConfig("scheduledSyncInterval") || "0"
      );
      if (!currentInterval || currentInterval <= 0) {
        clearInterval(scheduledSyncTimerRef.current);
        scheduledSyncTimerRef.current = null;
        return;
      }
      const defaultSyncOption = ConfigService.getItem("defaultSyncOption");
      if (
        !defaultSyncOption ||
        ConfigService.getReaderConfig("isDisableAutoSync") === "yes"
      ) {
        return;
      }
      if (!isSyncRef.current && !isSyncingRef.current) {
        const userInfo = await handleFetchUserInfo();
        await handleCloudSyncRef.current(userInfo);
      }
    }, intervalMs);
  };

  const autoScanFoldersOnStart = async () => {
    if (!isElectron || hasRunAutoImportRef.current) return;
    hasRunAutoImportRef.current = true;
    try {
      const folders =
        ConfigService.getAllListConfig(AUTO_IMPORT_FOLDERS_KEY) || [];
      if (folders.length === 0) return;
      if (!useAppStore.getState().book.importBookFunc) {
        console.error("Auto import: no import function available");
        return;
      }
      for (const folderPath of folders) {
        await scanFolderForNewBooks(
          folderPath,
          useAppStore.getState().book.importBookFunc
        );
      }
    } catch (error) {
      console.error("Auto import folder scan error:", error);
    }
  };

  const handleOpenLastReadBook = async () => {
    let filePath = "";
    //open book when app start
    if (isElectron) {
      const ipcRenderer = window.electronAPI;
      filePath = ipcRenderer.sendSync("check-file-data");
    }
    if (
      ConfigService.getReaderConfig("isOpenBook") === "yes" &&
      !currentBook.key &&
      !filePath
    ) {
      let lastReadBookKey = ConfigService.getAllListConfig("recentBooks")[0];
      if (lastReadBookKey) {
        let collectionKey = collectionUtil.isCollection(lastReadBookKey)
          ? lastReadBookKey
          : collectionUtil.getActiveCollectionByBook(lastReadBookKey)?.key;
        if (collectionKey) {
          let collection = collectionUtil.getCollection(collectionKey);
          if (collection) {
            handleReadingBook(
              collectionUtil.getCollectionAsBook(collection)
            );
            handleCurrentCollectionKey(collectionKey);
            handleCollectionDetailDialog(true);
            return;
          }
        }
        let fullBook = await DatabaseService.getRecord(
          lastReadBookKey,
          "books"
        );
        if (fullBook) {
          handleReadingBook(fullBook);
          BookUtil.redirectBook(fullBook);
        }
      }
    }
  };

  const handleFinishReading = async () => {
    if (
      ConfigService.getReaderConfig("isDisableAutoSync") !== "yes" &&
      ConfigService.getItem("defaultSyncOption") &&
      !isSyncRef.current
    ) {
      ConfigService.setItem("isFinshReading", "yes");
      let userInfo = await handleFetchUserInfo();
      setIsSync(true);
      await handleCloudSync(userInfo);
      ConfigService.setItem("isFinshReading", "no");
    }
  };

  const handleFinishUpgrade = () => {
    handleFetchBooks();
    setTimeout(() => {
      if (useAppStore.getState().sidebar.mode === "home") {
        navigate("/manager/home");
      }
    }, 2000);
  };

  const handleKOReaderSync = async () => {
    if (ConfigService.getReaderConfig("isEnableKoReaderSync") !== "yes") {
      return;
    }

    toast.loading(t("Start syncing") + " (KOReader)", {
      id: "koreader-sync",
      position: "bottom-center",
    });
    try {
      const koReaderUtil = new KOReaderUtil(
        ConfigService,
        TokenService,
        DatabaseService
      );
      const summary =
        await koReaderUtil.syncKOReaderProgress(getBookPartialMd5);
      if (summary.pulledBooks > 0 || summary.pushedBooks > 0) {
        handleFetchBooks();
      }
      toast.success(t("Synchronisation successful") + " (KOReader)", {
        id: "koreader-sync",
      });
    } catch (error) {
      console.error(error);
      toast.error(
        t("Sync failed") +
          " (KOReader): " +
          (error instanceof Error ? error.message : String(error)),
        {
          id: "koreader-sync",
          duration: 6000,
        }
      );
    }
  };

  const beforeSync = async (userInfo: any) => {
    if (!ConfigService.getItem("defaultSyncOption")) {
      toast.error(
        t("Please add data source in the setting-Sync and backup first")
      );
      handleSetting(true);
      handleSettingMode("sync");
      return false;
    }
    if (
      ConfigService.getReaderConfig("isEnableKoodoSync") === "yes" &&
      userInfo &&
      userInfo.default_sync_option &&
      userInfo.default_sync_option !== defaultSyncOption
    ) {
      toast.error(
        t(
          "The default sync options in the local and cloud are inconsistent, please set the local default sync option to "
        ) +
          t(
            driveList.find(
              (item) => item.value === userInfo.default_sync_option
            )?.label || ""
          ),
        {
          duration: 4000,
        }
      );
      return false;
    }
    let config = await getCloudConfig(
      ConfigService.getItem("defaultSyncOption") || ""
    );
    if (Object.keys(config).length === 0) {
      toast.error(t("Cannot get sync config"));
      return false;
    }
    await checkMissingBook();
    let checkResult = await checkBrokenDatabase();
    if (checkResult) {
      toast.error(
        t(
          "Broken data detected, please click the setting button to reset the sync records"
        )
      );
      return false;
    }
    if (ConfigService.getReaderConfig("isEnableKoodoSync") !== "yes") {
      if (ConfigService.getReaderConfig("hideSyncProgress") !== "yes") {
        toast.loading(
          t("Start syncing") +
            " (" +
            t(
              driveList.find(
                (item) =>
                  item.value === ConfigService.getItem("defaultSyncOption")
              )?.label || ""
            ) +
            ")",
          { id: "syncing", position: "bottom-center" }
        );
      }
    }

    return true;
  };

  const getCompareResult = async () => {
    let localSyncRecords = ConfigService.getAllSyncRecord();
    let cloudSyncRecords = await ConfigUtil.getCloudConfig("sync");
    return await SyncHelper.compareAll(
      localSyncRecords,
      cloudSyncRecords,
      ConfigService,
      TokenService,
      ConfigUtil
    );
  };

  const handleSyncStateChange = (isSyncing: boolean) => {
    setIsSync(isSyncing);
  };

  const handleCloudSync = async (
    userInfo?: any
  ): Promise<false | undefined> => {
    if (isSyncingRef.current) {
      console.info("Sync already in progress, skipping...");
      return false;
    }
    isSyncingRef.current = true;

    try {
      timerRef.current = await showTaskProgress(handleSyncStateChange);
      if (!timerRef.current) {
        setIsSync(false);
        handleKOReaderSync();
        return false;
      }

      let res = await beforeSync(
        userInfo ?? useAppStore.getState().manager.userInfo
      );
      if (!res) {
        clearInterval(timerRef.current);
        setIsSync(false);
        handleKOReaderSync();
        return false;
      }
      let compareResult = await getCompareResult();
      await handleSync(compareResult);
      clearInterval(timerRef.current);
      setIsSync(false);
      handleKOReaderSync();
    } catch (error) {
      console.error(error);
      toast.error(
        t("Sync failed") +
          ": " +
          (error instanceof Error ? error.message : String(error))
      );
      clearInterval(timerRef.current);
      setIsSync(false);
      handleKOReaderSync();
      return false;
    } finally {
      isSyncingRef.current = false;
    }
    setTimeout(() => {
      toast.dismiss("syncing");
    }, 3000);
    return;
  };

  const handleSuccess = async () => {
    if (ConfigService.getItem("isFinshReading") !== "yes" || !isElectron) {
      handleFetchBooks();
    }

    handleFetchBookmarks();
    handleFetchNotes();

    if (ConfigService.getReaderConfig("hideSyncProgress") !== "yes") {
      toast.success(t("Synchronisation successful"), {
        id: "syncing",
      });
    }

    if (
      ConfigService.getItem("defaultSyncOption") === "adrive" &&
      ConfigService.getReaderConfig("hasShowAliyunWarning") !== "yes"
    ) {
      ConfigService.setReaderConfig("hasShowAliyunWarning", "yes");
      toast.success(
        t(
          "We have bypassed the synchronization of book cover for Aliyun Drive, covers will be downloaded automatically when you open the book next time."
        ),
        {
          duration: 4000,
        }
      );
    }
    if (ConfigService.getReaderConfig("isEnableKoodoSync") === "yes") {
      ConfigUtil.updateSyncData();
    }
    //when book is empty, need to refresh the book list
    setTimeout(() => {
      if (useAppStore.getState().sidebar.mode === "home") {
        navigate("/manager/home");
      }
    }, 1000);
  };

  const handleSync = async (compareResult) => {
    try {
      let tasks = await SyncHelper.startSync(
        compareResult,
        ConfigService,
        DatabaseService,
        ConfigUtil,
        BookUtil,
        CoverUtil
      );
      await SyncHelper.runTasksWithLimit(
        tasks,
        99,
        ConfigService.getItem("defaultSyncOption")
      );

      clearInterval(timerRef.current);
      setIsSync(false);
      let stats = await getTaskStats();
      if (stats.hasFailedTasks) {
        toast.error(
          t(
            "Tasks failed after multiple retries, please check the network connection or reauthorize the data source in the settings"
          ),
          {
            id: "syncing",
            duration: 6000,
          }
        );
        return;
      }
      if (ConfigService.getReaderConfig("hideSyncProgress") !== "yes") {
        toast.loading(t("Almost finished"), {
          id: "syncing",
          position: "bottom-center",
        });
      }
      await handleSuccess();
    } catch (error) {
      console.error(error);
      clearInterval(timerRef.current);
      setIsSync(false);
      toast.error(
        t("Sync failed") +
          ": " +
          (error instanceof Error ? error.message : String(error))
      );

      return;
    }
  };

  handleCloudSyncRef.current = handleCloudSync;
  handleFinishReadingRef.current = handleFinishReading;

  useEffect(() => {
    let visibilityHandler: (() => Promise<void>) | null = null;
    const registeredIpcHandlers: [string, (...args: any[]) => any][] = [];

    const init = async () => {
      handleFetchAuthed();
      handleFetchDefaultSyncOption();
      handleFetchDataSourceList();
      if (isElectron) {
        const fs = window.electronAPI.fs;
        const path = window.electronAPI.path;
        const ipcRenderer = window.electronAPI;
        const dirPath = ipcRenderer.sendSync("user-data", "ping");
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(path.join(dirPath, "data", "book"), { recursive: true });
        }

        if (
          ConfigService.getReaderConfig("storageLocation") &&
          !ConfigService.getItem("storageLocation")
        ) {
          ConfigService.setItem(
            "storageLocation",
            ConfigService.getReaderConfig("storageLocation")
          );
        }
        //Check for data update
        //upgrade data from old version
        let res1 = await upgradeStorage(handleFinishUpgrade);
        let res2 = await upgradeConfig();
        if (!res1 || !res2) {
          console.error("upgrade failed");
        }

        const readingFinishedHandler = async () => {
          await handleFinishReadingRef.current();
        };
        const openBookFromLinkHandler = async (config: any) => {
          const book = await DatabaseService.getRecord(config.bookKey, "books");
          if (book) {
            BookUtil.redirectBook(book);
          }
        };
        const openNoteFromLinkHandler = async (config: any) => {
          const note = await DatabaseService.getRecord(config.noteKey, "notes");
          if (!note) return;
          const book = await DatabaseService.getRecord(note.bookKey, "books");
          if (!book) return;
          let bookLocation: any = {};
          try {
            bookLocation = JSON.parse(note.cfi) || {};
          } catch (error) {
            bookLocation.cfi = note.cfi;
            bookLocation.chapterTitle = note.chapter;
          }
          if (bookLocation.fingerprint) {
            bookLocation.chapterDocIndex = bookLocation.page - 1 + "";
            bookLocation.chapterHref = "title" + (bookLocation.page - 1);
          }
          ConfigService.setObjectConfig(
            note.bookKey,
            bookLocation,
            "recordLocation"
          );
          BookUtil.redirectBook(book);
        };
        const chatMessageHandler = async (msg: any) => {
          if (msg.payload.event === "new-message") {
            ConfigService.setReaderConfig("isAllowNotification", "yes");
          }
        };
        readingFinishedHandlerRef.current = readingFinishedHandler;
        registeredIpcHandlers.push(
          ["reading-finished", readingFinishedHandler],
          ["open-book-from-link", openBookFromLinkHandler],
          ["open-note-from-link", openNoteFromLinkHandler],
          ["chat-message", chatMessageHandler]
        );
        for (const [channel, handler] of registeredIpcHandlers) {
          ipcRenderer.on(channel, handler);
        }
      } else {
        await upgradeConfig();
        if (!isSelfHostedMode()) {
          const status = await LocalFileManager.getPermissionStatus();
          if (
            !ConfigService.getItem("isUseLocal") &&
            LocalFileManager.isSupported()
          ) {
            handleLocalFileDialog(true);
          } else if (
            ConfigService.getItem("isUseLocal") === "yes" &&
            !status.directoryName
          ) {
            handleLocalFileDialog(true);
          } else if (
            ConfigService.getItem("isUseLocal") === "yes" &&
            (status.needsReauthorization || !status.hasAccess)
          ) {
            handleLocalFileDialog(true);
          }
        }
      }
      handleCloudSyncFunc(async (userInfo?: any) => {
        await handleCloudSyncRef.current(userInfo);
      });
      visibilityHandler = async () => {
        if (
          document.visibilityState === "visible" &&
          !isElectron &&
          ConfigService.getReaderConfig("isFinishWebReading") === "yes"
        ) {
          await handleFinishReadingRef.current();
          // ConfigService.setReaderConfig("isFinishWebReading", "no");
        }
      };
      document.addEventListener("visibilitychange", visibilityHandler);
      let willAutoSync =
        ConfigService.getReaderConfig("isDisableAutoSync") !== "yes" &&
        ConfigService.getItem("defaultSyncOption");
      if (!willAutoSync) {
        handleOpenLastReadBook();
        autoScanFoldersOnStart();
      }
      if (
        isSelfHostedMode() &&
        ConfigService.getReaderConfig("isDisableAutoSync") !== "yes"
      ) {
        handleCloudSync(undefined);
      }
      startScheduledSync();
    };
    init();

    return () => {
      if (scheduledSyncTimerRef.current) {
        clearInterval(scheduledSyncTimerRef.current);
        scheduledSyncTimerRef.current = null;
      }
      if (isElectron && readingFinishedHandlerRef.current) {
        const ipcRenderer = window.electronAPI;
        ipcRenderer.removeListener(
          "reading-finished",
          readingFinishedHandlerRef.current
        );
        readingFinishedHandlerRef.current = null;
        for (const [channel, handler] of registeredIpcHandlers) {
          if (channel === "reading-finished") continue;
          ipcRenderer.removeListener(channel, handler);
        }
      }
      if (visibilityHandler) {
        document.removeEventListener("visibilitychange", visibilityHandler);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="header"
      style={isCollapsed ? { marginLeft: "40px" } : {}}
    >
      <div
        className="header-search-container"
        style={isCollapsed ? { width: "369px" } : {}}
      >
        <SearchBox />
      </div>
      <div
        className="setting-icon-parrent"
        style={isCollapsed ? { marginLeft: "430px" } : {}}
      >
        <div
          className="setting-icon-container"
          onClick={() => {
            handleSortDisplay(!isSortDisplay);
          }}
          onMouseLeave={() => {
            handleSortDisplay(false);
          }}
          style={{ top: "18px" }}
        >
          <span
            data-tooltip-id="my-tooltip"
            data-tooltip-content={t("Sort by")}
            data-tooltip-place="left"
          >
            <span className="icon-sort-desc header-sort-icon"></span>
          </span>
        </div>
        <div
          className="setting-icon-container"
          onClick={() => {
            handleSetting(true);
            handleAbout(false);
          }}
          onMouseLeave={() => {
            handleAbout(false);
          }}
          style={{ marginTop: "2px" }}
        >
          <span
            data-tooltip-id="my-tooltip"
            data-tooltip-content={t("Setting")}
            data-tooltip-place="left"
          >
            <span
              className="icon-setting setting-icon"
              style={{ fontSize: "25px" }}
            ></span>
          </span>
        </div>
        <div
          className="setting-icon-container"
          onClick={async () => {
            if (!ConfigService.getItem("defaultSyncOption")) {
              toast(
                t(
                  "Please add data source in the setting-Sync and backup first"
                )
              );
              handleSetting(true);
              handleSettingMode("general");
              return;
            }
            setIsSync(true);
            let userInfo = await handleFetchUserInfo();
            await handleCloudSync(userInfo);
          }}
          style={{ marginTop: "2px" }}
        >
          <span
            data-tooltip-id="my-tooltip"
            data-tooltip-content={t("Sync")}
            data-tooltip-place="left"
          >
            <span
              className={
                "icon-sync setting-icon" + (state.isSync ? " icon-rotate" : "")
              }
              style={{ fontSize: "25px" }}
            ></span>
          </span>
        </div>
      </div>

      {KookitConfig.CloudMode !== "production" ? (
        <div className="header-report-container" style={{ right: "300px" }}>
          <span
            style={{
              color: "red",
              opacity: 1,
              fontWeight: "bold",
            }}
          >
            <Trans>TEST</Trans>
            <span> </span>
          </span>
        </div>
      ) : null}

      <ImportLocal
        {...({
          handleDrag: props.handleDrag,
        } as any)}
      />
    </div>
  );
};

export default Header;
