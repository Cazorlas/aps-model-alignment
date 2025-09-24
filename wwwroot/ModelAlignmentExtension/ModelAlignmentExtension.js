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

import { PointToPointPicker, PointToPointPickerEvents, PointToPointPickerTypes } from './Pickers/PointToPointPicker.js';
import { TransformUtils } from './TransformUtils.js';
import { ModelUtils } from './ModelUtils.js';
import { ModelAlignmentPanel } from './ModelAlignmentPanel.js';
import { easeInOutCubic } from './AnimationEasingOptions.js';

const EXT_NAME = 'Autodesk.DeveloperAdvocacySupport.ModelAlignmentExtension';
const Events = {
    ModelTransformed: 'das.model-transformed',
    ...PointToPointPickerEvents
};

/**
 * ModelAlignmentExtension provides tools for aligning and transforming models in the Autodesk APS Viewer.
 * This extension enables point-to-point picking, model transformation, and visual feedback for model alignment operations.
 * 
 * @extends Autodesk.Viewing.Extension
 * 
 * @example
 * // Load the extension
 * const viewer = new Autodesk.Viewing.GuiViewer3D(container);
 * await viewer.loadExtension('ModelAlignmentExtension', {
 *   // extension options
 * });
 */
class ModelAlignmentExtension extends Autodesk.Viewing.Extension {
    /**
     * Creates a new ModelAlignmentExtension instance.
     * Initializes the extension with the given viewer and configuration options.
     * Sets up internal state for model selection, transformation tracking, extension loading flags,
     * and UI components. Binds event handler methods to ensure proper context.
     * 
     * @param {Autodesk.Viewing.GuiViewer3D} viewer - The Autodesk APS Viewer instance
     * @param {Object} [options={}] - Configuration options for the extension
     * @param {THREE.Vector4} [options.selectionColor] - Custom color for selected model highlighting
     * 
     * @example
     * // Extension is typically instantiated automatically by the viewer
     * const extension = new ModelAlignmentExtension(viewer, {
     *   selectionColor: new THREE.Vector4(0, 1, 0, 0.3) // Custom green highlight
     * });
     */
    constructor(viewer, options) {
        super(viewer, options);
        Autodesk.Viewing.EventDispatcher.prototype.apply(this);

        this.viewer = viewer;
        this.options = options;

        // State
        this.edit2dLoaded = false;
        this.snappingLoaded = false;
        this.selectionColor = new THREE.Vector4(255 / 255, 255 / 255, 0 / 255, 0.35);
        this.uiCreated = false;

        // Accumulated stats (by model.id)
        this.accumulatedState = new Map(); // { translation: THREE.Vector3, rotDegZ: number }

        // Utilities
        this.panel = null;
        this.pointToPointPicker = null;

        // UI controls
        this.group = null;
        this.btn = null;
        this.panel = null;

        this.createUI = this.createUI.bind(this);
        this.onToolbarCreated = this.onToolbarCreated.bind(this);
        this.onPanelVisibilityChanged = this.onPanelVisibilityChanged.bind(this);
        this.onModelTransformed = this.onModelTransformed.bind(this);
    }

    /**
     * Ensures the Autodesk.Edit2D extension is loaded and available.
     * This extension provides measurement and editing utilities required for advanced
     * model alignment operations. Sets the edit2dLoaded flag based on successful loading.
     * 
     * @async
     * @returns {Promise<void>}
     * @throws {Error} Logs warning if Edit2D extension fails to load
     * 
     * @example
     * // Load Edit2D extension before using measurement features
     * await extension.ensureEdit2dLoaded();
     * if (extension.edit2dLoaded) {
     *   // Use Edit2D functionality
     * }
     */
    async ensureEdit2dLoaded() {
        // Load the Autodesk.Edit2D extension explicitly
        if (this.edit2dLoaded) return;

        try {
            const ext = await this.viewer.loadExtension('Autodesk.Edit2D'); //!<< Viewer will get existing ext or load one if not yet loaded
            this.edit2dLoaded = !!ext;
        } catch (error) {
            console.warn(`[${EXT_NAME}] Failed to load Autodesk.Edit2D:`, error);
            this.edit2dLoaded = false;
        }
    }

    /**
     * Ensures the Autodesk.Snapping extension is loaded and available.
     * This extension is required for point-to-point picking functionality.
     * Sets the snappingLoaded flag based on successful loading.
     * 
     * @async
     * @returns {Promise<void>}
     * @throws {Error} Logs warning if snapping extension fails to load
     */
    async ensureSnappingLoaded() {
        // Load the Autodesk.Snapping extension explicitly
        try {
            const ext = await this.viewer.loadExtension('Autodesk.Snapping'); //!<< Viewer will get existing ext or load one if not yet loaded
            this.snappingLoaded = !!ext;
        } catch (error) {
            console.warn(`[${EXT_NAME}] Failed to load Autodesk.Snapping:`, error);
            this.snappingLoaded = false;
        }
    }

    /**
     * Ensures the PointToPointPicker utility is created and initialized.
     * Creates a new PointToPointPicker instance if one doesn't exist and initializes it.
     * This tool enables users to pick points for alignment and measurement operations.
     * 
     * @throws {Error} Logs warning if PointToPointPicker fails to initialize
     */
    ensurePointToPointPicker() {
        if (this.pointToPointPicker) return;

        try {
            this.pointToPointPicker = new PointToPointPicker(this.viewer);
            this.pointToPointPicker.init();
        } catch (error) {
            console.warn(`[${EXT_NAME}] Failed to initialize PointToPointPicker:`, error);
            this.pointToPointPicker = null;
        }
    }

    /**
     * Initializes the extension by ensuring all required dependencies are loaded.
     * Loads the snapping extension and initializes the point-to-point picker.
     * This method should be called before using any extension functionality.
     * Note: Edit2D extension loading is handled separately when needed.
     * 
     * @async
     * @returns {Promise<void>}
     * 
     * @example
     * // Initialize extension dependencies
     * await extension.init();
     * // Extension is now ready for use
     */
    async init() {
        await this.ensureSnappingLoaded();
        this.ensurePointToPointPicker();
    }

    /**
     * Creates and initializes the user interface for the extension.
     * Sets up the model alignment panel, toolbar button, and control group.
     * Creates event listeners for panel visibility changes and button interactions.
     * 
     * @returns {void} Returns early if no toolbar is available
     * 
     * @example
     * // Called automatically during extension initialization
     * // or manually when toolbar is ready
     * extension.createUI();
     */
    createUI() {
        const toolbar = this.viewer.getToolbar();
        if (!toolbar) return;

        // Create the alignment panel
        this.panel = new ModelAlignmentPanel(this);

        this.group = new Autodesk.Viewing.UI.ControlGroup('das.model-alignment-tools');
        this.btn = new Autodesk.Viewing.UI.Button('das.model-alignment-tools-btn');
        this.btn.setToolTip('Model Alignment Tool');
        this.btn.onClick = () => {
            this.panel.setVisible(!this.panel.isVisible());
        };
        const coordinationIconUrl = 'https://img.icons8.com/ios/50/coordinate-system'; // Ensure the icon file exists at this path
        const icon = this.btn.container.querySelector('.adsk-button-icon');
        if (icon) {
            icon.style.backgroundImage = `url(${coordinationIconUrl})`;
            icon.style.backgroundSize = `24px`;
            icon.style.backgroundRepeat = `no-repeat`;
            icon.style.backgroundPosition = `center`;
            icon.style.filter = 'drop-shadow(1px 1px 1px rgba(0,0,0,0.3))';
            icon.style.backgroundSize = `26px`; // Slightly larger for more prominence
        }
        this.group.addControl(this.btn);
        toolbar.addControl(this.group);

        this.panel.addVisibilityListener(this.onPanelVisibilityChanged);

        this.uiCreated = true;
    }

    /**
     * Handles panel visibility change events.
     * Called when the model alignment panel is shown or hidden. Updates the button state
     * to reflect the panel's visibility and notifies the viewer of panel visibility changes.
     * 
     * @param {boolean} visible - Whether the panel is now visible or hidden
     * @returns {void}
     * 
     * @example
     * // This method is automatically called when panel visibility changes
     * // You don't typically call this directly, but it can be useful for testing
     * extension.onPanelVisibilityChanged(true); // Panel is now visible
     */
    onPanelVisibilityChanged(visible) {
        if (visible)
            this.viewer.onPanelVisible(this.panel, this.viewer);

        this.btn.setState(visible ? Autodesk.Viewing.UI.Button.State.ACTIVE : Autodesk.Viewing.UI.Button.State.INACTIVE);
    }

    /**
     * Handles toolbar creation events.
     * Called when the viewer's toolbar is created. Ensures the UI is only created once
     * by checking the uiCreated flag before proceeding with UI initialization.
     * 
     * @returns {void} Returns early if UI has already been created
     * 
     * @example
     * // This method is typically called automatically by the viewer
     * // when the toolbar is ready, but can be called manually if needed
     * extension.onToolbarCreated();
     */
    onToolbarCreated() {
        if (this.uiCreated) return;

        this.createUI();
        this.uiCreated = true;
    }

    /**
     * Handles model transformation events from the viewer.
     * Called when a model transformation event is received, typically from internal
     * operations or external sources. Synchronizes the accumulated state and re-dispatches
     * the event to maintain consistency across all extension components.
     * 
     * @param {Object} event - The model transformation event object
     * @param {number} event.modelId - The ID of the model that was transformed
     * @returns {void} Returns early if event or modelId is invalid
     * 
     * @example
     * // This method is typically called automatically by the viewer
     * // but can be triggered manually for testing or integration
     * const transformEvent = { modelId: 5 };
     * extension.onModelTransformed(transformEvent);
     */
    onModelTransformed(event) {
        const modelId = event?.modelId;
        if (!modelId) return;

        const model = ModelUtils.findModelById(this.viewer, modelId);
        if (!model) return;

        this.syncAccFromModel(model);
        this.dispatchEvent({ type: Events.ModelTransformed, modelId: model.id, matrix: event.matrix });
    }

    /**
     * Synchronizes the accumulated transformation state from a model's current placement matrix.
     * Extracts translation and Z-rotation values from the model's placement transform
     * and stores them in the internal accumulated state tracking.
     * 
     * @param {Autodesk.Viewing.Model} model - The model to sync state from
     * @returns {void} Returns early if model is null or undefined
     */
    syncAccFromModel(model) {
        if (!model) return;
        const matrix = TransformUtils.getPlacementMatrix(model);
        const e = matrix.elements; // r71 column-major
        // Translation comes from m[12..14]
        const tx = e[12] || 0, ty = e[13] || 0, tz = e[14] || 0;
        // Extract Z-rotation from matrix (assuming no shear): atan2(m10, m00)
        const rotZDeg = Math.atan2(e[4] || 0, e[0] || 1) * 180 / Math.PI;
        this.accumulatedState.set(model.id, {
            translation: new THREE.Vector3(tx, ty, tz),
            rotDegZ: rotZDeg
        });
    }

    /**
     * Applies visual theming to highlight the specified model.
     * Colors the entire model with the selection color to provide visual feedback
     * that the model is currently selected for alignment operations.
     * 
     * @param {Autodesk.Viewing.Model} model - The model to apply theming to
     * @returns {void} Returns early if model is null or has no instance tree
     */
    applyTheming(model) {
        ModelUtils.applyThemingToModel(this.viewer, model, this.selectionColor);
    }

    /**
     * Clears visual theming from the specified model.
     * Removes all theming colors from the model, returning it to its original appearance.
     * Used to deselect models or reset visual highlighting.
     * 
     * @param {Autodesk.Viewing.Model} model - The model to clear theming from
     * @returns {void} Returns early if model is null
     */
    clearTheming(model) {
        ModelUtils.clearThemingFromModel(this.viewer, model);
    }

    /**
     * Initiates point picking for model alignment operations.
     * Starts the point-to-point picker to capture a specific point (From or To) and returns
     * a promise that resolves with the selected point data when picking is complete.
     * 
     * @async
     * @param {string} type - The type of point to pick (use PointToPointPickerTypes.From or PointToPointPickerTypes.To)
     * @returns {Promise<Object>} Promise that resolves with picked point data
     * @returns {THREE.Vector3} returns.point - The picked 3D world position (cloned)
     * @returns {string|null} returns.modelId - The ID of the model containing the picked point
     * @throws {Error} Rejects if PointToPointPicker is not initialized
     * 
     * @example
     * // Pick a "From" point for alignment
     * try {
     *   const fromPoint = await extension.pickPoint(PointToPointPickerTypes.From);
     *   console.log('From point:', fromPoint.point, 'Model:', fromPoint.modelId);
     * } catch (error) {
     *   console.error('Point picking failed:', error);
     * }
     * 
     * // Pick a "To" point for alignment
     * const toPoint = await extension.pickPoint(PointToPointPickerTypes.To);
     */
    async pickPoint(type) {
        return new Promise((resolve, reject) => {
            if (!this.pointToPointPicker) {
                reject(new Error('PointToPointPicker not initialized'));
                return;
            }

            this.pointToPointPicker.startPicking(type);

            const onPicked = (event) => {
                resolve({
                    point: event.point.clone(),
                    modelId: event.modelId || null
                });
            };

            const eventType = type === PointToPointPickerTypes.From ? PointToPointPickerEvents.PointFromPicked : PointToPointPickerEvents.PointToPicked;

            this.pointToPointPicker.addEventListener(eventType, onPicked, { once: true });
        });
    }

    /**
     * Clears all picked points and resets the point-to-point picker state.
     * This method removes any previously selected From and To points and 
     * resets the picker tool to its initial state for new point selection.
     * 
     * @returns {void}
     * @throws {Error} Throws if PointToPointPicker is not initialized
     * 
     * @example
     * // Clear all picked points before starting new alignment
     * extension.clearPicks();
     * 
     * // Clear picks when user cancels alignment operation
     * const cancelButton = document.getElementById('cancel-alignment');
     * cancelButton.addEventListener('click', () => {
     *   extension.clearPicks();
     * });
     * 
     * @see {@link PointToPointPicker.clearPicks} for underlying implementation
     */
    clearPicks() {
        if (this.pointToPointPicker) {
            this.pointToPointPicker.clearAll();
        }
    }

    /**
     * Animates the camera to fit the specified model in the viewer.
     * Moves the model so its bounding box center aligns with the current view target,
     * then updates the accumulated transformation state to reflect the new position.
     * 
     * @async
     * @param {Autodesk.Viewing.Model} model - The model to fit to view
     * @returns {Promise<void>} Promise that resolves when the animation completes
     */
    async fitToView(model) {
        if (!model) return;

        await TransformUtils.animateModelToViewTargetAsync(this.viewer, model, {
            duration: 1500,
            easing: easeInOutCubic,
            onUpdate: this.onModelTransformed
        });
        this.syncAccFromModel(model);

        this.dispatchEvent({ type: Events.ModelTransformed, modelId: model.id });
    }

    async animatePickerPoints(fromPoint, toPoint) {
        if (!this.pointToPointPicker) return;

        const target = toPoint.clone();

        await TransformUtils.animatePointAsync(fromPoint.clone(), target, {
            duration: 1500,
            easing: easeInOutCubic,
            onUpdate: ({ t, point }) => {
                this.pointToPointPicker.updatePoints({ point }, { point: target });
            }
        });
    }

    /**
     * Translates the specified model by the given offset values.
     * Applies a smooth animated translation to move the model by the specified
     * displacement values in world coordinates, then updates the accumulated state.
     * 
     * @async
     * @param {Autodesk.Viewing.Model} model - The model to translate
     * @param {number} dx - Translation distance along the X-axis
     * @param {number} dy - Translation distance along the Y-axis  
     * @param {number} dz - Translation distance along the Z-axis
     * @returns {Promise<void>} Promise that resolves when the translation animation completes
     */
    async applyTranslation(model, dx, dy, dz) {
        if (!model) return;

        await TransformUtils.translateModelAsync(this.viewer, model, dx, dy, dz, {
            animate: true,
            duration: 1500,
            easing: easeInOutCubic,
            onUpdate: this.onModelTransformed
        });
        this.syncAccFromModel(model);

        this.dispatchEvent({ type: Events.ModelTransformed, modelId: model.id });
    }

    /**
     * Applies rotational transformation to the specified model.
     * Rotates the model by the given Z-axis rotation increment and updates the accumulated
     * transformation state. The rotation is applied relative to the model's current rotation.
     * Uses the accumulated state to maintain proper transformation composition.
     * 
     * @async
     * @param {Autodesk.Viewing.Model} model - The model to rotate
     * @param {number} dRotDegZ - Rotation increment in degrees around the Z-axis (positive = counter-clockwise)
     * @returns {Promise<void>} Promise that resolves when the rotation is applied
     * 
     * @example
     * // Rotate model 45 degrees counter-clockwise around Z-axis
     * await extension.applyRotation(model, 45);
     * 
     * // Rotate model 90 degrees clockwise around Z-axis
     * await extension.applyRotation(model, -90);
     */
    async applyRotation(model, dRotDegZ) {
        if (!model) return;

        const acc = this.accumulatedState.get(model.id) || { translation: new THREE.Vector3(0, 0, 0), rotDegZ: 0 };
        const newRotDegZ = (acc.rotDegZ || 0) + (dRotDegZ || 0);
        const matrix = TransformUtils.composeMatrix(acc.translation, new THREE.Euler(0, 0, THREE.Math.degToRad(newRotDegZ)));
        await this.applyMatrix(model, matrix);

        this.dispatchEvent({ type: Events.ModelTransformed, modelId: model.id });
    }

    /**
     * Applies a transformation matrix to the specified model.
     * Sets the model's placement transform to the provided matrix and updates
     * the accumulated transformation state to reflect the new transform.
     * 
     * @async
     * @param {Autodesk.Viewing.Model} model - The model to transform
     * @param {THREE.Matrix4} matrix - The transformation matrix to apply
     * @returns {Promise<void>} Promise that resolves when the transform is applied
     */
    async applyMatrix(model, matrix) {
        if (!model || !matrix) return;

        await TransformUtils.animateModelMatrixAsync(this.viewer, model, null, matrix, {
            duration: 1500,
            easing: easeInOutCubic,
            onUpdate: this.onModelTransformed
        });
        this.syncAccFromModel(model);

        this.dispatchEvent({ type: Events.ModelTransformed, modelId: model.id });
    }

    /**
     * Checks if the alignment service extension is available.
     * Verifies whether the ModelAlignmentService extension is registered
     * and available for use. Logs a warning if the service is not found.
     * 
     * @returns {boolean} True if alignment service extension exists, false otherwise
     * 
     * @example
     * if (extension.isAlignmentServiceExists()) {
     *   // Use alignment service features
     *   const service = await extension.getAlignmentService();
     * }
     */
    isAlignmentServiceExists() {
        const alignmentServiceExtName = this.options.alignmentService || 'Autodesk.DeveloperAdvocacySupport.ModelAlignmentService';
        const hasExt = Autodesk.Viewing.theExtensionManager.registeredExtensions.has(alignmentServiceExtName);
        if (!hasExt) {
            console.warn(`[${EXT_NAME}] AlignmentService extension is not available.`);
            return false;
        }
        return hasExt;
    }

    /**
     * Gets the alignment service extension instance.
     * Retrieves the ModelAlignmentService extension if it's available,
     * or returns null if the service is not registered or loaded.
     * 
     * @async
     * @returns {Promise<Object|null>} The alignment service extension instance, or null if not available
     * @throws {Error} Logs warning if alignment service extension is not available
     * 
     * @example
     * const alignmentService = await extension.getAlignmentService();
     * if (alignmentService) {
     *   // Use alignment service methods
     *   await alignmentService.saveTransform(transformData);
     * }
     */
    async getAlignmentService() {
        if (!this.isAlignmentServiceExists()) return null;

        const alignmentServiceExtName = this.options.alignmentService || 'Autodesk.DeveloperAdvocacySupport.ModelAlignmentService';
        const ext = await this.viewer.getExtension(alignmentServiceExtName);
        if (!ext) {
            console.warn(`[${EXT_NAME}] AlignmentService extension is not available.`);
            return null;
        }
        return ext;
    }

    /**
     * Saves the current transformation state of a model.
     * Captures the model's current placement matrix and accumulated transformation data,
     * then attempts to save it using the alignment service or local storage fallback.
     * Includes model metadata like URN, name, and viewable ID for complete persistence.
     * 
     * @async
     * @param {Autodesk.Viewing.Model} model - The model whose transformation to save
     * @returns {Promise<void>} Promise that resolves when save operation completes
     * @throws {Error} Logs warnings if model data is missing or alignment service unavailable
     * 
     * @example
     * // Save current model transformation
     * await extension.saveTransform(selectedModel);
     * 
     * // The saved data includes:
     * // - Model URN and viewable ID
     * // - Current transformation matrix
     * // - Accumulated translation and rotation values
     */
    async saveTransform(model) {
        if (!model) return;

        const acc = this.accumulatedState.get(model.id);
        if (!acc) return;

        const transform = TransformUtils.getPlacementMatrix(model);
        if (!transform) return;

        const name = ModelUtils.getModelName(model);
        const viewableData = ModelUtils.getViewableData(model);
        const viewableId = viewableData?.viewableId || '';
        const urn = viewableData?.urn || '';

        // Prepare data to save
        const data = {
            urn,
            name,
            viewableId,
            transform: Array.from(transform.elements),
            accumulation: {
                translation: {
                    x: acc.translation.x,
                    y: acc.translation.y,
                    z: acc.translation.z
                },
                rotDegZ: acc.rotDegZ
            }
        };

        // Simulate saving the transform data (e.g., to a server or local storage)
        console.log(`Saving transform for model ${model.id}:`, data);

        const alignmentService = await this.getAlignmentService();
        if (!alignmentService) {
            console.warn(`[${EXT_NAME}] Saving transform by download only because AlignmentService extension is not available.`);

            // Simulate downloading the transform data
            this.saveTransformDataAsJsonFile(data);
            return;
        }

        try {
            await alignmentService.saveModelTransform(data);
            console.log(`Transform for model ${model.id} saved successfully via AlignmentService.`);
        } catch (error) {
            console.error(`[${EXT_NAME}] Failed to save transform via AlignmentService:`, error);
            console.warn(`[${EXT_NAME}] Saving transform by download only due to error.`);

            // Simulate downloading the transform data
            this.saveTransformDataAsJsonFile(data);
        }
    }

    /**
     * Downloads transformation data as a JSON file to the user's local system.
     * Creates a downloadable JSON file containing model transformation data when
     * server-side persistence is unavailable. This provides a fallback mechanism
     * for users to save and potentially restore transformation states manually.
     * 
     * @param {Object} data - The transformation data object to save
     * @param {string} data.urn - The model's URN identifier
     * @param {string} data.name - The human-readable model name
     * @param {string} data.viewableId - The viewable ID from the document node
     * @param {number[]} data.transform - The transformation matrix as an array of 16 elements
     * @param {Object} data.accumulation - The accumulated transformation state
     * @param {string} [filename='model-transform.json'] - The filename for the downloaded file
     * @returns {void} Returns early if data is null or undefined
     * 
     * @example
     * // Save transformation data with default filename
     * const transformData = {
     *   urn: 'urn:adsk.objects:os.object:bucket/model.rvt',
     *   name: 'Building Model',
     *   viewableId: 'viewable-123',
     *   transform: [...matrixElements],
     *   accumulation: { translation: {x:0, y:0, z:0}, rotDegZ: 0 }
     * };
     * extension.saveTransformDataAsJsonFile(transformData);
     * 
     * // Save with custom filename
     * extension.saveTransformDataAsJsonFile(transformData, 'building-alignment.json');
     */
    saveTransformDataAsJsonFile(data, filename = 'model-transform.json') {
        if (!data) return;

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Extension load lifecycle method.
     * Called when the extension is loaded into the viewer. Initializes all required
     * dependencies including snapping extension and point-to-point picker. This ensures
     * the extension is fully ready for use immediately after loading.
     * 
     * @returns {boolean} Always returns true to indicate successful loading
     * 
     * @example
     * // Extension is automatically loaded by the viewer
     * // The load method ensures all dependencies are initialized
     * viewer.loadExtension('ModelAlignmentExtension');
     */
    load() {
        this.ensureEdit2dLoaded();
        this.ensureSnappingLoaded();
        this.ensurePointToPointPicker();

        console.log(`${EXT_NAME} loaded`);
        return true;
    }

    /**
     * Extension unload lifecycle method.
     * Called when the extension is unloaded from the viewer. Performs comprehensive cleanup
     * including hiding and disposing of the panel, removing UI controls, disposing of utilities,
     * clearing accumulated state, and resetting all flags. Ensures no memory leaks or orphaned resources.
     * 
     * @returns {boolean} Always returns true to indicate successful unloading
     * 
     * @example
     * // Extension is automatically unloaded by the viewer
     * // The unload method ensures complete cleanup
     * viewer.unloadExtension('ModelAlignmentExtension');
     */
    unload() {
        if (this.panel) {
            this.panel.setVisible(false);
            this.panel.uninitialize();
            this.panel = null;
        }

        if (this.btn) {
            this.btn.setState(Autodesk.Viewing.UI.Button.State.INACTIVE);
            this.btn.removeFromParent();
            this.btn = null;
        }

        if (this.group && this.viewer.getToolbar()) {
            this.viewer.getToolbar().removeControl(this.group.getId());
            this.group = null;
        }

        if (this.pointToPointPicker) {
            this.pointToPointPicker.dispose();
            this.pointToPointPicker = null;
        }

        this.accumulatedState.clear();
        this.uiCreated = false;
        this.snappingLoaded = false;
        this.edit2dLoaded = false;

        console.log(`${EXT_NAME} unloaded`);
        return true;
    }
}

Autodesk.Viewing.theExtensionManager.registerExtension(EXT_NAME, ModelAlignmentExtension);

export { ModelAlignmentExtension, PointToPointPickerTypes, Events as ModelAlignmentEvents };