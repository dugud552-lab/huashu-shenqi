import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="zh-CN">
      <Head>
        <meta name="description" content="AI话术回复工具 - 直播间智能回复生成器" />
        {/* PWA */}
        <meta name="application-name" content="话术神器" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="话术神器" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#7c3aed" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#a855f7" media="(prefers-color-scheme: light)" />
        <meta name="msapplication-TileColor" content="#7c3aed" />
        <meta name="msapplication-config" content="./icons/browserconfig.xml" />
        <link rel="manifest" href="./manifest.webmanifest" />
        <link rel="icon" type="image/svg+xml" href="./icons/icon-192.svg" />
        <link rel="apple-touch-icon" href="./icons/icon-192.svg" />
        <link rel="apple-touch-icon" sizes="192x192" href="./icons/icon-192.svg" />
        <link rel="apple-touch-icon" sizes="512x512" href="./icons/icon-512.svg" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
