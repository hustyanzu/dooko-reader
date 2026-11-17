import "react";

declare module "react" {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    webkitdirectory?: string;
  }
}

declare global {
  interface File {
    // Electron 下由主进程注入的本地路径；web-only 构建中恒为 undefined
    path?: string;
  }
}

export {};
