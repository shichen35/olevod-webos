# 开发与构建

## 环境

- Node.js 18 及以上（CI 用 22）
- 打包所需的 LG `ares-*` 命令行工具是 `app/` 的开发依赖，不用全局安装

## 日常开发

```bash
cd app
npm install
npm run dev        # 开发服务器，浏览器直连接口（接口和 CDN 都允许跨域，不需要代理）
npm run build      # 生产构建到 app/dist（目标 chrome108，base './'）
npm run preview    # 本地预览构建产物
npm run sim        # 构建后在本机 webOS 模拟器里启动（模拟器路径写死为 /Applications）
```

浏览器里用键盘代替遥控器：方向键移动，Enter 确认，Esc 返回。真机上返回键是 webOS 的 keyCode 461。

项目没有自动化测试。改完代码至少要保证 `npm run build` 通过，再用键盘在浏览器、预览或模拟器里把改动涉及的界面走一遍。

## 打包

```bash
bash build.sh                     # 产物在 out/：.ipk 和 com.olevod.app.manifest.json
VERSION=1.0.2 bash build.sh       # 指定版本号
```

装到电视、远程调试等细节见 [打包与发布](dev/packaging.md)。

## 发版

推送 `v*` tag 后，GitHub Actions 会构建 `.ipk`，并把它和 manifest 一起发布成 Release。说明由上一个 tag 以来的提交自动生成。版本号取自 tag，源码里的版本字段只是占位。带后缀的 tag（如 `v1.1.0-beta.1`）会标为预发布。

```bash
git tag v1.0.2 && git push origin v1.0.2
```

## 提交约定

提交信息用一行 Conventional Commits：`type(scope): summary`。
