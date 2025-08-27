# Zotero 插件 UI 元素问题分析报告

## 1. UI 元素为什么不显示？

### 问题核心
虽然插件在 Sandbox 中正常运行（日志显示 `onStartup` 成功），但 UI 元素不显示的根本原因是：

1. **Sandbox 隔离机制**：
   - 插件在独立的 Cu.Sandbox 中运行
   - Sandbox 中没有真实的 `window` 或 `document` 对象
   - 在 Sandbox 中直接操作 DOM 的代码实际上无法访问主窗口的 DOM

2. **错误的 DOM 访问方式**：
   ```javascript
   // 这种代码在 Sandbox 中不会工作
   const button = document.createElement('button');
   document.getElementById('zotero-items-toolbar').appendChild(button);
   ```
   - 上面的 `document` 在 Sandbox 中是 undefined 或者是一个不同的对象
   - 即使创建了元素，也无法添加到真实的主窗口中

## 2. Sandbox 与主窗口 DOM 的交互

### Sandbox 环境分析
根据源代码 (`plugins.js` 第133-149行)，Sandbox 包含以下全局属性：
```javascript
wantGlobalProperties: [
    "atob", "btoa", "Blob", "crypto", "CSS",
    "ChromeUtils", "DOMParser", "fetch", "File",
    "FileReader", "TextDecoder", "TextEncoder",
    "URL", "URLSearchParams", "XMLHttpRequest"
]
```

**注意**：这里没有 `window` 或 `document`！

### 正确的 window 访问方式
插件必须通过传入的参数来访问真实的窗口对象：

```javascript
// plugins.js 第98行
await _callMethod(addon, 'onMainWindowLoad', REASONS.MAIN_WINDOW_LOAD, { window: domWindow });
```

这里的 `domWindow` 是真实的 Zotero 主窗口对象（`chrome://zotero/content/zoteroPane.xhtml`）。

## 3. onMainWindowLoad 的 window 参数

### window 参数的来源
```javascript
// plugins.js 第85-102行
const mainWindowListener = {
    onOpenWindow: function (xulWindow) {
        let domWindow = xulWindow.docShell.domWindow;  // 真实的窗口对象
        async function onload() {
            if (domWindow.location.href !== "chrome://zotero/content/zoteroPane.xhtml") {
                return;
            }
            // 将真实的窗口对象传递给插件
            await _callMethod(addon, 'onMainWindowLoad', REASONS.MAIN_WINDOW_LOAD, { window: domWindow });
        }
    }
};
```

### 关键点
- `domWindow` 是真实的 Zotero 主窗口，不是 Sandbox 中的代理
- 插件必须使用这个传入的 window 参数来访问 DOM
- 这是插件与主窗口 DOM 交互的唯一正确方式

## 4. 插件如何正确地修改 UI？

### 方案 1：使用传入的 window 参数（传统方式）
```javascript
// bootstrap.js
async function onMainWindowLoad({ window }) {
    // 使用传入的 window 参数，而不是全局的 window
    const doc = window.document;
    
    // 现在可以正确访问主窗口的 DOM
    const toolbar = doc.getElementById('zotero-items-toolbar');
    if (toolbar) {
        const button = doc.createXULElement('toolbarbutton');
        button.id = 'my-plugin-button';
        button.setAttribute('tooltiptext', 'My Plugin');
        button.addEventListener('command', () => {
            // 处理点击事件
        });
        toolbar.appendChild(button);
    }
}
```

### 方案 2：使用 Zotero 7 的插件 API（推荐）

Zotero 7 提供了专门的插件 API 来管理 UI 元素：

#### 使用 MenuManager API
```javascript
// 在 startup 函数中注册菜单
async function startup({ id, version, rootURI }) {
    // 注册菜单项
    Zotero.PreferencePanes.register({
        pluginID: id,
        src: rootURI + 'prefs.xhtml',
        label: 'My Plugin Settings',
        image: rootURI + 'icon.png'
    });
    
    // 使用内部的 MenuManager（如果可以访问）
    // 注意：这个 API 可能需要通过特定方式访问
}
```

#### 可用的 UI 扩展点
根据 `menuManager.js`，Zotero 7 支持以下 UI 扩展位置：
- 主窗口菜单栏：`main/menubar/file`, `main/menubar/edit`, `main/menubar/tools` 等
- 右键菜单：`main/library/item`, `main/library/collection`
- 工具栏子菜单：`main/library/addAttachment`, `main/library/addNote`
- 标签页右键菜单：`main/tab`
- 阅读器菜单：`reader/menubar/file`, `reader/menubar/view` 等

### 方案 3：监听 Zotero 事件
```javascript
// 使用 Zotero 的通知系统
var notifierID = Zotero.Notifier.registerObserver({
    notify: function(event, type, ids, extraData) {
        // 响应 Zotero 事件
    }
}, ['item', 'collection']);
```

## 5. 调试 Sandbox 内部状态

### 调试方法

1. **使用 Zotero.debug() 输出日志**：
   ```javascript
   // 在插件代码中
   Zotero.debug('Plugin: Current context type: ' + typeof window);
   Zotero.debug('Plugin: Document available: ' + (typeof document !== 'undefined'));
   ```

2. **检查 Sandbox 作用域**：
   ```javascript
   // 在 startup 函数中
   function startup(data, reason) {
       Zotero.debug('=== Sandbox Environment Check ===');
       Zotero.debug('Global this: ' + Object.keys(this));
       Zotero.debug('Has window: ' + (typeof window !== 'undefined'));
       Zotero.debug('Has document: ' + (typeof document !== 'undefined'));
       Zotero.debug('Available globals: ' + Object.getOwnPropertyNames(this));
   }
   ```

3. **开发者工具**：
   - 打开 Zotero 后，使用 `Ctrl+Shift+I` (Windows/Linux) 或 `Cmd+Opt+I` (Mac)
   - 在控制台中可以查看插件的日志输出
   - 使用 Error Console：工具 -> 开发者 -> Error Console

4. **检查插件状态**：
   ```javascript
   // 在浏览器控制台中
   Zotero.Plugins.getAll().then(plugins => console.log(plugins));
   ```

## 6. 解决方案总结

### 立即可行的修复方案
修改插件的 `bootstrap.js`，确保正确使用传入的 window 参数：

```javascript
// bootstrap.js 示例
const ResearchNavigator = {
    id: 'research-navigator@example.com',
    name: 'Research Navigator',
    
    async onStartup() {
        Zotero.debug('ResearchNavigator: Starting up');
        // 不要在这里创建 UI，等待 onMainWindowLoad
    },
    
    async onMainWindowLoad({ window }) {
        Zotero.debug('ResearchNavigator: Main window loaded');
        
        // 使用传入的 window 参数
        const doc = window.document;
        
        // 创建工具栏按钮
        const toolbar = doc.getElementById('zotero-items-toolbar');
        if (toolbar) {
            const button = doc.createXULElement('toolbarbutton');
            button.id = 'research-navigator-button';
            button.className = 'zotero-tb-button';
            button.setAttribute('tooltiptext', 'Research Navigator');
            button.setAttribute('type', 'menu');
            
            // 创建下拉菜单
            const menupopup = doc.createXULElement('menupopup');
            button.appendChild(menupopup);
            
            // 添加菜单项
            const menuitem = doc.createXULElement('menuitem');
            menuitem.setAttribute('label', 'Open Research Navigator');
            menuitem.addEventListener('command', () => {
                window.alert('Research Navigator clicked!');
            });
            menupopup.appendChild(menuitem);
            
            toolbar.appendChild(button);
            Zotero.debug('ResearchNavigator: Button created successfully');
        } else {
            Zotero.debug('ResearchNavigator: Toolbar not found');
        }
    },
    
    async onShutdown() {
        Zotero.debug('ResearchNavigator: Shutting down');
        // 清理资源
    }
};

// Bootstrap 函数
async function install(data, reason) {}

async function uninstall(data, reason) {}

async function startup(data, reason) {
    Zotero.ResearchNavigator = ResearchNavigator;
    await ResearchNavigator.onStartup();
}

async function shutdown(data, reason) {
    await ResearchNavigator.onShutdown();
    delete Zotero.ResearchNavigator;
}

// 重要：onMainWindowLoad 必须是全局函数
async function onMainWindowLoad(params) {
    await ResearchNavigator.onMainWindowLoad(params);
}

async function onMainWindowUnload(params) {
    // 清理 UI 元素
}
```

### 关键要点
1. **永远不要**在 Sandbox 中直接使用 `window` 或 `document`
2. **始终使用**传入的 window 参数来访问 DOM
3. **UI 创建**应该在 `onMainWindowLoad` 中进行，而不是在 `startup` 中
4. **确保** `onMainWindowLoad` 是一个全局函数，可以被 Zotero 调用
5. **使用** `createXULElement` 而不是 `createElement` 来创建 XUL 元素