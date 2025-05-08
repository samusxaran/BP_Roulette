document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const spinnerContainer = document.getElementById('spinner-container');
    const wheel = document.getElementById('spinner-wheel');
    const spinButton = document.getElementById('spin-button');
    const resultDisplay = document.getElementById('result-display');
    // Word Config Elements
    const wordInput = document.getElementById('word-input');
    const segmentImageInput = document.getElementById('segment-image-input'); // New file input for segments
    const segmentImagePreview = document.getElementById('segment-image-preview'); // Preview area
    const addWordButton = document.getElementById('add-word-button');
    const wordListElement = document.getElementById('word-list');
    // Cap Image Upload Elements
    const capImageUpload = document.getElementById('cap-image-upload');
    const removeCapImageButton = document.getElementById('remove-cap-image');
    // Font Size Elements
    const fontSizeSlider = document.getElementById('font-size-slider');
    const fontSizeValue = document.getElementById('font-size-value');

    // --- Configuration & State ---
    const defaultSegments = [ // New object structure
        { text: "Yes!", image: null }, { text: "No!", image: null }, { text: "Maybe", image: null },
        { text: "Ask Again", image: null }, { text: "Let's Try!", image: null }, { text: "Good Idea!", image: null },
        { text: "Hmm...", image: null }, { text: "Definitely!", image: null }
    ];
    let segments = []; // Will hold objects { text: string, image: string | null }
    const segmentColors = ['#FF6B6B', '#FFD166', '#06D6A0', '#118AB2', '#E76F51', '#F4A261', '#E9C46A', '#2A9D8F', '#264653', '#F7A072', '#ED6A5A', '#F8E16C', '#08A045', '#1E96FC', '#AF2BBF'];
    let segmentCount = 0;
    let segmentAngle = 0;
    let currentRotation = 0; // Y rotation
    let isSpinning = false;
    let winnerIndex = -1;
    let cylinderRadius = 0;
    let wheelHeight = 170;
    let currentSegmentImage = null; // Temporarily store Data URL for preview

    // --- Constants ---
    const INITIAL_TILT_X = -25;
    const CAP_IMAGE_STORAGE_KEY = 'spinnerCapImageData';
    const SEGMENTS_STORAGE_KEY = 'brainPowerSegments_v2'; // New key for object structure
    const FONT_SIZE_STORAGE_KEY = 'spinnerFontSize';

    // --- LOCAL STORAGE ---
    function saveSegmentsToStorage() { localStorage.setItem(SEGMENTS_STORAGE_KEY, JSON.stringify(segments)); }
    function loadSegmentsFromStorage() {
        const saved = localStorage.getItem(SEGMENTS_STORAGE_KEY);
        const oldSaved = localStorage.getItem('brainPowerSegments'); // Check for old string array

        if (saved) { // Load new object format if available
            try {
                segments = JSON.parse(saved);
                if (!Array.isArray(segments) || segments === null || segments.length === 0) {
                    segments = defaultSegments.map(s => ({...s})); // Deep copy defaults
                } else {
                    // Ensure all items have both text and image properties
                    segments = segments.map(item => ({
                        text: typeof item === 'string' ? item : (item?.text || ''), // Handle potential migration issues
                        image: typeof item === 'string' ? null : (item?.image || null)
                    }));
                }
            } catch (e) {
                console.error("Error loading segments (v2) from storage:", e);
                segments = defaultSegments.map(s => ({...s})); // Reset on error
            }
        } else if (oldSaved) { // Migrate from old string array format
             try {
                const oldArray = JSON.parse(oldSaved);
                if (Array.isArray(oldArray)) {
                    segments = oldArray.map(text => ({ text: text, image: null }));
                    console.log("Migrated old segments to new format.");
                    saveSegmentsToStorage(); // Save in new format
                    localStorage.removeItem('brainPowerSegments'); // Remove old key
                } else {
                     segments = defaultSegments.map(s => ({...s}));
                }
             } catch (e) {
                 console.error("Error migrating old segments:", e);
                 segments = defaultSegments.map(s => ({...s}));
             }
        } else { // No data found, use defaults
            segments = defaultSegments.map(s => ({...s}));
        }
        if (segments === null) segments = []; // Final safety check
    }

    // --- WORD/ITEM LIST MANAGEMENT ---
    function renderWordList() {
        wordListElement.innerHTML = '';
        if (segments.length === 0) {
            wordListElement.innerHTML = '<li>Add some items below!</li>';
            return;
        }
        segments.forEach((item, index) => {
            const li = document.createElement('li');

            // Container for content (image + text)
            const contentDiv = document.createElement('div');
            contentDiv.className = 'item-content';

            // Image Preview (if exists)
            if (item.image) {
                const imgPreview = document.createElement('img');
                imgPreview.src = item.image;
                imgPreview.alt = "Preview";
                contentDiv.appendChild(imgPreview);
            }

            // Text
            const textSpan = document.createElement('span');
            textSpan.textContent = item.text || "[No Text]"; // Show placeholder if text is missing
            contentDiv.appendChild(textSpan);

            li.appendChild(contentDiv);

            // Container for controls (remove image + remove item)
            const controlsDiv = document.createElement('div');
            controlsDiv.className = 'item-controls';

            // Remove Image Button (if image exists)
            if (item.image) {
                const removeImgButton = document.createElement('button');
                removeImgButton.textContent = '🖼️✖'; // Image + X
                removeImgButton.title = `Remove image for "${item.text}"`;
                removeImgButton.className = 'remove-item-image';
                removeImgButton.dataset.index = index;
                removeImgButton.addEventListener('click', handleRemoveItemImage);
                controlsDiv.appendChild(removeImgButton);
            }

            // Remove Item Button
            const removeItemButton = document.createElement('button');
            removeItemButton.textContent = '✖'; // Just X
            removeItemButton.title = `Remove item "${item.text}"`;
            removeItemButton.className = 'remove-word'; // Keep class for potential styling reuse
            removeItemButton.dataset.index = index;
            removeItemButton.addEventListener('click', handleRemoveWord); // Existing handler works
            controlsDiv.appendChild(removeItemButton);

            li.appendChild(controlsDiv);

            wordListElement.appendChild(li);
        });
    }

    // Modified to handle object structure and optional image
    function handleAddWord() {
        const newWord = wordInput.value.trim();
        if (!newWord) {
            alert("Please enter text for the spinner item.");
            return; // Require text
        }

        const newItem = {
            text: newWord,
            image: currentSegmentImage // Use the stored Data URL from preview
        };

        segments.push(newItem);

        // Reset inputs and preview
        wordInput.value = '';
        segmentImageInput.value = null; // Clear file input
        segmentImagePreview.innerHTML = ''; // Clear preview area
        currentSegmentImage = null; // Clear temporary storage

        saveSegmentsToStorage();
        updateSpinner();
        wordInput.focus();
    }

    // Existing handler works because it uses splice based on index
    function handleRemoveWord(event) {
        const indexToRemove = parseInt(event.target.dataset.index, 10);
        if (!isNaN(indexToRemove) && indexToRemove >= 0 && indexToRemove < segments.length) {
            segments.splice(indexToRemove, 1);
            saveSegmentsToStorage();
            updateSpinner();
        }
    }

    // New handler to remove just the image from an item
    function handleRemoveItemImage(event) {
        const indexToUpdate = parseInt(event.target.dataset.index, 10);
         if (!isNaN(indexToUpdate) && indexToUpdate >= 0 && indexToUpdate < segments.length) {
            segments[indexToUpdate].image = null; // Set image to null
            saveSegmentsToStorage();
            updateSpinner(); // Update list and wheel
        }
    }

    // --- CAP IMAGE HANDLING (Unchanged) ---
    function saveCapImage(dataUrl) { try { localStorage.setItem(CAP_IMAGE_STORAGE_KEY, dataUrl); } catch (e) { console.error("Error saving image to localStorage:", e); alert("Could not save image. Storage might be full."); } }
    function loadCapImage() { const savedImageData = localStorage.getItem(CAP_IMAGE_STORAGE_KEY); if (savedImageData) { applyCapImage(savedImageData); removeCapImageButton.style.display = 'inline-block'; } else { resetCapImage(); } }
    function applyCapImage(dataUrl) { wheel.style.setProperty('--cap-image', `url("${dataUrl}")`); }
    function resetCapImage() { wheel.style.removeProperty('--cap-image'); removeCapImageButton.style.display = 'none'; }
    function handleCapImageUpload(event) { const file = event.target.files?.[0]; if (!file || !file.type.startsWith('image/')) { if(file) alert('Please select an image file.'); return; } const reader = new FileReader(); reader.onload = (e) => { const imageDataUrl = e.target.result; applyCapImage(imageDataUrl); saveCapImage(imageDataUrl); removeCapImageButton.style.display = 'inline-block'; event.target.value = null; }; reader.onerror = (e) => { console.error("FileReader error:", e); alert("Sorry, there was an error reading the image file."); }; reader.readAsDataURL(file); }
    function handleRemoveCapImage() { localStorage.removeItem(CAP_IMAGE_STORAGE_KEY); resetCapImage(); }

    // --- SEGMENT IMAGE PREVIEW ---
    function handleSegmentImagePreview(event) {
        const file = event.target.files?.[0];
        segmentImagePreview.innerHTML = ''; // Clear previous preview
        currentSegmentImage = null; // Clear stored image data

        if (!file || !file.type.startsWith('image/')) {
            if(file) alert('Please select an image file.');
            segmentImageInput.value = null; // Clear invalid file selection
            return;
        }
         const reader = new FileReader();
         reader.onload = (e) => {
             currentSegmentImage = e.target.result; // Store Data URL temporarily
             // Display small preview
             const img = document.createElement('img');
             img.src = currentSegmentImage;
             img.alt = "Preview";
             img.style.maxWidth = '40px'; // Style preview inline
             img.style.maxHeight = '30px';
             segmentImagePreview.appendChild(img);
             segmentImagePreview.insertAdjacentText('beforeend', ` Ready: ${file.name}`);
         };
         reader.onerror = (e) => { console.error("FileReader error:", e); alert("Error reading preview image."); currentSegmentImage = null; segmentImageInput.value = null;};
         reader.readAsDataURL(file);
    }


    // --- FONT SIZE HANDLING ---
    function loadFontSize() {
        const savedSize = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
        const initialSize = savedSize ? parseInt(savedSize, 10) : 18; // Default 18px
        applyFontSize(initialSize);
        fontSizeSlider.value = initialSize;
    }
    function saveFontSize(size) {
        localStorage.setItem(FONT_SIZE_STORAGE_KEY, size.toString());
    }
    function applyFontSize(size) {
        wheel.style.setProperty('--segment-font-size', `${size}px`);
        if(fontSizeValue) {
            fontSizeValue.textContent = `${size}px`;
        }
    }
    function handleFontSizeChange(event) {
        const newSize = event.target.value;
        applyFontSize(newSize);
        saveFontSize(newSize);
    }


    // --- Update & Reset ---
    function updateSpinner() { renderWordList(); resetSpinnerVisuals(); createSegments(); spinButton.disabled = segments.length < 2; }
    function resetSpinnerVisuals() { currentRotation = 0; winnerIndex = -1; removeHighlight(); wheelHeight = wheel.offsetHeight; wheel.style.setProperty('--wheel-height', `${wheelHeight}px`); wheel.style.transition = 'none'; wheel.style.transform = `rotateX(${INITIAL_TILT_X}deg) rotateY(0deg)`; setTimeout(() => { wheel.style.transition = `transform 6s cubic-bezier(0.25, 0.1, 0.25, 1)`; }, 20); resultDisplay.textContent = ''; resultDisplay.classList.remove('visible'); }

    // --- Text Measurement Helper (Keep as is) ---
    const textMeasureEl = document.createElement('span');
    textMeasureEl.style.position = 'absolute'; textMeasureEl.style.visibility = 'hidden'; textMeasureEl.style.height = 'auto'; textMeasureEl.style.width = 'auto'; textMeasureEl.style.whiteSpace = 'nowrap'; textMeasureEl.style.fontWeight = '600'; textMeasureEl.style.fontFamily = "'Poppins', sans-serif"; document.body.appendChild(textMeasureEl);
    function getTextWidth(text, fontSize) { textMeasureEl.textContent = text || ''; textMeasureEl.style.fontSize = fontSize + 'px'; return textMeasureEl.offsetWidth; }


    // --- SPINNER WHEEL CREATION ---
    function createSegments() {
        wheel.innerHTML = '';
        segmentCount = segments.length;
        const computedStyle = getComputedStyle(wheel);
        const currentWheelWidth = parseFloat(computedStyle.width);
        wheelHeight = parseFloat(computedStyle.height);
        wheel.style.setProperty('--wheel-height', `${wheelHeight}px`);

        if (segmentCount < 2 || currentWheelWidth <= 0) {
            wheel.innerHTML = '<div class="placeholder-segment">Add 2+ items to spin!</div>'; // Updated text
            cylinderRadius = 0;
            wheel.style.setProperty('--cap-diameter', '0px');
            wheel.style.setProperty('--cap-left', '50%');
            return;
        }

        segmentAngle = 360 / segmentCount;
        cylinderRadius = currentWheelWidth / 2; // Radius matches half width
        const angleRad = (segmentAngle / 2) * (Math.PI / 180);
        const segmentWidth = 2 * cylinderRadius * Math.tan(angleRad);
        const capDiameter = currentWheelWidth;
        wheel.style.setProperty('--cap-diameter', `${capDiameter}px`);
        wheel.style.setProperty('--cap-left', `0px`);

        segments.forEach((item, index) => { // Use 'item' instead of 'text'
            const segmentElement = document.createElement('div');
            segmentElement.className = 'segment';
            segmentElement.dataset.index = index;
            const rotationY = segmentAngle * index;
            segmentElement.style.width = `${segmentWidth}px`;
            segmentElement.style.backgroundColor = segmentColors[index % segmentColors.length];
            // Transform remains the same
            segmentElement.style.transform = `translateX(-50%) rotateY(${rotationY}deg) translateZ(${cylinderRadius}px)`;

            // Add Image if it exists
            if (item.image) {
                const imgElement = document.createElement('img');
                imgElement.src = item.image;
                imgElement.alt = item.text || 'Segment Image'; // Use text as alt
                segmentElement.appendChild(imgElement);
            }

            // Add Text Span (always add, might be empty if user intended image only)
            const textSpan = document.createElement('span');
            textSpan.textContent = item.text;
            segmentElement.appendChild(textSpan);

            // Apply font size via CSS variable (set globally on wheel)
            // No individual scaling needed here if slider controls it globally

            wheel.appendChild(segmentElement);
        });
    }

    // --- Spin, Highlight, Confetti ---
    function spinWheel() { if (isSpinning || segmentCount < 2) return; isSpinning = true; spinButton.disabled = true; resultDisplay.textContent = 'Spinning...'; resultDisplay.classList.remove('visible'); removeHighlight(); const randomExtraRotation = Math.random() * 360; const spinCycles = Math.floor(Math.random() * 8) + 10; const targetRotationY = currentRotation + (spinCycles * 360) + randomExtraRotation; wheel.style.transform = `rotateX(${INITIAL_TILT_X}deg) rotateY(${targetRotationY}deg)`; currentRotation = targetRotationY; }
    function removeHighlight() { const highlighted = wheel.querySelector('.segment.winner'); if (highlighted) { highlighted.classList.remove('winner'); } winnerIndex = -1; }
    function highlightWinner(index) { winnerIndex = index; const winnerSegment = wheel.querySelector(`.segment[data-index="${index}"]`); if (winnerSegment) { winnerSegment.classList.add('winner'); } }
    function triggerConfetti() { if (typeof confetti === 'function') { confetti({ particleCount: 200, spread: 120, origin: { y: 0.6 }, startVelocity: 50, gravity: 0.7, ticks: 350 }); confetti({ particleCount: 70, angle: 60, spread: 60, origin: { x: 0, y: 0.7 } }); confetti({ particleCount: 70, angle: 120, spread: 60, origin: { x: 1, y: 0.7 } }); } }

    // --- EVENT LISTENERS ---
    wheel.addEventListener('transitionend', (event) => { if (event.target !== wheel || event.propertyName !== 'transform' || !isSpinning) { return; } isSpinning = false; spinButton.disabled = segments.length < 2; const finalRotationY = currentRotation % 360; const winningAngleRaw = (360 - finalRotationY) % 360; const winningAngleCentered = (winningAngleRaw + segmentAngle / 2) % 360; let calculatedWinnerIndex = -1; if (segmentAngle > 0) { calculatedWinnerIndex = Math.floor(winningAngleCentered / segmentAngle); } const finalWinnerIndex = Math.max(0, Math.min(calculatedWinnerIndex, segments.length - 1)); if (finalWinnerIndex >= 0 && finalWinnerIndex < segments.length && segments.length > 0) {
        // Display winner text and potentially indicate image presence
        const winnerItem = segments[finalWinnerIndex];
        resultDisplay.textContent = `${winnerItem.text}`; // Modify result display
        resultDisplay.classList.add('visible'); highlightWinner(finalWinnerIndex); triggerConfetti(); } else { resultDisplay.textContent = (segments.length < 2) ? 'Add items!' : 'Spin Error!'; resultDisplay.classList.add('visible'); console.error("Could not determine valid winner index (3D):", { finalRotationY, winningAngleCentered, segmentAngle, calculatedWinnerIndex, segmentsLength: segments.length }); winnerIndex = -1; } });
    spinButton.addEventListener('click', spinWheel);
    addWordButton.addEventListener('click', handleAddWord);
    capImageUpload.addEventListener('change', handleCapImageUpload); // Correct handler name
    removeCapImageButton.addEventListener('click', handleRemoveCapImage);
    segmentImageInput.addEventListener('change', handleSegmentImagePreview); // Listener for segment image preview
    wordInput.addEventListener('keypress', (event) => { if (event.key === 'Enter') { event.preventDefault(); handleAddWord(); } });
    fontSizeSlider.addEventListener('input', handleFontSizeChange); // Listener for font slider
    let resizeTimeout; window.addEventListener('resize', () => { clearTimeout(resizeTimeout); resizeTimeout = setTimeout(() => { console.log("Window resized, recalculating spinner layout."); updateSpinner(); }, 250); });

    // --- INITIALIZATION ---
    loadSegmentsFromStorage();
    loadCapImage();
    loadFontSize(); // Load saved font size
    updateSpinner();

    // Cleanup measurement element
    window.addEventListener('unload', () => { if (textMeasureEl && textMeasureEl.parentNode === document.body) { document.body.removeChild(textMeasureEl); } });

}); // End DOMContentLoaded