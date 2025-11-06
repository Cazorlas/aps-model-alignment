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
 * SVG overlay manager for managing multiple SVG graphics in the viewer.
 * Provides a container for SVG elements that can be attached to the viewer
 * and automatically updated when the camera changes.
 * 
 * @example
 * // Create and use SVG overlay
 * const overlay = new SvgOverlay(viewer);
 * overlay.attach();
 * 
 * // Add SVG elements
 * const line = new SvgLine(lineStyle);
 * overlay.add(line);
 * 
 * // Refresh display
 * overlay.refresh();
 * 
 * // Cleanup
 * overlay.detach();
 */
class SvgOverlay {
    /**
     * Creates a new SvgOverlay instance.
     * @param {Autodesk.Viewing.GuiViewer3D} viewer - The Autodesk APS Viewer instance
     */
    constructor(viewer) {
        this.viewer = viewer;
        this.layer = null;
        this._svgs = new Set();
        
        this.onCamChanged = this.onCamChanged.bind(this);
    }

    /**
     * Attaches the SVG overlay to the viewer container.
     * Creates the SVG layer element and sets up camera change event listeners.
     */
    attach() {
        if (this.layer) {
            return;
        }

        // Create SVG element
        this.layer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.layer.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        this.layer.style.position = 'absolute';
        this.layer.style.left = '0';
        this.layer.style.top = '0';
        this.layer.style.width = '100%';
        this.layer.style.height = '100%';
        this.layer.style.pointerEvents = 'none';
        this.layer.style.zIndex = '10'; // above canvas, below HUD
        
        this.viewer.container.appendChild(this.layer);

        this._svgs.forEach(svg => svg.attach());

        this.viewer.addEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, this.onCamChanged);
    }

    /**
     * Detaches the SVG overlay from the viewer container.
     * Removes event listeners and cleans up all SVG elements.
     */
    detach() {
        this.viewer.removeEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, this.onCamChanged);
        this._svgs.forEach(svg => svg.detach());

        if (this.layer && this.layer.parentElement) {
            this.layer.remove();
        }
        this.layer = null;
    }

    /**
     * Adds an SVG element to the overlay.
     * @param {SvgGraph} svg - The SVG element to add
     * @returns {SvgGraph} The added SVG element
     */
    add(svg) {
        this._svgs.add(svg);
        if (this.layer) {
            svg.attach(this.layer);
        }
        return svg;
    }

    /**
     * Removes an SVG element from the overlay.
     * @param {SvgGraph} svg - The SVG element to remove
     */
    remove(svg) {
        if (this._svgs.has(svg)) {
            svg.detach();
            this._svgs.delete(svg);
        }
    }

    /**
     * Clears all SVG elements from the overlay.
     */
    clearAll() {
        this._svgs.forEach(s => s.clear());
        this.refresh();
    }

    /**
     * Refreshes all SVG elements in the overlay.
     * Updates the display of all managed SVG elements.
     */
    refresh() {
        this._svgs.forEach(s => s.refresh(this.viewer));
    }

    /**
     * Handles camera change events from the viewer.
     * Automatically refreshes all tag positions when the camera moves.
     * @private
     */
    onCamChanged() {
        this.refresh();
    }
}

export { SvgOverlay };