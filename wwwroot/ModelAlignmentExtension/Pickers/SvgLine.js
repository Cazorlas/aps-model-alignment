/////////////////////////////////////////////////////////////////////
// Copyright (c) Autodesk, Inc. All rights reserved
// Written by Forge Partner Development
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

import { SvgGraph, SvgGraphStyle } from './SvgGraph.js';

/**
 * Style class for SVG line elements.
 * Extends SvgGraphStyle with line-specific properties like dash patterns.
 * 
 * @extends SvgGraphStyle
 */
class SvgLineStyle extends SvgGraphStyle {
    /**
     * Creates a new SvgLineStyle instance.
     * @param {Object} options - Style options
     * @param {string} options.color - The stroke color
     * @param {string} options.dash - The dash pattern
     * @param {number} options.width - The stroke width
     * @param {number} options.opacity - The opacity value
     */
    constructor({ color, dash, width, opacity }) {
        super();
        this.strokeDasharray = dash;
        this.stroke = color;
        this.strokeWidth = width;
        this.opacity = opacity;
    }
}

/**
 * SVG line element for drawing connection lines between points.
 * Extends SvgGraph to provide line-specific functionality with customizable styling.
 * 
 * @extends SvgGraph
 * 
 * @example
 * // Create a styled line
 * const lineStyle = new SvgLineStyle({
 *   color: '#00ffff',
 *   dash: '6,6',
 *   width: 2,
 *   opacity: 0.8
 * });
 * const line = new SvgLine(lineStyle);
 * 
 * // Set world coordinates
 * const start = new THREE.Vector3(0, 0, 0);
 * const end = new THREE.Vector3(10, 5, 0);
 * line.setWorld(start, end);
 */
class SvgLine extends SvgGraph {
    /**
     * Creates a new SvgLine instance.
     * @param {SvgLineStyle} style - The style configuration for the line
     */
    constructor(style) {
        super();
        this.startPoint = null;
        this.endPoint = null;
        this.style = style;
    }

    /**
     * Creates the SVG line element with styling attributes.
     */
    create() {
        if (this.svg) {
            return;
        }
        
        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        this.svg.setAttribute('stroke', this.style?.stroke || '#00ffff');
        this.svg.setAttribute('stroke-width', String(this.style?.strokeWidth || 2));
        this.svg.setAttribute('stroke-dasharray', this.style?.strokeDasharray || '6,6');
        this.svg.setAttribute('opacity', String(this.style?.opacity || 0.8));

        this.svg.setAttribute('x1', '0');
        this.svg.setAttribute('y1', '0');
        this.svg.setAttribute('x2', '0');
        this.svg.setAttribute('y2', '0');
    }

    /**
     * Clears the line and resets world points.
     */
    clear() {
        super.clear();
        this.startPoint = null;
        this.endPoint = null;
    }

    /**
     * Sets the world coordinates for the line endpoints.
     * @param {THREE.Vector3|null} start - The starting point in world coordinates
     * @param {THREE.Vector3|null} end - The ending point in world coordinates
     */
    setWorld(start, end) {
        this.startPoint = start?.clone() || null;
        this.endPoint = end?.clone() || null;
        
        if (this.startPoint && this.endPoint) {
            this.show();
        } else {
            this.hide();
        }
    }

    /**
     * Refreshes the line display by updating screen coordinates from world points.
     * @param {Autodesk.Viewing.GuiViewer3D} viewer - The viewer instance
     */
    refresh(viewer) {
        if (!this.svg || !this.startPoint || !this.endPoint) {
            return;
        }

        const pr = viewer.worldToClient.bind(viewer);
        const a = pr(this.startPoint.clone());
        const b = pr(this.endPoint.clone());

        this.svg.setAttribute('x1', String(a.x));
        this.svg.setAttribute('y1', String(a.y));
        this.svg.setAttribute('x2', String(b.x));
        this.svg.setAttribute('y2', String(b.y));
        this.show();
    }
}

export { SvgLine, SvgLineStyle };