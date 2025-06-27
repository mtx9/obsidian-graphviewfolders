/* File:        graphviewwrapper.ts
 * Author:      Mutzu
 * Description: Wrapper class for writing a graph view plugin for Obsidian 
 ******************************************************************************/

import {App, Plugin, ItemView, WorkspaceLeaf, Setting, TFolder, TFile} from "obsidian";

// Enum for the sections of the native graph view control panel
/////////////////////////////////////////////////////////////////////////////
export enum GCSectionEnum
{
   FILTERS = 0;
   GROUPS  = 1;
   DISPLAY = 2;
   FORCES  = 3;
} 

export class GVWLeaf
{      
   public app: App;
   public plugin: Plugin;
   public gvw: GraphViewWrapper;
   public leaf: WorkspaceLeaf;
   public view: ItemView;
   public leafType: string;
   public renderer: Object;
   public nodeLookup: Object[];     // Nodes in the graph view
   public px: Object;               // PIXI
   public stage: Object;
   public deltaTime: number;        // time between visual updates   
   public graphControlsEl: Object;  // UI element of graph controls   
   private localGraphObservers: MutationObserver[];  // for tracking changes in UI  
   private mouseX: number;
   private mouseY: number;
   
   // Methods //////////////////////////////////////////////////////////////////
   
   constructor(gvw: GraphViewWrapper, leaf: Object, leafType: string)
   {            
      let nativeRenderCallback = null;
      
      this.gvw = gvw;
      this.app = this.gvw.app;   
      this.plugin = this.gvw.plugin;
      this.nativeLeaf = leaf;
      this.leafType = leafType;
      this.view = this.nativeLeaf.view;      
      this.renderer = this.nativeLeaf.view.renderer;
      this.nodeLookup = this.nativeLeaf.view.renderer.nodeLookup 
      
      this.px = this.nativeLeaf.view.renderer.px;
      this.stage = this.nativeLeaf.view.renderer.px.stage;
      this.graphControlsEl = this.nativeLeaf.view.contentEl.childNodes[2];            
      this.localGraphObservers = [];      
      
      this.initialize();       // Useful to initialize subclass objects before
      this.enhanceControls();  // enhancing the graph view
      this.enhanceGraph();
      this.storeMousePos();      
      
      // Hook in the renderCallback function...
      nativeRenderCallback = this.renderer.renderCallback;
      this.renderer.renderCallback = (...args) =>
      {         
         this.storeMousePos();      
         nativeRenderCallback(args);  // Call the original render callback                  
         this.applyForces();         
         this.update();
      };
   
      // Handle active leaf change...
      this.plugin.registerEvent(this.app.workspace.on("active-leaf-change",
      (activeLeaf: WorkspaceLeaf) => 
      {
         if (activeLeaf.view === this.view)
            this.handleOnFocus();
      }));
   }
   
   // Used for initializing subclass objects before enhancing the graph view
   /////////////////////////////////////////////////////////////////////////////
   initialize(): void;
   
   // Resets the renderer of this leaf
   /////////////////////////////////////////////////////////////////////////////
   resetRenderer(nativeLeaf: Object)
   {
      this.view = nativeLeaf.view;      
      this.renderer = nativeLeaf.view.renderer;
      this.px = this.renderer.px;
   }
   
   // Enhances the graph controls UI
   /////////////////////////////////////////////////////////////////////////////
   async enhanceControls(): void {}  
   
   // Enhances the graph with static graphics like rulers and legends
   /////////////////////////////////////////////////////////////////////////////
   async enhanceGraph(): void {}
   
   // Calls setTransform on the submitted Graphics Object
   // to align it to the current viewport transformation.
   /////////////////////////////////////////////////////////////////////////////
   mapToViewport(shape: PIXI.Graphics): void
   {
      let x = 0,
          y = 0,
          scale = 0.85 * this.renderer.scale + 0.15 * this.renderer.targetScale; 
          
      if (!this.renderer.panning)  // Keyboard panning is active
      {
         x = this.renderer.panX + 1000 * this.renderer.panvX / 60;
         y = this.renderer.panY + 1000 * this.renderer.panvY / 60;         
      }
      else
      {
         x = this.renderer.panX + this.renderer.mouseX - this.mouseX;
         y = this.renderer.panY + this.renderer.mouseY - this.mouseY;
      }                
      shape.setTransform(x, y, scale, scale);
   }
   
   // Stores the coordinates of the mouse pointer.
   /////////////////////////////////////////////////////////////////////////////
   storeMousePos()
   {
      this.mouseX = this.renderer.mouseX;
      this.mouseY = this.renderer.mouseY;
   }
   
	// Adds a graphical element to the Graph View
	/////////////////////////////////////////////////////////////////////////////
	addElement(element)
	{
	   this.px.stage.addChild(element);
	}
   
   // Returns the element of the requested section
   /////////////////////////////////////////////////////////////////////////////
   private getSection(section: GCSectionEnum)
   {         
      if (this.leafType === "graph")
      {
         switch(section)
         {
            case GCSectionEnum.FILTERS:
               return this.graphControlsEl.childNodes[4];
            /* UPGRADE:
             * more sections 
             */
            default: return null;
         }
      }
      else  // "localgraph"
      {
         switch(section)
         {
            case GCSectionEnum.FILTERS:
               return this.graphControlsEl.childNodes[3];
            /* UPGRADE:
             * more sections 
             */
            default: return null;
         }
      }
   }
   
   // Adds an observer to observe change of the graph control's DOM nodes
   /////////////////////////////////////////////////////////////////////////////
   private addSectionObserver(sectionEl: Object, cb)
   {
      let element;
      let observer = new MutationObserver(() =>
      {
         const i = this.localGraphObservers.indexOf(observer);         
         
         cb();                   // Adding UI element
         observer.disconnect();  // One time calling cb is enough. Stop observer                                     
         if (i > -1)
            this.localGraphObservers.splice(i, 1);  // Remove observer
      });

      this.localGraphObservers.push(observer);
      observer.observe(sectionEl, {childList: true});         
   }
   
   // Subfunction of addToggle
   /////////////////////////////////////////////////////////////////////////////
   private addToggleElement(sectionEl: Object, name: string, label: string,
             value: boolean, cb: (evt: PointerEvent) => boolean)
   {
      let controlsEl;
      let itemEl;
     
      controlsEl = sectionEl.childNodes[1];
      
      // DOM-Definition --------------------------------------------------------
      
      itemEl = controlsEl.createDiv({cls: "setting-item mod-toggle"});
      
      itemEl.createDiv({cls: "setting-item-info"});
         itemEl.childNodes[0].createDiv({text: name, arialabel: label, cls: "setting-item-name"});    // FIX minor: doesn't accept ariaLabel  
         itemEl.childNodes[0].createDiv({cls: "setting-item-description"});
   
      itemEl.createDiv({cls: "setting-item-control"});
         itemEl.childNodes[1].createDiv({cls: "checkbox-container mod-small"});
            itemEl.childNodes[1].childNodes[0].createEl("input", {type: "checkbox", tabindex: "0"});  // FIX minor: doesn't accept tabindex
            
      // -----------------------------------------------------------------------
            
      if (value)  // Set checkbox and container to a visibly true...
      {      
         itemEl.childNodes[1].childNodes[0].childNodes[0].checked = true;
         itemEl.childNodes[1].childNodes[0].addClass("is-enabled");
      }
            
      // handle onclick event...
      itemEl.childNodes[1].childNodes[0].onclick = cb;   // checkbox-container.mod-small 
      itemEl.childNodes[1].childNodes[0].childNodes[0].onclick = cb;  // input      
   }
   
   // Adds a toggle control to the graph view controls.
   // PARAMETERS:
   // section ... which section of the graph controls (see GCSectionEnum)
   // name ...... visible name of the element
   // label ..... aria-lable of the element
   // value ..... initial value of the element
   // cb ........ callback function to handle a click on the element
   /////////////////////////////////////////////////////////////////////////////
   addToggle(section: GCSectionEnum, name: string, label: string,
             value: boolean, cb: (evt: PointerEvent) => boolean)
   {                  
      let sectionEl = this.getSection(section);
      
      if (sectionEl.classList.contains("is-collapsed"))  // If section isn't open, use an observer to track change              
      {
         this.addSectionObserver(sectionEl, () =>
         {
               this.addToggleElement(sectionEl, name, label, value, cb);
         });
      }
      else 
         this.addToggleElement(sectionEl, name, label, value, cb);
   }     
   
   // Handles the click event for a toggle element.
   // Returns true or false according to the value of the element.
   /////////////////////////////////////////////////////////////////////////////
   handleToggleOnClick(evt: PointerEvent): boolean
   {
      if (evt.target.nodeName === "DIV")  // The parental toggle container: div.checkbox-container.mod-small 
      {
         if (evt.target.childNodes[0].checked)
         {
            evt.target.childNodes[0].checked = false;
            evt.target.removeClass("is-enabled");
            return false;
         }
         else
         {
            evt.target.childNodes[0].checked = true;
            evt.target.addClass("is-enabled");
            return true;
         }
      }
      else  // The checkbox
      {
         evt.stopPropagation();  // Avoid second event handling by container
         
         if (evt.target.checked)
         {
            evt.target.parentElement.addClass("is-enabled");         
            return true;
         }
         else
         {
            evt.target.parentElement.removeClass("is-enabled");         
            return false;
         }
      }
   }
   
   // Handles focus set on this leaf
   /////////////////////////////////////////////////////////////////////////////
   async handleOnFocus() {}
   
   // Updates leaf's data (called right before draw)
   /////////////////////////////////////////////////////////////////////////////
   update(): void {}
   
   // Applys new forces on the nodes
   /////////////////////////////////////////////////////////////////////////////
   applyForces(): void {}
}

// GraphViewWrapper provides easy access to all shown graph views,
// be it a normal graph view or a local graph view.
// USAGE: 1. Create a subclass from GVWLeaf that implements new capabilities
//           for the graph view.
//        2. Create a GraphViewWrapper object in the onLoad-function of your
//           plugin with your subclass as parameter.
////////////////////////////////////////////////////////////////////////////////
export class GraphViewWrapper
{
   private app: App;
   private plugin: Plugin; 
   private leaves: [];
   private leafConstructor;   
	
   constructor(app: App, plugin: Plugin, leafConstructor)
   {      
      this.app = app;
      this.plugin = plugin;
      this.leaves = [];
      this.leafConstructor = leafConstructor;      
                         
      // Event handling...
      //////////////////////////////////////////////////////////////////////////
      
	   // Handle layout changes...
      this.plugin.registerEvent(this.app.workspace.on("layout-change", () => 
      {this.handleLayoutChange();}));      
   }
   
   // Returns an Array of GVWLeafs that wraps the native Obsidian
   // graph view leaf or local graph view leafs.
   // PARAMETERS:
   // leafType ... "graph" or "localgraph"
   /////////////////////////////////////////////////////////////////////////////
   private async getGVWLeavesOfType(leafType: string): GVWLeaf[]
   {
      let newGVWLeaves = [];
      let i = 0;
      let nativeLeaf = null;      
      let graphLeaves = app.workspace.getLeavesOfType(leafType);
                 
      // Iterate native leaves...
      for (nativeLeaf of graphLeaves)
      {
         //if (this.app.requireApiVersion("1.7.2"))   // FIX/VARIANT: this.app.requireApiVersion("1.7.2") not found; (nativeLeaf instanceof DeferredView)
            await nativeLeaf.loadIfDeferred();        // Ensure view is fully loaded
         //else
         //  await workspace.revealLeaf(nativeLeaf);  // FIX/VARIANT: Ensure view is visible and fully loaded
 
         for (i = 0; i < this.leaves.length; i++)
         {                        
            if (this.leaves[i].nativeLeaf === nativeLeaf)  // Is there a GVWLeaf for this nativeLeaf?
            {                 
               if (this.leaves[i].px !== nativeLeaf.view.renderer.px)  // Need to reset renderer? (Obsidian's behavior)
               {
                  await app.workspace.revealLeaf(nativeLeaf, true);               
                  this.leaves[i].resetRenderer(nativeLeaf);
                  await this.leaves[i].enhanceGraph();                 
               } 
               newGVWLeaves.push(this.leaves[i]);  // Use old GVWLeave
               break;
            }            
         }
         if (i === this.leaves.length)  // If true, there is no GVWLeaf for this nativeLeaf         
            newGVWLeaves.push(new this.leafConstructor(this, nativeLeaf, leafType));  // Create new GVWLeaf and enhance graph view leaf         
      }
      return newGVWLeaves;
   }
   
   // Refreshs the public variables of the GraphViewWrapper 
   // if any changes happen in the layout of the workspace.
   // (Openening or closing of graph views or local graph Views,
   //  or splitting of the layout.)
   // -----------------------------------------------------------
   // NOTE: This has to be called within the respective
   // event handling functions like handleLayoutChange.
   /////////////////////////////////////////////////////////////////////////////
   async refresh()
   {          
      let graphLeaves = await this.getGVWLeavesOfType("graph");
      this.leaves = graphLeaves.concat(await this.getGVWLeavesOfType("localgraph"));
   }
 
   async handleLayoutChange()
	{      
	   this.refresh();     
   }   
}