#!/bin/bash

# Research Navigator 打包脚本

echo "Packaging Research Navigator for Zotero 7..."

# 清理旧文件
rm -f research-navigator.xpi

# 创建 XPI 文件（实际上是 ZIP）
zip -r research-navigator.xpi bootstrap.js manifest.json content/ locale/ -x "*.DS_Store" -x "__MACOSX"

echo "Package created: research-navigator.xpi"
echo ""
echo "Installation instructions:"
echo "1. Open Zotero"
echo "2. Go to Tools → Add-ons"
echo "3. Click the gear icon → Install Add-on From File"
echo "4. Select research-navigator.xpi"
echo ""
echo "For development, create a symbolic link instead:"
echo "  macOS/Linux:"
echo "    ln -s $(pwd) ~/Zotero/Profiles/[profile]/extensions/research-navigator@zotero.org"
echo "  Windows (Admin):"
echo "    mklink /D \"%APPDATA%\\Zotero\\Zotero\\Profiles\\[profile]\\extensions\\research-navigator@zotero.org\" \"$(pwd)\""