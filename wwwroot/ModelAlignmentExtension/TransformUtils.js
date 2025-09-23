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
 * TransformUtils provides utility methods for manipulating model transforms in Autodesk APS Viewer.
 * This class contains static methods for getting/setting placement matrices, translating models,
 * and animating model transformations with smooth transitions.
 * 
 * @class
 * @static
 * 
 * @example
 * // Get a model's current placement matrix
 * const matrix = TransformUtils.getPlacementMatrix(model);
 * 
 * // Translate a model with animation
 * await TransformUtils.translateModel(viewer, model, 10, 0, 0, { animate: true });
 * 
 * // Animate model to fit current view target
 * await TransformUtils.animateModelToViewTarget(viewer, model, 600);
 */
class TransformUtils {
    /**
     * Gets the placement transformation matrix for a model.
     * Returns a cloned copy of the model's current placement transform matrix.
     * If the model has no transform, returns a new identity matrix.
     * 
     * @param {Autodesk.Viewing.Model} model - The model to get the placement matrix from
     * @returns {THREE.Matrix4} The model's placement transformation matrix or identity matrix
     * 
     * @example
     * const matrix = TransformUtils.getPlacementMatrix(model);
     * console.log('Model transform:', matrix.elements);
     */
    static getPlacementMatrix(model) {
        return model?.getPlacementTransform()?.clone() || new THREE.Matrix4();
    }

    /**
     * Sets the placement transformation matrix for a model.
     * Applies the given transformation matrix to the model and triggers a scene update
     * to ensure the visual changes are rendered in the viewer.
     * 
     * @param {Autodesk.Viewing.GuiViewer3D} viewer - The viewer instance
     * @param {Autodesk.Viewing.Model} model - The model to transform
     * @param {THREE.Matrix4} matrix - The transformation matrix to apply
     * @returns {void} Returns early if any parameter is null/undefined
     * 
     * @example
     * const matrix = new THREE.Matrix4().makeTranslation(10, 0, 0);
     * TransformUtils.setPlacementMatrix(viewer, model, matrix);
     */
    static setPlacementMatrix(viewer, model, matrix) {
        if (!viewer || !model || !matrix) return;

        viewer.impl.setPlacementTransform(model, matrix);
        // Only needed after *geometry* transform changes (not overlays)
        viewer.impl.sceneUpdated(true);  // ensure a redraw
    }
    /**
     * Move a model so its bounding-box center aligns with the current view's target.
     * Calculates the offset needed to move the model's center to the camera's target point
     * and applies the translation to the model's existing transformation matrix.
     * Works with single or multi-model; defaults to the first model.
     *
     * @param {Autodesk.Viewing.GuiViewer3D|Autodesk.Viewing.Viewer3D} viewer - The viewer instance
     * @param {Autodesk.Viewing.Model} [model] - The model to move
     * @returns {void} Returns early if viewer or model is null/undefined
     * 
     * @example
     * // Move model center to current camera target
     * TransformUtils.moveModelCenterToViewTarget(viewer, model);
     */
    static moveModelCenterToViewTarget(viewer, model) {
        if (!viewer || !model) return;

        // 1) Get the model's world-space bounding box and its center
        const box = model.getBoundingBox();              // world-space with current transform
        const center = box.getCenter(new THREE.Vector3());

        // 2) Get the viewer's current camera target (Orbit pivot)
        const target = viewer.navigation.getTarget().clone();

        // 3) Compute the translation needed to bring center -> target
        const delta = target.sub(center);          // (target - center)

        // 4) Apply that translation to the model's existing transform
        //    Use the public API: viewer.impl.setModelTransform(model, matrix)
        const current = TransformUtils.getPlacementMatrix(model);  // THREE.Matrix4 or undefined

        // Decompose -> translate -> recompose
        const pos = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        const scale = new THREE.Vector3(1, 1, 1);
        current.decompose(pos, quat, scale);
        pos.add(delta);
        const next = new THREE.Matrix4().compose(pos, quat, scale);

        // viewer.impl.setPlacementTransform(model, next);
        // viewer.impl.sceneUpdated(true); // ensure a redraw
        TransformUtils.setPlacementMatrix(viewer, model, next);
    }

    /**
     * Animates a model to move its center to the current view target.
     * Performs a smooth animated transition that moves the model's bounding box center
     * to align with the viewer's current camera target point. Uses eased interpolation
     * for smooth visual feedback.
     * 
     * @param {Autodesk.Viewing.GuiViewer3D} viewer - The viewer instance
     * @param {Autodesk.Viewing.Model} model - The model to animate
     * @param {number} [duration=400] - Animation duration in milliseconds
     * @returns {Promise<void>} Promise that resolves when animation completes
     * 
     * @example
     * // Animate model to view target over 600ms
     * await TransformUtils.animateModelToViewTarget(viewer, model, 600);
     */
    static async animateModelToViewTarget(viewer, model, duration = 400) {
        if (!viewer || !model) return;

        let animHandle = null;
        return new Promise((resolve) => {
            // Compute start/end positions
            const box = model.getBoundingBox();
            const center = box.getCenter(new THREE.Vector3());
            const target = viewer.navigation.getTarget().clone();
            const delta = target.clone().sub(center);

            const startM = TransformUtils.getPlacementMatrix(model);  // THREE.Matrix4 or undefined
            const sPos = new THREE.Vector3(), sQuat = new THREE.Quaternion(), sScale = new THREE.Vector3(1, 1, 1);
            startM.decompose(sPos, sQuat, sScale);

            const endPos = sPos.clone().add(delta);

            const self = this;
            if (animHandle) {
                cancelAnimationFrame(animHandle);
            }

            const start = performance.now();
            function tick(t0) {
                const now = performance.now();
                const k = Math.min(1, (now - start) / duration);
                // easeInOutQuad
                const e = k < 0.5 ? 2 * k * k : -1 + (4 - 2 * k) * k;

                const pos = sPos.clone().lerp(endPos, e);
                const m = new THREE.Matrix4().compose(pos, sQuat, sScale);
                // viewer.impl.setPlacementTransform(model, m);
                // viewer.impl.sceneUpdated(true);

                TransformUtils.setPlacementMatrix(viewer, model, m);

                if (k < 1) {
                    self.animHandle = requestAnimationFrame(tick);
                } else {
                    self.animHandle = null;
                    resolve();
                }
            }
            animHandle = requestAnimationFrame(tick);
        });
    }

    /**
     * Smoothly translates a model by the specified offset over a given duration.
     * Performs an animated translation using the model's current rotation and scale,
     * interpolating only the position component with eased timing.
     * 
     * @param {Autodesk.Viewing.GuiViewer3D} viewer - The viewer instance
     * @param {Autodesk.Viewing.Model} model - The model to translate
     * @param {number} dx - Translation distance along X-axis
     * @param {number} dy - Translation distance along Y-axis  
     * @param {number} dz - Translation distance along Z-axis
     * @param {number} [duration=400] - Animation duration in milliseconds
     * @returns {Promise<void>} Promise that resolves when animation completes
     * 
     * @example
     * // Animate model translation by (10, 5, 0) over 500ms
     * await TransformUtils.animateTranslateModel(viewer, model, 10, 5, 0, 500);
     */
    static animateTranslateModel(viewer, model, dx, dy, dz, duration = 400) {
        if (!viewer || !model) return;

        let animHandle = null;

        return new Promise((resolve) => {
            // Start placement
            const M0 = TransformUtils.getPlacementMatrix(model);
            const p0 = new THREE.Vector3(), q0 = new THREE.Quaternion(), s0 = new THREE.Vector3(1, 1, 1);
            M0.decompose(p0, q0, s0);
            // End position
            const p1 = new THREE.Vector3(p0.x + dx, p0.y + dy, p0.z + dz);

            // Ease (same feel as your view-target anim)
            const easeInOutQuad = (k) => (k < 0.5 ? 2 * k * k : -1 + (4 - 2 * k) * k);

            let t0 = null;
            if (animHandle) cancelAnimationFrame(animHandle);

            function frame(ts) {
                if (t0 === null) t0 = ts;
                const k = Math.min(1, (ts - t0) / Math.max(1, duration | 0));
                const e = easeInOutQuad(k);
                const pt = new THREE.Vector3().lerpVectors(p0, p1, e);
                const Mt = new THREE.Matrix4().compose(pt, q0, s0);

                TransformUtils.setPlacementMatrix(viewer, model, Mt);

                if (k < 1) {
                    animHandle = requestAnimationFrame(frame);
                } else {
                    animHandle = null;
                    resolve();
                }
            }
            animHandle = requestAnimationFrame(frame);
        });
    }

    /**
     * Translates a model by the specified offset with optional animation.
     * Provides both immediate and animated translation modes. When animated,
     * uses smooth eased interpolation for visual feedback.
     * 
     * @param {Autodesk.Viewing.GuiViewer3D} viewer - The viewer instance
     * @param {Autodesk.Viewing.Model} model - The model to translate
     * @param {number} dx - Translation distance along X-axis
     * @param {number} dy - Translation distance along Y-axis
     * @param {number} dz - Translation distance along Z-axis
     * @param {Object} [opts={}] - Translation options
     * @param {boolean} [opts.animate=false] - Whether to animate the translation
     * @param {number} [opts.duration=400] - Animation duration in milliseconds (if animated)
     * @param {Function} [opts.onDone] - Callback function called when translation completes
     * @returns {Promise<void>} Promise that resolves when translation completes
     * 
     * @example
     * // Immediate translation
     * await TransformUtils.translateModel(viewer, model, 5, 0, 10);
     * 
     * // Animated translation with custom duration
     * await TransformUtils.translateModel(viewer, model, 5, 0, 10, {
     *   animate: true,
     *   duration: 600,
     *   onDone: () => console.log('Translation complete')
     * });
     */
    static async translateModel(viewer, model, dx, dy, dz, opts = {}) {
        // opts?: { animate?: boolean, duration?: number, onDone?: ()=>void }
        if (!viewer || !model) return;
        return new Promise(async (resolve) => {
            if (opts.animate) {
                await TransformUtils.animateTranslateModel(viewer, model, dx, dy, dz, opts.duration || 400);
                return resolve();
            }

            const T = new THREE.Matrix4().makeTranslation(dx, dy, dz);
            const M = TransformUtils.getPlacementMatrix(model);
            M.multiplyMatrices(T, M);
            TransformUtils.setPlacementMatrix(viewer, model, M);
            return resolve();
        });
    }

    /**
     * Composes a transformation matrix from translation, rotation, and scale components.
     * Creates a transformation matrix by combining translation, rotation, and scaling operations.
     * The transformations are applied in the order: Scale, then Rotation, then Translation (T * R * S).
     * 
     * @param {THREE.Vector3} translation - The translation vector (x, y, z displacement)
     * @param {THREE.Euler} rotation - The rotation as Euler angles
     * @param {THREE.Vector3} [scale] - The scale vector (x, y, z scale factors). Defaults to uniform scale of 1
     * @returns {THREE.Matrix4} The composed transformation matrix
     * 
     * @example
     * // Create a matrix with translation and Z rotation only
     * const translation = new THREE.Vector3(10, 5, 0);
     * const rotation = new THREE.Euler(0, 0, Math.PI / 4); // 45 degrees Z rotation
     * const matrix = TransformUtils.composeMatrix(translation, rotation);
     * 
     * // Create a matrix with translation, rotation, and uniform scaling
     * const scale = new THREE.Vector3(2, 2, 2); // Double size
     * const matrixWithScale = TransformUtils.composeMatrix(translation, rotation, scale);
     * 
     * // Create a matrix with non-uniform scaling
     * const nonUniformScale = new THREE.Vector3(1.5, 1, 0.8);
     * const stretchedMatrix = TransformUtils.composeMatrix(translation, rotation, nonUniformScale);
     * 
     * // Apply to model
     * TransformUtils.setPlacementMatrix(viewer, model, matrix);
     */
    static composeMatrix(translation, rotation, scale) {
        const T = new THREE.Matrix4().makeTranslation(translation.x || 0, translation.y || 0, translation.z || 0);
        const R = new THREE.Matrix4().makeRotationFromEuler(rotation);
        
        // If scale is provided, create a scale matrix, otherwise use identity (no scaling)
        const S = scale ? 
            new THREE.Matrix4().makeScale(scale.x || 1, scale.y || 1, scale.z || 1) : 
            new THREE.Matrix4(); // Identity matrix (no scaling)
        
        // Apply transformations in order: T * R * S (Scale first, then Rotate, then Translate)
        return new THREE.Matrix4().multiplyMatrices(T, new THREE.Matrix4().multiplyMatrices(R, S));
    }
}

// r71 compatibility: Math.degToRad helper
if (!THREE.Math.degToRad) THREE.Math.degToRad = function (d) { return d * Math.PI / 180; };

export { TransformUtils };