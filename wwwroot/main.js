import { initViewer, loadModel } from './viewer.js';

const viewer = await initViewer(document.getElementById('preview'));

await loadModel(viewer, 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6dGVzdC1zYW5kYm94LWxrd2VqN3hwYmdwNjN4NGhsMzM1eTZtMjZvYWtnZ29mL3JhY2Jhc2ljc2FtcGxlcHJvamVjdC5ydnQ');
await loadModel(viewer, 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6ZXh0cmFjdC1hdXRvZGVzay1pby0yMDE3bGt3ZWo3eHBiZ3A2M3g0aGwzMzV5Nm0yNm9ha2dnb2YvcnN0X2Jhc2ljX3NhbXBsZV9wcm9qZWN0LnJ2dA', { keepCurrentModels: true });

function showNotification(message) {
    const overlay = document.getElementById('overlay');
    overlay.innerHTML = `<div class="notification">${message}</div>`;
    overlay.style.display = 'flex';
}

function clearNotification() {
    const overlay = document.getElementById('overlay');
    overlay.innerHTML = '';
    overlay.style.display = 'none';
}
