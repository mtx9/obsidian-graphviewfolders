/* File:        main.ts
 * Author:      Mutzu
 * Description: Plugin for Obsidian that adds folders to the graph view 
 ******************************************************************************/

import {App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting} from "obsidian";
import {GraphViewWrapper}  from "graphviewwrapper";
import {GraphViewFoldersLeaf} from "graphviewfoldersleaf";
import {setDictionary} from "localization";

interface GVFSettings 
{
   showFolders: boolean;
   showFoldersLocal: boolean;
}

export const DEFAULT_SETTINGS: GVFSettings = 
{
   showFolders: true,
   showFoldersLocal: true 
}

export let latestSettings: GVFSettings =  // Settings of the latest graph view
{
   showFolders: true,
   showFoldersLocal: true                 // showFolders for local graph
}

export default class GVFPlugin extends Plugin
{
   gvw: GraphViewWrapper;

   async onload()
   {
      setDictionary();  // Set dictionary for localization to Obsidian's language
      await this.loadSettings();
      GraphViewFoldersLeaf.initTables();
      this.app.vault.on("create", GraphViewFoldersLeaf.addFileToTable);       
      this.gvw = new GraphViewWrapper(this.app, this, GraphViewFoldersLeaf);
   }

   async loadSettings()
   {
      latestSettings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());      
   }

   async saveSettings()
   {
      await this.saveData(this.settings);
   }
}