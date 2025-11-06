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

import { ModelUtils } from "./ModelUtils.js";
import { PointToPointPickerTypes, ModelAlignmentEvents } from './ModelAlignmentExtension.js';
import { TransformUtils } from "./TransformUtils.js";

/**
 * @typedef {import('./ModelAlignmentExtension.js').ModelAlignmentExtension} ModelAlignmentExtension
 */

class ModelAlignmentPanel extends Autodesk.Viewing.UI.DockingPanel {
    /**
     * Creates a new ModelAlignmentPanel instance.
     * Initializes the panel with the given host and sets up event listeners.
     * 
     * @param {ModelAlignmentExtension} host - The host extension that owns this panel
     */
    constructor(host) {
        const options = {};

        // Height adjustment for scroll container, offset to height of the title bar and footer by default.
        if (!options.heightAdjustment) {
            options.heightAdjustment = 70;
        }

        if (!options.marginTop) {
            options.marginTop = 0;
        }

        super(host.viewer.container, 'das-model-alignment-panel', 'Model Alignment', options);
        Autodesk.Viewing.EventDispatcher.prototype.apply(this);

        /**
         * @type {ModelAlignmentExtension}
         */
        this.host = host;
        this.isUiCreated = false;
        this.container.classList.add('das-model-alignment');
        this.container.style.width = '380px';
        this.container.style.height = '560px';

        this.selectedModelId = null;
        this.fromPoint = null;
        this.toPoint = null;

        this.onSelectedModelChanged = this.onSelectedModelChanged.bind(this);
        this.onVisibilityChanged = this.onVisibilityChanged.bind(this);
        this.onModelGeometryLoaded = this.onModelGeometryLoaded.bind(this);
        this.onModelTransformed = this.onModelTransformed.bind(this);

        this.createScrollContainer(options);
        this.createUI();
        this.bindEvents();
    }

    /**
     * Gets the viewer instance from the host extension.
     * Convenience getter to access the viewer without going through the host reference.
     * @returns {Autodesk.Viewing.GuiViewer3D} The viewer instance
     */
    get viewer() {
        return this.host.viewer;
    }

    /**
     * Handles model selection changes in the panel.
     * Updates the selected model ID, clears previous highlighting, applies new highlighting,
     * and refreshes the UI to reflect the current selection state.
     * 
     * @param {number|null} modelId - The ID of the newly selected model, or null to clear selection
     */
    onSelectedModelChanged(modelId) {
        // clear previous highlight
        if (this.selectedModelId && this.selectedModelId !== modelId) {
            const prevModel = ModelUtils.findModelById(this.viewer, this.selectedModelId);
            if (prevModel) this.host.clearTheming(prevModel);
        }

        this.selectedModelId = modelId || null;

        const validId = !!modelId;

        this.btnSave.disabled = !validId;

        // apply highlight to current selection (or clear if none), functions have null check.
        const currentModel = ModelUtils.findModelById(this.viewer, modelId);
        this.refreshByModel(currentModel);
        this.host.applyTheming(currentModel);
    }

    /**
     * Handles panel visibility change events.
     * Refreshes the model list when the panel becomes visible to ensure
     * up-to-date model information is displayed.
     * 
     * @param {boolean} show - Whether the panel is now visible
     */
    onVisibilityChanged(show) {
        if (!show) return;

        this.refreshModelList();
    }

    /**
     * Handles model geometry loaded events.
     * Refreshes the model list when new geometry is loaded to include
     * newly loaded models in the selection dropdown.
     * 
     * @param {Object} event - The geometry loaded event
     */
    onModelGeometryLoaded(event) {
        this.refreshModelList();
    }

    /**
     * Handles model transformation events.
     * Updates the panel display when the currently selected model is transformed
     * to reflect the new transformation state in the UI.
     * 
     * @param {Object} event - The model transformed event
     * @param {number} event.modelId - The ID of the transformed model
     */
    onModelTransformed(event) {
        const { modelId } = event;
        if (this.selectedModelId !== modelId) return;

        this.refreshByModel(ModelUtils.findModelById(this.viewer, modelId));
    }

    /**
     * Initializes the panel after construction.
     * Calls the parent class initialization method to set up the panel infrastructure.
     */
    initialize() {
        super.initialize();
    }

    /**
     * Uninitializes the panel before destruction.
     * Removes event listeners and calls the parent class cleanup method.
     */
    uninitialize() {
        this.unbindEvents();

        super.uninitialize();
    }

    /**
     * Binds event listeners for the panel.
     * Sets up listeners for visibility changes, geometry loading, and model transformations.
     */
    bindEvents() {
        this.addVisibilityListener(this.onVisibilityChanged);
        this.viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, this.onModelGeometryLoaded);
        this.host.addEventListener(ModelAlignmentEvents.ModelTransformed, this.onModelTransformed);
    }

    /**
     * Removes event listeners from the panel.
     * Cleans up all event listeners to prevent memory leaks when the panel is destroyed.
     */
    unbindEvents() {
        this.removeVisibilityListener(this.onVisibilityChanged);
        this.viewer.removeEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, this.onModelGeometryLoaded);
        this.host.removeEventListener(ModelAlignmentEvents.ModelTransformed, this.onModelTransformed);
    }

    createUI() {
        if (this.isUiCreated) return;

        const style = document.createElement('style');
        style.textContent = `
        /* Containment & sizing */
        .das-model-alignment, 
        .das-model-alignment * { 
            box-sizing: border-box; 
        }
        
        .das-model-alignment { 
            overflow: auto; 
        }
        
        .das-model-alignment .row { 
            display: flex; 
            gap: 8px; 
            align-items: center; 
            margin-bottom: 8px; 
        }
        
        .das-model-alignment .row > * { 
            min-width: 0; /* allow children to shrink */ 
        }
        
        .das-model-alignment label { 
            min-width: 90px; 
            flex: 0 0 auto; 
        }
        
        /* Inputs/selects default to full width of their cell */
        .das-model-alignment input[type="text"], 
        .das-model-alignment select {
            width: 100%; 
            padding: 6px 8px; 
            border: 1px solid #555; 
            border-radius: 4px; 
            background: #1f1f1f; 
            color: #fff;
        }
        
        /* In flex rows, let selects stretch but keep buttons natural size */
        .das-model-alignment .row select { 
            flex: 1 1 auto; 
        }
        
        .das-model-alignment .row button { 
            flex: 0 0 auto; 
        }
        
        .das-model-alignment button {
            padding: 6px 10px; 
            border: 1px solid #666; 
            background: #2b2b2b; 
            color: #fff; 
            border-radius: 4px; 
            cursor: pointer;
        }
        
        .das-model-alignment button:disabled { 
            opacity: .55; 
            cursor: default; 
        }
        
        .das-model-alignment .section { 
            border: 1px solid #333; 
            border-radius: 6px; 
            padding: 8px; 
            margin-bottom: 10px; 
        }
        
        .das-model-alignment .tabs { 
            display: flex; 
            gap: 6px; 
            margin: 10px 0; 
        }
        
        .das-model-alignment .tab-btn { 
            padding: 6px 10px; 
            border: 1px solid #444; 
            background: #222; 
            color: #ddd; 
            border-radius: 4px; 
            cursor: pointer; 
        }
        
        .das-model-alignment .tab-btn.active { 
            background: #3a3a3a; 
            color: #fff; 
        }
        
        /* 3-column groups must allow children to shrink inside */
        .das-model-alignment .grid3 {
            display: grid; 
            grid-template-columns: repeat(3, minmax(0, 1fr)); 
            gap: 6px;
        }
        
        .das-model-alignment .grid3 input[type="text"], 
        .das-model-alignment .grid3 select { 
            width: 100%; 
        }
        
        .das-model-alignment .muted { 
            opacity: .8; 
        }
        
        /*.das-model-alignment .footer { display:flex; justify-content:space-between; align-items:center; margin-top:8px; }*/
        /* Footer: allow wrapping so matrix drops under the button on narrow widths */
        .das-model-alignment .footer {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            flex-wrap: wrap; /* <-- key: wrap to next line when needed */
            margin-top: 8px;
        }
        
        .das-model-alignment .mono { 
            font-family: ui-monospace, Menlo, Consolas, monospace; 
            font-size: 12px; 
        }
        
        #das-model-alignment-panel { 
            background: black; 
            max-height: 705px; 
            max-width: 1300px; 
            left: 0px; 
            top: 65px; 
        }
        
        .adsk-viewing-viewer.light-theme #das-model-alignment-panel { 
            background: unset; 
        }
        
        .adsk-viewing-viewer.light-theme .das-model-alignment select, 
        .adsk-viewing-viewer.light-theme .das-model-alignment input[type="text"] { 
            background: #ffffff; 
            color: #4a555b; 
        }
        
        .adsk-viewing-viewer.light-theme .das-model-alignment .tab-btn { 
            background: #ffffff; 
            color: #4a555b; 
        }
        
        .adsk-viewing-viewer.light-theme .das-model-alignment .tab-btn.active { 
            background: silver; 
            color: #fff; 
        }
        
        .adsk-viewing-viewer.light-theme .das-model-alignment button { 
            background: #ffffff; 
            color: #4a555b; 
            border: 1px solid #444; 
        }
        
        /* === Matrix (fixed layout, aligned) === */
        /* .das-model-alignment .matrix { display:inline-block; } */
        .das-model-alignment .matrix {
            display: inline-block;
            max-width: 100%; /* never overflow panel */
            overflow-x: auto; /* graceful overflow if container is very narrow */
        }
        
        .das-model-alignment .mat-row {
            display: grid;
            grid-template-columns: auto repeat(4, 8ch) auto; /* slightly tighter cells */
            column-gap: 8px; /* a bit tighter to fit comfortably */
            font-family: ui-monospace, Menlo, Consolas, monospace;
            line-height: 1.25;
        }
        
        .das-model-alignment .mat-row::before { 
            content: "["; 
        }
        
        .das-model-alignment .mat-row::after { 
            content: "]"; 
        }
        
        .das-model-alignment .mat-cell {
            width: 9ch; /* fixed width */
            text-align: right; /* right aligned */
            white-space: pre; /* monospace width preserved */
        }
        `;
        document.head.appendChild(style);
        const root = document.createElement('div');
        root.style.padding = '12px';
        root.innerHTML = `
            <div class="section">
                <div class="row" style="margin-bottom:0;">
                    <label>Model</label>
                    <select id="sel-model">
                        <option value="">Please select</option>
                    </select>
                    <button id="btn-pickModel">Select</button>
                </div>
            </div>
            
            <div class="tabs">
                <button id="tab-pos" class="tab-btn active">Position</button>
                <button id="tab-move" class="tab-btn">Move</button>
                <button id="tab-rot" class="tab-btn" style="display:none;">Rotate</button>
            </div>
            
            <!-- Position tab -->
            <div id="tabc-pos">
                <div class="section">
                    <div class="row">
                        <b>Position</b>
                        <button id="btn-edit" class="muted">Edit</button>
                        <button id="btn-fit" class="muted">Fit to View</button>
                    </div>
                    <div class="grid3">
                        <input id="pos-x" type="text" placeholder="X" readonly />
                        <input id="pos-y" type="text" placeholder="Y" readonly />
                        <input id="pos-z" type="text" placeholder="Z" readonly />
                    </div>
                </div>
                <div class="section">
                    <div class="row">
                        <b>Rotation</b>
                        <span class="muted">Deg (Z)</span>
                    </div>
                    <div class="row" style="margin-bottom:0;">
                        <input id="rot-deg-pos" type="text" placeholder="0" readonly />
                    </div>
                </div>
            </div>
            
            <!-- Move tab -->
            <div id="tabc-move" style="display:none;">
                <div class="section">
                    <div class="row">
                        <b>From point</b>
                        <button id="btn-pick-from">Select</button>
                    </div>
                    <div class="grid3">
                        <input id="from-x" type="text" placeholder="X" readonly />
                        <input id="from-y" type="text" placeholder="Y" readonly />
                        <input id="from-z" type="text" placeholder="Z" readonly />
                    </div>
                </div>
                <div class="section">
                    <div class="row">
                        <b>To point</b>
                        <button id="btn-pick-to">Select</button>
                    </div>
                    <div class="grid3">
                        <input id="to-x" type="text" placeholder="X" readonly />
                        <input id="to-y" type="text" placeholder="Y" readonly />
                        <input id="to-z" type="text" placeholder="Z" readonly />
                    </div>
                </div>
                <div class="section">
                    <div class="row">
                        <b>Offset</b>
                        <span class="muted">To − From</span>
                    </div>
                    <div class="grid3" style="margin-bottom: 8px;">
                        <input id="off-x" type="text" placeholder="dx" />
                        <input id="off-y" type="text" placeholder="dy" />
                        <input id="off-z" type="text" placeholder="dz" />
                    </div>
                    <div class="row" style="margin-bottom:0;">
                        <button id="btn-apply-offset">Apply</button>
                        <button id="btn-clear">Clear</button>
                    </div>
                </div>
            </div>
            
            <!-- Rotate tab -->
            <div id="tabc-rot" style="display:none;">
                <div class="section">
                    <div class="row">
                        <b>Rotation</b>
                        <span class="muted">Deg (Z)</span>
                    </div>
                    <div class="row">
                        <input id="rot-deg" type="text" value="0"/>
                        <button id="btn-apply-rot">Apply</button>
                    </div>
                    <div class="row mono" id="lbl-acc"></div>
                </div>
            </div>
            
            <div class="footer">
                <button id="btn-save" disabled>Save Transforms</button>
                <div class="mono" id="lbl-matrix" title="Current 4x4 placement matrix"></div>
            </div>
        `;

        this.scrollContainer.appendChild(root);

        // Tab switching
        const btnTabPosition = root.querySelector('#tab-pos');
        const btnTabTranslation = root.querySelector('#tab-move');
        const btnTabRotation = root.querySelector('#tab-rot');
        const contentTabPosition = root.querySelector('#tabc-pos');
        const contentTabTranslation = root.querySelector('#tabc-move');
        const contentTabRotation = root.querySelector('#tabc-rot');

        const activate = (mode) => {
            [btnTabPosition, btnTabTranslation, btnTabRotation].forEach(b => b.classList.remove('active'));
            [contentTabPosition, contentTabTranslation, contentTabRotation].forEach(n => n.style.display = 'none');

            if (mode === 'position') {
                btnTabPosition.classList.add('active');
                contentTabPosition.style.display = '';
            }
            if (mode === 'translation') {
                btnTabTranslation.classList.add('active');
                contentTabTranslation.style.display = '';
            }
            if (mode === 'rotation') {
                btnTabRotation.classList.add('active');
                contentTabRotation.style.display = '';
            }
        };

        btnTabPosition.onclick = () => activate('position');
        btnTabTranslation.onclick = () => activate('translation');
        btnTabRotation.onclick = () => activate('rotation');

        // Header
        this.selModel = root.querySelector('#sel-model');
        this.btnPickModel = root.querySelector('#btn-pickModel');

        // Position tab
        this.posX = root.querySelector('#pos-x');
        this.posY = root.querySelector('#pos-y');
        this.posZ = root.querySelector('#pos-z');
        this.rotDegPos = root.querySelector('#rot-deg-pos');
        this.btnEdit = root.querySelector('#btn-edit');
        this.btnFit = root.querySelector('#btn-fit');

        // Move tab
        this.fromX = root.querySelector('#from-x');
        this.fromY = root.querySelector('#from-y');
        this.fromZ = root.querySelector('#from-z');
        this.toX = root.querySelector('#to-x');
        this.toY = root.querySelector('#to-y');
        this.toZ = root.querySelector('#to-z');
        this.offX = root.querySelector('#off-x');
        this.offY = root.querySelector('#off-y');
        this.offZ = root.querySelector('#off-z');

        root.querySelector('#btn-pick-from').onclick = () => this.pickAlignPoint(PointToPointPickerTypes.From);
        root.querySelector('#btn-pick-to').onclick = () => this.pickAlignPoint(PointToPointPickerTypes.To);
        root.querySelector('#btn-apply-offset').onclick = () => this.applyOffset();
        root.querySelector('#btn-clear').onclick = () => this.clearPicks();

        // Rotate tab
        this.rotDeg = root.querySelector('#rot-deg');
        root.querySelector('#btn-apply-rot').onclick = () => this.applyRotation();
        this.lblAcc = root.querySelector('#lbl-acc');

        // Footer
        this.btnSave = root.querySelector('#btn-save');
        this.lblMatrix = root.querySelector('#lbl-matrix');
        this.lblMatrix.classList.add('matrix');
        this.matCells = null; // will hold 16 <span> references
        this.refreshMatrixDisplay(null); // create empty matrix display

        // Events
        this.selModel.onchange = () => this.onSelectedModelChanged(+this.selModel.value || null);
        this.btnPickModel.onclick = () => this.selectModelBySelection();

        // Position tab events
        this.btnFit.onclick = () => this.fitToView();
        this.btnEdit.onclick = () => {
            const ro = this.posX.hasAttribute('readonly');
            [this.posX, this.posY, this.posZ, this.rotDegPos].forEach(el => {
                if (ro) {
                    el.removeAttribute('readonly');
                } else {
                    el.setAttribute('readonly', '');
                }
            });
            this.btnEdit.textContent = ro ? 'Apply' : 'Edit';
            if (!ro) {
                this.applyPosition(); // Apply when toggling back
            }
        };

        // Footer save binding
        this.btnSave.onclick = () => this.saveTransform();

        this.isUiCreated = true;
    }

    /**
     * Refreshes the model selection dropdown with current loaded models.
     * Updates the dropdown options to reflect all currently loaded models in the viewer.
     * Preserves the current selection if the model is still available, otherwise resets selection.
     */
    refreshModelList() {
        const models = ModelUtils.getAllModels(this.viewer);
        const modelSelector = this.selModel;
        const currentId = this.selectedModelId || null;

        // Clear existing options
        modelSelector.innerHTML = '<option value="">Please select</option>';

        models.forEach(model => {
            const modelId = model.id;
            const opt = document.createElement('option');
            opt.value = modelId;
            opt.textContent = ModelUtils.generateLabelForModel(model);

            if (modelId === this.selectedModelId) opt.selected = true;

            modelSelector.appendChild(opt);
        });

        // If previously selected model is gone, reset selection
        if (currentId && !models.find(m => m.id === currentId)) {
            modelSelector.value = '';
            this.onSelectedModelChanged(null);
        }
    }

    /**
     * Selects a model based on the current viewer selection.
     * Updates the model dropdown and selection state to match the currently
     * selected model in the viewer, if any.
     */
    selectModelBySelection() {
        const sel = this.viewer.getAggregateSelection();
        if (sel.length && sel[0].model) {
            const modelId = sel[0].model.id;
            const modelSelector = this.selModel;
            modelSelector.value = modelId;
            this.onSelectedModelChanged(modelId);
        }
    }

    /**
     * Refreshes the position display fields with values from the transformation matrix.
     * Extracts position and rotation values from the matrix and updates the UI input fields.
     * Handles both valid matrices and null/undefined cases with appropriate fallbacks.
     * 
     * @param {THREE.Matrix4|null} matrix - The transformation matrix to display, or null to clear
     */
    refreshPositionDisplay(matrix) {
        if (!matrix) {
            this.posX.value = '';
            this.posY.value = '';
            this.posZ.value = '';
            this.rotDegPos.value = '';
            return;
        }

        if (matrix && matrix.elements) {
            const elems = matrix.elements;
            this.posX.value = elems[12].toFixed(4);
            this.posY.value = elems[13].toFixed(4);
            this.posZ.value = elems[14].toFixed(4);

            // Rotation about world Z from rotation part (assumes no shear, uniform scale)
            const yawDeg = Math.atan2(elems[4], elems[0]) * 180 / Math.PI; // atan2(m10, m00)
            this.rotDegPos.value = (yawDeg ? yawDeg : 0.0).toFixed(1);
        } else {
            this.posX.value = '0.0000';
            this.posY.value = '0.0000';
            this.posZ.value = '0.0000';
            this.rotDegPos.value = '0.0';
        }
    }

    /**
     * Refreshes the matrix display in the footer to show the current placement matrix.
     * Creates the matrix cells if they do not exist, and updates their values.
     */
    refreshMatrixDisplay(matrix) {
        if (!this.lblMatrix) return;

        if (!this.matCells) {
            // Create matrix cells
            this.lblMatrix.innerHTML = '';
            this.matCells = [];
            for (let row = 0; row < 4; row++) {
                const rowDiv = document.createElement('div');
                rowDiv.classList.add('mat-row');
                for (let col = 0; col < 4; col++) {
                    const cellSpan = document.createElement('span');
                    cellSpan.classList.add('mat-cell');
                    cellSpan.textContent = '0.0000';
                    this.matCells.push(cellSpan);
                    rowDiv.appendChild(cellSpan);
                }
                this.lblMatrix.appendChild(rowDiv);
            }
        }

        // Update matrix values
        if (matrix && matrix.elements) {
            let idx = 0;
            const elems = matrix.elements;

            for (let r = 0; r < 4; r++) {
                for (let c = 0; c < 4; c++) {
                    const v = elems[c * 4 + r];
                    this.matCells[idx++].textContent = (isFinite(v) ? v : 0).toFixed(4);
                }
            }
        } else {
            // Clear to zeros if no matrix
            for (let i = 0; i < 16; i++) {
                this.matCells[i].textContent = '0.0000';
            }
        }
    }

    /**
     * Refreshes all model-related displays with data from the specified model.
     * Updates the matrix display and position display with the model's current transformation.
     * Uses the selected model if no model is provided.
     * 
     * @param {Autodesk.Viewing.Model|null} [model] - The model to refresh displays for, or null to use selected model
     */
    refreshByModel(model) {
        model = model || ModelUtils.findModelById(this.viewer, this.selectedModelId);

        const matrix = TransformUtils.getPlacementMatrix(model || null);
        this.refreshMatrixDisplay(matrix);
        this.refreshPositionDisplay(matrix);
    }

    /**
     * Fits the selected model to the current view.
     * Animates the camera to show the selected model optimally and refreshes the display.
     * 
     * @async
     * @returns {Promise<void>} Promise that resolves when the fit-to-view operation completes
     */
    async fitToView() {
        const model = ModelUtils.findModelById(this.viewer, this.selectedModelId);
        await this.host.fitToView(model);
        this.refreshByModel(model);
    }

    /**
     * Initiates point picking for model alignment operations.
     * Prompts the user to pick a point of the specified type (From or To) and automatically
     * updates the corresponding input fields with the picked coordinates. If picking a "From" point,
     * automatically triggers picking of a "To" point afterward for streamlined workflow.
     * 
     * @async
     * @param {string} type - The type of point to pick (use PointToPointPickerTypes.From or PointToPointPickerTypes.To)
     * @returns {Promise<void>} Promise that resolves when point picking is complete
     * @throws {Error} Rejects if point picking fails or host is not available
     * 
     * @example
     * // Pick a "From" point (will automatically trigger "To" point picking)
     * await panel.pickAlignPoint(PointToPointPickerTypes.From);
     * 
     * // Pick only a "To" point
     * await panel.pickAlignPoint(PointToPointPickerTypes.To);
     */
    async pickAlignPoint(type) {
        const result = await this.host.pickPoint(type); // { point, modelId }
        if (!result) return;

        const { point, modelId } = result;

        console.log('Picked...', type, result);

        if (type === PointToPointPickerTypes.From && point) {
            this.fromX.value = point.x?.toFixed(3);
            this.fromY.value = point.y?.toFixed(3);
            this.fromZ.value = point.z?.toFixed(3);
            this.fromPoint = point.clone();

            if (!this.toPoint) {
                this.pickAlignPoint(PointToPointPickerTypes.To);
            }
        } else if (type === PointToPointPickerTypes.To && point) {
            this.toX.value = point.x?.toFixed(3);
            this.toY.value = point.y?.toFixed(3);
            this.toZ.value = point.z?.toFixed(3);
            this.toPoint = point.clone();
        }

        if (this.fromX.value && this.toX.value) {
            const dx = (parseFloat(this.toX.value) - parseFloat(this.fromX.value));
            const dy = (parseFloat(this.toY.value) - parseFloat(this.fromY.value));
            const dz = (parseFloat(this.toZ.value) - parseFloat(this.fromZ.value));
            this.offX.value = dx.toFixed(3);
            this.offY.value = dy.toFixed(3);
            this.offZ.value = dz.toFixed(3);
        }
    }

    /**
     * Clears all picked points and resets related input fields.
     * Clears the From and To point coordinates and offset values from the UI,
     * and notifies the host to clear its point picker state.
     */
    clearPicks() {
        this.fromX.value = '';
        this.fromY.value = '';
        this.fromZ.value = '';
        this.toX.value = '';
        this.toY.value = '';
        this.toZ.value = '';
        this.offX.value = '';
        this.offY.value = '';
        this.offZ.value = '';

        this.fromPoint = null;
        this.toPoint = null;

        this.host.clearPicks();
    }

    /**
     * Applies translation offset to the selected model based on picked From and To points.
     * Calculates the translation vector from the From point to the To point and applies
     * this transformation to move the selected model. Updates the offset input fields
     * and clears the picked points afterward.
     * 
     * @async
     * @returns {Promise<void>} Promise that resolves when the offset transformation is applied
     * @throws {Error} Rejects if model is not found or transformation fails
     * 
     * @example
     * // Apply offset after picking From and To points
     * await panel.pickAlignPoint(PointToPointPickerTypes.From);
     * // ... user picks points ...
     * await panel.applyOffset();
     * 
     * @see {@link ModelAlignmentExtension.applyTranslation} for the underlying transformation
     */
    async applyOffset() {
        if (!this.selectedModelId || !this.fromPoint || !this.toPoint) return;

        const model = ModelUtils.findModelById(this.viewer, this.selectedModelId);
        if (!model) return;

        // this.host.clearPicks(); // clear any active pick handlers

        this.host.animatePickerPoints(this.fromPoint, this.toPoint);

        // Compute translation vector
        const delta = new THREE.Vector3().subVectors(this.toPoint, this.fromPoint);
        await this.host.applyTranslation(model, delta.x, delta.y, delta.z);

        this.offX.value = delta.x.toFixed(3);
        this.offY.value = delta.y.toFixed(3);
        this.offZ.value = delta.z.toFixed(3);

        this.refreshByModel(model);
        this.clearPicks();
    }

    /**
     * Applies absolute position and rotation transformation to the selected model.
     * Reads the position (X, Y, Z) and rotation (degrees) values from the UI input fields
     * and applies them as an absolute transformation matrix to the selected model.
     * The transformation combines translation and Z-axis rotation.
     * 
     * @async
     * @returns {Promise<void>} Promise that resolves when the position transformation is applied
     * @throws {Error} Rejects if model is not found or transformation fails
     * 
     * @example
     * // Set position values in UI and apply transformation
     * panel.posX.value = "10.0";
     * panel.posY.value = "5.0";
     * panel.posZ.value = "0.0";
     * panel.rotDegPos.value = "45";
     * await panel.applyPosition();
     * 
     * @see {@link ModelAlignmentExtension.applyMatrix} for the underlying transformation
     */
    async applyPosition() {
        if (!this.selectedModelId) return;

        const model = ModelUtils.findModelById(this.viewer, this.selectedModelId);
        if (!model) return;

        const tx = parseFloat(this.posX.value) || 0;
        const ty = parseFloat(this.posY.value) || 0;
        const tz = parseFloat(this.posZ.value) || 0;
        const deg = parseFloat(this.rotDegPos.value) || 0;

        const T = new THREE.Matrix4().makeTranslation(tx, ty, tz);
        const R = new THREE.Matrix4().makeRotationZ(THREE.Math.degToRad(deg) * -1); // negative angle for right-handed
        const M = new THREE.Matrix4().multiplyMatrices(T, R); // new placement = T*R

        await this.host.applyMatrix(model, M);
        this.refreshByModel(model);
    }

    /**
     * Applies rotation transformation to the selected model.
     * This method is currently not implemented but is intended to apply
     * rotation-only transformations to the selected model.
     * 
     * @async
     * @returns {Promise<void>} Promise that resolves when rotation is applied
     * @todo Implement rotation transformation logic
     * 
     * @example
     * // Apply rotation (implementation pending)
     * await panel.applyRotation();
     */
    async applyRotation() {
        if (!this.selectedModelId) return;

        const model = ModelUtils.findModelById(this.viewer, this.selectedModelId);
        if (!model) return;

        const deg = parseFloat(this.rotDeg.value);
        if (!isFinite(deg)) return;

        await this.host.applyRotation(model, deg * -1); // negative angle for right-handed
        this.refreshByModel(model);
    }

    /**
     * Saves the current transformation state of models.
     * This method is currently not implemented but is intended to persist
     * the current model transformations for later restoration or export.
     * 
     * @async
     * @returns {void}
     * @todo Implement transform saving functionality
     * 
     * @example
     * // Save current transforms (implementation pending)
     * panel.saveTransforms();
     */
    async saveTransform() {
        const model = ModelUtils.findModelById(this.viewer, this.selectedModelId);
        if (!model) return;

        return await this.host.saveTransform(model);
    }
}

export { ModelAlignmentPanel };
