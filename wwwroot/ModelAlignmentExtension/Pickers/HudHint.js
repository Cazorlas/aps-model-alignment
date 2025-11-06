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
 * HudHint class for displaying temporary hint messages in the Autodesk APS Viewer HUD.
 * Provides a positioned overlay element for showing user guidance, warnings, or status messages.
 * The hint appears as a styled box in the top-right corner of the viewer container.
 * 
 * @example
 * // Create and use a HUD hint
 * const hudHint = new HudHint(viewer);
 * 
 * // Show a message
 * hudHint.setMessage('Click on a point to select it');
 * 
 * // Show visibility without changing message
 * hudHint.setVisible(true);
 * 
 * // Clear the message and hide
 * hudHint.clear();
 * 
 * // Clean up when done
 * hudHint.dispose();
 */
class HudHint {
    /**
     * Creates a new HudHint instance and initializes the DOM element.
     * @param {Autodesk.Viewing.GuiViewer3D} viewer - The Autodesk APS Viewer instance
     */
    constructor(viewer) {
        this.viewer = viewer;
        this.container = null;

        this.init();
    }

    /**
     * Initializes the HUD hint DOM element and styling.
     * Creates a styled div element positioned in the top-right corner of the viewer.
     * Sets up the visual appearance with background, border, and typography styling.
     * @private
     */
    init() {
        const hudHintDiv = document.createElement('div');
        hudHintDiv.style.position = 'absolute';
        hudHintDiv.style.top = '8px';
        hudHintDiv.style.right = '12px';
        hudHintDiv.style.padding = '6px 10px';
        hudHintDiv.style.background = 'rgba(0,0,0,.55)';
        hudHintDiv.style.color = '#ff4d4f';
        hudHintDiv.style.border = '1px solid #a00';
        hudHintDiv.style.borderRadius = '6px';
        hudHintDiv.style.font = '12px/1.2 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial';
        hudHintDiv.style.pointerEvents = 'none';
        hudHintDiv.style.display = 'none';
        hudHintDiv.textContent = '';

        this.viewer.container.appendChild(hudHintDiv);
        this.container = hudHintDiv;
    }

    /**
     * Sets the message content and automatically shows the hint.
     * Updates the text content of the hint element and makes it visible if a message is provided.
     * Automatically hides the hint if an empty message is provided.
     * @param {string} message - The message text to display, or empty string to hide
     */
    setMessage(message) {
        if (this.container) {
            this.container.textContent = message;
            this.setVisible(!!message);
        }
    }

    /**
     * Clears the hint message and hides the element.
     * Convenience method that combines setting an empty message with hiding the hint.
     * Equivalent to calling setMessage('') and setVisible(false).
     */
    clear() {
        this.setMessage('');
        this.setVisible(false);
    }

    /**
     * Controls the visibility of the hint element.
     * Shows or hides the hint without changing its message content.
     * @param {boolean} visible - True to show the hint, false to hide it
     */
    setVisible(visible) {
        this.container.style.display = visible ? 'block' : 'none';
    }

    /**
     * Disposes of the HUD hint and cleans up DOM resources.
     * Removes the hint element from the DOM and clears internal references.
     * Should be called when the hint is no longer needed to prevent memory leaks.
     */
    dispose() {
        if (this.container) {
            if (this.container.parentNode) {
                this.container.parentNode.removeChild(this.container);
            }
            this.container = null;
        }
    }
}

export { HudHint };