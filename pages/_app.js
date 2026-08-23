import { useEffect } from "react";
import "../styles/globals.css";

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      window.location.protocol !== "file:"
    ) {
      // 延迟到首屏加载完毕再注册，不阻塞首屏
      const onLoad = () => {
        const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
        navigator.serviceWorker
          .register(`${base}/sw.js`, { scope: `${base}/` })
          .catch(() => {
            /* 离线功能失败不影响主流程 */
          });
      };
      if (document.readyState === "complete") onLoad();
      else window.addEventListener("load", onLoad, { once: true });
    }
  }, []);

  return <Component {...pageProps} />;
}
