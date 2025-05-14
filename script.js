document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const spinnerContainer = document.getElementById('spinner-container');
    const wheel = document.getElementById('spinner-wheel');
    const spinButton = document.getElementById('spin-button');
    const resultDisplay = document.getElementById('result-display');
    // Word Config Elements
    const wordInput = document.getElementById('word-input');
    const segmentImageInput = document.getElementById('segment-image-input');
    const segmentImagePreview = document.getElementById('segment-image-preview');
    const addWordButton = document.getElementById('add-word-button');
    const wordListElement = document.getElementById('word-list');
    // Cap Image Upload Elements
    const capImageUpload = document.getElementById('cap-image-upload');
    const removeCapImageButton = document.getElementById('remove-cap-image');
    // Font Size Elements
    const fontSizeSlider = document.getElementById('font-size-slider');
    const fontSizeValue = document.getElementById('font-size-value');
    // Configuration Management Elements (Browser Storage)
    const configNameInput = document.getElementById('config-name-input');
    const saveConfigButton = document.getElementById('save-config-button');
    const configSelect = document.getElementById('config-select');
    const loadConfigButton = document.getElementById('load-config-button');
    const deleteConfigButton = document.getElementById('delete-config-button');
    // Configuration Management Elements (File)
    const downloadConfigFileButton = document.getElementById('download-config-file-button');
    const uploadConfigFileInput = document.getElementById('upload-config-file-input');


    // --- Sound Effects ---
    const sounds = {
        spinStart: new Audio('audio/spin_start.mp3'),
        winnerReveal: new Audio('audio/winner_reveal.mp3'),
        itemAdd: new Audio('audio/item_add.mp3'),
        itemRemove: new Audio('audio/item_remove.mp3'),
        configSave: new Audio('audio/config_save.mp3'),
        configLoad: new Audio('audio/config_load.mp3')
    };

    function playSound(soundKey) {
        if (sounds[soundKey]) {
            sounds[soundKey].currentTime = 0;
            sounds[soundKey].play().catch(error => console.warn(`Audio play failed for ${soundKey}. Error:`, error));
        }
    }

    // --- Configuration & State ---
    const defaultSegments = [
        { text: "Yes!", image: null }, { text: "No!", image: null }, { text: "Maybe", image: null },
        { text: "Ask Again", image: null }, { text: "Let's Try!", image: null }, { text: "Good Idea!", image: null },
        { text: "Hmm...", image: null }, { text: "Definitely!", image: null }
    ];
    let segments = [];
    const segmentColors = ['#FF6B6B', '#FFD166', '#06D6A0', '#118AB2', '#E76F51', '#F4A261', '#E9C46A', '#2A9D8F', '#264653', '#F7A072', '#ED6A5A', '#F8E16C', '#08A045', '#1E96FC', '#AF2BBF'];
    let segmentCount = 0;
    let segmentAngle = 0;
    let currentRotation = 0;
    let isSpinning = false;
    let winnerIndex = -1;
    let cylinderRadius = 0;
    let wheelHeight = 170;
    let currentSegmentImage = null;
    let scrollResetTimeoutId = null; // For handling scroll during spin

    // --- Constants ---
    const INITIAL_TILT_X = -25;
    const CAP_IMAGE_STORAGE_KEY = 'spinnerCapImageData';
    const SEGMENTS_STORAGE_KEY = 'brainPowerSegments_v2';
    const FONT_SIZE_STORAGE_KEY = 'spinnerFontSize';
    const CONFIGURATIONS_STORAGE_KEY = 'brainPowerConfigurations_v1';
    const CONFIG_FILE_EXTENSION = '.bpsc'; // Brain Power Spinner Config

    // --- Deep Copy Helper ---
    function deepCopy(obj) {
        try {
            return JSON.parse(JSON.stringify(obj));
        } catch (e) {
            console.error("Deep copy failed:", e);
            return obj;
        }
    }

    // --- LOCAL STORAGE (Current State) ---
    function saveSegmentsToStorage() {
        try {
            localStorage.setItem(SEGMENTS_STORAGE_KEY, JSON.stringify(segments));
        } catch (e) {
            console.error("Error saving segments to localStorage (quota likely exceeded):", e);
            // Potentially alert the user here if this specific save fails,
            // though the main quota issue is typically on loading large files.
        }
    }
    function loadSegmentsFromStorage() {
        const saved = localStorage.getItem(SEGMENTS_STORAGE_KEY);
        const oldSaved = localStorage.getItem('brainPowerSegments');
        if (saved) {
            try {
                segments = JSON.parse(saved);
                if (!Array.isArray(segments) || segments === null || segments.length === 0) {
                    segments = deepCopy(defaultSegments);
                } else {
                    segments = segments.map(item => ({
                        text: typeof item === 'string' ? item : (item?.text || ''),
                        image: typeof item === 'string' ? null : (item?.image || null)
                    }));
                }
            } catch (e) { console.error("Error loading segments (v2) from storage:", e); segments = deepCopy(defaultSegments); }
        } else if (oldSaved) {
             try {
                const oldArray = JSON.parse(oldSaved);
                if (Array.isArray(oldArray)) {
                    segments = oldArray.map(text => ({ text: text, image: null }));
                    saveSegmentsToStorage(); localStorage.removeItem('brainPowerSegments');
                } else { segments = deepCopy(defaultSegments); }
             } catch (e) { console.error("Error migrating old segments:", e); segments = deepCopy(defaultSegments); }
        } else { segments = deepCopy(defaultSegments); }
        if (segments === null) segments = [];
    }

    // --- WORD/ITEM LIST MANAGEMENT ---
    function renderWordList() {
        wordListElement.innerHTML = '';
        if (segments.length === 0) { wordListElement.innerHTML = '<li>Add some items below!</li>'; return; }
        const fragment = document.createDocumentFragment();
        segments.forEach((item, index) => {
            const li = document.createElement('li'); const contentDiv = document.createElement('div'); contentDiv.className = 'item-content';
            if (item.image) { const imgPreview = document.createElement('img'); imgPreview.src = item.image; imgPreview.alt = "Preview"; contentDiv.appendChild(imgPreview); }
            const textSpan = document.createElement('span'); textSpan.textContent = item.text || "[No Text]"; contentDiv.appendChild(textSpan); li.appendChild(contentDiv);
            const controlsDiv = document.createElement('div'); controlsDiv.className = 'item-controls';
            if (item.image) { const removeImgButton = document.createElement('button'); removeImgButton.textContent = '🖼️✖'; removeImgButton.title = `Remove image for "${item.text}"`; removeImgButton.className = 'remove-item-image'; removeImgButton.dataset.index = index; removeImgButton.addEventListener('click', handleRemoveItemImage); controlsDiv.appendChild(removeImgButton); }
            const removeItemButton = document.createElement('button'); removeItemButton.textContent = '✖'; removeItemButton.title = `Remove item "${item.text}"`; removeItemButton.className = 'remove-word'; removeItemButton.dataset.index = index; removeItemButton.addEventListener('click', handleRemoveWord); controlsDiv.appendChild(removeItemButton);
            li.appendChild(controlsDiv);
            fragment.appendChild(li);
        });
        wordListElement.appendChild(fragment);
    }
    function handleAddWord() {
        const newWord = wordInput.value.trim(); if (!newWord) { alert("Please enter text for the spinner item."); return; }
        const newItem = { text: newWord, image: currentSegmentImage }; segments.push(newItem);
        wordInput.value = ''; segmentImageInput.value = null; segmentImagePreview.innerHTML = ''; currentSegmentImage = null;
        saveSegmentsToStorage(); updateSpinner(); playSound('itemAdd'); wordInput.focus();
    }
    function handleRemoveWord(event) {
        const indexToRemove = parseInt(event.target.dataset.index, 10);
        if (!isNaN(indexToRemove) && indexToRemove >= 0 && indexToRemove < segments.length) {
            segments.splice(indexToRemove, 1); saveSegmentsToStorage(); updateSpinner(); playSound('itemRemove');
        }
    }
    function handleRemoveItemImage(event) {
        const indexToUpdate = parseInt(event.target.dataset.index, 10);
         if (!isNaN(indexToUpdate) && indexToUpdate >= 0 && indexToUpdate < segments.length) {
            segments[indexToUpdate].image = null; saveSegmentsToStorage(); updateSpinner(); playSound('itemRemove');
        }
    }

    // --- CAP IMAGE HANDLING ---
    function saveCapImage(dataUrl) { try { localStorage.setItem(CAP_IMAGE_STORAGE_KEY, dataUrl); } catch (e) { console.error("Error saving cap image to localStorage (quota likely exceeded):", e); alert("Could not save cap image due to storage limits. Try removing other saved configurations or using smaller images.");} }
    function loadCapImage() { const savedImageData = localStorage.getItem(CAP_IMAGE_STORAGE_KEY); if (savedImageData) { applyCapImage(savedImageData); removeCapImageButton.style.display = 'inline-block'; } else { resetCapImage(); } }
    function applyCapImage(dataUrl) { wheel.style.setProperty('--cap-image', `url("${dataUrl}")`); }
    function resetCapImage() { wheel.style.removeProperty('--cap-image'); removeCapImageButton.style.display = 'none'; }
    function handleCapImageUpload(event) { const file = event.target.files?.[0]; if (!file || !file.type.startsWith('image/')) { if(file) alert('Please select an image file.'); return; } const reader = new FileReader(); reader.onload = (e) => { const imageDataUrl = e.target.result; applyCapImage(imageDataUrl); saveCapImage(imageDataUrl); removeCapImageButton.style.display = 'inline-block'; event.target.value = null; }; reader.onerror = (e) => { console.error("FileReader error:", e); alert("Sorry, there was an error reading the image file."); }; reader.readAsDataURL(file); }
    function handleRemoveCapImage() { localStorage.removeItem(CAP_IMAGE_STORAGE_KEY); resetCapImage(); }

    // --- SEGMENT IMAGE PREVIEW ---
    function handleSegmentImagePreview(event) {
        const file = event.target.files?.[0]; segmentImagePreview.innerHTML = ''; currentSegmentImage = null;
        if (!file || !file.type.startsWith('image/')) { if(file) alert('Please select an image file.'); segmentImageInput.value = null; return; }
         const reader = new FileReader();
         reader.onload = (e) => { currentSegmentImage = e.target.result; const img = document.createElement('img'); img.src = currentSegmentImage; img.alt = "Preview"; segmentImagePreview.appendChild(img); segmentImagePreview.insertAdjacentText('beforeend', ` Ready: ${file.name}`); };
         reader.onerror = (e) => { console.error("FileReader error:", e); alert("Error reading preview image."); currentSegmentImage = null; segmentImageInput.value = null;};
         reader.readAsDataURL(file);
    }

    // --- FONT SIZE HANDLING ---
    function loadFontSize() { const savedSize = localStorage.getItem(FONT_SIZE_STORAGE_KEY); const initialSize = savedSize ? parseInt(savedSize, 10) : 18; applyFontSize(initialSize); fontSizeSlider.value = initialSize; }
    function saveFontSize(size) { try {localStorage.setItem(FONT_SIZE_STORAGE_KEY, size.toString()); } catch(e) { console.warn("Could not save font size to local storage."); }}
    function applyFontSize(size) { wheel.style.setProperty('--segment-font-size', `${size}px`); if(fontSizeValue) { fontSizeValue.textContent = `${size}px`; } }
    function handleFontSizeChange(event) { const newSize = event.target.value; applyFontSize(newSize); saveFontSize(newSize); }

    // --- CONFIGURATION DATA APPLICATION LOGIC ---
    function applyConfigurationData(configData, sourceName = "Loaded", persistToLocalStorage = true) {
        if (!configData || typeof configData !== 'object') {
            alert(`Invalid configuration data from ${sourceName}.`);
            return false;
        }
        if (!Array.isArray(configData.segments)) {
            alert(`Invalid segments format in ${sourceName} configuration. Loading defaults.`);
            segments = deepCopy(defaultSegments);
        } else {
            segments = deepCopy(configData.segments);
        }
        if (persistToLocalStorage) {
            saveSegmentsToStorage(); // This might fail if segments array with images is too large
        }

        if (typeof configData.capImageDataUrl === 'string' && configData.capImageDataUrl.startsWith('data:image')) {
            applyCapImage(configData.capImageDataUrl);
            if (persistToLocalStorage) {
                saveCapImage(configData.capImageDataUrl); // This might fail if cap image is too large
            }
            removeCapImageButton.style.display = 'inline-block';
        } else {
            resetCapImage();
            if (persistToLocalStorage) {
                localStorage.removeItem(CAP_IMAGE_STORAGE_KEY);
            }
        }

        const newFontSize = parseInt(configData.fontSize, 10);
        if (!isNaN(newFontSize) && newFontSize >= 8 && newFontSize <= 30) {
            applyFontSize(newFontSize);
            fontSizeSlider.value = newFontSize;
            if (persistToLocalStorage) {
                saveFontSize(newFontSize);
            }
        } else {
            applyFontSize(18);
            fontSizeSlider.value = 18;
            if (persistToLocalStorage) {
                saveFontSize(18);
            }
        }
        updateSpinner();
        return true;
    }


    // --- CONFIGURATION MANAGEMENT (Browser Storage) ---
    function getAllConfigurations() { const configs = localStorage.getItem(CONFIGURATIONS_STORAGE_KEY); try { return configs ? JSON.parse(configs) : {}; } catch (e) { console.error("Error parsing configurations:", e); return {}; } }
    function saveAllConfigurations(configs) { try { localStorage.setItem(CONFIGURATIONS_STORAGE_KEY, JSON.stringify(configs)); } catch (e) { console.error("Error saving configurations to localStorage (quota likely exceeded):", e); alert("Could not save all configurations due to storage limits. Some data might be too large."); } }
    function populateConfigDropdown() {
        const configs = getAllConfigurations(); const configNames = Object.keys(configs); configSelect.innerHTML = '';
        if (configNames.length === 0) { const option = document.createElement('option'); option.textContent = "No saved configurations"; option.disabled = true; configSelect.appendChild(option); loadConfigButton.disabled = true; deleteConfigButton.disabled = true; }
        else { configNames.forEach(name => { const option = document.createElement('option'); option.value = name; option.textContent = name; configSelect.appendChild(option); }); loadConfigButton.disabled = false; deleteConfigButton.disabled = false; }
    }
    function handleSaveConfig() { // Saves current working set to a named config in browser storage
        const name = configNameInput.value.trim(); if (!name) { alert("Please enter a name for the configuration."); configNameInput.focus(); return; }
        const currentCapImageData = wheel.style.getPropertyValue('--cap-image').replace(/^url\(['"](.+)['"]\)$/, '$1'); // Get from style
        const currentFontSize = fontSizeSlider.value;
        const newConfig = {
            segments: deepCopy(segments), // Current segments in memory
            capImageDataUrl: (currentCapImageData && currentCapImageData.startsWith('data:image')) ? currentCapImageData : null,
            fontSize: parseInt(currentFontSize, 10)
        };
        const allConfigs = getAllConfigurations(); allConfigs[name] = newConfig; saveAllConfigurations(allConfigs); // This is where quota might be hit for the whole set
        populateConfigDropdown(); configSelect.value = name; configNameInput.value = ''; alert(`Configuration "${name}" saved to browser!`); playSound('configSave');
    }
    function handleLoadConfig() { // Loads from a named config in browser storage
        const name = configSelect.value; if (!name) { alert("No configuration selected to load."); return; }
        const allConfigs = getAllConfigurations(); const configToLoad = allConfigs[name];
        if (!configToLoad) { alert(`Configuration "${name}" not found!`); return; }
        // When loading FROM browser storage, we assume it was valid when saved,
        // and we want to make it the "active" localStorage set too.
        if (applyConfigurationData(configToLoad, `browser config "${name}"`, true)) { // persistToLocalStorage = true
            alert(`Configuration "${name}" loaded from browser!`);
            playSound('configLoad');
        }
    }
    function handleDeleteConfig() {
        const name = configSelect.value; if (!name) { alert("No configuration selected to delete."); return; }
        if (!confirm(`Are you sure you want to delete the browser configuration "${name}"? This cannot be undone.`)) { return; }
        const allConfigs = getAllConfigurations();
        if (allConfigs[name]) { delete allConfigs[name]; saveAllConfigurations(allConfigs); populateConfigDropdown(); alert(`Browser configuration "${name}" deleted.`); }
        else { alert(`Browser configuration "${name}" not found for deletion.`); }
    }

    // --- CONFIGURATION MANAGEMENT (File Download/Upload) ---
    function handleDownloadConfigFile() {
        const currentCapImageDataFromStyle = wheel.style.getPropertyValue('--cap-image').replace(/^url\(['"](.+)['"]\)$/, '$1');
        const configData = {
            segments: deepCopy(segments),
            capImageDataUrl: (currentCapImageDataFromStyle && currentCapImageDataFromStyle.startsWith('data:image')) ? currentCapImageDataFromStyle : null,
            fontSize: parseInt(fontSizeSlider.value, 10)
        };
        const jsonData = JSON.stringify(configData, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-").replace("T", "_");
        a.href = url;
        a.download = `spinner_config_${timestamp}${CONFIG_FILE_EXTENSION}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('Configuration file download initiated!');
    }
    function handleUploadConfigFile(event) {
        const file = event.target.files?.[0]; if (!file) { return; }
        if (!file.name.endsWith(CONFIG_FILE_EXTENSION) && !file.name.endsWith('.json')) {
            alert(`Invalid file type. Please upload a ${CONFIG_FILE_EXTENSION} or .json file.`);
            uploadConfigFileInput.value = null; return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const fileContent = e.target.result;
                const loadedConfigData = JSON.parse(fileContent);
                if (typeof loadedConfigData === 'object' && loadedConfigData !== null &&
                    Array.isArray(loadedConfigData.segments) &&
                    (loadedConfigData.capImageDataUrl === null || typeof loadedConfigData.capImageDataUrl === 'string') && // Allow null for cap image
                    typeof loadedConfigData.fontSize === 'number') {
                    // When loading from FILE, set persistToLocalStorage to false.
                    // The user can explicitly save to browser storage later if they wish.
                    if (applyConfigurationData(loadedConfigData, `file "${file.name}"`, false)) {
                       alert(`Configuration loaded successfully from file: ${file.name}`);
                       playSound('configLoad');
                    }
                } else { alert(`The file "${file.name}" does not contain a valid spinner configuration structure.`); }
            } catch (error) {
                console.error("Error parsing or applying configuration file:", error);
                // Check for QuotaExceededError specifically for the alert, though it shouldn't happen here with persist=false
                let errorDetails = error.message;
                if (error.name === 'QuotaExceededError') {
                    errorDetails = "The browser's storage quota has been exceeded. Please clear some saved configurations or use smaller images.";
                }
                alert(`Error reading or applying configuration from "${file.name}". Details: ${errorDetails}`);
            } finally { uploadConfigFileInput.value = null; }
        };
        reader.onerror = (e) => {
            console.error("FileReader error:", e);
            alert(`Sorry, there was an error reading the file: ${file.name}.`);
            uploadConfigFileInput.value = null;
        };
        reader.readAsText(file);
    }


    // --- Update & Reset ---
    function updateSpinner() {
        // console.time("updateSpinnerTotal");
        // console.time("renderWordListInUpdate");
        renderWordList();
        // console.timeEnd("renderWordListInUpdate");

        // console.time("resetVisualsInUpdate");
        resetSpinnerVisuals();
        // console.timeEnd("resetVisualsInUpdate");

        setTimeout(() => {
            // console.time("createSegmentsInTimeout");
            createSegments();
            // console.timeEnd("createSegmentsInTimeout");
            if (spinButton) {
                spinButton.disabled = segments.length < 2;
            }
            // console.timeEnd("updateSpinnerTotal"); // Place it here to see full async time
        }, 50); // Increased timeout for better list rendering chance
    }
    function resetSpinnerVisuals() {
        currentRotation = 0; winnerIndex = -1; removeHighlight();
        if (wheel && typeof wheel.offsetHeight !== 'undefined') {
            wheelHeight = wheel.offsetHeight;
            wheel.style.setProperty('--wheel-height', `${wheelHeight}px`);
        }
        if (wheel) {
            wheel.style.transition = 'none';
            wheel.style.transform = `rotateX(${INITIAL_TILT_X}deg) rotateY(0deg)`;
            setTimeout(() => {
                if (wheel) {
                    wheel.style.transition = `transform 6s cubic-bezier(0.25, 0.1, 0.25, 1)`;
                }
            }, 20);
        }
        if (resultDisplay) {
            resultDisplay.textContent = '';
            resultDisplay.classList.remove('visible');
        }
    }

    // --- Text Measurement Helper ---
    const textMeasureEl = document.createElement('span'); textMeasureEl.style.position = 'absolute'; textMeasureEl.style.visibility = 'hidden'; textMeasureEl.style.height = 'auto'; textMeasureEl.style.width = 'auto'; textMeasureEl.style.whiteSpace = 'nowrap'; textMeasureEl.style.fontWeight = '600'; textMeasureEl.style.fontFamily = "'Poppins', sans-serif"; document.body.appendChild(textMeasureEl);
    function getTextWidth(text, fontSize) { textMeasureEl.textContent = text || ''; textMeasureEl.style.fontSize = fontSize + 'px'; return textMeasureEl.offsetWidth; }

    // --- SPINNER WHEEL CREATION ---
    function createSegments() {
        const fragment = document.createDocumentFragment();
        segmentCount = segments.length;
        if (!wheel) return; // Guard against wheel not existing
        const computedStyle = getComputedStyle(wheel);
        const currentWheelWidth = parseFloat(computedStyle.width);
        wheelHeight = parseFloat(computedStyle.height);
        wheel.style.setProperty('--wheel-height', `${wheelHeight}px`);

        if (segmentCount < 2 || currentWheelWidth <= 0 || wheelHeight <= 0) {
            wheel.innerHTML = '<div class="placeholder-segment">Add 2+ items to spin!</div>';
            cylinderRadius = 0; wheel.style.setProperty('--cap-diameter', '0px'); wheel.style.setProperty('--cap-left', '50%'); return;
        }
        segmentAngle = 360 / segmentCount; cylinderRadius = currentWheelWidth / 2;
        const angleRad = (segmentAngle / 2) * (Math.PI / 180); const segmentWidth = 2 * cylinderRadius * Math.tan(angleRad) * 1.01;
        const capDiameter = currentWheelWidth; wheel.style.setProperty('--cap-diameter', `${capDiameter}px`); wheel.style.setProperty('--cap-left', `0px`);

        segments.forEach((item, index) => {
            const segmentElement = document.createElement('div'); segmentElement.className = 'segment'; segmentElement.dataset.index = index; const rotationY = segmentAngle * index;
            segmentElement.style.width = `${segmentWidth}px`; segmentElement.style.backgroundColor = segmentColors[index % segmentColors.length];
            segmentElement.style.transform = `translateX(-50%) rotateY(${rotationY}deg) translateZ(${cylinderRadius}px)`;
            if (item.image) { const imgElement = document.createElement('img'); imgElement.src = item.image; imgElement.alt = item.text || 'Segment Image'; segmentElement.appendChild(imgElement); }
            const textSpan = document.createElement('span'); textSpan.textContent = item.text; segmentElement.appendChild(textSpan);
            fragment.appendChild(segmentElement);
        });
        wheel.innerHTML = '';
        wheel.appendChild(fragment);
    }

    // --- Spin, Highlight, Confetti ---
    function spinWheel() { if (isSpinning || segmentCount < 2) return; isSpinning = true; spinButton.disabled = true; resultDisplay.textContent = 'Spinning...'; resultDisplay.classList.remove('visible'); removeHighlight(); playSound('spinStart'); const randomExtraRotation = Math.random() * 360; const spinCycles = Math.floor(Math.random() * 8) + 10; const targetRotationY = currentRotation + (spinCycles * 360) + randomExtraRotation; wheel.style.transform = `rotateX(${INITIAL_TILT_X}deg) rotateY(${targetRotationY}deg)`; currentRotation = targetRotationY; }
    function removeHighlight() { const highlighted = wheel.querySelector('.segment.winner'); if (highlighted) { highlighted.classList.remove('winner'); } winnerIndex = -1; }
    function highlightWinner(index) { winnerIndex = index; const winnerSegment = wheel.querySelector(`.segment[data-index="${index}"]`); if (winnerSegment) { winnerSegment.classList.add('winner'); } }
    function triggerConfetti() { if (typeof confetti === 'function') { confetti({ particleCount: 200, spread: 120, origin: { y: 0.6 }, startVelocity: 50, gravity: 0.7, ticks: 350 }); confetti({ particleCount: 70, angle: 60, spread: 60, origin: { x: 0, y: 0.7 } }); confetti({ particleCount: 70, angle: 120, spread: 60, origin: { x: 1, y: 0.7 } }); } }

    // --- Scroll Handling during Spin ---
    function handleScrollDuringSpin() {
        if (isSpinning) {
            const currentTransform = window.getComputedStyle(wheel).transform;
            wheel.style.transition = 'none';
            wheel.style.transform = currentTransform;

            if (scrollResetTimeoutId) {
                clearTimeout(scrollResetTimeoutId);
            }
            scrollResetTimeoutId = setTimeout(() => {
                isSpinning = false;
                updateSpinner();
                if (resultDisplay) {
                    resultDisplay.textContent = 'Spin interrupted by scroll.';
                    resultDisplay.classList.add('visible');
                }
                scrollResetTimeoutId = null;
            }, 100);
        }
    }

    // --- EVENT LISTENERS ---
    wheel.addEventListener('transitionend', (event) => {
        if (scrollResetTimeoutId) { return; }
        if (event.target !== wheel || event.propertyName !== 'transform' || !isSpinning) { return; }
        isSpinning = false; spinButton.disabled = segments.length < 2;
        const finalRotationY = currentRotation % 360; const winningAngleRaw = (360 - finalRotationY) % 360; const winningAngleCentered = (winningAngleRaw + segmentAngle / 2) % 360; let calculatedWinnerIndex = -1; if (segmentAngle > 0) { calculatedWinnerIndex = Math.floor(winningAngleCentered / segmentAngle); }
        const finalWinnerIndex = Math.max(0, Math.min(calculatedWinnerIndex, segments.length - 1));
        if (finalWinnerIndex >= 0 && finalWinnerIndex < segments.length && segments.length > 0) {
            const winnerItem = segments[finalWinnerIndex]; resultDisplay.textContent = `${winnerItem.text}`; resultDisplay.classList.add('visible'); highlightWinner(finalWinnerIndex); triggerConfetti(); playSound('winnerReveal');
        } else { resultDisplay.textContent = (segments.length < 2) ? 'Add items!' : 'Spin Error!'; resultDisplay.classList.add('visible'); console.error("Could not determine valid winner index (3D):", { finalRotationY, winningAngleCentered, segmentAngle, calculatedWinnerIndex, segmentsLength: segments.length }); winnerIndex = -1; }
    });
    spinButton.addEventListener('click', spinWheel);
    addWordButton.addEventListener('click', handleAddWord);
    capImageUpload.addEventListener('change', handleCapImageUpload);
    removeCapImageButton.addEventListener('click', handleRemoveCapImage);
    segmentImageInput.addEventListener('change', handleSegmentImagePreview);
    wordInput.addEventListener('keypress', (event) => { if (event.key === 'Enter') { event.preventDefault(); handleAddWord(); } });
    fontSizeSlider.addEventListener('input', handleFontSizeChange);
    saveConfigButton.addEventListener('click', handleSaveConfig);
    loadConfigButton.addEventListener('click', handleLoadConfig);
    deleteConfigButton.addEventListener('click', handleDeleteConfig);
    downloadConfigFileButton.addEventListener('click', handleDownloadConfigFile);
    uploadConfigFileInput.addEventListener('change', handleUploadConfigFile);
    window.addEventListener('scroll', handleScrollDuringSpin, { passive: true });
    let resizeTimeout; window.addEventListener('resize', () => { clearTimeout(resizeTimeout); resizeTimeout = setTimeout(() => { updateSpinner(); }, 250); });

    // --- INITIALIZATION ---
    loadSegmentsFromStorage();
    loadCapImage();
    loadFontSize();
    populateConfigDropdown();
    updateSpinner();
    window.addEventListener('unload', () => { if (textMeasureEl && textMeasureEl.parentNode === document.body) { document.body.removeChild(textMeasureEl); } });
});