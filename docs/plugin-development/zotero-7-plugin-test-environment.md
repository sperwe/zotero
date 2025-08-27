# Zotero 7 插件测试环境构建指南

## 1. Zotero 7 开发环境设置

### 1.1 从源码构建 Zotero

```bash
# 克隆 Zotero 仓库
git clone --recursive https://github.com/zotero/zotero.git
cd zotero

# 安装依赖
npm install

# 构建 Zotero
npm run build

# 启动开发模式（自动监视文件变化）
npm start
```

### 1.2 运行开发版 Zotero

#### Windows
```bash
# 使用开发配置文件运行
app\win\zotero.exe -P dev -jsconsole -purgecaches
```

#### macOS
```bash
# 使用开发配置文件运行
/Applications/Zotero.app/Contents/MacOS/zotero -P dev -jsconsole -purgecaches
```

#### Linux
```bash
# 使用开发配置文件运行
app/linux/zotero -P dev -jsconsole -purgecaches
```

### 1.3 开发模式参数说明
- `-P dev`: 使用名为 "dev" 的配置文件
- `-jsconsole`: 打开 JavaScript 控制台
- `-purgecaches`: 清除缓存，确保加载最新代码
- `-ZoteroDebugText`: 启用调试日志输出

## 2. 插件加载机制确认

### 2.1 加载流程
基于源码分析，您的理解是正确的：

1. **Zotero.Plugins.init()** 在启动时被调用（`plugins.js` 第59行）
2. **Sandbox 环境**：插件在独立的 Cu.Sandbox 中运行
3. **脚本加载**：使用 `Services.scriptloader.loadSubScriptWithOptions()`
4. **全局函数要求**：bootstrap.js 中的函数必须在全局作用域
5. **window 参数**：`onMainWindowLoad({ window })` 接收的是真实的 DOM 窗口

### 2.2 关键代码位置
- 插件管理器：`chrome/content/zotero/xpcom/plugins.js`
- 插件加载：`_loadScope()` 函数（第125行）
- 方法调用：`_callMethod()` 函数（第216行）

## 3. 调试方法

### 3.1 查看 dump() 输出

#### 方法 1：JavaScript 控制台
使用 `-jsconsole` 参数启动 Zotero，dump() 输出会显示在控制台中。

#### 方法 2：终端输出
在 Linux/macOS 上，从终端启动 Zotero 可以直接看到 dump() 输出：
```bash
# Linux/macOS
./zotero -P dev 2>&1 | grep "RN"
```

#### 方法 3：使用 Zotero.debug()
推荐使用 Zotero.debug() 代替 dump()：
```javascript
if (typeof Zotero !== 'undefined') {
    Zotero.debug("[RN] Message here");
}
```

### 3.2 调试 Sandbox 中的代码

1. **使用 debugger 语句**：
```javascript
function startup(data, reason) {
    debugger; // 会在开发者工具中暂停
    // 你的代码
}
```

2. **开发者工具**：
- 快捷键：Ctrl+Shift+I (Windows/Linux) 或 Cmd+Opt+I (macOS)
- 或通过菜单：工具 → 开发者 → 开发者工具箱

3. **Browser Toolbox**（高级调试）：
- 在 about:config 中设置 `devtools.chrome.enabled = true`
- 使用 Ctrl+Alt+Shift+I 打开 Browser Toolbox

### 3.3 环境变量和调试标志

```bash
# 启用详细日志
export ZOTERO_DEBUG=1
export ZOTERO_DEBUG_LEVEL=5

# Windows
set ZOTERO_DEBUG=1
set ZOTERO_DEBUG_LEVEL=5
```

## 4. 常见问题解答

### 4.1 文件编码
- **推荐**：UTF-8 编码，无 BOM
- 可以在文件开头添加：`/* -*- Mode: javascript; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */`

### 4.2 manifest.json 配置
`strict_min_version` 确实会影响加载。确保版本匹配：
```json
{
    "manifest_version": 2,
    "name": "Research Navigator",
    "version": "2.0.3",
    "applications": {
        "zotero": {
            "id": "research-navigator@zotero.org",
            "strict_min_version": "7.0",
            "strict_max_version": "7.1.*"
        }
    }
}
```

### 4.3 chrome.manifest
在 Zotero 7 中，chrome.manifest 不是必需的，但如果存在会被处理。

### 4.4 权限和安全策略
Sandbox 使用系统主体权限，一般不会阻止 UI 创建。但要注意：
- 必须使用传入的 window 参数
- 不能在 startup 中创建 UI，必须等待 onMainWindowLoad

## 5. 测试代码（改进版）

创建 `bootstrap.js`：
```javascript
/* -*- Mode: javascript; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* global Components, Services */

// 使用 Components.utils.reportError 确保错误被记录
const { utils: Cu } = Components;

function log(msg) {
    // 多种日志输出方式，确保能看到
    try {
        dump(`[RN] ${msg}\n`);
        if (typeof Zotero !== 'undefined' && Zotero.debug) {
            Zotero.debug(`[RN] ${msg}`);
        }
        Services.console.logStringMessage(`[RN] ${msg}`);
    } catch (e) {
        dump(`[RN] Log error: ${e}\n`);
    }
}

function startup({ id, version, rootURI }, reason) {
    log("=== Research Navigator TEST ===");
    log(`startup called - reason: ${reason}`);
    log(`Plugin ID: ${id}, Version: ${version}`);
    log(`Root URI: ${rootURI}`);
    
    try {
        if (typeof Zotero !== 'undefined') {
            Zotero.ResearchNavigatorTest = { 
                loaded: true,
                version: version,
                startupTime: new Date().toISOString()
            };
            log("Set Zotero.ResearchNavigatorTest successfully");
            log(`Zotero version: ${Zotero.version}`);
        } else {
            log("ERROR: Zotero is undefined in startup!");
        }
    } catch (e) {
        log(`ERROR in startup: ${e}`);
        Cu.reportError(e);
    }
}

function onMainWindowLoad({ window }, reason) {
    log(`onMainWindowLoad called - reason: ${reason}`);
    
    try {
        if (!window) {
            log("ERROR: window is undefined!");
            return;
        }
        
        log(`Window location: ${window.location.href}`);
        
        if (!window.document) {
            log("ERROR: window.document is undefined!");
            return;
        }
        
        // 方法 1：创建一个固定位置的按钮
        const btn = window.document.createXULElement('button');
        btn.id = 'research-navigator-test-button';
        btn.setAttribute('label', 'RN TEST');
        btn.setAttribute('tooltiptext', 'Research Navigator Test Button');
        btn.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 999999;
            background: #ff6b6b;
            color: white;
            border: none;
            padding: 5px 10px;
            cursor: pointer;
        `;
        btn.addEventListener('click', () => {
            window.alert('Plugin works! Check console for details.');
            log('Button clicked!');
            if (window.Zotero && window.Zotero.ResearchNavigatorTest) {
                log(`Plugin data: ${JSON.stringify(window.Zotero.ResearchNavigatorTest)}`);
            }
        });
        
        // 尝试多个父元素，确保能添加
        const possibleParents = [
            window.document.documentElement,
            window.document.body,
            window.document.getElementById('zotero-pane-stack'),
            window.document.getElementById('appcontent')
        ];
        
        let added = false;
        for (const parent of possibleParents) {
            if (parent) {
                try {
                    parent.appendChild(btn);
                    log(`Added button to: ${parent.id || parent.tagName}`);
                    added = true;
                    break;
                } catch (e) {
                    log(`Failed to add to ${parent.id || parent.tagName}: ${e}`);
                }
            }
        }
        
        if (!added) {
            log("ERROR: Could not add button to any parent element!");
        }
        
        // 方法 2：添加到工具栏（如果存在）
        const toolbar = window.document.getElementById('zotero-items-toolbar');
        if (toolbar) {
            const toolbarBtn = window.document.createXULElement('toolbarbutton');
            toolbarBtn.id = 'research-navigator-toolbar-button';
            toolbarBtn.setAttribute('label', 'RN Toolbar');
            toolbarBtn.setAttribute('tooltiptext', 'Research Navigator Toolbar Button');
            toolbarBtn.addEventListener('command', () => {
                window.alert('Toolbar button clicked!');
            });
            toolbar.appendChild(toolbarBtn);
            log("Added toolbar button");
        } else {
            log("Toolbar not found");
        }
        
    } catch (e) {
        log(`ERROR in onMainWindowLoad: ${e}`);
        log(`Stack: ${e.stack}`);
        Cu.reportError(e);
    }
}

function shutdown({ id }, reason) {
    log(`shutdown called - reason: ${reason}`);
    
    try {
        if (typeof Zotero !== 'undefined' && Zotero.ResearchNavigatorTest) {
            delete Zotero.ResearchNavigatorTest;
            log("Cleaned up Zotero.ResearchNavigatorTest");
        }
    } catch (e) {
        log(`ERROR in shutdown: ${e}`);
    }
}

function install(data, reason) {
    log(`install called - reason: ${reason}`);
}

function uninstall(data, reason) {
    log(`uninstall called - reason: ${reason}`);
}

// 确保函数在全局作用域
if (typeof startup === 'undefined') {
    log("ERROR: Functions not in global scope!");
}
```

## 6. 预期输出

### 6.1 控制台输出
```
[RN] === Research Navigator TEST ===
[RN] startup called - reason: 1
[RN] Plugin ID: research-navigator@zotero.org, Version: 2.0.3
[RN] Root URI: file:///path/to/plugin/
[RN] Set Zotero.ResearchNavigatorTest successfully
[RN] Zotero version: 7.0.0
[RN] onMainWindowLoad called - reason: 9
[RN] Window location: chrome://zotero/content/zoteroPane.xhtml
[RN] Added button to: zotero-pane-stack
[RN] Added toolbar button
```

### 6.2 可见元素
- 右上角应该有一个红色的 "RN TEST" 按钮
- 工具栏中应该有 "RN Toolbar" 按钮

### 6.3 验证方法
在开发者工具控制台中运行：
```javascript
// 检查插件数据
Zotero.ResearchNavigatorTest

// 检查按钮
document.getElementById('research-navigator-test-button')

// 列出所有已加载的插件
Zotero.Plugins.getAll()
```

## 7. 最小化工作示例

### 7.1 目录结构
```
research-navigator/
├── bootstrap.js      # 上面的测试代码
├── manifest.json     # 下面的配置
└── install.rdf       # 可选，用于兼容性
```

### 7.2 manifest.json
```json
{
    "manifest_version": 2,
    "name": "Research Navigator Test",
    "version": "2.0.3",
    "description": "Test plugin for Zotero 7",
    "applications": {
        "zotero": {
            "id": "research-navigator@zotero.org",
            "strict_min_version": "7.0",
            "strict_max_version": "7.1.*"
        }
    },
    "author": "Your Name",
    "homepage_url": "https://github.com/yourusername/research-navigator"
}
```

### 7.3 安装方法

1. **开发模式安装**：
   - 将插件目录压缩为 .zip 文件
   - 在 Zotero 中：工具 → 插件 → 齿轮图标 → Install Add-on From File
   - 选择 .zip 文件

2. **或使用符号链接**（推荐用于开发）：
   ```bash
   # Windows (管理员权限)
   mklink /D "C:\Users\[User]\AppData\Roaming\Zotero\Zotero\Profiles\[profile]\extensions\research-navigator@zotero.org" "C:\path\to\your\plugin"
   
   # macOS/Linux
   ln -s /path/to/your/plugin ~/Zotero/Profiles/[profile]/extensions/research-navigator@zotero.org
   ```

## 8. 故障排除

### 8.1 插件未加载
1. 检查错误控制台（工具 → 开发者 → Error Console）
2. 确认版本兼容性
3. 验证文件编码（UTF-8 无 BOM）

### 8.2 UI 不显示
1. 确认 onMainWindowLoad 被调用
2. 检查是否使用了正确的 window 对象
3. 验证父元素是否存在

### 8.3 调试技巧
1. 在每个关键步骤添加日志
2. 使用 try-catch 捕获所有错误
3. 使用 Browser Toolbox 进行深度调试

### 8.4 验证清单
- [ ] manifest.json 中的 ID 与文件夹名匹配
- [ ] 版本范围包含当前 Zotero 版本
- [ ] bootstrap.js 使用 UTF-8 编码
- [ ] 所有函数在全局作用域
- [ ] 使用传入的 window 参数

## 9. 进阶调试

### 9.1 实时重载插件
```javascript
// 在开发者控制台运行
async function reloadPlugin(id) {
    const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
    const addon = await AddonManager.getAddonByID(id);
    await addon.reload();
}
reloadPlugin('research-navigator@zotero.org');
```

### 9.2 监控插件状态
```javascript
// 监听插件事件
Zotero.Plugins.addObserver({
    startup: (params) => console.log('Plugin started:', params),
    shutdown: (params) => console.log('Plugin stopped:', params)
});
```

这个测试环境应该能帮助您快速定位和解决插件 UI 不显示的问题。