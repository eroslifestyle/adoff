const previewContainer = document.getElementById('preview-container');
const sizeSlider = document.getElementById('size-slider');
const sizeVal = document.getElementById('size-val');
const codeOutput = document.getElementById('code-output');
const assetList = document.getElementById('asset-list');
const dropZone = document.getElementById('drop-zone');

let currentSvg = null;

// Initialize
async function init() {
    const defaultPath = '../../site/assets/logo.svg';
    loadSvg(defaultPath);
    
    // Load thumb for the list
    const thumbData = await fetchSvg(defaultPath);
    document.getElementById('logo-thumb').innerHTML = thumbData;
}

async function fetchSvg(path) {
    try {
        const response = await fetch(path);
        return await response.text();
    } catch (e) {
        console.error('Error loading SVG:', e);
        return null;
    }
}

async function loadSvg(path, content = null) {
    const svgText = content || await fetchSvg(path);
    if (!svgText) return;

    previewContainer.innerHTML = svgText;
    currentSvg = previewContainer.querySelector('svg');
    
    // Apply current size
    updateSize(sizeSlider.value);
    
    // Update code panel
    codeOutput.textContent = svgText;
}

function updateSize(size) {
    if (!currentSvg) return;
    currentSvg.setAttribute('width', size);
    currentSvg.setAttribute('height', size);
    sizeVal.textContent = size;
}

function setBg(className) {
    previewContainer.className = className;
}

function copyCode() {
    const text = codeOutput.textContent;
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.querySelector('.btn-copy');
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        btn.style.background = '#10b981';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = 'var(--accent)';
        }, 2000);
    });
}

// Event Listeners
sizeSlider.addEventListener('input', (e) => {
    updateSize(e.target.value);
});

// Drag & Drop
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.background = 'rgba(59, 130, 246, 0.1)';
});

dropZone.addEventListener('dragleave', () => {
    dropZone.style.background = 'transparent';
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.background = 'transparent';
    
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'image/svg+xml') {
        const reader = new FileReader();
        reader.onload = (event) => {
            loadSvg(null, event.target.result);
            
            // Add to list
            const newItem = document.createElement('div');
            newItem.className = 'asset-item active';
            newItem.innerHTML = `
                <div class="asset-thumb">${event.target.result}</div>
                <div class="asset-info">
                    <div class="asset-name">${file.name}</div>
                    <div class="asset-meta">Dropped File</div>
                </div>
            `;
            
            // Remove active from others
            document.querySelectorAll('.asset-item').forEach(i => i.classList.remove('active'));
            assetList.prepend(newItem);
        };
        reader.readAsText(file);
    }
});

init();
