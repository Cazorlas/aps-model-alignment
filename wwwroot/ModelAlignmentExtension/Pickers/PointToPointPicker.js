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

/// import * as Autodesk from "@types/forge-viewer";

import { PointPickerTool, PointPickerEvents } from './PointPicker.js';
import { TagOverlay } from './TagOverlay.js';
import { Tag, CrossTag } from './Tag.js';
import { HudHint } from './HudHint.js';
import { SvgOverlay } from './SvgOverlay.js';
import { SvgLine, SvgLineStyle } from './SvgLine.js';

/** Name constant for the overlay scene used by the PointToPointPicker */
const PointToPointPickerOverlayName = 'das.overlay-point-to-point-picker';
/**
 * Enum for point types in the PointToPointPicker
 * @enum {string}
 */
const PointTypes = {
    From: 'From',
    To: 'To'
};

/** 
 * Event constants for PointToPointPicker
 * @enum {string}
 */
const Events = {
    /** Fired when the picking "From" point is started */
    PointFromPicking: 'das.pointFromPicking',
    /** Fired when the picking "To" point is started */
    PointToPicking: 'das.pointToPicking',
    /** Fired when the "From" point is selected */
    PointFromPicked: 'das.pointFromPicked',
    /** Fired when the "To" point is selected */
    PointToPicked: 'das.pointToPicked'
};

/**
 * PointToPointPicker class for measuring distances between two points in Autodesk APS Viewer.
 * Extends EventDispatcher to emit events when points are selected.
 * Provides visual feedback with tags, lines, and distance measurements.
 * 
 * @extends Autodesk.Viewing.EventDispatcher
 * 
 * @fires PointToPointPickerEvents#pointFromPicking - When the "From" point picking starts
 * @fires PointToPointPickerEvents#pointToPicking - When the "To" point picking starts
 * @fires PointToPointPickerEvents#pointFromPicked - When the "From" point is selected
 * @fires PointToPointPickerEvents#pointToPicked - When the "To" point is selected
 * 
 * @example
 * // Create and initialize the picker
 * const picker = new PointToPointPicker(viewer);
 * picker.init();
 * 
 * // Listen for picking start events
 * picker.addEventListener(PointToPointPickerEvents.pointFromPicking, (event) => {
 *   console.log('Started picking from point:', event.pointType);
 * });
 * picker.addEventListener(PointToPointPickerEvents.pointToPicking, (event) => {
 *   console.log('Started picking to point:', event.pointType);
 * });
 * 
 * // Listen for point selection events
 * picker.addEventListener(PointToPointPickerEvents.pointFromPicked, (event) => {
 *   console.log('From point selected:', event.point);
 * });
 * picker.addEventListener(PointToPointPickerEvents.pointToPicked, (event) => {
 *   console.log('To point selected:', event.point);
 * });
 * 
 * // Start picking the "From" point
 * picker.startPicking('From');
 * // Later, start picking the "To" point
 * picker.startPicking('To');
 * 
 * // Dispose of the picker when done
 * picker.dispose();
 */
class PointToPointPicker extends Autodesk.Viewing.EventDispatcher {
    /**
     * Creates a new PointToPointPicker instance.
     * @param {Autodesk.Viewing.GuiViewer3D} viewer - The Autodesk APS Viewer instance
     * @param {Object} [options={}] - Configuration options
     * @param {Object} [options.snapper] - Custom snapper instance
     * @param {Object} [options.snapperOptions] - Options for the snapper
     * @param {boolean} [options.useSvg] - Whether to use SVG for the line overlay
     */
    constructor(viewer, options = {}) {
        super();

        this.viewer = viewer;
        this.active = false;
        this.snapper = null;
        this.pickerTool = null;
        this.currentType = null; // 'From' or 'To'
        this.options = options || {};
        this.fromPoint = null;
        this.toPoint = null;
        this.unitHandler = null;

        // For SVG line
        this.SvgOverlay = null;
        this.useSvg = options.useSvg || true;
        // For WebGL line
        this.lineMat = null;
        // For previous line
        this.prevLine = null;

        // Tag overlay & instances
        this.tagOverlay = null; // TagOverlay
        this.fromTag = null;    // Tag("From")
        this.toTag = null;      // Tag("To")
        this.distTag = null;    // Tag for distance label (class 'ma-dist')

        // HUD hint
        this.hudHint = null;

        this.onPointHovered = this.onPointHovered.bind(this);
        this.onPointPicked = this.onPointPicked.bind(this);
        this.onPointPickingCanceled = this.onPointPickingCanceled.bind(this);
    }

    /**
     * Gets the default configuration options for the snapper tool.
     * @returns {Object} Default snapper options with topology rendering enabled
     * @static
     */
    static get defaultSnapperOptions() {
        return {
            //renderSnappedGeometry: true,
            renderSnappedTopology: true,
            toolName: 'das.snapper-point-to-point-picker'
        };
    }

    /**
     * Initializes all required components for the point-to-point picker.
     * Sets up unit helper, snapper, picker tool, tag overlay, and line overlay.
     * Resets point storage to initial state.
     * @async
     */
    async init() {
        await this.ensureUnitHelper();
        await this.ensureSnapper();
        this.ensurePickerTool();
        this.ensureHudHint();
        this.ensureTagOverlay();
        this.ensureLineOverlay();

        this.fromPoint = { point: null, model: null, pointLocal: null };
        this.toPoint = { point: null, model: null, pointLocal: null };
    }

    /**
     * Ensures the unit helper is loaded and available for distance formatting.
     * Loads the Edit2D extension if not already loaded and creates a DefaultUnitHandler.
     * @async
     */
    async ensureUnitHelper() {
        await this.viewer.loadExtension('Autodesk.Edit2D');
        if (!this.unitHandler) {
            this.unitHandler = new Autodesk.Edit2D.DefaultUnitHandler(this.viewer);
        }
    }

    /**
     * Ensures the HUD hint component is created and configured.
     * Creates a HudHint instance for displaying user guidance messages.
     * Initially sets the hint to be invisible until needed.
     */
    ensureHudHint() {
        if (this.hudHint) {
            return;
        }

        this.hudHint = new HudHint(this.viewer);
        this.hudHint.setVisible(false);
    }

    /**
     * Ensures the tag overlay is created and configured with all required tags.
     * Creates CrossTag instances for "From" and "To" points, and a Tag for distance display.
     * Attaches the overlay to the viewer and adds all tags to it.
     */
    ensureTagOverlay() {
        if (this.tagOverlay) {
            return;
        }
        this.tagOverlay = new TagOverlay(this.viewer);
        this.tagOverlay.attach();

        this.fromTag = new CrossTag('From', { className: 'ma-tag', crossColor: '#05a6ff', crossSize: 18 });
        this.toTag = new CrossTag('To', { className: 'ma-tag', crossColor: '#ff4d4f', crossSize: 18 });
        this.distTag = new Tag('', { className: 'ma-dist' });
        this.tagOverlay.add(this.fromTag);
        this.tagOverlay.add(this.toTag);
        this.tagOverlay.add(this.distTag);
    }

    /**
     * Ensures the line overlay is created for drawing connection lines.
     * Creates either a WebGL overlay scene with THREE.js line material or an SVG overlay
     * based on the useSvg configuration option. Initializes the appropriate resources
     * for rendering dashed lines that connect the "From" and "To" points.
     */
    ensureLineOverlay() {
        if (!this.useSvg) {
            // The connection line between fromTag and toTag
            if (!this.viewer.overlays.hasScene(PointToPointPickerOverlayName)) {
                this.viewer.overlays.addScene(PointToPointPickerOverlayName);
            }

            if (!this.lineMat) {
                this.lineMat = new THREE.LineDashedMaterial({ dashSize: 0.3, gapSize: 0.15, color: 0x00ffff, depthTest: false, depthWrite: false, transparent: true, opacity: 1.0 });
            }
        } else {
            if (!this.SvgOverlay) {
                this.SvgOverlay = new SvgOverlay(this.viewer);
                this.SvgOverlay.attach();
            }
        }
    }

    /**
     * Ensures the snapper tool is created and configured.
     * Creates a new Snapper instance with default options merged with user-provided options.
     * Uses existing snapper from options if provided.
     * @async
     */
    async ensureSnapper() {
        if (this.snapper) {
            return;
        }

        await this.viewer.loadExtension('Autodesk.Snapping');
        const options = this.options || {};
        this.snapper = options.snapper || new Autodesk.Viewing.Extensions.Snapping.Snapper(this.viewer, {
            ...PointToPointPicker.defaultSnapperOptions,
            ...(options.snapperOptions || {})
        });

        this.snapper?.setSnapToPixel(true); // keep pixel-snapping on by default
    }

    /**
     * Ensures the picker tool is created, registered, and configured with event listeners.
     * Creates a PointPickerTool instance with the snapper, registers it with the tool controller,
     * and sets up event handlers for point hovering, picking, and cancellation.
     */
    ensurePickerTool() {
        if (this.pickerTool) {
            return;
        }

        this.pickerTool = new PointPickerTool(this.viewer, { snapper: this.snapper });

        if (!this.viewer.toolController.getTool(this.pickerTool.getName())) {
            this.viewer.toolController.registerTool(this.pickerTool);
        }

        this.pickerTool.addEventListener(PointPickerEvents.PointHovered, this.onPointHovered);
        this.pickerTool.addEventListener(PointPickerEvents.PointPicked, this.onPointPicked);
        this.pickerTool.addEventListener(PointPickerEvents.PointPickingCanceled, this.onPointPickingCanceled);
    }

    /**
     * Starts the point picking process for either "From" or "To" point.
     * Activates the picker tool, clears previous data for the specified type,
     * sets up visual feedback, and dispatches the appropriate picking start event.
     * @param {string} type - The type of point to pick: "From" or "To"
     * @fires PointToPointPicker#pointFromPicking - When type is "From"
     * @fires PointToPointPicker#pointToPicking - When type is "To"
     */
    startPicking(type) { // From || To
        if (type !== 'From' && type !== 'To') {
            console.warn('[TwoPointPicker] Invalid type specified. Use "From" or "To".');
            return;
        }

        this.currentType = type;
        this.drawTag(type, null);
        this.clearLine();

        // Clear previous point of the same type
        if (type === 'From') {
            this.fromPoint = { point: null, model: null, pointLocal: null };
        }

        if (type === 'To') {
            this.toPoint = { point: null, model: null, pointLocal: null };
        }

        if (!this.viewer.toolController.isToolActivated(this.pickerTool.getName())) {
            this.viewer.toolController.activateTool(this.pickerTool.getName());
        }

        const hudText = type === 'From' ? 'Picking “From” point (press ESC to cancel)' : 'Picking “To” point (press ESC to cancel)';
        this.hudHint.setMessage(hudText);
        this.hudHint.setVisible(true);

        this.active = true;
        this.dispatchEvent({ type: type === 'From' ? Events.PointFromPicking : Events.PointToPicking, pointType: type });
    }

    /**
     * Stops the active point picking process.
     * Deactivates the picker tool, unlocks the tool controller, and clears the HUD hint.
     */
    stopPicking() {
        if (this.viewer.toolController.isToolActivated(this.pickerTool.getName())) {
            this.viewer.toolController.setIsLocked(false);
            this.viewer.toolController.deactivateTool(this.pickerTool.getName());
        }

        this.hudHint.clear();
        this.active = false;
    }

    /**
     * Disposes of all resources and cleans up the PointToPointPicker instance.
     * Removes event listeners, deregisters tools, clears both SVG and WebGL overlays,
     * disposes HUD hints, and releases memory. Should be called when the picker is no longer needed.
     */
    dispose() {
        this.stopPicking();

        if (this.pickerTool) {
            this.pickerTool.removeEventListener(PointPickerEvents.PointHovered, this.onPointHovered);
            this.pickerTool.removeEventListener(PointPickerEvents.PointPicked, this.onPointPicked);
            this.pickerTool.removeEventListener(PointPickerEvents.PointPickingCanceled, this.onPointPickingCanceled);

            if (this.viewer.toolController.getTool(this.pickerTool.getName())) {
                this.viewer.toolController.deregisterTool(this.pickerTool);
            }

            this.pickerTool = null;
        }

        if (this.snapper) {
            if (this.viewer.toolController.getTool(this.snapper.getName())) {
                this.viewer.toolController.deregisterTool(this.snapper);
            }
            this.snapper = null;
        }

        this.viewer = null;
        this.currentType = null;
        this.fromPoint = null;
        this.toPoint = null;
        this.clearAll();

        if (this.tagOverlay) {
            this.tagOverlay.clearAll();
            this.tagOverlay.detach();
            this.tagOverlay = null;
        }

        if (this.SvgOverlay) {
            this.SvgOverlay.clearAll();
            this.SvgOverlay.detach();
            this.SvgOverlay = null;
        }

        if (this.hudHint) {
            this.hudHint.dispose();
            this.hudHint = null;
        }

        this.unitHandler = null;
        this.fromTag = null;
        this.toTag = null;
        this.distTag = null;

        if (this.viewer.overlays.hasScene(PointToPointPickerOverlayName)) {
            this.viewer.overlays.removeScene(PointToPointPickerOverlayName);
        }

        if (this.lineMat) {
            this.lineMat.dispose();
            this.lineMat = null;
        }

        this.active = false;
    }

    /**
     * Clears all tag instances and resets point data.
     * Removes visual tags from the display and resets internal point storage.
     */
    clearTags() {
        this.fromPoint = { point: null, modelId: null };
        this.toPoint = { point: null, modelId: null };
        this.currentType = null;
        this.tagOverlay?.clearAll();
    }

    /**
     * Clears the connection line between points.
     * Removes the line from the overlay (either THREE.js mesh or SVG line) and disposes of its resources.
     * Handles both WebGL and SVG line types based on the current line instance type.
     */
    clearLine() {
        if (this.prevLine) {
            if (this.prevLine instanceof THREE.Line) {
                this.viewer.overlays.removeMesh(this.prevLine, PointToPointPickerOverlayName);
                this.prevLine.geometry.dispose();
                this.prevLine.material.dispose();
                this.prevLine = null;
            }

            if (this.prevLine instanceof SvgLine) {
                this.prevLine.clear();
                this.SvgOverlay.refresh();
                this.prevLine = null;
            }
        }
    }

    /**
     * Clears the distance tag display.
     * Removes the distance measurement text and hides the distance tag,
     * then refreshes the tag overlay to update the visual display.
     */
    clearDistTag() {
        this.distTag.setText('');
        this.distTag.setWorld(null);
        this.tagOverlay.refresh();
    }

    /**
     * Clears all visual elements including tags and connection lines.
     * Combines clearTags() and clearLine() for complete cleanup.
     */
    clearAll() {
        this.clearTags();
        this.clearLine();
        this.clearDistTag();
    }

    /**
     * Draws or updates a tag at the specified world position.
     * Updates the position of either the "From" or "To" tag and refreshes the overlay.
     * @param {string} type - The type of tag: "From" or "To"
     * @param {THREE.Vector3|null} point - The world position for the tag, or null to hide
     */
    drawTag(type, point) {
        if (type === 'From') {
            this.fromTag?.setWorld(point);
        }

        if (type === 'To') {
            this.toTag?.setWorld(point);
        }

        this.tagOverlay?.refresh();
    }

    /**
     * Draws a connection line between two points.
     * Creates either a THREE.js dashed line geometry or an SVG line based on the useSvg setting.
     * Only draws if no previous line exists.
     * @param {THREE.Vector3} startPoint - The starting point of the line
     * @param {THREE.Vector3} endPoint - The ending point of the line
     */
    drawLine(startPoint, endPoint) {
        // Draw only if no previous line exists
        if (this.prevLine || !startPoint || !endPoint) {
            return;
        }

        if (!this.useSvg) {
            const lineGeo = new THREE.BufferGeometry();
            const lineIndices = [];
            const lineVertices = [];
            lineVertices.push(...startPoint.toArray());
            lineVertices.push(...endPoint.toArray());
            lineIndices.push(0, 1);
            lineGeo.setAttribute('index', new THREE.BufferAttribute(new Uint32Array(lineIndices), 1));
            lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lineVertices), 3));
            lineGeo.isLines = true;

            // ensure bounds exist
            lineGeo.computeBoundingSphere();
            lineGeo.computeBoundingBox();

            const line = new THREE.Line(lineGeo, this.lineMat);
            line.computeLineDistances();

            // r71: make sure it's never culled and draws last
            line.frustumCulled = false;
            line.renderDepth = 1e6; // r71-era ordering hint

            this.viewer.overlays.addMesh(line, PointToPointPickerOverlayName);
            this.prevLine = line;
        } else {
            const lineStyle = new SvgLineStyle({ color: '#00ffff', dash: '6,6', width: 2, opacity: 0.8 });
            const line = new SvgLine(lineStyle);
            line.setWorld(startPoint, endPoint);
            this.prevLine = line;

            this.SvgOverlay.add(line);
            this.SvgOverlay.refresh();
        }
    }

    /**
     * Updates an existing line with new start and end points.
     * If no line exists, creates a new one. Otherwise updates the geometry (for WebGL lines)
     * or world coordinates (for SVG lines) of the existing line with new positions.
     * @param {THREE.Vector3} startPoint - The new starting point of the line
     * @param {THREE.Vector3} endPoint - The new ending point of the line
     */
    updateLine(startPoint, endPoint) {
        if (!this.prevLine) {
            this.drawLine(startPoint, endPoint);
        } else {
            if (!this.useSvg) {
                const lineGeo = this.prevLine.geometry;
                const lineVertices = [];
                lineVertices.push(...startPoint.toArray());
                lineVertices.push(...endPoint.toArray());
                lineGeo.attributes.position.array = new Float32Array(lineVertices);
                lineGeo.attributes.position.needsUpdate = true;
                lineGeo.computeBoundingSphere();
                lineGeo.computeBoundingBox();
                this.prevLine.computeLineDistances();
            } else {
                this.prevLine.setWorld(startPoint, endPoint);
                this.SvgOverlay.refresh();
            }
        }
    }

    /**
     * Updates both From and To points and refreshes all visual elements accordingly.
     * Stores the provided point data, updates tag positions, draws connection lines,
     * calculates and displays distance measurements between the points. This method
     * provides a comprehensive update of the picker's visual state.
     * 
     * @param {Object|null} fromPoint - The From point data object, or null to clear
     * @param {THREE.Vector3} fromPoint.point - The 3D world position of the From point
     * @param {string} fromPoint.modelId - The ID of the model containing the From point
     * @param {Object|null} toPoint - The To point data object, or null to clear
     * @param {THREE.Vector3} toPoint.point - The 3D world position of the To point
     * @param {string} toPoint.modelId - The ID of the model containing the To point
     * 
     * @example
     * // Update both points with new data
     * const fromData = {
     *   point: new THREE.Vector3(0, 0, 0),
     *   modelId: '5'
     * };
     * const toData = {
     *   point: new THREE.Vector3(10, 5, 0),
     *   modelId: '5'
     * };
     * picker.updatePoints(fromData, toData);
     * 
     * // Clear the From point while keeping the To point
     * picker.updatePoints(null, toData);
     * 
     * // Clear both points
     * picker.updatePoints(null, null);
     */
    updatePoints(fromPoint, toPoint) {
        this.fromPoint = fromPoint ? { point: fromPoint.point.clone(), modelId: fromPoint.modelId } : { point: null, modelId: null };
        this.toPoint = toPoint ? { point: toPoint.point.clone(), modelId: toPoint.modelId } : { point: null, modelId: null };

        // console.log('PointToPointPicker: updatePoints', this.fromPoint?.point, this.toPoint?.point);

        this.drawTag('From', this.fromPoint?.point || null);
        this.drawTag('To', this.toPoint?.point || null);

        if (this.fromPoint?.point && this.toPoint?.point) {
            this.updateLine(this.fromPoint.point, this.toPoint.point);

            const offset = new THREE.Vector3().subVectors(this.toPoint.point, this.fromPoint.point);
            const dx = Math.abs(offset.x);
            const dy = Math.abs(offset.y);
            const dz = Math.abs(offset.z);
            const dxConverted = this.unitHandler ? this.unitHandler.lengthToString(dx) : dx;
            const dyConverted = this.unitHandler ? this.unitHandler.lengthToString(dy) : dy;
            const dzConverted = this.unitHandler ? this.unitHandler.lengthToString(dz) : dz;
            const text = `ΔX: ${dxConverted}  ΔY: ${dyConverted}  ΔZ: ${dzConverted}`;
            this.distTag.setText(text);

            // Position the dist tag at the midpoint between fromPoint and toPoint
            const midPoint = new THREE.Vector3().addVectors(this.fromPoint.point, this.toPoint.point).multiplyScalar(0.5);
            this.distTag.setWorld(midPoint);
        } else {
            this.clearLine();
            this.clearDistTag();
        }

        this.tagOverlay?.refresh();
    }

    /**
     * Handles point hover events from the picker tool.
     * Updates tag positions and displays real-time distance measurements
     * as the user moves the cursor over potential pick points.
     * @param {Object} event - The hover event containing point and model information
     * @param {THREE.Vector3} event.point - The hovered point in world coordinates
     * @param {string} event.modelId - The ID of the model containing the point
     */
    onPointHovered(event) {
        const { point, modelId } = event;

        if (this.currentType === 'From') {
            this.drawTag('From', point);
        } else if (this.currentType === 'To') {
            this.drawTag('To', point);
        }

        let startPoint = this.fromPoint?.point || this.toPoint?.point

        // Update distance tag if both points are set
        if (startPoint && point && this.distTag) {
            this.updateLine(startPoint, point);
            const offset = new THREE.Vector3().addVectors(startPoint, point);

            const dx = Math.abs(offset.x);
            const dy = Math.abs(offset.y);
            const dz = Math.abs(offset.z);
            const dxConverted = this.unitHandler ? this.unitHandler.lengthToString(dx) : dx;
            const dyConverted = this.unitHandler ? this.unitHandler.lengthToString(dy) : dy;
            const dzConverted = this.unitHandler ? this.unitHandler.lengthToString(dz) : dz;
            const text = `ΔX: ${dxConverted}  ΔY: ${dyConverted}  ΔZ: ${dzConverted}`;
            this.distTag.setText(text);

            // Position the dist tag at the midpoint between fromPoint and current hovered point
            const midPoint = offset.multiplyScalar(0.5);
            this.distTag.setWorld(midPoint);
        } else if (this.distTag) {
            this.distTag.setText('');
            this.distTag.setWorld(null);
        }

        this.tagOverlay?.refresh();
    }

    /**
     * Handles point selection events from the picker tool.
     * Stores the selected point, updates the visual display, sets the camera pivot,
     * and dispatches the appropriate event (PointFromPicked or PointToPicked).
     * @param {Object} event - The pick event containing point and model information
     * @param {THREE.Vector3} event.point - The picked point in world coordinates
     * @param {string} event.modelId - The ID of the model containing the point
     */
    onPointPicked(event) {
        const { point, modelId } = event;

        this.stopPicking();

        this.viewer.navigation.setPivotPoint(point);

        let finalEventType = '';
        if (this.currentType === 'From') {
            this.fromPoint = { point: point.clone(), modelId };
            this.drawTag('From', point);
            finalEventType = Events.PointFromPicked;
        } else if (this.currentType === 'To') {
            this.toPoint = { point: point.clone(), modelId };
            this.drawTag('To', point);
            finalEventType = Events.PointToPicked;
        }

        this.dispatchEvent({ type: finalEventType, point: point.clone(), modelId });
        this.currentType = null;
    }

    /**
     * Handles point picking cancellation events from the picker tool.
     * Clears any temporary visual elements (lines, distance tag, and current tag), 
     * and stops the picking process. Typically triggered when the user presses ESC 
     * or cancels the picking operation.
     */
    onPointPickingCanceled() {
        this.clearLine();
        this.clearDistTag();
        this.drawTag(this.currentType, null);
        this.stopPicking();
    }
}

export { PointToPointPicker, Events as PointToPointPickerEvents, PointTypes as PointToPointPickerTypes };