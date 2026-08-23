/** @type {import('next').NextConfig} */
const isGhPages = process.env.GH_PAGES === "1";
const BASE_PATH = isGhPages ? "/huashu-shenqi" : "";

const nextConfig = {
  reactStrictMode: true,
  // 支持 next export 导出纯静态文件（便于 GitHub Pages 等托管）
  output: "export",
  images: { unoptimized: true },
  // GitHub Pages 部署在子路径时，自动加 basePath 和 assetPrefix
  ...(isGhPages
    ? {
        basePath: BASE_PATH,
        assetPrefix: `${BASE_PATH}/`,
      }
    : {}),
  env: {
    // 传给 pages/_app.js 的 SW 注册与 manifest 引用
    NEXT_PUBLIC_BASE_PATH: BASE_PATH,
  },
  // public 下静态文件导出时不会被 basePath 吞掉；trailingSlash 保证 PWA start_url "./" 解析稳定
  trailingSlash: true,
};

module.exports = nextConfig;
