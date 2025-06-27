// ====== パスワード認証機能ここから ======
const CORRECT_PASSWORD = "basstab"; // ★★★ ここに希望するパスワードを設定してください ★★★

document.addEventListener('DOMContentLoaded', () => {
    const authContainer = document.getElementById('auth-container');
    const passwordInput = document.getElementById('password-input');
    const loginButton = document.getElementById('login-button');
    const authMessage = document.getElementById('auth-message');
    const appContent = document.getElementById('app-content');

    const checkPassword = () => {
        if (passwordInput.value === CORRECT_PASSWORD) {
            authContainer.style.display = 'none';
            appContent.style.display = 'block';
            initializeApp();
        } else {
            authMessage.textContent = "パスワードが間違っています。";
            passwordInput.value = '';
        }
    };

    loginButton.addEventListener('click', checkPassword);
    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            checkPassword();
        }
    });

    authContainer.style.display = 'flex';
    appContent.style.display = 'none';
    // ====== パスワード認証機能ここまで ======

    function initializeApp() {
        const tabDisplay = document.getElementById('tab-display');
        const addHammerBtn = document.getElementById('add-hammer-btn');
        const addPullBtn = document.getElementById('add-pull-btn');
        const addSlideUpBtn = document.getElementById('add-slide-up-btn');
        const addSlideDownBtn = document.getElementById('add-slide-down-btn');
        const addMuteBtn = document.getElementById('add-mute-btn');
        const addSlapBtn = document.getElementById('add-slap-btn');
        const addPopBtn = document.getElementById('add-pop-btn');
        const deleteLastBtn = document.getElementById('delete-last-btn');
        const add4MeasuresBtn = document.getElementById('add-4-measures-btn');
        const clearAllBtn = document.getElementById('clear-all-btn');
        const saveTabBtn = document.getElementById('save-tab-btn');
        const copyTextBtn = document.getElementById('copy-text-btn');
        const exportImageBtn = document.getElementById('export-image-btn');
        const exportPdfBtn = document.getElementById('export-pdf-btn');
        const durationControls = document.getElementById('duration-controls');

        const luckyFretDisplay = document.getElementById('lucky-fret-display');
        const refreshLuckyFretBtn = document.getElementById('refresh-lucky-fret-btn');

        const tuningOptionsDiv = document.getElementById('tuning-options');
        const applyTuningBtn = document.getElementById('apply-tuning-btn');

        // --- メトロノーム関連 ---
        const bpmInput = document.getElementById('bpm-input');
        const metronomeToggleBtn = document.getElementById('metronome-toggle-btn');
        let audioContext;
        let isMetronomePlaying = false;
        let metronomeInterval;

        let currentDuration = 0.25;

        const MIDI_NOTES = {
            'C': 12, 'C#': 13, 'Db': 13, 'D': 14, 'D#': 15, 'Eb': 15,
            'E': 16, 'F': 17, 'F#': 18, 'Gb': 18, 'G': 19, 'G#': 20, 'Ab': 20,
            'A': 21, 'A#': 22, 'Bb': 22, 'B': 23
        };

        let STRING_NAMES = ['G', 'D', 'A', 'E', 'B'];
        let NUM_STRINGS = 5;
        // 5弦ベースの標準チューニング (B1, E2, A2, D3, G3)
        let currentTuning = {
            'G': 55, // G3
            'D': 50, // D3
            'A': 45, // A2
            'E': 40, // E2
            'B': 35, // B1
        };
        
        let tabData = [];
        let activeStringIndex = NUM_STRINGS - 1;
        let activeMeasureIndex = 0;
        let activeColumnIndex = 0;

        const MEASURES_PER_LINE = 4;
        const INITIAL_MEASURES = 4;
        const SIXTEENTH_NOTE_WIDTH = 2;

        let lastInputWasNumber = false;
        let lastInputTime = 0;
        const DOUBLE_DIGIT_TIMEOUT = 500;

        function getElementDisplayWidth(element) {
            if (element.t === 'technique') {
                return 1;
            }
            const duration = element.d || 0.25;
            const widthMultiplier = duration / 0.0625;
            const fretStr = String(element.f);
            const baseWidth = fretStr.length > 1 ? fretStr.length : 1;
            return Math.max(baseWidth, widthMultiplier * SIXTEENTH_NOTE_WIDTH);
        }

        function renderTab() {
            tabDisplay.innerHTML = '';
            if (tabData.length === 0) {
                initializeTab();
                return;
            }
            for (let i = 0; i < tabData.length; i += MEASURES_PER_LINE) {
                const measuresInLine = tabData.slice(i, i + MEASURES_PER_LINE);
                renderTabLine(i, measuresInLine);
            }
            updateCursorPosition();
        }

        function renderTabLine(startIndex, measuresInLine) {
            const sectionDiv = document.createElement('div');
            sectionDiv.className = 'tab-section';

            let measureVisualWidths = measuresInLine.map(measureData => {
                let maxMeasureContentWidth = 0;
                STRING_NAMES.forEach(stringName => {
                    let currentContentWidth = 0;
                    (measureData[stringName] || []).forEach(el => currentContentWidth += getElementDisplayWidth(el));
                    maxMeasureContentWidth = Math.max(maxMeasureContentWidth, currentContentWidth);
                });
                return Math.max(16, maxMeasureContentWidth);
            });

            const measureNumbersLine = document.createElement('div');
            measureNumbersLine.className = 'tab-string-line measure-number-line';
            measureNumbersLine.innerHTML = `<div class="tab-string-name">&nbsp;</div>`;
            const contentDiv = document.createElement('div');
            contentDiv.className = 'tab-string-content';
            let contentHtml = '';
            measuresInLine.forEach((_, idx) => {
                const measureNum = startIndex + idx + 1;
                const numStr = `(${measureNum})`;
                const width = measureVisualWidths[idx];
                const padding = ' '.repeat(Math.max(0, width - numStr.length));
                contentHtml += `<span class="bar-line">|</span><span class="fret-note">${numStr}${padding}</span>`;
            });
            contentDiv.innerHTML = contentHtml + '<span class="bar-line">|</span>';
            measureNumbersLine.appendChild(contentDiv);
            sectionDiv.appendChild(measureNumbersLine);

            STRING_NAMES.forEach((stringName, stringIdx) => {
                const stringLineDiv = document.createElement('div');
                stringLineDiv.className = 'tab-string-line';
                if (stringIdx === activeStringIndex && startIndex <= activeMeasureIndex && activeMeasureIndex < startIndex + measuresInLine.length) {
                    stringLineDiv.classList.add('active-string');
                }
                stringLineDiv.innerHTML = `<div class="tab-string-name">${stringName}|</div>`;
                const stringContentDiv = document.createElement('div');
                stringContentDiv.className = 'tab-string-content';
                let lineContentHtml = '';
                measuresInLine.forEach((measureData, measureIdxInLine) => {
                    let measureContentHtml = '';
                    let currentContentVisualWidth = 0;
                    const elements = measureData[stringName] || [];
                    elements.forEach((el) => {
                        const elementWidth = getElementDisplayWidth(el);
                        const fretStr = String(el.f);
                        const padding = '-'.repeat(Math.max(0, elementWidth - fretStr.length));
                        measureContentHtml += `<span class="note-wrapper"><span class="fret-note">${fretStr}</span><span class="hyphen">${padding}</span></span>`;
                        currentContentVisualWidth += elementWidth;
                    });
                    const padding = '-'.repeat(Math.max(0, measureVisualWidths[measureIdxInLine] - currentContentVisualWidth));
                    lineContentHtml += `<span class="bar-line">|</span>${measureContentHtml}<span class="padding">${padding}</span>`;
                });
                stringContentDiv.innerHTML = lineContentHtml + `<span class="bar-line">|</span>`;
                stringLineDiv.appendChild(stringContentDiv);
                sectionDiv.appendChild(stringLineDiv);
            });
            tabDisplay.appendChild(sectionDiv);
        }
        
        function updateCursorPosition() {
            const existingCursor = tabDisplay.querySelector('.cursor');
            if (existingCursor) existingCursor.remove();
            if (activeMeasureIndex >= tabData.length) return;

            const lineIndex = Math.floor(activeMeasureIndex / MEASURES_PER_LINE);
            const section = tabDisplay.querySelectorAll('.tab-section')[lineIndex];
            if (!section) return;

            const stringLine = section.querySelectorAll('.tab-string-line')[activeStringIndex + 1];
            if (!stringLine) return;

            const stringContent = stringLine.querySelector('.tab-string-content');
            const charWidth = parseFloat(getComputedStyle(tabDisplay).fontSize) * 0.6;
            let leftOffset = 0;

            const measureIndexInLine = activeMeasureIndex % MEASURES_PER_LINE;
            for (let i = 0; i < measureIndexInLine; i++) {
                const measureData = tabData[activeMeasureIndex - measureIndexInLine + i];
                let maxMeasureContentWidth = 0;
                STRING_NAMES.forEach(stringName => {
                    let currentContentWidth = 0;
                    (measureData[stringName] || []).forEach(el => currentContentWidth += getElementDisplayWidth(el));
                    maxMeasureContentWidth = Math.max(maxMeasureContentWidth, currentContentWidth);
                });
                leftOffset += (Math.max(16, maxMeasureContentWidth) + 1) * charWidth;
            }
            
            leftOffset += charWidth;

            const elements = (tabData[activeMeasureIndex][STRING_NAMES[activeStringIndex]]) || [];
            for (let i = 0; i < activeColumnIndex; i++) {
                leftOffset += getElementDisplayWidth(elements[i]) * charWidth;
            }

            const cursor = document.createElement('div');
            cursor.className = 'cursor';
            cursor.style.left = `${leftOffset}px`;
            stringContent.appendChild(cursor);
        }

        function initializeTab() {
            tabData = [];
            addMeasures(INITIAL_MEASURES);
            activeMeasureIndex = 0;
            activeColumnIndex = 0;
            activeStringIndex = NUM_STRINGS - 1;
            renderTab();
        }

        function addMeasures(num) {
            for (let i = 0; i < num; i++) {
                const newMeasure = {};
                STRING_NAMES.forEach(name => {
                    newMeasure[name] = [];
                });
                tabData.push(newMeasure);
            }
            renderTab();
            saveTabDataToLocalStorage();
        }

        function clearAllTab() {
            if (confirm('全てのTAB譜をクリアしますか？この操作は元に戻せません。')) {
                initializeTab();
                saveTabDataToLocalStorage();
            }
        }
        
        function insertElementAtCursor(fretOrSymbol, type) {
            if (activeMeasureIndex >= tabData.length) return;
            const currentMeasure = tabData[activeMeasureIndex];
            const currentStringName = STRING_NAMES[activeStringIndex];
            if(!currentMeasure[currentStringName]) currentMeasure[currentStringName] = [];
            const currentStringData = currentMeasure[currentStringName];
            activeColumnIndex = Math.min(activeColumnIndex, currentStringData.length);
            const durationForElement = (type === 'technique') ? 0 : currentDuration;
            const newElement = { f: fretOrSymbol, t: type, d: durationForElement };
            currentStringData.splice(activeColumnIndex, 0, newElement);
            activeColumnIndex++;
            renderTab();
            saveTabDataToLocalStorage();
        }

        function deleteElementAtCursor() {
            if (activeMeasureIndex >= tabData.length) return;
            const currentStringData = tabData[activeMeasureIndex][STRING_NAMES[activeStringIndex]];
            if (!currentStringData) return;
            
            if (activeColumnIndex > 0) {
                currentStringData.splice(activeColumnIndex - 1, 1);
                activeColumnIndex--;
            } else if (activeMeasureIndex > 0) {
                activeMeasureIndex--;
                const prevMeasureStringData = tabData[activeMeasureIndex][STRING_NAMES[activeStringIndex]] || [];
                activeColumnIndex = prevMeasureStringData.length;
            }
            renderTab();
            saveTabDataToLocalStorage();
        }

        function saveTabDataToLocalStorage() {
            try {
                localStorage.setItem('bassTabEditorData', JSON.stringify(tabData));
                localStorage.setItem('bassTabEditorTuning', JSON.stringify(currentTuning));
                localStorage.setItem('bassTabEditorStringNames', JSON.stringify(STRING_NAMES));
            } catch (e) {
                console.error('Failed to save data:', e);
            }
        }

        function loadTabDataFromLocalStorage() {
            try {
                const savedStringNames = localStorage.getItem('bassTabEditorStringNames');
                if (savedStringNames) STRING_NAMES = JSON.parse(savedStringNames);
                NUM_STRINGS = STRING_NAMES.length;

                const savedTuning = localStorage.getItem('bassTabEditorTuning');
                if (savedTuning) currentTuning = JSON.parse(savedTuning);

                const savedData = localStorage.getItem('bassTabEditorData');
                if (savedData) {
                    tabData = JSON.parse(savedData);
                    tabData.forEach(measure => {
                        Object.values(measure).forEach(stringData => {
                            if(Array.isArray(stringData)){
                                stringData.forEach(el => {
                                    if (el.d === undefined) el.d = 0.25;
                                    if (el.t === undefined) el.t = (typeof el.f === 'number') ? 'note' : 'rest';
                                });
                            }
                        });
                    });
                } else {
                    initializeTab();
                }
            } catch (e) {
                console.error('Failed to load data:', e);
                initializeTab();
            }
        }

        function getTabText() {
             let exportText = `# 簡易ベースTAB譜エディター\n`;
            exportText += `# Strings: ${STRING_NAMES.join(', ')}\n\n`;

            for (let i = 0; i < tabData.length; i += MEASURES_PER_LINE) {
                const measuresInLine = tabData.slice(i, i + MEASURES_PER_LINE);
                let measureVisualWidths = measuresInLine.map(measureData => {
                    let maxMeasureContentWidth = 0;
                    STRING_NAMES.forEach(stringName => {
                        let currentContentWidth = 0;
                        (measureData[stringName] || []).forEach(el => currentContentWidth += getElementDisplayWidth(el));
                        maxMeasureContentWidth = Math.max(maxMeasureContentWidth, currentContentWidth);
                    });
                    return Math.max(16, maxMeasureContentWidth);
                });

                let measureNumbersLine = '';
                measuresInLine.forEach((_, idx) => {
                    const measureNum = i + idx + 1;
                    const numStr = `(${measureNum})`;
                    const padding = ' '.repeat(Math.max(0, measureVisualWidths[idx] - numStr.length));
                    measureNumbersLine += `|${numStr}${padding}`;
                });
                exportText += measureNumbersLine + '|\n';

                STRING_NAMES.forEach(stringName => {
                    let stringLineText = `${stringName}|`;
                    measuresInLine.forEach((measureData, measureIdxInLine) => {
                        let measureContent = '';
                        let currentContentVisualWidth = 0;
                        const elements = measureData[stringName] || [];
                        elements.forEach(el => {
                            const fretStr = String(el.f);
                            const elementWidth = getElementDisplayWidth(el);
                            measureContent += fretStr + '-'.repeat(Math.max(0, elementWidth - fretStr.length));
                            currentContentVisualWidth += elementWidth;
                        });
                        const padding = '-'.repeat(Math.max(0, measureVisualWidths[measureIdxInLine] - currentContentVisualWidth));
                        stringLineText += `${measureContent}${padding}|`;
                    });
                    exportText += stringLineText + '\n';
                });
                exportText += '\n';
            }
            return exportText;
        }

        function exportTabAsText() {
            const text = getTabText();
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'bass-tab.txt';
            a.click();
            URL.revokeObjectURL(a.href);
        }

        async function copyTabAsTextToClipboard() {
            const text = getTabText();
            try {
                await navigator.clipboard.writeText(text);
                alert('TAB譜テキストをクリップボードにコピーしました！');
            } catch (err) {
                alert('コピーに失敗しました。');
            }
        }

        function exportTabAsImage() {
            const cursor = tabDisplay.querySelector('.cursor');
            if(cursor) cursor.style.display = 'none';

            html2canvas(tabDisplay, { scale: 2, backgroundColor: '#ffffff' }).then(canvas => {
                const link = document.createElement('a');
                link.download = 'bass-tab.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
                if(cursor) cursor.style.display = 'block';
            }).catch(err => {
                console.error(err);
                if(cursor) cursor.style.display = 'block';
            });
        }

        function exportTabAsPdf() {
            const { jsPDF } = window.jspdf;
            const cursor = tabDisplay.querySelector('.cursor');
            if(cursor) cursor.style.display = 'none';

            html2canvas(tabDisplay, { scale: 2, backgroundColor: '#ffffff', useCORS: true }).then(canvas => {
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF({
                    orientation: 'landscape',
                    unit: 'px',
                    format: [canvas.width, canvas.height]
                });
                pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
                pdf.save("bass-tab.pdf");
                if(cursor) cursor.style.display = 'block';
            }).catch(err => {
                console.error(err);
                if(cursor) cursor.style.display = 'block';
            });
        }
        
        function initializeTuningUI() {
            tuningOptionsDiv.innerHTML = '';
            STRING_NAMES.forEach(stringName => {
                const stringDiv = document.createElement('div');
                const label = document.createElement('label');
                label.textContent = `${stringName}弦:`;
                const select = document.createElement('select');
                select.dataset.stringName = stringName;

                const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
                for (let octave = 0; octave <= 6; octave++) {
                    notes.forEach(note => {
                        const noteName = note + octave;
                        const option = document.createElement('option');
                        option.value = noteName;
                        option.textContent = noteName;
                        select.appendChild(option);
                    });
                }
                
                const currentMidi = currentTuning[stringName];
                if (currentMidi) select.value = findNoteFromMidi(currentMidi);

                stringDiv.appendChild(label);
                stringDiv.appendChild(select);
                tuningOptionsDiv.appendChild(stringDiv);
            });
        }

        function findNoteFromMidi(midiNumber) {
            const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            const octave = Math.floor(midiNumber / 12) - 1;
            const noteIndex = midiNumber % 12;
            return notes[noteIndex] + octave;
        }
        
        function applyTuning() {
            const newTuning = {};
            tuningOptionsDiv.querySelectorAll('select').forEach(select => {
                const stringName = select.dataset.stringName;
                const selectedNoteOctave = select.value;
                const note = selectedNoteOctave.match(/([A-G]#?)/)[0];
                const octave = parseInt(selectedNoteOctave.match(/(\d+)/)[0], 10);
                const midiNoteNumber = MIDI_NOTES[note] + (octave * 12);
                newTuning[stringName] = midiNoteNumber;
            });
            currentTuning = newTuning;
            saveTabDataToLocalStorage();
            alert('チューニングが適用されました！');
        }

        function initAudioContext() {
            if (!audioContext) {
                try {
                    audioContext = new (window.AudioContext || window.webkitAudioContext)();
                } catch (e) {
                    alert('Web Audio API is not supported in this browser.');
                }
            }
        }
        
        // --- メトロノーム機能 ---
        function playTick() {
            if (!audioContext) return;
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
            gainNode.gain.setValueAtTime(1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.05);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.05);
        }

        function toggleMetronome() {
            initAudioContext();
            isMetronomePlaying = !isMetronomePlaying;

            if (isMetronomePlaying) {
                const bpm = parseInt(bpmInput.value, 10);
                if (isNaN(bpm) || bpm < 40 || bpm > 300) {
                    alert('有効なテンポ (40-300 BPM) を入力してください。');
                    isMetronomePlaying = false;
                    return;
                }
                const interval = 60000 / bpm;
                metronomeInterval = setInterval(playTick, interval);
                metronomeToggleBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12"></rect></svg> 停止';
            } else {
                clearInterval(metronomeInterval);
                metronomeToggleBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> 開始';
            }
        }


        function displayLuckyFret() {
            const randomStringName = STRING_NAMES[Math.floor(Math.random() * NUM_STRINGS)];
            const randomFret = Math.floor(Math.random() * 13);
            luckyFretDisplay.textContent = `${randomStringName}弦 ${randomFret}フレット！`;
        }
        
        // --- Initialization and Event Listeners ---
        loadTabDataFromLocalStorage();
        initializeTuningUI();
        displayLuckyFret();
        renderTab();

        addHammerBtn.addEventListener('click', () => insertElementAtCursor('h', 'technique'));
        addPullBtn.addEventListener('click', () => insertElementAtCursor('p', 'technique'));
        addSlideUpBtn.addEventListener('click', () => insertElementAtCursor('/', 'technique'));
        addSlideDownBtn.addEventListener('click', () => insertElementAtCursor('\\', 'technique'));
        addMuteBtn.addEventListener('click', () => insertElementAtCursor('x', 'mute'));
        addSlapBtn.addEventListener('click', () => insertElementAtCursor('S', 'technique'));
        addPopBtn.addEventListener('click', () => insertElementAtCursor('P', 'technique'));

        deleteLastBtn.addEventListener('click', deleteElementAtCursor);
        add4MeasuresBtn.addEventListener('click', () => addMeasures(4));
        clearAllBtn.addEventListener('click', clearAllTab);
        saveTabBtn.addEventListener('click', exportTabAsText);
        copyTextBtn.addEventListener('click', copyTabAsTextToClipboard);
        exportImageBtn.addEventListener('click', exportTabAsImage);
        exportPdfBtn.addEventListener('click', exportTabAsPdf);
        applyTuningBtn.addEventListener('click', applyTuning);
        metronomeToggleBtn.addEventListener('click', toggleMetronome);
        refreshLuckyFretBtn.addEventListener('click', displayLuckyFret);

        durationControls.addEventListener('click', (e) => {
            const target = e.target.closest('.duration-btn');
            if (!target) return;
            document.querySelectorAll('.duration-btn').forEach(btn => btn.classList.remove('active'));
            target.classList.add('active');
            currentDuration = parseFloat(target.dataset.duration);
        });

        document.addEventListener('keydown', (e) => {
            if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

            const keyMap = {
                'ArrowUp': () => { activeStringIndex = Math.max(0, activeStringIndex - 1); },
                'ArrowDown': () => { activeStringIndex = Math.min(NUM_STRINGS - 1, activeStringIndex + 1); },
                'ArrowLeft': () => { 
                    if (e.shiftKey) { activeMeasureIndex = Math.max(0, activeMeasureIndex - 1); activeColumnIndex = 0; }
                    else { activeColumnIndex = Math.max(0, activeColumnIndex - 1); }
                },
                'ArrowRight': () => { 
                    const currentLine = (tabData[activeMeasureIndex]?.[STRING_NAMES[activeStringIndex]]) || [];
                    if (e.shiftKey) { activeMeasureIndex = Math.min(tabData.length - 1, activeMeasureIndex + 1); activeColumnIndex = 0; }
                    else { activeColumnIndex = Math.min(currentLine.length, activeColumnIndex + 1); }
                },
                'Backspace': () => { deleteElementAtCursor(); lastInputWasNumber = false; },
                ' ': () => { e.preventDefault(); insertElementAtCursor('-', 'rest'); lastInputWasNumber = false; },
                'h': () => { insertElementAtCursor('h', 'technique'); lastInputWasNumber = false; },
                'p': () => { insertElementAtCursor('p', 'technique'); lastInputWasNumber = false; },
                'S': () => { insertElementAtCursor('S', 'technique'); lastInputWasNumber = false; },
                's': () => { insertElementAtCursor('S', 'technique'); lastInputWasNumber = false; },
                'P': () => { insertElementAtCursor('P', 'technique'); lastInputWasNumber = false; },
                '/': () => { insertElementAtCursor('/', 'technique'); lastInputWasNumber = false; },
                '\\': () => { insertElementAtCursor('\\', 'technique'); lastInputWasNumber = false; },
                'x': () => { insertElementAtCursor('x', 'mute'); lastInputWasNumber = false; }
            };

            if (keyMap[e.key]) {
                e.preventDefault();
                keyMap[e.key]();
                renderTab();
            } else if (e.key >= '0' && e.key <= '9') {
                e.preventDefault();
                const num = parseInt(e.key, 10);
                const currentTime = Date.now();
                const currentStringData = (tabData[activeMeasureIndex]?.[STRING_NAMES[activeStringIndex]]) || [];

                if (lastInputWasNumber && (currentTime - lastInputTime < DOUBLE_DIGIT_TIMEOUT) && activeColumnIndex > 0) {
                    const prevElement = currentStringData[activeColumnIndex - 1];
                    if (prevElement && prevElement.t === 'note' && typeof prevElement.f === 'number' && prevElement.f < 10) {
                        const combinedFret = prevElement.f * 10 + num;
                        if (combinedFret <= 24) {
                            prevElement.f = combinedFret;
                            lastInputTime = currentTime;
                            renderTab();
                            saveTabDataToLocalStorage();
                            return;
                        }
                    }
                }
                insertElementAtCursor(num, 'note');
                lastInputWasNumber = true;
                lastInputTime = currentTime;
            } else {
                 lastInputWasNumber = false;
            }
        });
    }
});