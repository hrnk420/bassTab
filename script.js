document.addEventListener('DOMContentLoaded', () => {
    const authContainer = document.getElementById('auth-container');
    const appContent = document.getElementById('app-content');

    // パスワード認証機能を廃止し、直接アプリコンテンツを表示
    authContainer.style.display = 'none';
    appContent.style.display = 'block';
    initializeApp();

    function initializeApp() {
        const tabDisplay = document.getElementById('tab-display');
        const addHammerBtn = document.getElementById('add-hammer-btn');
        const addPullBtn = document.getElementById('add-pull-btn');
        const addSlideUpBtn = document.getElementById('add-slide-up-btn');
        const addSlideDownBtn = document.getElementById('add-slide-down-btn');
        const addMuteBtn = document.getElementById('add-mute-btn');
        const addSlapBtn = document.getElementById('add-slap-btn');
        const addPopBtn = document = document.getElementById('add-pop-btn');
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
        const stringCountSelect = document.getElementById('string-count-select');
        const defaultTuningSelect = document.getElementById('default-tuning-select');
        const fretInput = document.getElementById('fret-input');
        const inputControlsGrid = document.getElementById('input-controls-grid');

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

        const DEFAULT_TUNINGS = {
            '4': {
                name: '4弦ベース (E標準)',
                strings: ['G', 'D', 'A', 'E'],
                tuning: { 'G': 55, 'D': 50, 'A': 45, 'E': 40 }
            },
            '5': {
                name: '5弦ベース (B標準)',
                strings: ['G', 'D', 'A', 'E', 'B'],
                tuning: { 'G': 55, 'D': 50, 'A': 45, 'E': 40, 'B': 35 }
            },
            '6': {
                name: '6弦ベース (B標準)',
                strings: ['C', 'G', 'D', 'A', 'E', 'B'],
                tuning: { 'C': 60, 'G': 55, 'D': 50, 'A': 45, 'E': 40, 'B': 35 }
            }
        };

        let STRING_NAMES = DEFAULT_TUNINGS['5'].strings;
        let NUM_STRINGS = 5;
        let currentTuning = DEFAULT_TUNINGS['5'].tuning;
        
        let tabData = [];
        let activeStringIndex = NUM_STRINGS - 1;
        let activeMeasureIndex = 0;
        let activeColumnIndex = 0;

        const MEASURES_PER_LINE = 4;
        const INITIAL_MEASURES = 4;
        // 16分音符以外の音符の幅計算の基準単位
        const BASE_NOTE_UNIT_WIDTH = 2; 

        let lastInputWasNumber = false;
        let lastInputTime = 0;
        const DOUBLE_DIGIT_TIMEOUT = 500;

        // 音符や記号の表示幅を計算する関数
        function getElementDisplayWidth(element) {
            if (element.t === 'technique' || element.f === 'x') {
                return 1;
            }
            const duration = element.d || 0.25;
            const widthMultiplier = duration / 0.0625;
            
            // 数字の場合は文字数と音価に応じて幅を決定
            if (typeof element.f === 'number') {
                const fretStr = String(element.f);
                if (duration === 0.0625) { // 16分音符の場合
                    // 16分音符は常にフレット番号の文字数 + 1 (ハイフン1つ分) の幅
                    return fretStr.length + 1;
                } else { // それ以外の音価の場合
                    // それ以外の音符は、フレット番号の文字数と、音価に応じた基本幅の大きい方
                    const baseWidthForDuration = Math.round(widthMultiplier * BASE_NOTE_UNIT_WIDTH);
                    return Math.max(fretStr.length, baseWidthForDuration);
                }
            }
            // 休符 '-' の場合
            return Math.max(1, Math.round(widthMultiplier * BASE_NOTE_UNIT_WIDTH));
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
            const tempSpan = document.createElement('span');
            tempSpan.style.fontFamily = 'var(--font-mono)';
            tempSpan.style.fontSize = getComputedStyle(tabDisplay).fontSize;
            tempSpan.style.position = 'absolute';
            tempSpan.style.visibility = 'hidden';
            tempSpan.textContent = '-';
            document.body.appendChild(tempSpan);
            const charWidth = tempSpan.offsetWidth;
            document.body.removeChild(tempSpan);

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
            const durationForElement = (type === 'technique' || type === 'mute') ? 0 : currentDuration;
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
                if(activeColumnIndex > 0) {
                    prevMeasureStringData.splice(activeColumnIndex - 1, 1);
                    activeColumnIndex--;
                }
            }
            renderTab();
            saveTabDataToLocalStorage();
        }

        function saveTabDataToLocalStorage() {
            try {
                localStorage.setItem('bassTabEditorData', JSON.stringify(tabData));
                localStorage.setItem('bassTabEditorTuning', JSON.stringify(currentTuning));
                localStorage.setItem('bassTabEditorStringNames', JSON.stringify(STRING_NAMES));
                localStorage.setItem('bassTabEditorNumStrings', NUM_STRINGS);
            } catch (e) {
                console.error('Failed to save data:', e);
            }
        }

        function loadTabDataFromLocalStorage() {
            try {
                const savedNumStrings = localStorage.getItem('bassTabEditorNumStrings');
                if (savedNumStrings) {
                    NUM_STRINGS = parseInt(savedNumStrings, 10);
                    stringCountSelect.value = NUM_STRINGS;
                }

                const savedStringNames = localStorage.getItem('bassTabEditorStringNames');
                if (savedStringNames) {
                    STRING_NAMES = JSON.parse(savedStringNames);
                } else {
                    STRING_NAMES = DEFAULT_TUNINGS[NUM_STRINGS].strings;
                }

                const savedTuning = localStorage.getItem('bassTabEditorTuning');
                if (savedTuning) {
                    currentTuning = JSON.parse(savedTuning);
                } else {
                    currentTuning = DEFAULT_TUNINGS[NUM_STRINGS].tuning;
                }
                
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
            oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
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

        stringCountSelect.addEventListener('change', (e) => {
            const newNumStrings = parseInt(e.target.value, 10);
            if (newNumStrings !== NUM_STRINGS) {
                if (confirm(`${newNumStrings}弦ベースに切り替えますか？現在のTAB譜データはクリアされます。`)) {
                    NUM_STRINGS = newNumStrings;
                    STRING_NAMES = DEFAULT_TUNINGS[NUM_STRINGS].strings;
                    currentTuning = DEFAULT_TUNINGS[NUM_STRINGS].tuning;
                    initializeTab();
                    initializeTuningUI();
                    populateDefaultTuningSelect();
                    defaultTuningSelect.value = NUM_STRINGS;
                    saveTabDataToLocalStorage();
                } else {
                    stringCountSelect.value = NUM_STRINGS;
                }
            }
        });

        defaultTuningSelect.addEventListener('change', (e) => {
            const selectedDefault = e.target.value;
            if (selectedDefault && DEFAULT_TUNINGS[selectedDefault]) {
                currentTuning = { ...DEFAULT_TUNINGS[selectedDefault].tuning };
                initializeTuningUI();
                saveTabDataToLocalStorage();
                alert(`${DEFAULT_TUNINGS[selectedDefault].name}が適用されました！`);
            }
        });

        // スマホでの数字入力対応
        fretInput.addEventListener('input', (e) => {
            const fretValue = parseInt(e.target.value, 10);
            if (!isNaN(fretValue)) {
                insertElementAtCursor(fretValue, 'note');
                e.target.value = '';
            }
        });

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

        // PCキーボードからの入力イベント
        document.addEventListener('keydown', (e) => {
            if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) && e.target !== fretInput) return;

            if (e.target === fretInput && e.key >= '0' && e.key <= '9') {
                return;
            }

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

        // スマホでのフリック/スワイプ操作を矢印キーに変換する
        let touchStartX = 0;
        let touchStartY = 0;

        tabDisplay.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
            }
        });

        tabDisplay.addEventListener('touchend', (e) => {
            if (e.changedTouches.length === 1) {
                const touchEndX = e.changedTouches[0].clientX;
                const touchEndY = e.changedTouches[0].clientY;

                const dx = touchEndX - touchStartX;
                const dy = touchEndY - touchStartY;

                const swipeThreshold = 30;

                if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > swipeThreshold) {
                    if (dx > 0) {
                        const currentLine = (tabData[activeMeasureIndex]?.[STRING_NAMES[activeStringIndex]]) || [];
                        activeColumnIndex = Math.min(currentLine.length, activeColumnIndex + 1);
                    } else {
                        activeColumnIndex = Math.max(0, activeColumnIndex - 1);
                    }
                } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > swipeThreshold) {
                    if (dy > 0) {
                        activeStringIndex = Math.min(NUM_STRINGS - 1, activeStringIndex + 1);
                    } else {
                        activeStringIndex = Math.max(0, activeStringIndex - 1);
                    }
                }
                renderTab();
            }
        });

        // 弦数選択の初期化とイベントリスナー
        for (const count in DEFAULT_TUNINGS) {
            const option = document.createElement('option');
            option.value = count;
            option.textContent = DEFAULT_TUNINGS[count].name;
            stringCountSelect.appendChild(option);
        }
        stringCountSelect.value = NUM_STRINGS;

        function populateDefaultTuningSelect() {
            defaultTuningSelect.innerHTML = '<option value="">カスタム</option>';
            for (const count in DEFAULT_TUNINGS) {
                const tuningData = DEFAULT_TUNINGS[count];
                if (parseInt(count, 10) === NUM_STRINGS) {
                    const option = document.createElement('option');
                    option.value = count;
                    option.textContent = tuningData.name;
                    defaultTuningSelect.appendChild(option);
                }
            }
        }
        populateDefaultTuningSelect();
    }
});