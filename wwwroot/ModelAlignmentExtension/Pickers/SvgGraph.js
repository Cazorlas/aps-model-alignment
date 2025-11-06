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
 * Base class for SVG graphics elements.
 * Provides common functionality for SVG elements that can be managed by SvgOverlay.
 * 
 * @abstract
 */
class SvgGraph {
    /**
     * Creates a new SvgGraph instance.
     */
    constructor() {
        /** @type {SVGElement} */
        this.svg = null;
    }

    /**
     * Creates the SVG element. Should be overridden in subclasses.
     * @abstract
     */
    create() {
        // override in subclass
    }

    /**
     * Attaches the SVG element to a parent element.
     * @param {Element} parent - The parent element to attach to
     */
    attach(parent) {
        if (this.svg || !parent) {
            return;
        }

        this.create();
        parent.appendChild(this.svg);
    }

    /**
     * Detaches the SVG element from its parent.
     */
    detach() {
        if (this.svg && this.svg.parentElement) {
            this.svg.remove();
        }
        this.svg = null;
    }

    /**
     * Hides the SVG element.
     */
    hide() {
        if (this.svg) {
            this.svg.style.display = 'none';
        }
    }

    /**
     * Shows the SVG element.
     */
    show() {
        if (this.svg) {
            this.svg.style.display = 'block';
        }
    }

    /**
     * Clears the SVG element by hiding it.
     */
    clear() {
        this.hide();
    }

    /**
     * Refreshes the SVG element display. Should be overridden in subclasses.
     * @param {Autodesk.Viewing.GuiViewer3D} viewer - The viewer instance
     * @abstract
     */
    refresh(viewer) {
        // override in subclass
    }
}

/**
 * Base class for SVG styling properties.
 * Provides common style properties for SVG elements.
 */
class SvgGraphStyle {
    /**
     * Creates a new SvgGraphStyle instance.
     */
    constructor() {
        this.stroke = null;
        this.strokeWidth = null;
        this.opacity = null;
    }
}

export { SvgGraph, SvgGraphStyle };