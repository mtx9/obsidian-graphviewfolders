/* File:        localization.ts
 * Author:      Mutzu
 * Description: Simple function for providing various language translations 
 * USAGE: 
 * - Call setDictionary() at the beginning of onload() of your plugin class.
 * - Use the variable dict like dict.FOLDERS or with other 
 *   defined translations in in your code.
 *   Example: setText(dict.FOLDERS);
 *   dict returns the localization for the current language of Obsidian.
 */

export let dict = DictionaryEN;

const enum DictionaryEN
{
   FOLDERS = "Folders",
   FOLDERS_ARIA = "Folders contain notes and other files.",
   HULLDEFLECT = "Folder repel force"
}

const enum DictionaryDE 
{
   FOLDERS = "Ordner",
   FOLDERS_ARIA = "Ordner beinhalten Notizen und andere Dateien.",
   HULLDEFLECT = "Ordnerabprallkraft"
}

const enum DictionaryIT
{
   FOLDERS = "Cartelle",
   FOLDERS_ARIA = "Le cartelle contengono appunti e altri file.",
   HULLDEFLECT = "Forza di repulsione della cartella"
}

export function setDictionary()
{  
   switch(window.localStorage.getItem("language"))
   {
      case "de": dict = DictionaryDE;
                        break;
      case "it": dict = DictionaryIT;
                        break;
      default:   dict = DictionaryEN;  // case null for English
   }      
}