/** @type {import('next').NextConfig} */
const isGhPages = process.env.GH_PAGES === "1";

const nextConfig = {
  reactStrictMode: true,
  // 支持 next export 导出纯静态文件（便于 GitHub Pages 等托管）
  output: "export",
  images: { unoptimized: true },
  // GitHub Pages 部署在子路径时，自动加 basePath 和 assetPrefix
  ...(isGhPages
    ? {
        basePath: "/huashu-shenqi",
        assetPrefix: "/huashu-shenqi/",
      }
    : {}),
};

module.exports = nextConfig;
