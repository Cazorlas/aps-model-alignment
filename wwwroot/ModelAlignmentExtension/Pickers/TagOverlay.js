/////////////////////////////////////////////////////////////////////
// Copyright (c) Autodesk, Inc. All rights reserved
// Written by Developer Advocacy and Support
//
// Permission to use, copy, modify, and distribute this software in
// object code form for any purpose and without fee is hereby granted,
// provided that the above copyright notice appears in all copies and
// that both that copyright notice and the limited warranty and
// restricted rights notice below appear in all supporting
// documentation.
//
// AUTODESK PROVIDES THIS PROGRAM "AS IS" AND WITH ALL FAULTS.
// AUTODESK SPECIFICALLY DISCLAIMS ANY IMPLIED WARRANTY OF
// MERCHANTABILITY OR FITNESS FOR A PARTICULAR USE.  AUTODESK, INC.
// DOES NOT WARRANT THAT THE OPERATION OF THE PROGRAM WILL BE
// UNINTERRUPTED OR ERROR FREE.
/////////////////////////////////////////////////////////////////////

/**
 * TagOverlay class for managing 2D overlay tags in Autodesk APS Viewer.
 * Provides a container layer for positioning and displaying tags that follow 3D world positions.
 * Handles camera change events to update tag positions and manages tag lifecycle.
 * 
 * @example
 * // Create and attach a tag overlay
 * const tagOverlay = new TagOverlay(viewer);
 * tagOverlay.attach();
 * 
 * // Create and add tags
 * const tag = new Tag('Point 1', { className: 'my-tag' });
 * tagOverlay.add(tag);
 * tag.setWorld(new THREE.Vector3(10, 20, 30));
 * 
 * // Refresh to update positions
 * tagOverlay.refresh();
 * 
 * // Clean up when done
 * tagOverlay.detach();
 */
class TagOverlay {
    /**
     * Creates a new TagOverlay instance.
     * @param {Autodesk.Viewing.GuiViewer3D} viewer - The Autodesk APS Viewer instance
     */
    constructor(viewer) {
        this.viewer = viewer;
        this.layer = null;
        this._tags = new Set();
        this.onCamChanged = this.onCamChanged.bind(this);
        this._styleEl = null;
    }

    /**
     * Attaches the overlay to the viewer container.
     * Creates the overlay DOM layer, injects CSS styles, and sets up event listeners.
     * Also attaches any pre-existing tags that were added before attachment.
     */
    attach() {
        if (this.layer) return;
        // container
        const layer = document.createElement('div');
        layer.style.position = 'absolute';
        layer.style.left = '0';
        layer.style.top = '0';
        layer.style.width = '100%';
        layer.style.height = '100%';
        layer.style.pointerEvents = 'none';
        // local styles (namespaced classes, no global ids)
        const style = document.createElement('style');
        style.textContent = `
        .ma-tag .ma-bubble{
          padding:2px 6px;border-radius:12px;background:rgba(0,120,255,.9);
          color:#fff;font:12px/1 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;white-space:nowrap;
          /* Lift bubble above the cross by a configurable offset */
          transform: translate(-50%, calc(-100% - var(--ma-cross-offset, 10px)));
        }
        .ma-dist{
          padding:4px 8px;border-radius:10px;background:rgba(0,0,0,.75);
          color:#0ff;font:12px/1 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;white-space:nowrap;
        }
        /* Cross using two pseudo-elements so it stays crisp */
        .ma-cross{
          width: var(--ma-cross-size, 18px);
          height: var(--ma-cross-size, 18px);
        }
        .ma-cross::before,
        .ma-cross::after{
          content:"";
          position:absolute;
          left:50%; top:50%;
          background: var(--ma-cross-color, #05a6ff);
          border-radius: 1px;
          transform: translate(-50%,-50%);
        }
        /* horizontal bar */
        .ma-cross::before{ width: 100%; height: 2px; }
        /* vertical bar */
        .ma-cross::after { width: 2px; height: 100%; }
      `;
        this.viewer.container.appendChild(style);
        this.viewer.container.appendChild(layer);
        this._styleEl = style;
        this.layer = layer;
        this.viewer.addEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, this.onCamChanged);
        // Attach any pre-added tags
        this._tags.forEach(t => t.attach(this.layer));
    }

    /**
     * Detaches the overlay from the viewer container.
     * Removes event listeners, detaches all tags, and cleans up DOM elements.
     * Should be called when the overlay is no longer needed.
     */
    detach() {
        this.viewer.removeEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, this.onCamChanged);
        this._tags.forEach(t => t.detach());
        if (this.layer && this.layer.parentElement) this.layer.remove();
        if (this._styleEl && this._styleEl.parentElement) this._styleEl.remove();
        this.layer = null;
        this._styleEl = null;
    }

    /**
     * Adds a tag to the overlay.
     * If the overlay is already attached, the tag will be immediately attached to the layer.
     * @param {Tag|CrossTag} tag - The tag instance to add
     * @returns {Tag|CrossTag} The added tag instance (for method chaining)
     */
    add(tag) {
        this._tags.add(tag);
        if (this.layer) tag.attach(this.layer);
        return tag;
    }

    /**
     * Removes a tag from the overlay.
     * Detaches the tag from the DOM and removes it from the internal collection.
     * @param {Tag|CrossTag} tag - The tag instance to remove
     */
    remove(tag) {
        if (this._tags.has(tag)) {
            tag.detach();
            this._tags.delete(tag);
        }
    }

    /**
     * Clears the world position of all tags, effectively hiding them.
     * Tags remain in the overlay but are not displayed until new world positions are set.
     */
    clearAll() {
        this._tags.forEach(t => t.setWorld(null));
        this.refresh();
    }

    /**
     * Refreshes the screen positions of all tags based on their world coordinates.
     * Converts 3D world positions to 2D screen coordinates and updates tag positioning.
     * Called automatically on camera changes.
     */
    refresh() { this._tags.forEach(t => t.refresh(this.viewer)); }

    /**
     * Handles camera change events from the viewer.
     * Automatically refreshes all tag positions when the camera moves.
     * @private
     */
    onCamChanged() { this.refresh(); }
}

export { TagOverlay };