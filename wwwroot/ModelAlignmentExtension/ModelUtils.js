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

/**
 * ModelUtils provides utility methods for working with Autodesk APS Viewer models.
 * This class contains static methods for model theming, visual feedback, and common
 * model manipulation operations in the Autodesk APS Viewer environment.
 * 
 * @class
 * @static
 * 
 * @example
 * // Apply theming to highlight a model
 * const highlightColor = new THREE.Vector4(1, 1, 0, 0.5); // Yellow with transparency
 * ModelUtils.applyThemingToModel(viewer, model, highlightColor);
 * 
 * // Clear theming to return model to normal appearance
 * ModelUtils.clearThemingFromModel(viewer, model);
 */
class ModelUtils {
    /**
     * Gets the root node ID from a model's instance tree.
     * Returns the root ID which represents the top-level node in the model hierarchy.
     * This is commonly used for operations that need to work with the entire model.
     * 
     * @param {Autodesk.Viewing.Model} model - The model to get the root ID from
     * @returns {number|null} The root node ID, or null if model is invalid or has no instance tree
     * 
     * @example
     * // Get root ID for theming operations
     * const rootId = ModelUtils.getModelRootId(model);
     * if (rootId !== null) {
     *   viewer.setThemingColor(rootId, color, model, true);
     * }
     */
    static getModelRootId(model) {
        if (!model) return null;

        return model.getInstanceTree()?.getRootId() || null;
    }

    /**
     * Applies visual theming to highlight the specified model.
     * Colors the entire model with the provided color to give visual feedback
     * that the model is currently selected, highlighted, or being manipulated.
     * The theming is applied recursively from the root node to color the entire model.
     * 
     * @param {Autodesk.Viewing.GuiViewer3D} viewer - The Autodesk APS Viewer instance
     * @param {Autodesk.Viewing.Model} model - The model to apply theming to
     * @param {THREE.Vector4} color - The color to apply (RGBA values as Vector4)
     * @returns {void} Returns early if model is null or has no instance tree
     * 
     * @example
     * // Highlight a model with semi-transparent yellow
     * const highlightColor = new THREE.Vector4(1, 1, 0, 0.25);
     * ModelUtils.applyThemingToModel(viewer, selectedModel, highlightColor);
     * 
     * // Highlight with solid red color
     * const redColor = new THREE.Vector4(1, 0, 0, 1);
     * ModelUtils.applyThemingToModel(viewer, errorModel, redColor);
     */
    static applyThemingToModel(viewer, model, color) {
        if (!model) return;

        const rootId = ModelUtils.getModelRootId(model);
        if (rootId == null) return;

        // Color whole model recursively from the root
        viewer.setThemingColor(rootId, color, model, true);
    }

    /**
     * Clears visual theming from the specified model.
     * Removes all theming colors from the model, returning it to its original appearance.
     * This is used to deselect models, reset visual highlighting, or return models
     * to their default rendering state after theming operations.
     * 
     * @param {Autodesk.Viewing.GuiViewer3D} viewer - The Autodesk APS Viewer instance
     * @param {Autodesk.Viewing.Model} model - The model to clear theming from
     * @returns {void} Returns early if model is null
     * 
     * @example
     * // Clear theming from a previously highlighted model
     * ModelUtils.clearThemingFromModel(viewer, highlightedModel);
     * 
     * // Clear theming from all models in a loop
     * viewer.impl.modelQueue().getModels().forEach(model => {
     *   ModelUtils.clearThemingFromModel(viewer, model);
     * });
     */
    static clearThemingFromModel(viewer, model) {
        if (!model) return;

        viewer.clearThemingColors(model);
    }

    /**
     * Gets all models currently loaded in the viewer.
     * This method provides a consistent way to retrieve all models across different
     * viewer versions, with fallback support for older viewer implementations.
     * 
     * @param {Autodesk.Viewing.GuiViewer3D} viewer - The Autodesk APS Viewer instance
     * @returns {Autodesk.Viewing.Model[]} Array of all loaded models
     * 
     * @example
     * // Get all models and iterate through them
     * const allModels = ModelUtils.getAllModels(viewer);
     * allModels.forEach(model => {
     *   console.log('Model ID:', model.id, 'Name:', ModelUtils.getModelName(model));
     * });
     */
    static getAllModels(viewer) {
        if (typeof viewer.getAllModels === 'function') {
            return viewer.getAllModels();
        }

        // Very old viewer fallback (best effort)
        return viewer.impl.modelQueue().getModels();
    }

    /**
     * Gets only the visible models currently loaded in the viewer.
     * Filters the complete model list to return only models that are currently visible.
     * Hidden models will be excluded from the returned array.
     * 
     * @param {Autodesk.Viewing.GuiViewer3D} viewer - The Autodesk APS Viewer instance
     * @returns {Autodesk.Viewing.Model[]} Array of visible models only
     * 
     * @example
     * // Get only visible models for processing
     * const visibleModels = ModelUtils.getVisibleModels(viewer);
     * console.log(`${visibleModels.length} models are currently visible`);
     * 
     * // Apply operation only to visible models
     * visibleModels.forEach(model => {
     *   // Perform operations only on visible models
     *   ModelUtils.applyThemingToModel(viewer, model, highlightColor);
     * });
     */
    static getVisibleModels(viewer) {
        return ModelUtils.getAllModels(viewer).filter(m => m.isVisible());
    }

    /**
     * Finds a specific model by its ID from all loaded models.
     * Searches through all models in the viewer and returns the model with the matching ID.
     * This is useful for retrieving specific models when you have their identifier.
     * 
     * @param {Autodesk.Viewing.GuiViewer3D} viewer - The Autodesk APS Viewer instance
     * @param {number} modelId - The ID of the model to find
     * @returns {Autodesk.Viewing.Model|null} The model with the specified ID, or null if not found
     * 
     * @example
     * // Find a specific model by ID
     * const targetModel = ModelUtils.findModelById(viewer, 5);
     * if (targetModel) {
     *   console.log('Found model:', ModelUtils.getModelName(targetModel));
     *   ModelUtils.applyThemingToModel(viewer, targetModel, selectionColor);
     * } else {
     *   console.log('Model with ID 5 not found');
     * }
     */
    static findModelById(viewer, modelId) {
        return ModelUtils.getAllModels(viewer).find(m => m.id === modelId) || null;
    }

    /**
     * Gets a human-readable name for the specified model.
     * Attempts to retrieve the model name from various sources in order of preference:
     * 1. Custom model name override from load options
     * 2. Model name from document node
     * 3. Fallback to "Model id={modelId}" format
     * 
     * @param {Autodesk.Viewing.Model} model - The model to get the name from
     * @returns {string} The model name, or empty string if model is null/undefined
     * 
     * @example
     * // Get display name for a model
     * const modelName = ModelUtils.getModelName(model);
     * console.log('Model name:', modelName);
     * 
     * // Use in UI dropdown or list
     * const modelOption = document.createElement('option');
     * modelOption.value = model.id;
     * modelOption.textContent = ModelUtils.getModelName(model);
     * selectElement.appendChild(modelOption);
     */
    static getModelName(model) {
        if (!model) return '';

        const modelMetaData = model.getData?.();
        return modelMetaData?.loadOptions?.modelNameOverride || model.getDocumentNode()?.getModelName() || `Model id=${model.id}`;
    }

    /**
     * Generates a display label for the specified model.
     * This is a convenience method that provides a fallback label generation for models.
     * Primarily delegates to getModelName() but ensures a valid string is always returned.
     * 
     * @param {Autodesk.Viewing.Model} model - The model to generate a label for
     * @returns {string} The generated label, or empty string if model is null/undefined
     * 
     * @example
     * // Generate label for dropdown options
     * const models = ModelUtils.getAllModels(viewer);
     * const options = models.map(model => ({
     *   value: model.id,
     *   label: ModelUtils.generateLabelForModel(model)
     * }));
     * 
     * @see {@link ModelUtils.getModelName} for the underlying implementation
     */
    static generateLabelForModel(model) {
       if (!model) return '';

       return ModelUtils.getModelName(model) || `Model id=${model.id}`;
    }

    static getViewableData(model) {
        if (!model) return null;

        const viewableId = model.getDocumentNode()?.data?.viewableID || '';
        const urn = model.getData().urn || '';

        return { viewableId, urn };
    }
}

export { ModelUtils };