# Zotero 7 Plugin Development Documentation

This directory contains comprehensive documentation and examples for Zotero 7 plugin development, created to help developers understand the plugin system and troubleshoot common issues.

## Contents

### Documentation Files

1. **[zotero-plugin-loading-analysis.md](./zotero-plugin-loading-analysis.md)**
   - Deep analysis of Zotero 7's plugin loading mechanism
   - Explains how Bootstrap.js is loaded and executed
   - Details about Sandbox isolation and scope management
   - Solutions for object persistence issues

2. **[zotero-plugin-ui-analysis.md](./zotero-plugin-ui-analysis.md)**
   - Analysis of UI element creation in plugins
   - Explains why UI elements might not appear
   - Details about Sandbox-DOM interaction limitations
   - Correct methods for creating UI elements

3. **[zotero-7-plugin-test-environment.md](./zotero-7-plugin-test-environment.md)**
   - Complete guide for setting up a Zotero 7 development environment
   - Debugging methods and tools
   - Common issues and solutions
   - Step-by-step troubleshooting guide

### Example Plugins

1. **[minimal-working-plugin/](./minimal-working-plugin/)**
   - A minimal but fully functional Zotero 7 plugin
   - Demonstrates basic UI element creation
   - Includes proper bootstrap.js and manifest.json

2. **[research-navigator-fixed/](./research-navigator-fixed/)**
   - Fixed version of the Research Navigator plugin
   - Shows advanced UI integration (toolbar, menus, context menus)
   - Includes proper error handling and logging
   - Ready-to-use packaging script

## Key Findings

### Plugin Loading in Zotero 7
- Plugins run in isolated Cu.Sandbox environments
- No direct access to window/document objects in the sandbox
- UI must be created using the window parameter passed to onMainWindowLoad()
- All bootstrap functions must be in the global scope

### Common Issues and Solutions
1. **UI not showing**: Use the window parameter from onMainWindowLoad, not global window
2. **Object persistence**: Plugin modifications to Zotero object may not persist across contexts
3. **Debugging**: Use Zotero.debug(), dump(), and Services.console for logging

## Usage

1. Read the analysis documents to understand Zotero 7's plugin architecture
2. Use the minimal-working-plugin as a starting template
3. Refer to research-navigator-fixed for more complex UI examples
4. Follow the test environment guide for debugging

## Contributing

These documents were created through source code analysis of Zotero 7. If you find any issues or have improvements, please submit a pull request.

---

*Note: These documents are based on Zotero 7.0+ and may need updates for future versions.*