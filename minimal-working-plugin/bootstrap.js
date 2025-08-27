/* -*- Mode: javascript; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/* global Components */
const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

// 简单的日志函数
function log(msg) {
    try {
        Zotero.debug("[MinimalPlugin] " + msg);
    } catch (e) {
        dump("[MinimalPlugin] " + msg + "\n");
    }
}

var MinimalPlugin = {
    id: null,
    version: null,
    rootURI: null,
    initialized: false,
    addedElements: [],
    
    init({ id, version, rootURI }) {
        this.id = id;
        this.version = version;
        this.rootURI = rootURI;
        this.initialized = true;
        
        log(`Initialized - ID: ${id}, Version: ${version}`);
    },
    
    addUI(window) {
        log("Adding UI elements");
        
        try {
            const doc = window.document;
            
            // 方法1: 添加一个简单的状态栏按钮
            const statusBar = doc.getElementById('zotero-tb-sync-progress-box');
            if (statusBar && statusBar.parentNode) {
                const statusButton = doc.createXULElement('toolbarbutton');
                statusButton.id = 'minimal-plugin-status-button';
                statusButton.setAttribute('tooltiptext', 'Minimal Plugin is Active');
                statusButton.style.listStyleImage = 'url(chrome://zotero/skin/tick.png)';
                statusButton.addEventListener('command', () => {
                    window.alert('Minimal Plugin v' + this.version + ' is working!');
                });
                
                statusBar.parentNode.insertBefore(statusButton, statusBar);
                this.addedElements.push({ element: statusButton, parent: statusBar.parentNode });
                log("Added status bar button");
            }
            
            // 方法2: 添加菜单项到工具菜单
            const toolsMenu = doc.getElementById('menu_ToolsPopup');
            if (toolsMenu) {
                const menuSeparator = doc.createXULElement('menuseparator');
                menuSeparator.id = 'minimal-plugin-separator';
                toolsMenu.appendChild(menuSeparator);
                this.addedElements.push({ element: menuSeparator, parent: toolsMenu });
                
                const menuItem = doc.createXULElement('menuitem');
                menuItem.id = 'minimal-plugin-menu-item';
                menuItem.setAttribute('label', 'Minimal Plugin Test');
                menuItem.addEventListener('command', () => {
                    this.showTestDialog(window);
                });
                toolsMenu.appendChild(menuItem);
                this.addedElements.push({ element: menuItem, parent: toolsMenu });
                log("Added tools menu item");
            }
            
            // 方法3: 添加右键菜单到项目列表
            const itemMenu = doc.getElementById('zotero-itemmenu');
            if (itemMenu) {
                const menuSeparator = doc.createXULElement('menuseparator');
                menuSeparator.id = 'minimal-plugin-item-separator';
                itemMenu.appendChild(menuSeparator);
                this.addedElements.push({ element: menuSeparator, parent: itemMenu });
                
                const menuItem = doc.createXULElement('menuitem');
                menuItem.id = 'minimal-plugin-item-menu';
                menuItem.setAttribute('label', 'Minimal Plugin Action');
                menuItem.addEventListener('command', () => {
                    const items = window.ZoteroPane.getSelectedItems();
                    window.alert(`Selected ${items.length} item(s)`);
                });
                itemMenu.appendChild(menuItem);
                this.addedElements.push({ element: menuItem, parent: itemMenu });
                log("Added item context menu");
            }
            
        } catch (e) {
            log("Error adding UI: " + e + "\n" + e.stack);
        }
    },
    
    removeUI() {
        log("Removing UI elements");
        
        for (const { element, parent } of this.addedElements) {
            try {
                parent.removeChild(element);
            } catch (e) {
                // Element might already be removed
            }
        }
        this.addedElements = [];
    },
    
    showTestDialog(window) {
        const dialog = window.alert(
            "Minimal Plugin Test\n\n" +
            "Plugin is working correctly!\n" +
            "Version: " + this.version + "\n" +
            "Zotero Version: " + Zotero.version
        );
    }
};

// Bootstrap functions - 必须在全局作用域
function install(data, reason) {
    log(`Install called - reason: ${reason}`);
}

function uninstall(data, reason) {
    log(`Uninstall called - reason: ${reason}`);
}

function startup(data, reason) {
    log(`Startup called - reason: ${reason}`);
    MinimalPlugin.init(data);
    
    // 在 Zotero 对象上添加引用（可选，用于调试）
    Zotero.MinimalPlugin = MinimalPlugin;
}

function shutdown(data, reason) {
    log(`Shutdown called - reason: ${reason}`);
    MinimalPlugin.removeUI();
    
    // 清理 Zotero 对象引用
    delete Zotero.MinimalPlugin;
}

function onMainWindowLoad({ window }, reason) {
    log(`Main window loaded - ${window.location.href}`);
    MinimalPlugin.addUI(window);
}

function onMainWindowUnload({ window }, reason) {
    log(`Main window unloaded`);
    MinimalPlugin.removeUI();
}