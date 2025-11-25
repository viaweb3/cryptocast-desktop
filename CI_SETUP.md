# GitHub Actions CI/CD 设置指南

## 概述

这个项目的 GitHub Actions 工作流配置支持：
- 自动测试（Ubuntu）
- 多平台构建（Linux, Windows, macOS Intel/ARM）
- 代码签名和发布（当创建版本标签时）
- 构建产物的自动上传

## 必需的 GitHub Secrets

为了完整的功能，需要在仓库设置中配置以下 Secrets：

### 1. 基本构建
- `GITHUB_TOKEN`（自动提供，无需手动设置）

### 2. macOS 代码签名（可选）
- `CSC_LINK_MAC`: macOS 开发者证书文件（.p12）
- `CSC_KEY_PASSWORD_MAC`: 证书密码
- `APPLE_ID`: Apple ID 邮箱
- `APPLE_ID_PASSWORD`: Apple ID 应用专用密码
- `APPLE_TEAM_ID`: Apple Team ID

### 3. Windows 代码签名（可选）
- `CSC_LINK_WIN`: Windows 代码签名证书文件（.p12）
- `CSC_KEY_PASSWORD_WIN`: 证书密码

## 设置步骤

### 1. 访问 GitHub Secrets 设置
1. 进入 GitHub 仓库页面
2. 点击 `Settings` 选项卡
3. 在左侧菜单中选择 `Secrets and variables` > `Actions`

### 2. 添加 Repository Secrets
点击 `New repository secret` 添加上述必需的 secrets。

### 3. macOS 代码签名证书设置

#### 获取开发者证书
1. 登录 Apple Developer Portal
2. 创建 `Developer ID Application` 证书
3. 下载并导出为 .p12 格式

#### 转换证书为 base64
```bash
base64 -i YourCertificate.p12 | pbcopy
```

#### 添加到 GitHub Secrets
- 将 base64 字符串作为 `CSC_LINK_MAC` 的值
- 证书导出密码作为 `CSC_KEY_PASSWORD_MAC`

### 4. Apple ID 应用专用密码
1. 访问 appleid.apple.com
2. 登录后进入 "Sign-In and Security"
3. 选择 "App-Specific Passwords"
4. 生成新密码用于 GitHub Actions

## 触发构建

### 开发构建
推送到 `main` 或 `develop` 分支：
```bash
git push origin main
git push origin develop
```

### 发布构建
创建并推送版本标签：
```bash
git tag v1.0.0
git push origin v1.0.0
```

### 测试构建
创建 Pull Request 到 `main` 分支会自动运行测试。

## 构建产物

- 普通构建：保存在 Actions 中的 artifacts，保留 30 天
- 发布构建：自动附加到 GitHub Release，永久保存
- 签名构建：额外的 artifacts，保留 90 天

## 支持的平台

### Linux
- Ubuntu (x64)
- 输出：AppImage, DEB

### Windows
- Windows (x64)
- 输出：NSIS 安装包, Portable

### macOS
- macOS Intel (x64)
- macOS Apple Silicon (ARM64)
- 输出：DMG, ZIP（签名版本包含公证）

## 故障排除

### 常见问题

1. **原生模块编译失败**
   - 工作流已配置 Python 和 build tools
   - 使用 `npm rebuild` 确保原生模块正确编译

2. **macOS 代码签名失败**
   - 检查证书是否过期
   - 确认 Team ID 正确
   - 验证证书密码

3. **Linux 构建缺少依赖**
   - 工作流已安装必要的 GUI 库
   - 使用 xvfb 进行无头构建

4. **构建超时**
   - GitHub Actions 有默认时间限制
   - 大型项目可能需要优化构建过程

### 本地调试
```bash
# 模拟 CI 环境
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm run build:ci

# 运行特定平台构建
npm run build:mac
npm run build:win
npm run build:linux
```

## 自定义配置

### 修改构建目标
编辑 `.github/workflows/build.yml` 中的 matrix 配置。

### 调整 Electron Builder 设置
修改 `electron-builder.json` 文件。

### 更新依赖
```bash
npm ci
npm rebuild
```

## 更多信息

- [Electron Builder 文档](https://www.electron.build/)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [Node.js 原生模块](https://nodejs.org/api/addons.html)