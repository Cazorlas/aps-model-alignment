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
 * await TransformUtils.translateModelAsync(viewer, model, 10, 0, 0, { animate: true });
 * 
 * // Animate model to fit current view target
 * await TransformUtils.animateModelToViewTargetAsync(viewer, model, { duration: 600 });
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
     * to align with the viewer's current camera target point. Uses configurable easing
     * interpolation for smooth visual feedback with progress callbacks.
     * 
     * @async
     * @param {Autodesk.Viewing.GuiViewer3D} viewer - The viewer instance
     * @param {Autodesk.Viewing.Model} model - The model to animate
     * @param {Object} [opts={}] - Animation configuration options
     * @param {number} [opts.duration=400] - Animation duration in milliseconds
     * @param {Function|null} [opts.easing=null] - Easing function that takes normalized time (0-1) and returns eased value. If null, defaults to easeInOutQuad
     * @param {Function|null} [opts.onUpdate=null] - Callback function called on each frame with {t, matrix, modelId} parameters
     * @returns {Promise<void>} Promise that resolves when animation completes
     * 
     * @example
     * // Animate model to view target with default settings
     * await TransformUtils.animateModelToViewTargetAsync(viewer, model);
     * 
     * // Animate with custom duration and progress callback
     * await TransformUtils.animateModelToViewTargetAsync(viewer, model, {
     *   duration: 800,
     *   easing: t => t * t * (3 - 2 * t), // smoothstep
     *   onUpdate: ({t, matrix, modelId}) => console.log(`Progress: ${(t * 100).toFixed(1)}%`)
     * });
     */
    static async animateModelToViewTargetAsync(viewer, model, opts = {
        duration: 400,
        easing: null,
        onUpdate: null
    }) {
        if (!viewer || !model) return;

        let animHandle = null;
        if (!opts.easing) {
            opts.easing = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
        }

        opts.duration = opts.duration || 400;
        if (opts.duration <= 0) opts.duration = 1; // prevent div/0

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

            if (animHandle) cancelAnimationFrame(animHandle);

            const start = performance.now();
            function tick(t0) {
                const now = performance.now();
                const k = Math.min(1, (now - start) / opts.duration);
                // easeInOutQuad
                const e = opts.easing(k);

                const pos = sPos.clone().lerp(endPos, e);
                const m = new THREE.Matrix4().compose(pos, sQuat, sScale);
                TransformUtils.setPlacementMatrix(viewer, model, m);

                if (opts.onUpdate) opts.onUpdate({ e, matrix: m, modelId: model.id });
                // Note: onUpdate callback would be available if passed via options

                if (k < 1) {
                    animHandle = requestAnimationFrame(tick);
                } else {
                    animHandle = null;
                    resolve();
                }
            }
            animHandle = requestAnimationFrame(tick);
        });
    }

    /**
     * Smoothly translates a model by the specified offset with configurable animation settings.
     * Performs an animated translation using the model's current rotation and scale,
     * interpolating only the position component with configurable easing timing.
     * Supports custom easing functions and progress callbacks for advanced control.
     * 
     * @async
     * @param {Autodesk.Viewing.GuiViewer3D} viewer - The viewer instance
     * @param {Autodesk.Viewing.Model} model - The model to translate
     * @param {number} dx - Translation distance along X-axis in world coordinates
     * @param {number} dy - Translation distance along Y-axis in world coordinates
     * @param {number} dz - Translation distance along Z-axis in world coordinates
     * @param {Object} [opts={}] - Animation configuration options
     * @param {number} [opts.duration=400] - Animation duration in milliseconds
     * @param {Function|null} [opts.easing=null] - Easing function that takes normalized time (0-1) and returns eased value. If null, defaults to easeInOutQuad
     * @param {Function|null} [opts.onUpdate=null] - Callback function called on each frame with {t, matrix, modelId} parameters
     * @returns {Promise<void>} Promise that resolves when animation completes
     * 
     * @example
     * // Animate model translation with default easing
     * await TransformUtils.animateTranslateModelAsync(viewer, model, 10, 5, 0);
     * 
     * // Animate with custom duration and easing
     * await TransformUtils.animateTranslateModelAsync(viewer, model, 25, 0, 0, {
     *   duration: 800,
     *   easing: t => t * t * (3 - 2 * t), // smoothstep
     *   onUpdate: ({t}) => console.log(`Progress: ${(t * 100).toFixed(1)}%`)
     * });
     */
    static async animateTranslateModelAsync(viewer, model, dx, dy, dz, opts = {
        duration: 400,
        easing: null,
        onUpdate: null
    }) {
        if (!viewer || !model) return;

        let animHandle = null;
        if (!opts.easing) {
            opts.easing = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
        }

        opts.duration = opts.duration || 400;
        if (opts.duration <= 0) opts.duration = 1; // prevent div/0

        return new Promise((resolve) => {
            // Start placement
            const M0 = TransformUtils.getPlacementMatrix(model);
            const p0 = new THREE.Vector3(), q0 = new THREE.Quaternion(), s0 = new THREE.Vector3(1, 1, 1);
            M0.decompose(p0, q0, s0);
            // End position
            const p1 = new THREE.Vector3(p0.x + dx, p0.y + dy, p0.z + dz);

            // Ease (same feel as your view-target anim)
            // const easeInOutQuad = (k) => (k < 0.5 ? 2 * k * k : -1 + (4 - 2 * k) * k);

            let t0 = null;
            if (animHandle) cancelAnimationFrame(animHandle);

            function frame(ts) {
                if (t0 === null) t0 = ts;
                const k = Math.min(1, (ts - t0) / Math.max(1, opts.duration | 0));
                const e = opts.easing(k);
                const pt = new THREE.Vector3().lerpVectors(p0, p1, e);
                const Mt = new THREE.Matrix4().compose(pt, q0, s0);

                TransformUtils.setPlacementMatrix(viewer, model, Mt);

                if (opts.onUpdate) opts.onUpdate({ e, matrix: Mt, modelId: model.id });
                // Note: onUpdate callback would be available if passed via options

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
     * uses smooth eased interpolation for visual feedback. Supports custom
     * easing functions and progress callbacks for advanced control.
     * 
     * @async
     * @param {Autodesk.Viewing.GuiViewer3D} viewer - The viewer instance
     * @param {Autodesk.Viewing.Model} model - The model to translate
     * @param {number} dx - Translation distance along X-axis in world coordinates
     * @param {number} dy - Translation distance along Y-axis in world coordinates
     * @param {number} dz - Translation distance along Z-axis in world coordinates
     * @param {Object} [opts={}] - Translation configuration options
     * @param {boolean} [opts.animate=false] - Whether to animate the translation
     * @param {number} [opts.duration=400] - Animation duration in milliseconds (if animated)
     * @param {Function|null} [opts.easing=null] - Easing function that takes normalized time (0-1) and returns eased value. If null, defaults to easeInOutQuad
     * @param {Function|null} [opts.onUpdate=null] - Callback function called on each frame with {t, matrix, modelId} parameters
     * @returns {Promise<void>} Promise that resolves when translation completes
     * 
     * @example
     * // Immediate translation (non-animated)
     * await TransformUtils.translateModelAsync(viewer, model, 5, 0, 10);
     * 
     * // Animated translation with custom settings
     * await TransformUtils.translateModelAsync(viewer, model, 5, 0, 10, {
     *   animate: true,
     *   duration: 600,
     *   easing: t => t * t * (3 - 2 * t), // smoothstep easing
     *   onUpdate: ({t, matrix, modelId}) => console.log(`Progress: ${(t * 100).toFixed(1)}%`)
     * });
     */
    static async translateModelAsync(viewer, model, dx, dy, dz, opts = {
        animate: false,
        duration: 400,
        easing: null,
        onUpdate: null
    }) {
        // opts?: { animate?: boolean, duration?: number, easing: (t: number) => number, onUpdate?: (progress: { t: number }) => void }
        if (!viewer || !model) return;

        if (!opts.easing) {
            opts.easing = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
        }

        opts.animate = !!opts.animate;

        opts.duration = opts.duration || 400;
        if (opts.duration <= 0) opts.duration = 1; // prevent div/0

        return new Promise(async (resolve) => {
            if (opts.animate) {
                await TransformUtils.animateTranslateModelAsync(viewer, model, dx, dy, dz, opts);
                return resolve();
            }

            const T = new THREE.Matrix4().makeTranslation(dx, dy, dz);
            const M = TransformUtils.getPlacementMatrix(model);
            M.multiplyMatrices(T, M);
            TransformUtils.setPlacementMatrix(viewer, model, M);
            if (opts.onUpdate) opts.onUpdate({ t: 1, matrix: M, modelId: model.id }); // t=1 for immediate completion

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

    /**
     * Animates a model transformation from one matrix to another with smooth interpolation.
     * Performs a smooth animated transition between two transformation matrices by decomposing
     * them into position, rotation, and scale components, then interpolating each component
     * separately using quaternion slerping for rotation and linear interpolation for position and scale.
     * 
     * @async
     * @param {Autodesk.Viewing.GuiViewer3D} viewer - The viewer instance
     * @param {Autodesk.Viewing.Model} model - The model to animate
     * @param {THREE.Matrix4} mFrom - Starting transformation matrix. If null, uses model's current matrix
     * @param {THREE.Matrix4} mTo - Target transformation matrix to animate to
     * @param {Object} [options={}] - Animation configuration options
     * @param {number} [options.duration=600] - Animation duration in milliseconds
     * @param {Function|null} [options.easing=null] - Easing function that takes normalized time (0-1) and returns eased value. If null, defaults to smoothstep easing
     * @param {Function|null} [options.onUpdate=null] - Callback function called on each frame with {t, matrix} parameters
     * @returns {Promise<THREE.Matrix4>} Promise that resolves with the final transformation matrix when animation completes
     * 
     * @example
     * // Animate model from current position to a new transform
     * const targetMatrix = new THREE.Matrix4().makeTranslation(10, 0, 5);
     * const finalMatrix = await TransformUtils.animateModelMatrixAsync(viewer, model, null, targetMatrix, {
     *   duration: 1000,
     *   easing: t => t * t, // Quadratic easing
     *   onUpdate: ({t, matrix}) => console.log(`Progress: ${(t * 100).toFixed(1)}%`)
     * });
     * 
     * // Animate between two specific matrices with custom easing
     * const fromMatrix = new THREE.Matrix4().makeTranslation(0, 0, 0);
     * const toMatrix = new THREE.Matrix4().makeTranslation(20, 10, 0);
     * await TransformUtils.animateModelMatrixAsync(viewer, model, fromMatrix, toMatrix, {
     *   duration: 800,
     *   easing: t => 0.5 * (1 - Math.cos(Math.PI * t)) // Sine wave easing
     * });
     */
    static async animateModelMatrixAsync(viewer, model, mFrom, mTo, opts = {
        duration: 600,
        easing: null,
        onUpdate: null
    }) {
        if (!viewer || !model) return;

        let animHandle = null;
        if (!opts.easing) {
            opts.easing = (t) => (t * t * (3 - 2 * t));
        }

        opts.duration = opts.duration || 600;
        if (opts.duration <= 0) opts.duration = 1; // prevent div/0

        return new Promise((resolve) => {
            const startM = (mFrom || TransformUtils.getPlacementMatrix(model)).clone();

            const endM = mTo.clone();

            // Decompose
            const p0 = new THREE.Vector3(), p1 = new THREE.Vector3();
            const q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion();
            const s0 = new THREE.Vector3(), s1 = new THREE.Vector3();
            startM.decompose(p0, q0, s0);
            endM.decompose(p1, q1, s1);
            if (q0.dot(q1) < 0) q1.multiplyScalar(-1);

            // Temps
            const p = new THREE.Vector3();
            const q = new THREE.Quaternion();
            const s = new THREE.Vector3();
            const m = new THREE.Matrix4();

            const apply = (mat) => {
                TransformUtils.setPlacementMatrix(viewer, model, mat);
            };

            const t0 = performance.now();
            if (animHandle) cancelAnimationFrame(animHandle);

            function tick(now) {
                const rawT = Math.min(1, (now - t0) / opts.duration);
                const t = opts.easing(rawT);

                p.copy(p0).lerp(p1, t);
                s.copy(s0).lerp(s1, t);
                q.slerpQuaternions(q0, q1, t);

                m.compose(p, q, s);
                apply(m);

                if (opts.onUpdate) opts.onUpdate({ t, matrix: m, modelId: model.id });

                if (rawT < 1) {
                    animHandle = requestAnimationFrame(tick);
                } else {
                    animHandle = null;
                    resolve(m);
                }
            }

            animHandle = requestAnimationFrame(tick);
        });
    }

    /**
     * Animates a THREE.Vector3 point from start position to end position with smooth interpolation.
     * Performs linear interpolation between two 3D points over a specified duration with configurable
     * easing functions. Useful for animating camera positions, target points, or any 3D coordinates
     * that need smooth transitions independent of model transformations.
     * 
     * @async
     * @param {THREE.Vector3} start - The starting 3D position vector
     * @param {THREE.Vector3} end - The target 3D position vector to animate to
     * @param {Object} [opts={}] - Animation configuration options
     * @param {number} [opts.duration=600] - Animation duration in milliseconds
     * @param {Function|null} [opts.easing=null] - Easing function that takes normalized time (0-1) and returns eased value. If null, defaults to smoothstep easing
     * @param {Function|null} [opts.onUpdate=null] - Callback function called on each frame with {t, point} parameters
     * @returns {Promise<THREE.Vector3>} Promise that resolves with the final Vector3 position when animation completes
     * 
     * @example
     * // Animate camera position to a new location
     * const startPos = new THREE.Vector3(0, 0, 100);
     * const endPos = new THREE.Vector3(50, 25, 75);
     * const finalPos = await TransformUtils.animatePointAsync(startPos, endPos, {
     *   duration: 1000,
     *   onUpdate: ({t, point}) => {
     *     console.log(`Animation progress: ${(t * 100).toFixed(1)}%`);
     *     viewer.navigation.setPosition(point);
     *   }
     * });
     * 
     * // Animate with custom easing for camera target movement
     * await TransformUtils.animatePointAsync(currentTarget, newTarget, {
     *   duration: 800,
     *   easing: t => t * t * (3 - 2 * t), // smoothstep
     *   onUpdate: ({point}) => viewer.navigation.setTarget(point)
     * });
     */
    static async animatePointAsync(start, end,  opts = {
        duration: 600,
        easing: null,
        onUpdate: null
    }) {

        let animHandle = null;
        if (!opts.easing) {
            opts.easing = (t) => (t * t * (3 - 2 * t));
        }

        opts.duration = opts.duration || 600;
        if (opts.duration <= 0) opts.duration = 1; // prevent div/0

        const { duration, easing, onUpdate } = opts;

        return new Promise((resolve) => {
            const p0 = start.clone();
            const p1 = end.clone();
            const p = new THREE.Vector3();

            const t0 = performance.now();
            if (animHandle) cancelAnimationFrame(animHandle);

            function tick(now) {
                const rawT = Math.min(1, (now - t0) / duration);
                const t = easing(rawT);

                p.copy(p0).lerp(p1, t);

                if (onUpdate) onUpdate({ t, point: p.clone() });

                if (rawT < 1) {
                    animHandle = requestAnimationFrame(tick);
                } else {
                    animHandle = null;
                    resolve(p.clone());
                }
            }

            animHandle = requestAnimationFrame(tick);
        });
    }
}

// r71 compatibility: Math.degToRad helper
if (!THREE.Math.degToRad) THREE.Math.degToRad = function (d) { return d * Math.PI / 180; };

export { TransformUtils };