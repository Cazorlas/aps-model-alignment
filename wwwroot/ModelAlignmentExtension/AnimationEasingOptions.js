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
 * AnimationEasingOptions provides easing functions for smooth animation transitions.
 * These functions define the rate of change of an animation over time, creating
 * natural and visually appealing motion effects for model transformations.
 * 
 * @module AnimationEasingOptions
 * @example
 * import { easeInOutCubic, easeInOutSine, easeInOutQuad } from './AnimationEasingOptions.js';
 * 
 * // Use with TransformUtils animation methods
 * await TransformUtils.animateModelToViewTargetAsync(viewer, model, {
 *   duration: 800,
 *   easing: easeInOutCubic
 * });
 */

/**
 * Cubic easing function with smooth acceleration and deceleration.
 * Starts slow, accelerates quickly in the middle, then decelerates smoothly to the end.
 * Provides a more dramatic curve than quadratic easing with stronger acceleration/deceleration.
 * 
 * @param {number} t - Normalized time value between 0 and 1
 * @returns {number} Eased value between 0 and 1
 * 
 * @example
 * // Use for dramatic, smooth animations
 * const easedValue = easeInOutCubic(0.5); // Returns 0.5 (midpoint)
 * const startEase = easeInOutCubic(0.1);  // Returns ~0.004 (slow start)
 * const endEase = easeInOutCubic(0.9);    // Returns ~0.996 (slow end)
 */
function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t                // accelerate
    : 1 - Math.pow(-2 * t + 2, 3) / 2; // decelerate
}

/**
 * Sinusoidal easing function with gentle, wave-like acceleration and deceleration.
 * Creates a smooth, natural motion based on a sine wave curve.
 * Provides the gentlest easing among the three options with gradual acceleration/deceleration.
 * 
 * @param {number} t - Normalized time value between 0 and 1
 * @returns {number} Eased value between 0 and 1
 * 
 * @example
 * // Use for gentle, natural-feeling animations
 * const easedValue = easeInOutSine(0.5); // Returns 0.5 (midpoint)
 * const startEase = easeInOutSine(0.1);  // Returns ~0.024 (gentle start)
 * const endEase = easeInOutSine(0.9);    // Returns ~0.976 (gentle end)
 */
function easeInOutSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

/**
 * Quadratic easing function with moderate acceleration and deceleration.
 * Provides a balanced easing curve that's smoother than linear but less dramatic than cubic.
 * This is the default easing function used throughout the TransformUtils methods.
 * 
 * @param {number} t - Normalized time value between 0 and 1
 * @returns {number} Eased value between 0 and 1
 * 
 * @example
 * // Use for balanced, smooth animations (default easing)
 * const easedValue = easeInOutQuad(0.5); // Returns 0.5 (midpoint)
 * const startEase = easeInOutQuad(0.1);  // Returns ~0.02 (moderate start)
 * const endEase = easeInOutQuad(0.9);    // Returns ~0.98 (moderate end)
 * 
 * // This is equivalent to the default easing used in TransformUtils
 * const defaultEasing = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
 */
function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export { easeInOutCubic, easeInOutSine, easeInOutQuad };

