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

/**
 * Tag class for creating 2D overlay markers that follow 3D world positions.
 * Manages DOM elements, positioning, and visibility based on world coordinates.
 * Provides basic text display functionality with customizable styling.
 * 
 * @example
 * // Create a basic tag
 * const tag = new Tag('Point A', { className: 'my-custom-tag' });
 * 
 * // Set world position
 * tag.setWorld(new THREE.Vector3(10, 20, 30));
 * 
 * // Update text
 * tag.setText('Updated Point A');
 * 
 * // Check if tag has a world position
 * if (tag.hasWorld()) {
 *   console.log('Tag is positioned in 3D space');
 * }
 */
class Tag {
    /**
     * Creates a new Tag instance.
     * @param {string} text - The text content to display in the tag
     * @param {Object} [opts={}] - Configuration options
     * @param {string} [opts.className='ma-tag'] - CSS class name for styling
     */
    constructor(text, opts = {}) {
        this.text = text;
        this.className = opts.className || 'ma-tag'; // namespaced class; avoid global IDs
        this.el = null;
        this._world = null; // THREE.Vector3 | null
    }

    /**
     * Attaches the tag to a DOM container.
     * Creates the tag DOM element with appropriate styling and positioning.
     * @param {HTMLElement} container - The parent DOM element to attach the tag to
     */
    attach(container) {
        if (this.el) return;
        const el = document.createElement('div');
        el.className = this.className;
        el.textContent = this.text;
        el.style.position = 'absolute';
        el.style.transform = 'translate(-50%,-120%)';
        el.style.pointerEvents = 'none';
        el.style.display = 'none';
        container.appendChild(el);
        this.el = el;
    }

    /**
     * Detaches the tag from its DOM container.
     * Removes the tag element from the DOM and cleans up references.
     */
    detach() {
        if (this.el && this.el.parentElement) this.el.remove();
        this.el = null;
    }

    /**
     * Updates the text content of the tag.
     * Changes both the internal text property and the DOM element content.
     * @param {string} t - The new text content
     */
    setText(t) {
        this.text = t;
        if (this.el) this.el.textContent = t;
    }

    /**
     * Checks if the tag has a world position set.
     * @returns {boolean} True if the tag has a valid world position, false otherwise
     */
    hasWorld() {
        return !!this._world;
    }

    /**
     * Sets the 3D world position for the tag.
     * The position will be converted to screen coordinates when the tag is refreshed.
     * @param {THREE.Vector3|null} vec3OrNull - The world position vector, or null to hide the tag
     */
    setWorld(vec3OrNull) {
        this._world = vec3OrNull ? vec3OrNull.clone() : null;
        if (!this.el) return;
        this.el.style.display = this._world ? 'block' : 'none';
    }

    /**
     * Refreshes the tag's screen position based on its world coordinates.
     * Converts the 3D world position to 2D screen coordinates and updates DOM positioning.
     * @param {Autodesk.Viewing.GuiViewer3D} viewer - The viewer instance for coordinate conversion
     */
    refresh(viewer) {
        if (!this.el) return;
        if (!this._world) { this.el.style.display = 'none'; return; }
        const pt = viewer.worldToClient(this._world.clone());
        this.el.style.left = `${pt.x}px`;
        this.el.style.top = `${pt.y}px`;
        this.el.style.display = 'block';
    }
}

/**
 * CrossTag class extends Tag to provide a visual cross marker with a text bubble.
 * Combines a cross-shaped visual indicator with a text label for enhanced point marking.
 * Supports customizable cross size and color for different visual requirements.
 * 
 * @extends Tag
 * 
 * @example
 * // Create a cross tag with custom styling
 * const crossTag = new CrossTag('Start Point', {
 *   className: 'my-cross-tag',
 *   crossSize: 24,
 *   crossColor: '#ff0000'
 * });
 * 
 * // Use like a regular tag
 * crossTag.setWorld(new THREE.Vector3(0, 0, 0));
 * crossTag.setText('Origin Point');
 */
class CrossTag extends Tag {
    /**
     * Creates a new CrossTag instance.
     * @param {string} text - The text content to display in the tag bubble
     * @param {Object} [opts={}] - Configuration options
     * @param {string} [opts.className='ma-tag'] - CSS class name for styling
     * @param {number} [opts.crossSize=18] - Size of the cross marker in pixels
     * @param {string} [opts.crossColor='#05a6ff'] - Color of the cross marker
     */
    constructor(text, opts = {}) {
        super(text, opts);
        this._crossSize = (opts.crossSize != null ? opts.crossSize : 18);
        this._crossColor = opts.crossColor || '#05a6ff';
    }

    /**
     * Attaches the cross tag to a DOM container.
     * Creates a compound element with both a cross marker and a text bubble.
     * The bubble is positioned above the cross with proper offset calculations.
     * @param {HTMLElement} container - The parent DOM element to attach the tag to
     */
    attach(container) {
        if (this.el) return;
        const root = document.createElement('div');
        root.className = this.className;
        root.style.position = 'absolute';
        root.style.left = '0';
        root.style.top = '0';
        root.style.pointerEvents = 'none';
        root.style.display = 'none';

        const bubble = document.createElement('div');
        bubble.className = 'ma-bubble';
        bubble.textContent = this.text;
        bubble.style.position = 'absolute';

        const cross = document.createElement('div');
        cross.className = 'ma-cross';
        cross.style.position = 'absolute';
        cross.style.transform = 'translate(-50%,-50%)';
        cross.style.setProperty('--ma-cross-size', this._crossSize + 'px');
        cross.style.setProperty('--ma-cross-color', this._crossColor);
        // Provide a bubble offset proportional to cross size (≈ 0.6–0.7 looks good)
        // This controls the CSS var used by .ma-bubble translateY calc()
        root.style.setProperty('--ma-cross-offset', Math.round(this._crossSize * 0.65) + 'px');

        root.appendChild(bubble);
        root.appendChild(cross);
        container.appendChild(root);

        this.el = root;
        this._bubbleEl = bubble;
        this._crossEl = cross;
    }

    /**
     * Updates the text content of the cross tag's bubble.
     * Changes both the internal text property and the bubble element content.
     * @param {string} t - The new text content
     */
    setText(t) {
        this.text = t;
        if (this._bubbleEl) this._bubbleEl.textContent = t;
    }
}

export { Tag, CrossTag };