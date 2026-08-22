/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 支持 next export 导出纯静态文件（便于 GitHub Pages 等托管）
  output: "export",
  images: { unoptimized: true },
};

module.exports = nextConfig;
