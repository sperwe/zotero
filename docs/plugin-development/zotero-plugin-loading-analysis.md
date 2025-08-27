# Zotero 插件加载机制分析报告

## 1. 插件加载流程

### ExtensionSupport.registerBootstrap() 的实现
在 Zotero 7 中，插件管理已经从旧的 ExtensionSupport API 迁移到了新的实现方式。根据源代码分析：

- **不再使用 ExtensionSupport.registerBootstrap()**：Zotero 7 使用了自己的插件管理器 (`chrome/content/zotero/xpcom/plugins.js`)
- **主要加载函数**：`Zotero.Plugins.init()` 在启动时被调用
- **插件发现机制**：通过 `AddonManager.getAllAddons()` 获取所有已安装的扩展

### Bootstrap.js 的 startup() 函数调用机制

1. **加载时机**：
   ```javascript
   // plugins.js 第59-76行
   this.init = async function () {
       var addons = await AddonManager.getAllAddons();
       for (let addon of addons) {
           if (addon.type != 'extension') continue;
           let blockedReason = shouldBlockPlugin(addon);
           if (blockedReason || !addon.isActive) {
               continue;
           }
           addonVersions.set(addon.id, addon.version);
           _loadScope(addon);
           setDefaultPrefs(addon);
           await registerLocales(addon);
           await _callMethod(addon, 'startup', REASONS.APP_STARTUP);
       }
   };
   ```

2. **调用参数和上下文**：
   ```javascript
   // plugins.js 第240-248行
   let params = {
       id: addon.id,
       version: addon.version,
       rootURI: addon.getResourceURI().spec
   };
   if (extraParams) {
       Object.assign(params, extraParams);
   }
   let result;
   try {
       result = func.call(scope, params, reason);
   ```

## 2. 脚本执行环境

### Services.scriptloader.loadSubScriptWithOptions() 的实现细节

```javascript
// plugins.js 第196-203行
let uri = addon.getResourceURI().spec + 'bootstrap.js';
Services.scriptloader.loadSubScriptWithOptions(
    uri,
    {
        target: scope,
        ignoreCache: true
    }
);
```

### 执行环境（Sandbox）的创建

```javascript
// plugins.js 第129-151行
var scope = new Cu.Sandbox(
    Services.scriptSecurityManager.getSystemPrincipal(),
    {
        sandboxName: addon.id,
        wantGlobalProperties: [
            "atob", "btoa", "Blob", "crypto", "CSS",
            "ChromeUtils", "DOMParser", "fetch", "File",
            "FileReader", "TextDecoder", "TextEncoder",
            "URL", "URLSearchParams", "XMLHttpRequest"
        ]
    }
);
```

### ctx 对象和全局 Zotero 对象的关系

1. **Zotero 对象的注入**：
   ```javascript
   // plugins.js 第155-175行
   Object.assign(
       scope,
       {
           Zotero,  // 这里将全局 Zotero 对象注入到插件的 sandbox
           ChromeWorker,
           IOUtils,
           Localization,
           PathUtils,
           Services,
           Worker,
           XMLSerializer,
           // 额外的全局函数
           setTimeout,
           clearTimeout,
           setInterval,
           clearInterval,
           requestIdleCallback,
           cancelIdleCallback,
       }
   );
   ```

2. **Sandbox 隔离**：每个插件在独立的 Sandbox 中运行，有自己的全局作用域，但共享同一个 Zotero 对象引用

## 3. 对象生命周期

### 插件创建的对象管理

1. **作用域管理**：
   - 插件的所有代码在 Sandbox 中执行
   - Sandbox 存储在 `scopes` Map 中：`scopes.set(addon.id, scope)`
   - 插件卸载时，Sandbox 被清理：`_unloadScope(id)` -> `scopes.delete(id)`

2. **对象持久化问题**：
   - 插件在 Sandbox 中对 Zotero 对象的修改（如 `Zotero.ResearchNavigator = addonInstance`）只在该 Sandbox 的生命周期内有效
   - Zotero 对象是共享的，但插件对其的修改可能被其他操作覆盖或在某些上下文中不可见

### 不同窗口/上下文之间的对象共享

1. **主窗口访问**：
   ```javascript
   // zotero.js
   this.getMainWindow = function () {
       return Services.wm.getMostRecentWindow("navigator:browser");
   };
   ```

2. **多窗口环境**：
   - 每个窗口有自己的 `window.ZoteroPane` 对象
   - 但所有窗口共享同一个全局 `Zotero` 对象（通过 ESM 模块导入）

## 4. Zotero 7 的变化

### 相比之前版本的改变

1. **移除 ExtensionSupport API**：不再使用 Firefox 的 ExtensionSupport，而是自己实现的插件管理器
2. **ChromeUtils.import 废弃**：添加了兼容性代理，但推荐使用 `ChromeUtils.importESModule()`
3. **增强的 Sandbox 环境**：提供了更多的全局属性和 API

### 安全限制和沙箱机制

1. **Sandbox 隔离**：每个插件在独立的 Sandbox 中运行
2. **系统权限**：使用 `getSystemPrincipal()` 提供完整的系统权限
3. **API 限制**：只有明确添加到 Sandbox 的 API 才能使用

### 旧插件兼容性

1. **Bootstrap 方法兼容**：仍然支持传统的 bootstrap.js 和相关方法（startup, shutdown, install, uninstall）
2. **ChromeUtils.import 垫片**：提供了兼容性代理，自动转换为新的 ESM 导入

## 5. 关键问题分析

### 为什么 Zotero.ResearchNavigator 是 undefined？

**可能的原因**：

1. **上下文隔离**：插件在 Sandbox 中设置的属性可能在其他上下文中不可见
2. **时序问题**：访问时插件可能还未完成加载
3. **作用域问题**：不同的代码可能在不同的作用域中执行

**解决方案**：

1. **使用插件 API**：通过 Zotero 提供的插件 API 来注册功能，而不是直接修改 Zotero 对象
2. **确保正确的访问方式**：
   ```javascript
   // 在插件中
   if (!Zotero.ResearchNavigator) {
       Zotero.ResearchNavigator = addonInstance;
   }
   
   // 在其他地方访问时
   if (typeof Zotero !== 'undefined' && Zotero.ResearchNavigator) {
       // 使用 Zotero.ResearchNavigator
   }
   ```

3. **使用事件和观察者模式**：
   ```javascript
   // 注册观察者
   Zotero.Plugins.addObserver({
       startup: function(params, reason) {
           // 插件启动后的处理
       }
   });
   ```

### Bootstrap.js 中的设置为什么没有持久化？

1. **Sandbox 生命周期**：插件的修改只在 Sandbox 存在期间有效
2. **没有持久化机制**：对 Zotero 对象的修改不会自动保存
3. **推荐做法**：
   - 使用 Zotero 的偏好设置系统保存配置
   - 使用 Zotero 的数据库 API 保存数据
   - 通过事件系统与其他组件通信

### 是否存在多个 Zotero 对象？

**答案**：只有一个全局 Zotero 对象，但存在多个访问上下文：

1. **全局 Zotero**：通过 `chrome://zotero/content/zotero.mjs` 导出的单例
2. **窗口上下文**：每个窗口可能有 `window.ZoteroPane` 等窗口特定对象
3. **Sandbox 上下文**：插件在 Sandbox 中访问的是同一个 Zotero 对象的引用

## 6. 建议和最佳实践

1. **避免直接修改 Zotero 对象**：使用官方提供的 API 和扩展点
2. **使用事件系统**：通过 `Zotero.Notifier` 进行组件间通信
3. **正确的初始化时机**：在 `startup` 方法中进行初始化，确保 Zotero 已完全加载
4. **清理资源**：在 `shutdown` 方法中清理创建的对象和事件监听器
5. **测试多窗口场景**：确保插件在多窗口环境下正常工作