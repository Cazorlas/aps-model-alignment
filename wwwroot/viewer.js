/// import * as Autodesk from "@types/forge-viewer";

import './ModelAlignmentExtension/ModelAlignmentExtension.js';

async function getAccessToken(callback) {
    try {
        const resp = await fetch('/api/auth/token');
        if (!resp.ok) {
            throw new Error(await resp.text());
        }
        const { access_token, expires_in } = await resp.json();
        callback(access_token, expires_in);
    } catch (err) {
        alert('Could not obtain access token. See the console for more details.');
        console.error(err);
    }
}

export function initViewer(container) {
    return new Promise(function (resolve, reject) {
        Autodesk.Viewing.Initializer({ env: 'AutodeskProduction2', api: 'streamingV2', getAccessToken }, function () {
            const config = {
                extensions: ['Autodesk.DocumentBrowser', 'Autodesk.DeveloperAdvocacySupport.ModelAlignmentExtension']
            };
            const viewer = new Autodesk.Viewing.GuiViewer3D(container, config);
            viewer.start();
            viewer.setTheme('light-theme');
            resolve(viewer);
        });
    });
}

export function loadModel(viewer, urn, options = {}) {
    return new Promise(function (resolve, reject) {
        async function onDocumentLoadSuccess(doc) {
            viewer.loadDocumentNode(doc, doc.getRoot().getDefaultGeometry(), options);
            await viewer.waitForLoadDone();
            resolve();
        }
        function onDocumentLoadFailure(code, message, errors) {
            reject({ code, message, errors });
        }
        Autodesk.Viewing.Document.load('urn:' + urn, onDocumentLoadSuccess, onDocumentLoadFailure);
    });
}
