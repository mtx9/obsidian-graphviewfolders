/* File:        graphviewfoldersleaf.ts
 * Author:      Mutzu
 * Description: Classes for implementing the graph view folders 
 ******************************************************************************/
 
import {App, Vault, Editor, TFolder, TFile, MarkdownView, Modal, Notice, Plugin, 
        PluginSettingTab, Setting} from "obsidian";
import {latestSettings} from "main";
import {GraphViewWrapper, GVWLeaf, GCSectionEnum}  from "graphviewwrapper";
import {Force, ParticleEnum} from "force";
import {dict} from "localization";

// A folder visualized in the graph view
////////////////////////////////////////////////////////////////////////////////
class GraphViewFolder
{ 
   leaf: GraphViewFoldersLeaf;
   renderer: Object;
   nativeFolder: TFolder;     // Corresponding folder in the vault   
   fileNodes: Object[];       // Nodes that belong to this GraphViewFolder
   forcedNodes: Set;          // Nodes which positions are being forced
   x: number;                 // X coordinate of the center of the GraphViewFolder
   y: number;                 // Y coordinate of the center of the GraphViewFolder
   radius: number;            // Effective radius of the force (its current maximum radius)
	color: Color;
   hullPoints: Set;           // Set of points of the form [x, y]
   hullForceK: number;        // Strength of hull force
   shape: PIXI.Graphics;      // Graphic object for PIXI renderer
   cssPadding: number;
   cssMarginMin: number;
   
   constructor(leaf: GraphViewFoldersLeaf, renderer: Object, nativeFolder: TFolder)
   {  
      this.leaf = leaf;
      this.renderer = renderer;      
      this.nativeFolder = nativeFolder;
      this.fileNodes = [];
      this.forcedNodes = new Set();
      this.x = 0;
      this.y = 0;
      this.radius = 0;
      this.hullForceK = 20;
      this.shape = new PIXI.Graphics();
      this.cssPadding = 30;
      this.cssMarginMin = 100;
      
      this.renderer.px.stage.addChildAt(this.shape, 0);  
      this.hullPoints = new Set();
   }
   
   // Sets the color of the folder
   ////////////////////////////////////////////////////////////////////////////////
	setColor(color: Color)
	{
	   this.color = color;
   }
	
   // Adds a file node to the folder
   ////////////////////////////////////////////////////////////////////////////////
   addFileNode(node: Object)
   {
      this.fileNodes.push(node);      
   }
   
   //////////////////////////// QUICKHULL-ALGORITHM ///////////////////////////////   
   // Calculates the points for the hull for the folder by
   // using the Quickhull algorithm, stores it in this.hullPoints
   // Code derived from: 
   // https://www.geeksforgeeks.org/quickhull-algorithm-convex-hull/
   ////////////////////////////////////////////////////////////////////////////////
   calcHull()
   {
      let a = [],
          n = this.fileNodes.length,
          min_x = 0,
          max_x = 0,
          i = 0;
          
      this.hullPoints.clear();
      if (n < 3)
      {
         for (let node of this.fileNodes)
            this.hullPoints.add([node.x, node.y]);
      }
      else
      {
         for (i = 0; i < n; i++)          
            a.push([this.fileNodes[i].x, this.fileNodes[i].y]);                                

         // Finding the point with minimum and
         // maximum x-coordinate
         for (let i = 1; i < n; i++)
         {
            if (a[i][0] < a[min_x][0])
               min_x = i;
            if (a[i][0] > a[max_x][0])
                  max_x = i;
         }
       
         // Recursively find convex hull points on
         // one side of line joining a[min_x] and
         // a[max_x]
         this.quickHull(a, n, a[min_x], a[max_x], 1);
       
         // Recursively find convex hull points on
         // other side of line joining a[min_x] and
         // a[max_x]
         this.quickHull(a, n, a[min_x], a[max_x], -1);
      }         
   }
   
   // Returns the side of point p with respect to line
   // joining points p1 and p2
   ////////////////////////////////////////////////////////////////////////////////
   findSide(p1, p2, p)
   {
       let val = (p[1] - p1[1]) * (p2[0] - p1[0]) -
               (p2[1] - p1[1]) * (p[0] - p1[0]);
    
       if (val > 0)
           return 1;
       else if (val < 0)
           return -1;
       else 
          return 0;
   }
    
   // Returns a value proportional to the distance
   // between the point p and the line joining the
   // points p1 and p2
   ////////////////////////////////////////////////////////////////////////////////
   lineDist(p1, p2, p)
   {
       return Math.abs ((p[1] - p1[1]) * (p2[0] - p1[0]) -
               (p2[1] - p1[1]) * (p[0] - p1[0]));
   }
    
   // End points of line L are p1 and p2. side can have value
   // 1 or -1 specifying each of the parts made by the line L
   ////////////////////////////////////////////////////////////////////////////////
   quickHull(a, n, p1, p2, side)
   {
       let ind = -1;
       let max_dist = 0;
    
       // finding the point with maximum distance
       // from L and also on the specified side of L.
       for (let i = 0; i < n; i++)
       {
           let temp = this.lineDist(p1, p2, a[i]);
           if ((this.findSide(p1, p2, a[i]) == side) && (temp > max_dist))
           {
               ind = i;
               max_dist = temp;
           }
       }
    
       // If no point is found, add the end points
       // of L to the convex hull.
       if (ind == -1)
       {
           this.hullPoints.add(p1);  // points are unique because of the Set
           this.hullPoints.add(p2);  // points are unique because of the Set
           return;
       }
    
       // Recur for the two parts divided by a[ind]
       this.quickHull(a, n, a[ind], p1, -this.findSide(a[ind], p1, p2));
       this.quickHull(a, n, a[ind], p2, -this.findSide(a[ind], p2, p1));
   }  
   ////////////////////////// END QUICKHULL-ALGORITHM /////////////////////////////
   
   // Sorts the points in hullPoints counterclock-wise in-place (changes poly)
   // Returns 2-dimensional Array in the form: [[x, y], [x, y], ...]  
   // This is used for debugging.   
   ////////////////////////////////////////////////////////////////////////////////
   DEBUG_sortHullPoints(hullPoints): Array
   {
      let points = Array.from(hullPoints),
          xc = 0,
          yc = 0,
          i = 0;
      
      // Calculate center
      while (i < points.length)
      {
         xc += points[i][0];
         yc += points[i][1];
         i++;
      }
      xc /= points.length;  // average x
      yc /= points.length;  // average y
      
      // Sort the points based on their angle relative to the centroid...
      points.sort((a, b) => 
      {
         let angleA = Math.atan2(a[1] - yc, a[0] - xc);
         let angleB = Math.atan2(b[1] - yc, b[0] - xc);
         
         return angleA - angleB;
      });      
      return points;
   }

   // Returns the distance between two points
   // p1 and p2 have the Array form [x, y]
   ////////////////////////////////////////////////////////////////////////////////
   dist(p1: Array, p2: Array): number
   {
      let d = [p2[0] - p1[0], p2[1] - p1[1]];   
      return Math.sqrt(d[0] * d[0] + d[1] * d[1]);
   }
   
   // Calculates the center of the folder.
   ////////////////////////////////////////////////////////////////////////////////
   calcCenter()
   {
      let xmin = 0,
          xmax = 0,
          ymin = 0,
          ymax = 0,
          points = null;  // Array for points of form [x, y]
          
      if (this.hullPoints.size > 0)
      {
         points = Array.from(this.hullPoints);               
      
         xmin = xmax = points[0][0];
         ymin = ymax = points[0][1];
         
         for (let i = 1; i < points.length; i++)  // Iterate through remaining points in this.hullPoints
         {
            if (points[i][0] < xmin)
               xmin = points[i][0];
            else if (points[i][0] > xmax)
               xmax = points[i][0];
            
            if (points[i][1] < ymin)
               ymin = points[i][1];
            else if (points[i][1] > ymax)
               ymax = points[i][1];
         }         
      }  
      this.x = xmin + (xmax - xmin) / 2;
      this.y = ymin + (ymax - ymin) / 2;
   }
   
   // Calculates the radius of the folder.
   ////////////////////////////////////////////////////////////////////////////////
   calcRadius(): void
   {
      let r = 0,
          padding = 0,
          points = null;  // Array for points of form [x, y]
      
      this.radius = 0;
      points = Array.from(this.hullPoints);  
      
      for (const point of points)
      {
         r = this.dist([this.x, this.y], [point[0], point[1]]);
         padding = this.cssPadding;  // NOTE: Add radius of largest node from this.hullPoints
         
         if (r + padding> this.radius)
            this.radius = r + padding;
      }      
   }
   
   // Adds a circle as a hull.
   ////////////////////////////////////////////////////////////////////////////////
   addCircleHull(): void
   {
      this.shape.beginFill(0x516497, 0.3);             
      this.shape.drawCircle(this.x, this.y, this.radius);     
      this.shape.lineStyle(0);      
      this.shape.endFill();
   }
   
   // This debug function draws a polygon constituted by this.hullPoints.
   ////////////////////////////////////////////////////////////////////////////////
   DEBUG_polyHull(): void
   {
      let poly = [],
          points = [];
          
      if (this.hullPoints.size >= 3)  // Points need to be sorted for drawing
      {
         points = this.DEBUG_sortHullPoints(this.hullPoints);
         for (const point of points)          
            poly.push(point[0], point[1]);        
      
         this.shape.lineStyle(2, 0x516497);
         this.shape.beginFill(0x516497, 0.3);  
         this.shape.drawPolygon(poly);      
         this.shape.endFill();      
      }
   }
   
   // Updates the form of the folder puddle.
   ////////////////////////////////////////////////////////////////////////////////
   update(): void
   {      
      this.shape.clear();      
      this.leaf.mapToViewport(this.shape);      
      this.calcHull();         
      this.calcCenter();       // MISSING: Welzl's algorithm - https://www.geeksforgeeks.org/minimum-enclosing-circle-using-welzls-algorithm/
      this.calcRadius();       // MISSING: Welzl's algorithm
      this.addCircleHull();      
      // this.DEBUG_polyHull();
   }
   
   // Returns value regarding to t with an applied quadratic easingOut 
   // function curve
   // t... ranges from 0 to 1
   ////////////////////////////////////////////////////////////////////////////////
   easeOutQuad(value: number, t: number): number
   {
      return value * (1 - (t * t));
   }
   
   // Applys the forces of the GraphFiewFolder on node
   ////////////////////////////////////////////////////////////////////////////////
   applyForces(node: Object): void
   {
      const repelRadius = this.radius + this.cssMarginMin;
      let a = [node.x - this.x, node.y - this.y],        // Vector from center of folder to node
          aLen = Math.sqrt(a[0] * a[0] + a[1] * a[1]),   // Length of vector a   
          k = 0,                                         // Strength of hull repel force                    
          msg = null;                                    // Message for graph worker thread
      
      if (!this.fileNodes.includes(node) && aLen <= repelRadius)  // Node is within folder. Force node's position...
      {                  
         k = this.easeOutQuad(this.hullForceK, (aLen / repelRadius));
         node.x += k * a[0] / aLen;
         node.y += k * a[1] / aLen;
         msg = 
         { 
            nodes: null,
            forceNode: 
            {
              id: node.id,
              x:  node.x,
              y:  node.y
            },
            run: true
         };
         
         this.renderer.worker.postMessage(msg);         
         this.renderer.changed();  
         this.forcedNodes.add(node);
      }
      else if (this.forcedNodes.has(node))  // Release node to native forces...
      {
         msg = 
         {             
            forceNode: 
            {
              id: node.id,
              x:  null,
              y:  null
            },
            run: true
         };
         
         this.renderer.worker.postMessage(msg);
         this.renderer.changed();    
         this.forcedNodes.delete(node);
      }
   }
}

// This class implements the main logic of the plugin Graph View folders.
////////////////////////////////////////////////////////////////////////////////
export class GraphViewFoldersLeaf extends GVWLeaf
{      
   static filePathXfolder: Map<string, TFolder>;            // <filePath, folder object>
   static foldersEmpty: TFolder[];                          // References to empty folders  // CLEAN: für GitHub entfernen
 
   showFolders: boolean;
	numLevels: number;  // number of GraphViewFolder levels in this GraphViewFoldersLeaf
	startColor: Color;  // Color of 1st (highest) GraphViewFolder level
	endColor: Color;    // Color of last GraphViewFolder level
   folderXgvf: Map<TFolder, GraphViewFolder>;  // Lookup-table <folder object, GraphvViewFolder object>
         
   static initTables()
   {
      GraphViewFoldersLeaf.filePathXfolder = new Map();
      GraphViewFoldersLeaf.foldersEmpty = [];  // CLEAN: für GitHub entfernen
   }
   
   static addFileToTable(fileOrFolder: TFile)
   {
      let folder: TFolder;
      
      if (fileOrFolder instanceof TFile && fileOrFolder.parent != null
		    && fileOrFolder.parent.path !== "/")
      {
         /* MISSING: Check if any empty folder got this as a new file. If so, remove folder from foldersEmpty. */
         /* NOTE: Don't draw empty folders. */
         
         GraphViewFoldersLeaf.filePathXfolder.set(fileOrFolder.path, fileOrFolder.parent);
      }
      else if (fileOrFolder instanceof TFolder && fileOrFolder.children.length === 0)
         GraphViewFoldersLeaf.foldersEmpty.push(fileOrFolder);
   }
   
   initialize(): void
   {      
      // Preserve 'this' for using functions as callback...
      this.handleFolderToggleOnClick = this.handleFolderToggleOnClick.bind(this);
      
      if (this.leafType === "graph")
         this.showFolders = latestSettings["showFolders"]; 
      else  // "localgraph"
         this.showFolders = latestSettings["showFoldersLocal"];
   }
   
   constructor(gvw: GraphViewWrapper, leaf: Object, leafType: string)
   {                  
      let folder: TFolder;      
      let targetGVF: GraphViewFolder;
      
      super(gvw, leaf, leafType);
      
      // Create GraphViewFolders...      
      this.folderXgvf = new Map();     
      for (let node of this.renderer.nodes)  // Traverse all nodes in graph view...
      {  
         folder = GraphViewFoldersLeaf.filePathXfolder.get(node.id);
         
         if (folder !== undefined)  // Node is in a folder...
         {
            targetGVF = this.folderXgvf.get(folder);
            
            if (targetGVF === undefined)  // If there is no matching GraphViewFolder in this GraphViewFoldersLeaf...
            { 
               targetGVF = new GraphViewFolder(this, this.renderer, folder);               
               this.folderXgvf.set(folder, targetGVF);
            }               
            targetGVF.addFileNode(node);
         }     
      } 
   }   
   
   async enhanceControls(): void
   {   
      this.addToggle(GCSectionEnum.FILTERS, dict.FOLDERS, dict.FOLDERS_ARIA,
         this.showFolders, this.handleFolderToggleOnClick);
   }
   
   async handleFolderToggleOnClick(evt: PointerEvent): boolean
   {      
      this.showFolders = super.handleToggleOnClick(evt);
      
      if (this.leafType === "graph")
         latestSettings["showFolders"] = this.showFolders;
      else  // "localgraph"
         latestSettings["showFoldersLocal"] = this.showFolders;
         
      if (this.showFolders)
      {
         /* ... */
      }
      else
      {
         /* ... */
      }      
      return this.showFolders;
   }
   
   async handleOnFocus(): void
   {
      if (this.leafType === "graph")
         latestSettings["showFolders"] = this.showFolders;
      else  // "localgraph"
         latestSettings["showFoldersLocal"] = this.showFolders;
   }
   
   applyForces(): void
   {      
      for (let node of this.renderer.nodes)  // Apply folder forces to each file node...
      {
         for (let gvf of this.folderXgvf.values())  
         {
            if (node !== this.renderer.dragNode)  // Don't apply force on draggedNode
               gvf.applyForces(node);
         }         
      }      
   } 
   
   update()
   {
      for (const [folder, gvf] of this.folderXgvf)
         gvf.update();
   }                                                                                                               
}                                                                                                                  