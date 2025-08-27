/* -*- Mode: javascript; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
"use strict";

/* global Components, Services */
const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

// 全局日志函数
function log(msg) {
    try {
        if (typeof Zotero !== 'undefined' && Zotero.debug) {
            Zotero.debug("[ResearchNavigator] " + msg);
        }
        dump("[ResearchNavigator] " + msg + "\n");
        Services.console.logStringMessage("[ResearchNavigator] " + msg);
    } catch (e) {
        dump("[ResearchNavigator] Log error: " + e + "\n");
    }
}

// 插件主对象
var ResearchNavigator = {
    id: null,
    version: null,
    rootURI: null,
    initialized: false,
    windows: new Set(),
    
    init(data) {
        this.id = data.id;
        this.version = data.version;
        this.rootURI = data.rootURI;
        this.initialized = true;
        
        log(`Initializing Research Navigator v${this.version}`);
        
        // 在 Zotero 对象上注册
        if (typeof Zotero !== 'undefined') {
            Zotero.ResearchNavigator = this;
            log("Registered as Zotero.ResearchNavigator");
        }
    },
    
    shutdown() {
        log("Shutting down Research Navigator");
        
        // 清理所有窗口的 UI
        for (let win of this.windows) {
            this.removeWindowUI(win);
        }
        this.windows.clear();
        
        // 从 Zotero 对象移除
        if (typeof Zotero !== 'undefined' && Zotero.ResearchNavigator) {
            delete Zotero.ResearchNavigator;
        }
    },
    
    setupWindowUI(window) {
        if (this.windows.has(window)) {
            log("Window already initialized");
            return;
        }
        
        log(`Setting up UI for window: ${window.location.href}`);
        this.windows.add(window);
        
        try {
            const doc = window.document;
            
            // 等待 DOM 完全加载
            if (doc.readyState !== 'complete') {
                window.addEventListener('load', () => this.setupWindowUI(window), { once: true });
                return;
            }
            
            // 1. 添加工具栏按钮
            this.addToolbarButton(window);
            
            // 2. 添加菜单项
            this.addMenuItems(window);
            
            // 3. 添加右键菜单
            this.addContextMenuItems(window);
            
            log("UI setup completed successfully");
            
        } catch (e) {
            log(`Error setting up UI: ${e}\n${e.stack}`);
            Cu.reportError(e);
        }
    },
    
    addToolbarButton(window) {
        const doc = window.document;
        
        // 尝试多个可能的工具栏位置
        const toolbarIds = [
            'zotero-items-toolbar',
            'zotero-tb-toolbar',
            'nav-bar'
        ];
        
        for (let toolbarId of toolbarIds) {
            const toolbar = doc.getElementById(toolbarId);
            if (toolbar) {
                // 检查是否已存在
                if (doc.getElementById('research-navigator-button')) {
                    log("Toolbar button already exists");
                    return;
                }
                
                const button = doc.createXULElement('toolbarbutton');
                button.id = 'research-navigator-button';
                button.className = 'zotero-tb-button';
                button.setAttribute('tooltiptext', 'Research Navigator');
                button.setAttribute('label', 'RN');
                button.setAttribute('type', 'menu');
                button.style.listStyleImage = 'url(chrome://zotero/skin/16/universal/tag.svg)';
                
                // 创建下拉菜单
                const menupopup = doc.createXULElement('menupopup');
                button.appendChild(menupopup);
                
                // 添加菜单项
                const menuItems = [
                    { label: 'Open Research Navigator', command: () => this.openMainDialog(window) },
                    { label: 'Quick Search', command: () => this.quickSearch(window) },
                    { separator: true },
                    { label: 'Settings', command: () => this.openSettings(window) }
                ];
                
                for (let item of menuItems) {
                    if (item.separator) {
                        menupopup.appendChild(doc.createXULElement('menuseparator'));
                    } else {
                        const menuitem = doc.createXULElement('menuitem');
                        menuitem.setAttribute('label', item.label);
                        menuitem.addEventListener('command', item.command);
                        menupopup.appendChild(menuitem);
                    }
                }
                
                toolbar.appendChild(button);
                log(`Added toolbar button to ${toolbarId}`);
                break;
            }
        }
    },
    
    addMenuItems(window) {
        const doc = window.document;
        
        // 添加到工具菜单
        const toolsMenu = doc.getElementById('menu_ToolsPopup');
        if (toolsMenu) {
            // 检查是否已存在
            if (doc.getElementById('research-navigator-menu')) {
                return;
            }
            
            const separator = doc.createXULElement('menuseparator');
            separator.id = 'research-navigator-menu-separator';
            toolsMenu.appendChild(separator);
            
            const menu = doc.createXULElement('menu');
            menu.id = 'research-navigator-menu';
            menu.setAttribute('label', 'Research Navigator');
            
            const menupopup = doc.createXULElement('menupopup');
            menu.appendChild(menupopup);
            
            // 添加子菜单项
            const menuItems = [
                { label: 'Open Dashboard', command: () => this.openMainDialog(window) },
                { label: 'Search Literature', command: () => this.quickSearch(window) },
                { label: 'Export Research Map', command: () => this.exportMap(window) },
                { separator: true },
                { label: 'Preferences', command: () => this.openSettings(window) }
            ];
            
            for (let item of menuItems) {
                if (item.separator) {
                    menupopup.appendChild(doc.createXULElement('menuseparator'));
                } else {
                    const menuitem = doc.createXULElement('menuitem');
                    menuitem.setAttribute('label', item.label);
                    menuitem.addEventListener('command', item.command);
                    menupopup.appendChild(menuitem);
                }
            }
            
            toolsMenu.appendChild(menu);
            log("Added tools menu");
        }
    },
    
    addContextMenuItems(window) {
        const doc = window.document;
        
        // 项目右键菜单
        const itemMenu = doc.getElementById('zotero-itemmenu');
        if (itemMenu) {
            // 检查是否已存在
            if (doc.getElementById('research-navigator-item-menu')) {
                return;
            }
            
            const separator = doc.createXULElement('menuseparator');
            separator.id = 'research-navigator-item-separator';
            itemMenu.appendChild(separator);
            
            const menuitem = doc.createXULElement('menuitem');
            menuitem.id = 'research-navigator-item-menu';
            menuitem.setAttribute('label', 'Analyze with Research Navigator');
            menuitem.addEventListener('command', () => {
                const items = window.ZoteroPane.getSelectedItems();
                this.analyzeItems(window, items);
            });
            itemMenu.appendChild(menuitem);
            
            log("Added item context menu");
        }
    },
    
    removeWindowUI(window) {
        const doc = window.document;
        
        // 要移除的元素 ID 列表
        const elementIds = [
            'research-navigator-button',
            'research-navigator-menu',
            'research-navigator-menu-separator',
            'research-navigator-item-menu',
            'research-navigator-item-separator'
        ];
        
        for (let id of elementIds) {
            const element = doc.getElementById(id);
            if (element && element.parentNode) {
                element.parentNode.removeChild(element);
            }
        }
        
        this.windows.delete(window);
        log("Removed UI from window");
    },
    
    // 功能方法
    openMainDialog(window) {
        window.alert("Research Navigator Dashboard\n\nThis would open the main interface.");
        log("Opening main dialog");
    },
    
    quickSearch(window) {
        const query = window.prompt("Enter search query:");
        if (query) {
            window.alert(`Searching for: ${query}`);
            log(`Quick search: ${query}`);
        }
    },
    
    openSettings(window) {
        window.alert("Research Navigator Settings\n\nSettings dialog would appear here.");
        log("Opening settings");
    },
    
    exportMap(window) {
        window.alert("Exporting research map...");
        log("Exporting map");
    },
    
    analyzeItems(window, items) {
        window.alert(`Analyzing ${items.length} items with Research Navigator`);
        log(`Analyzing ${items.length} items`);
    }
};

// Bootstrap 函数 - 必须在全局作用域
function install(data, reason) {
    log("Install: " + reason);
}

function uninstall(data, reason) {
    log("Uninstall: " + reason);
}

function startup(data, reason) {
    log("Startup: " + reason);
    ResearchNavigator.init(data);
}

function shutdown(data, reason) {
    log("Shutdown: " + reason);
    ResearchNavigator.shutdown();
}

function onMainWindowLoad(params, reason) {
    const { window } = params;
    log(`Main window load: ${reason}`);
    ResearchNavigator.setupWindowUI(window);
}

function onMainWindowUnload(params, reason) {
    const { window } = params;
    log(`Main window unload: ${reason}`);
    ResearchNavigator.removeWindowUI(window);
}

// 验证函数在全局作用域
log("Bootstrap.js loaded - verifying global functions:");
log("startup: " + (typeof startup));
log("shutdown: " + (typeof shutdown));
log("onMainWindowLoad: " + (typeof onMainWindowLoad));