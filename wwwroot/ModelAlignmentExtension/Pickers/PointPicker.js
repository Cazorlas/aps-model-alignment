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

/** Tool name constant for the PointPickerTool */
const PointPickerToolName = 'das.tool-point-picker-model-alignment';

/**
 * Event constants for PointPickerTool
 * @enum {string}
 */
const PointPickerEvents = {
    /** Fired when a point is hovered over during mouse movement */
    PointHovered: 'das.pointHovered',
    /** Fired when a point is clicked/selected */
    PointPicked: 'das.pointPicked',
    /** Fired when point picking is canceled */
    PointPickingCanceled: 'das.pointPickingCanceled'
};

/**
 * PointPickerTool class for picking points in 3D space with snapping support.
 * Extends Autodesk APS Viewer's ToolInterface to provide point selection functionality
 * with visual feedback and snapping to geometry.
 * 
 * @extends Autodesk.Viewing.ToolInterface
 * @mixes Autodesk.Viewing.EventDispatcher
 * 
 * @fires PointPickerEvents#pointHovered - When mouse hovers over a pickable point
 * @fires PointPickerEvents#pointPicked - When a point is clicked/selected
 * 
 * @example
 * // Create a snapper and point picker tool
 * const snapper = new Autodesk.Viewing.Extensions.Snapping.Snapper(viewer);
 * const pointPicker = new PointPickerTool(viewer, { snapper });
 * 
 * // Listen for point events
 * pointPicker.addEventListener('pointPicked', (event) => {
 *   console.log('Point picked:', event.point, 'Model:', event.modelId);
 * });
 * 
 * // Register and activate the tool
 * viewer.toolController.registerTool(pointPicker);
 * viewer.toolController.activateTool(pointPicker.getName());
 */
class PointPickerTool extends Autodesk.Viewing.ToolInterface {
    /**
     * Creates a new PointPickerTool instance.
     * @param {Autodesk.Viewing.GuiViewer3D} viewer - The Autodesk APS Viewer instance
     * @param {Object} options - Configuration options
     * @param {Autodesk.Viewing.Extensions.Snapping.Snapper} options.snapper - The snapper instance for point snapping
     */
    constructor(viewer, { snapper }) {
        super();
        Autodesk.Viewing.EventDispatcher.prototype.apply(this);

        this.viewer = viewer;
        this.snapper = snapper;
        this.active = false;

        this.onCameraChanged = this.onCameraChanged.bind(this);

        // Hack: delete functions defined on the *instance* of a ToolInterface (we want the tool controller to call our class methods instead)
        delete this.register;
        delete this.deregister;
        delete this.activate;
        delete this.deactivate;
        // delete this.getPriority;
        delete this.handleMouseMove;
        delete this.handleSingleClick;
        delete this.handleKeyDown;
    }

    /**
     * Gets the name of this tool.
     * @returns {string} The tool name identifier
     */
    getName() {
        return PointPickerToolName;
    }

    /**
     * Gets an array of tool names this tool responds to.
     * @returns {string[]} Array containing the tool name
     */
    getNames() {
        return [PointPickerToolName];
    }

    // /**
    //  * Gets the priority of this tool for the tool controller.
    //  * Higher priority tools are activated before lower priority ones.
    //  * @returns {number} The tool priority (99 = high priority)
    //  */
    // getPriority() {
    //     return 99; // Feel free to use any number higher than 0 (which is the priority of all the default viewer tools)
    // }

    /**
     * Registers the tool and its dependencies with the viewer's tool controller.
     * Registers the snapper tool that this picker depends on.
     * @returns {boolean} True if registration was successful, false otherwise
     */
    register() {
        if (!this.snapper) {
            console.warn('[PointPickerTool] No snapper instance available.');
            return false;
        }

        this.viewer.toolController.registerTool(this.snapper);
        return true;
    }

    /**
     * Deregisters the tool and its dependencies from the viewer's tool controller.
     * Cleans up the snapper tool and removes references.
     * @returns {boolean} True if deregistration was successful, false otherwise
     */
    deregister() {
        if (!this.snapper) {
            console.warn('[PointPickerTool] No snapper instance available.');
            return false;
        }

        this.viewer.toolController.deregisterTool(this.snapper);
        this.snapper = null;
        return true;
    }

    /**
     * Activates the point picker tool.
     * Enables the snapper, pauses highlighting, and sets up event listeners.
     * @returns {boolean} True if activation was successful, false otherwise
     */
    activate() {
        if (this.active) {
            return false;
        }

        if (!this.snapper) {
            console.warn('[PointPickerTool] No snapper instance available.');
            return false;
        }

        this.viewer.toolController.activateTool(this.snapper.getName());
        this.viewer.impl.pauseHighlight(true);
        // this.viewer.impl.disableSelection(true);

        this.active = true;
        this.viewer.addEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, this.onCameraChanged);

        return true;
    }

    /**
     * Deactivates the point picker tool.
     * Disables the snapper, restores highlighting, and removes event listeners.
     * @returns {boolean} True if deactivation was successful, false otherwise
     */
    deactivate() {
        if (!this.active) {
            return false;
        }

        if (!this.snapper) {
            console.warn('[PointPickerTool] No snapper instance available.');
            return false;
        }

        this.viewer.toolController.deactivateTool(this.snapper.getName());
        this.viewer.impl.pauseHighlight(false);
        // this.viewer.impl.disableSelection(false);

        this.active = false;
        this.viewer.removeEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, this.onCameraChanged);

        return true;
    }

    /**
     * Handles camera change events to update snapper visual indicators.
     * Ensures the snapper indicator is re-rendered when the camera moves.
     */
    onCameraChanged() {
        if (this.snapper.indicator) {
            this.snapper.indicator.render();
        }
    }

    /**
     * Gets the snapped point results from either the snapper or hit testing.
     * Attempts to use snapper results first, falls back to hit testing if snapping is not active.
     * @param {Object} event - The mouse event containing canvas coordinates
     * @param {number} event.canvasX - X coordinate on the canvas
     * @param {number} event.canvasY - Y coordinate on the canvas
     * @param {number} [event.clientX] - Alternative X coordinate (fallback)
     * @param {number} [event.clientY] - Alternative Y coordinate (fallback)
     * @returns {Object|null} Object containing point, modelId, and dbId, or null if no valid point found
     * @returns {THREE.Vector3} returns.point - The 3D world position of the picked point
     * @returns {string} returns.modelId - The ID of the model containing the point
     * @returns {number} returns.dbId - The database ID of the object containing the point
     */
    getSnappedResults(event) {
        if (!this.snapper) {
            console.warn('[PointPickerTool] No snapper instance available.');
            return null;
        }

        let point = null;
        let modelId = null;
        let dbId = null;
        if (this.viewer.toolController.isToolActivated(this.snapper.getName()) && this.snapper.isSnapped()) {
            const sr = this.snapper.getSnapResult();
            point = Autodesk.Viewing.MeasureCommon.getSnapResultPosition(sr, this.viewer);
            modelId = sr?.modelId;
            dbId = sr?.dbId;
        } else {
            let x = event.canvasX != null ? event.canvasX : event.clientX;
            let y = event.canvasY != null ? event.canvasY : event.clientY;
            let hit = this.viewer.impl.hitTest(x, y);
            point = hit?.point?.clone();
            modelId = hit?.model?.id;
            dbId = hit?.dbId;
        }

        return {
            point,
            modelId,
            dbId
        };
    }

    /**
     * Handles mouse move events for point hovering and snapping.
     * Updates the snapper position, renders visual indicators, and dispatches hover events.
     * @param {Object} event - The mouse move event
     * @param {number} event.canvasX - X coordinate on the canvas
     * @param {number} event.canvasY - Y coordinate on the canvas
     * @returns {boolean} False to allow event propagation
     * @fires PointPickerTool#pointHovered
     */
    handleMouseMove(event) {
        if (!this.active || !this.snapper) return false;

        this.snapper.onMouseMove({ x: event.canvasX, y: event.canvasY });

        if (this.snapper.indicator) {
            this.snapper.indicator.render();
        }

        const result = this.getSnappedResults(event);
        this.dispatchEvent({ type: PointPickerEvents.PointHovered, ...result });

        return false;
    }

    /**
     * Handles single click events for point selection.
     * Gets the snapped/hit point and dispatches a point picked event.
     * @param {Object} event - The click event
     * @param {number} button - The mouse button that was clicked (0 = left, 1 = middle, 2 = right)
     * @returns {boolean} True if a point was successfully picked, false otherwise
     * @fires PointPickerTool#pointPicked
     */
    handleSingleClick(event, button) {
        if (!this.active || button !== 0) return false;

        const result = this.getSnappedResults(event);
        this.dispatchEvent({ type: PointPickerEvents.PointPicked, ...result });

        return result?.point != null; //!<< return true if a point was picked. The key if viewer will select clicked object after placing the tag.
    }

    /**
     * Handles key down events.
     * Currently not implemented but required by the ToolInterface.
     * @param {Object} event - The keyboard event
     * @returns {boolean} False to allow event propagation
     */
    handleKeyDown(event) {
        if (event.key === 'Escape' || event.key === 'Esc' || event.keyCode === 27) {
            this.dispatchEvent({ type: PointPickerEvents.PointPickingCanceled });
            return true;
        }
        return false;
    }
}

export { PointPickerTool, PointPickerEvents };