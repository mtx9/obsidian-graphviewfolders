# Graph View Folders for Obsidian

I had the idea of adding folders to the graph view of Obsidian.

https://forum.obsidian.md/t/show-folders-as-areas-in-the-graph/8208/13

![Folders without tags](https://github.com/user-attachments/assets/4275d140-554a-4b65-9bb8-a80145384c77)

However, I stopped working on it, because I couldn't solve the performance issues.

***Yet, if you'd like to try to solve these issues, you're free to create a [fork](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo) , or use it as a [template](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-repository-from-a-template#creating-a-repository-from-a-template) for your own graph view plugin!***

**I do not intend to maintain this repository** (maybe a few small additions), as I do not have the time. That's why I'm totally fine with you publishing your fork as a plugin.

The following lines offer insights into the code, additional resources and things I've learned about Obsidian's codebase.

I've written the plugin using the classical C-style braces formatting, for I think this is much easier to inspect and more beautiful. Please don't judge me for that! :)

![Mockup hq](https://github.com/user-attachments/assets/049782ae-7c66-495d-8449-da753cbf0813)

## Quick explanation of the code

The basic approach for handling graph view enhancements is:
- Inherit your graph view leaf class from `GVWLeaf` and 
- Pass your graph view leaf class to the `GraphViewWrapper` object in the `onload`-function of your plugin

Example:

``` typescript
async onload()
{ 
   /* ... */
   this.gvw = new GraphViewWrapper(this.app, this, GraphViewFoldersLeaf);
   /* ... */
}
```

The code that moves the nodes is in the function `applyForces` in the class `GraphViewFolder` in the file `graphviewfolders.ts.`

### Approach for drawing folders

- Collect all the visible files and folders of the graph view
- Create graph view folder objects and pass them to the PIXI renderer
- Apply the new folder forces to the file nodes and folders in the graph view
- Update the graph view folders' variables (location, size) when there is any change in the nodes' position.

## Features

- Folders for files in the graph view
- Toggle button for folders in the native graph view panel
- Support for multiple instances of the graph view (split workspace)
- Support for normal und local graph views
- Panning with the arrow keys

## Known Bugs

- Folders can inflate each other when they overlap and nodes are located in certain constellations. Perhaps the (missing) force that attracts file nodes to their folder center and a force that repels folders from each other would solve this.
- Sometimes nodes become shaky.
- Zooming with keys and mouse isn't 100% correct. I couldn't figure out the right formula.
- Panming with the mouse isn't 100% correct. There is a temporal “lack” value that creates a small jerk. I think I should have created a mouse handling function instead of relying on the panning and mouse position variables.
- Mysterious: When I split a graph view vertically, the first graph view of its kind doesn't show the folders.

## Missing

- Folder repel force - folders on the same hierarchy level should repel each other
- Folder center force - File nodes should be attracted to the center of their folder
- Subfolders
- Effective toggle button for folders
- Welzl's algorithm for minimum enclosing circle - Currently, the code uses the center of bounding rectangles.
- Handling of adding, moving, renaming or removing files, folders or tags in Obsidian or in the file system of the OS
- Zooming with the mouse
- Labels for folders
- Decrease the brightness of folders and their labels when the mouse cursor hovers over a node

## Things I've learned about Obsidian's codebase

### How to change nodes positions

This was a tricky one to figure out. It must be done by posting a message to the graph worker thread. I haven't solved it perfectly, as some minor shaking still appears in the nodes. I couldn't find out why this happens.

I suspect the reason is that the native graph worker thread calculates the node's position at a higher frequency than fixed 60 fps. But the current code only calculates it synchronized with each frame. Or maybe it's the interchange of forcing the nodes' positions and relieving them to the native forces.

The respective function is `applyForces(node: Object): void`.
### Fix nodes position

   You can fix a node's position by sending fixed position values to the graph worker thread. Another (faster) option is to use the `renderer.nodes` array and set `fx` and/or `fy` of its items.
   But it doesn't work with `0`! Instead you could use something like `Number.MIN_VALUE`, which is the smallest representable positive numeric value.
### Keep rendering

You have to tell the renderer that something has changed by calling `renderer.changed();`.
### Optimization

Obsidian uses a worker thread to calculate the nodes' positions by using a quadtree algorithm and WebAssembly.

The best way (but utterly intracate to implement) I could think of to speed up the calculations is to write a separate worker thread, which changes the values of the buffer of the native graph worker thread:

https://forum.obsidian.md/t/graph-view-allow-to-configure-how-node-size-is-calculated/4247/47
## Ressources

- Build a plugin for Obsidian
  https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin
- PIXI (2D WebGL renderer used by the graph view)
  https://pixijs.com/
- How to debug Obsidian plugins 
  https://mnaoumov.wordpress.com/2022/05/10/how-to-debug-obsidian-plugins/?preview_id=1094&preview_nonce=d133fd046d&preview=true

## Acknowledgment

Thanks to natefrisch01 for providing a starting point and encouragement!
