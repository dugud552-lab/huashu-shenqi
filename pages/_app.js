import { useEffect } from "react";
import "../styles/globals.css";

export default function App({ Component, pageProps }) {
  useEffect(() => {
    // 主动注销旧版 Service Worker，防止缓存旧 JS 导致更新不生效
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => {
          for (const reg of regs) {
            reg.unregister();
          }
        })
        .catch(() => {});
      // 清空所有缓存
      if ("caches" in window) {
        caches.keys().then((keys) => {
          for (const k of keys) caches.delete(k);
        });
      }
    }
  }, []);

  return <Component {...pageProps} />;
}
