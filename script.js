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
            authContainer.style.display = 'none'; // 認証画面を非表示
            appContent.style.display = 'block';   // アプリケーションコンテンツを表示
            initializeApp(); // アプリケーションの初期化関数を呼び出す
        } else {
            authMessage.textContent = "パスワードが間違っています。";
            passwordInput.value = ''; // 入力欄をクリア
        }
    };

    loginButton.addEventListener('click', checkPassword);
    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            checkPassword();
        }
    });

    // 初期状態では認証画面のみ表示
    authContainer.style.display = 'flex'; // CSSで設定したFlexboxレイアウトを適用
    appContent.style.display = 'none';

    // ====== パスワード認証機能ここまで ======

    // アプリケーションの既存のコードを initializeApp() 関数でラップする
    function initializeApp() {
        const tabDisplay = document.getElementById('tab-display');
        const addHammerBtn = document.getElementById('add-hammer-btn');
        const addPullBtn = document.getElementById('add-pull-btn');
        const addSlideUpBtn = document.getElementById('add-slide-up-btn');
        const addSlideDownBtn = document.getElementById('add-slide-down-btn');
        const addMuteBtn = document.getElementById('add-mute-btn');
        const deleteLastBtn = document.getElementById('delete-last-btn');
        const add4MeasuresBtn = document.getElementById('add-4-measures-btn');
        const clearAllBtn = document.getElementById('clear-all-btn');
        const saveTabBtn = document.getElementById('save-tab-btn');
        const copyTextBtn = document.getElementById('copy-text-btn');
        const exportImageBtn = document.getElementById('export-image-btn');
        
        // ラッキーフレット関連
        const luckyFretDisplay = document.getElementById('lucky-fret-display');
        const refreshLuckyFretBtn = document.getElementById('refresh-lucky-fret-btn');

        // チューニング設定関連
        const tuningOptionsDiv = document.getElementById('tuning-options');
        const applyTuningBtn = document.getElementById('apply-tuning-btn');

        // メトロノーム関連
        const bpmInput = document.getElementById('bpm-input');
        const metronomeToggleButton = document.getElementById('metronome-toggle-btn');
        let audioContext;
        let metronomeInterval;
        let isMetronomePlaying = false;

        // ★ 5弦ベースのデフォルトチューニングに修正
        let STRING_NAMES = ['G', 'D', 'A', 'E', 'B']; // 5弦ベースをデフォルトに
        let NUM_STRINGS = STRING_NAMES.length;

        // 各弦のMIDIノートナンバー (標準チューニング B E A D G)
        // MIDIノートナンバー: A4=69, C4=60
        // B1=35, E2=40, A2=45, D3=50, G3=55
        const MIDI_NOTES = {
            'C': 36, 'C#': 37, 'Db': 37, 'D': 38, 'D#': 39, 'Eb': 39,
            'E': 40, 'F': 41, 'F#': 42, 'Gb': 42, 'G': 43, 'G#': 44, 'Ab': 44,
            'A': 45, 'A#': 46, 'Bb': 46, 'B': 47
        };

        // ★ チューニングのデフォルト設定 (MIDIノートナンバー) 5弦ベース標準
        let currentTuning = {
            'G': MIDI_NOTES['G'] + 12, // G3 (MIDI 55)
            'D': MIDI_NOTES['D'] + 12, // D3 (MIDI 50)
            'A': MIDI_NOTES['A'] + 0,  // A2 (MIDI 45)
            'E': MIDI_NOTES['E'] + 0,  // E2 (MIDI 40)
            'B': MIDI_NOTES['B'] - 12  // B1 (MIDI 35)
        };    
        let tabData = [];

        let activeStringIndex = NUM_STRINGS - 1; // E弦をアクティブにする
        let activeMeasureIndex = 0;
        let activeColumnIndex = 0;   

        const MEASURES_PER_LINE = 4;

        const BASE_HYPHEN_WIDTH = 1;
        const INITIAL_MEASURES = 4;
        // const FIXED_MEASURE_CONTENT_WIDTH = 11; // ★この行を削除またはコメントアウト★


        const ELEMENT_WIDTH_MAP = {
            '0': 1, '1': 1, '2': 1, '3': 1, '4': 1, '5': 1, '6': 1, '7': 1, '8': 1, '9': 1,
            '10': 2, '11': 2, '12': 2, '13': 2, '14': 2, '15': 2, '16': 2, '17': 2, '18': 2, '19': 2,
            '20': 2, '21': 2, '22': 2, '23': 2, '24': 2,
            '-': 1,
            '|': 1 
        };
        const TECHNIQUE_SYMBOLS = ['h', 'p', '/', '\\', 'x'];

        let lastInputWasNumber = false;
        let lastInputTime = 0;
        const DOUBLE_DIGIT_TIMEOUT = 500;

        function getElementDisplayWidth(element) {
            if (typeof element === 'object' && element !== null && 'f' in element) {
                const val = typeof element.f === 'number' ? String(element.f) : element.f;
                // テクニック記号はそれ自体では幅を持たない（前の数字に付随するため）
                if (TECHNIQUE_SYMBOLS.includes(val.toLowerCase())) {
                    return 0; // テクニック記号は0幅として計算
                }
                return ELEMENT_WIDTH_MAP[val] || 1;
            }
            return 1; // '-' など
        }

        // measureData (例: {'G': [{f:12, t:'note'}, {f:'h', t:'hammer'}], 'D': [{f:10, t:'note'}]} )
        // elementsInString (例: [{f:12, t:'note'}, {f:'h', t:'hammer'}])
        function calculateVisualWidthForStringData(elementsInString) {
            let currentWidth = 0;
            elementsInString.forEach((el, idx) => {
                currentWidth += getElementDisplayWidth(el);
                // 次の要素がテクニック記号でなければ、ハイフンの幅を追加
                if (!TECHNIQUE_SYMBOLS.includes(String(el.f).toLowerCase()) && 
                    idx < elementsInString.length - 1 && 
                    !TECHNIQUE_SYMBOLS.includes(String(elementsInString[idx + 1]?.f).toLowerCase())) {
                    currentWidth += BASE_HYPHEN_WIDTH;
                }
            });
            return currentWidth;
        }


        function renderTab() {
            tabDisplay.innerHTML = ''; 

            let currentLineMeasures = [];
            let sectionMeasuresStartIndex = 0;

            if (tabData.length === 0) {
                initializeTab();
            }

            // 各小節の最大幅を事前に計算する
            const measureMaxContentWidths = tabData.map(measureData => {
                let maxMeasureWidth = 0;
                STRING_NAMES.forEach(stringName => {
                    const elements = measureData[stringName] || [];
                    const stringWidth = calculateVisualWidthForStringData(elements);
                    if (stringWidth > maxMeasureWidth) {
                        maxMeasureWidth = stringWidth;
                    }
                });
                // 各小節は最低でもこれだけの幅を確保したい場合（例: 4つのハイフンと数字1つ）
                // ただし、これは動的に幅を調整するため、強制的な最低幅が必要なければ削除しても良い
                return Math.max(maxMeasureWidth, 4); // 例: 最低4文字幅を保証
            });


            tabData.forEach((measureData, measureIdx) => {
                currentLineMeasures.push(measureData);

                if (currentLineMeasures.length === MEASURES_PER_LINE || measureIdx === tabData.length - 1) {
                    // この行の各小節の実際の最大幅を渡す
                    const widthsForLine = measureMaxContentWidths.slice(sectionMeasuresStartIndex, measureIdx + 1);
                    renderTabLine(sectionMeasuresStartIndex, currentLineMeasures, widthsForLine);
                    currentLineMeasures = [];
                    sectionMeasuresStartIndex = measureIdx + 1;
                }
            });

            highlightCursor();
        }

        // renderTabLine 関数のシグネチャとロジックを修正
        function renderTabLine(startIndex, measuresInLine, widthsForLine) {
            let sectionHtml = '';

            let measureNumbersLine = [];
            let currentTotalCharOffset = 0; 

            const stringNameAndPipeDisplayWidth = STRING_NAMES[0].length + 1; 

            measuresInLine.forEach((measureData, idx) => {
                const actualMeasureIndex = startIndex + idx;
                const measureNum = actualMeasureIndex + 1;
                const measureStr = String(measureNum);
                
                // その小節の実際の最大幅を使用
                const currentMeasureCalculatedWidth = widthsForLine[idx]; 

                let currentMeasureStartCharOffsetInLine; 

                if (idx === 0) { 
                    currentMeasureStartCharOffsetInLine = stringNameAndPipeDisplayWidth;
                } else { 
                    // 以前はFIXED_MEASURE_CONTENT_WIDTHを使用していたが、動的に変更された幅を使用
                    const prevMeasureCalculatedWidth = widthsForLine[idx - 1]; 
                    currentMeasureStartCharOffsetInLine = prevMeasureCalculatedWidth + 1; // 前の小節の幅 +  '|'
                }

                const absoluteBarlinePosition = currentTotalCharOffset + currentMeasureStartCharOffsetInLine;
                const numPositionForMeasure = Math.max(0, Math.floor(absoluteBarlinePosition - measureStr.length / 2));

                const spaceBeforeNum = Math.max(0, numPositionForMeasure - measureNumbersLine.join('').length);
                measureNumbersLine.push(' '.repeat(spaceBeforeNum) + measureStr);
                
                currentTotalCharOffset += currentMeasureStartCharOffsetInLine; 
            });

            sectionHtml += `<div class="tab-string-line measure-number-line">`;
            sectionHtml += `<div class="tab-string-name"></div>`; 
            sectionHtml += `<div class="tab-string-content">${measureNumbersLine.join('')}</div>`;
            sectionHtml += `</div>`;


            STRING_NAMES.forEach((stringName, stringIdx) => {
                let stringContentArray = [];
                measuresInLine.forEach((measureData, idx) => {
                    const actualMeasureIndex = startIndex + idx;
                    const elements = measureData[stringName] || [];

                    if (idx === 0) { 
                        stringContentArray.push('|');
                    }
                    
                    let measureString = '';
                    elements.forEach((el, elIdx) => {
                        measureString += (typeof el.f === 'number' ? String(el.f) : el.f);
                        // 次の要素がテクニック記号でなければハイフンを追加
                        if (!TECHNIQUE_SYMBOLS.includes(String(el.f).toLowerCase()) && 
                            (elIdx === elements.length - 1 || !TECHNIQUE_SYMBOLS.includes(String(elements[elIdx + 1]?.f).toLowerCase()))) {
                            measureString += '-';
                        }
                    });
                    
                    // その小節の実際の最大幅を使用
                    const currentMeasureCalculatedWidth = widthsForLine[idx];
                    const currentContentVisualWidth = calculateVisualWidthForStringData(elements); // 全弦のコンテンツ幅を計算
                    const paddingNeeded = currentMeasureCalculatedWidth - currentContentVisualWidth;
                    measureString += '-'.repeat(Math.max(0, paddingNeeded));
                    
                    measureString += '|'; 

                    stringContentArray.push(measureString);
                });

                const isActive = (stringIdx === activeStringIndex &&
                                startIndex <= activeMeasureIndex &&
                                activeMeasureIndex < startIndex + measuresInLine.length) ? ' active-string' : '';

                sectionHtml += `<div class="tab-string-line${isActive}">`;
                sectionHtml += `<div class="tab-string-name">${stringName}|</div>`; 
                sectionHtml += `<div class="tab-string-content">${stringContentArray.join('')}</div>`;
                sectionHtml += `</div>`;
            });
            const sectionDiv = document.createElement('div');
            sectionDiv.className = 'tab-section';
            sectionDiv.innerHTML = sectionHtml;
            tabDisplay.appendChild(sectionDiv);
        }

        function highlightCursor() {
            document.querySelectorAll('.cursor').forEach(cursor => cursor.remove());

            if (activeMeasureIndex >= tabData.length || activeStringIndex >= NUM_STRINGS) {
                activeMeasureIndex = Math.max(0, Math.min(activeMeasureIndex, tabData.length - 1));
                const currentStringDataContent = tabData[activeMeasureIndex]?.[STRING_NAMES[activeStringIndex]] || [];
                activeColumnIndex = Math.max(0, Math.min(activeColumnIndex, currentStringDataContent.length)); 
                renderTab();
                return;
            }

            const targetMeasure = tabData[activeMeasureIndex];
            const targetStringName = STRING_NAMES[activeStringIndex];
            const targetStringData = targetMeasure[targetStringName];
            const targetStringDataContent = targetStringData; 

            let charOffset = 0; 

            const currentLineIndex = Math.floor(activeMeasureIndex / MEASURES_PER_LINE);
            const lineStartMeasureIndex = currentLineIndex * MEASURES_PER_LINE;
            const measuresInCurrentLine = tabData.slice(lineStartMeasureIndex, lineStartMeasureIndex + MEASURES_PER_LINE);

            // この行の各小節の実際の最大幅を計算し直す（カーソル移動時にも正確な位置を特定するため）
            const widthsForLine = measuresInCurrentLine.map(measureData => {
                let maxMeasureWidth = 0;
                STRING_NAMES.forEach(stringName => {
                    const elements = measureData[stringName] || [];
                    const stringWidth = calculateVisualWidthForStringData(elements);
                    if (stringWidth > maxMeasureWidth) {
                        maxMeasureWidth = stringWidth;
                    }
                });
                return Math.max(maxMeasureWidth, 4); // renderTab() と同様の最低幅を保証
            });


            charOffset += STRING_NAMES[activeStringIndex].length + 1; 

            for (let j = 0; j < (activeMeasureIndex - lineStartMeasureIndex); j++) {
                // 以前はFIXED_MEASURE_CONTENT_WIDTHを使用していたが、動的に変更された幅を使用
                charOffset += widthsForLine[j] + 1; // その小節の幅 + '|'
            }
            
            for (let colIdx = 0; colIdx < activeColumnIndex; colIdx++) {
                const el = targetStringDataContent[colIdx];
                charOffset += getElementDisplayWidth(el);
                // 次の要素がテクニック記号でなければハイフンを追加
                if (!TECHNIQUE_SYMBOLS.includes(String(el.f).toLowerCase())) { 
                    if (colIdx < targetStringDataContent.length -1) {
                        if (!TECHNIQUE_SYMBOLS.includes(String(targetStringDataContent[colIdx + 1]?.f).toLowerCase())) { 
                            charOffset += BASE_HYPHEN_WIDTH;
                        }
                    }
                    // If it's the last element and not a technique, add a hyphen
                    else if (colIdx === targetStringDataContent.length - 1) {
                        charOffset += BASE_HYPHEN_WIDTH;
                    }
                }
            }
            
            const sections = tabDisplay.querySelectorAll('.tab-section');
            let targetSection = null;
            let sectionCounter = 0;
            for (let i = 0; i < tabData.length; i += MEASURES_PER_LINE) {
                if (activeMeasureIndex >= i && activeMeasureIndex < i + MEASURES_PER_LINE) {
                    targetSection = sections[sectionCounter];
                    break;
                }
                sectionCounter++;
            }

            if (targetSection) {
                const stringLines = targetSection.querySelectorAll('.tab-string-line');
                if (activeStringIndex + 1 < stringLines.length) { 
                    const targetContentDiv = stringLines[activeStringIndex + 1].querySelector('.tab-string-content');
                    
                    const cursorSpan = document.createElement('span');
                    cursorSpan.className = 'cursor';
                    
                    const currentInnerHTML = targetContentDiv.innerHTML;
                    let htmlInsertIndex = 0;
                    let currentDisplayedCharCount = 0;
                    let inTag = false;

                    for (let i = 0; i < currentInnerHTML.length; i++) {
                        const char = currentInnerHTML[i];

                        if (char === '<') {
                            inTag = true;
                        } else if (char === '>') {
                            inTag = false;
                        } else if (!inTag) { 
                            currentDisplayedCharCount++;
                        }

                        if (currentDisplayedCharCount >= charOffset && !inTag) {
                            htmlInsertIndex = i; 
                            break;
                        }
                        htmlInsertIndex = i + 1; 
                    }

                    const newHtml = currentInnerHTML.substring(0, htmlInsertIndex) + cursorSpan.outerHTML + currentInnerHTML.substring(htmlInsertIndex);
                    targetContentDiv.innerHTML = newHtml;
                }
            }
        }

        function initializeTab() {
            tabData = [];
            addMeasures(INITIAL_MEASURES);
            activeMeasureIndex = 0;
            activeColumnIndex = 0; 
        }

        function addMeasures(num) {
            for (let i = 0; i < num; i++) {
                const newMeasure = {};
                STRING_NAMES.forEach(name => {
                    newMeasure[name] = [{f: '-', t: 'rest'}]; 
                });
                tabData.push(newMeasure);
            }
            activeMeasureIndex = tabData.length - num; 
            activeColumnIndex = 0;
            renderTab(); 
            saveTabDataToLocalStorage(); // ローカルストレージに保存
        }

        function clearAllTab() {
            tabData = [];
            initializeTab();
            renderTab();
            saveTabDataToLocalStorage(); // ローカルストレージに保存
        }

        function insertElementAtCursor(fretOrSymbol, type) {
            if (activeMeasureIndex >= tabData.length) {
                return; 
            }

            const currentMeasure = tabData[activeMeasureIndex];
            const currentStringName = STRING_NAMES[activeStringIndex];
            const currentStringData = currentMeasure[currentStringName]; 

            activeColumnIndex = Math.max(0, Math.min(activeColumnIndex, currentStringData.length));

            currentStringData.splice(activeColumnIndex, 0, {f: fretOrSymbol, t: type});
            activeColumnIndex++; 
            
            renderTab();
            saveTabDataToLocalStorage(); // ローカルストレージに保存
        }


        function deleteElementAtCursor() {
            const currentMeasure = tabData[activeMeasureIndex];
            const currentStringName = STRING_NAMES[activeStringIndex];
            const currentStringData = currentMeasure[currentStringName]; 

            if (activeColumnIndex > 0) { 
                currentStringData.splice(activeColumnIndex - 1, 1);
                activeColumnIndex--; 
                
                const hasNoContent = currentStringData.length === 0;
                if (hasNoContent) {
                    currentStringData.splice(0, 0, {f: '-', t: 'rest'});
                    activeColumnIndex = 0; 
                }
                renderTab();
                saveTabDataToLocalStorage(); // ローカルストレージに保存
            } else if (activeMeasureIndex > 0) { 
                activeMeasureIndex--;
                const prevMeasureData = tabData[activeMeasureIndex][STRING_NAMES[activeStringIndex]];
                activeColumnIndex = prevMeasureData.length; 
                renderTab();
                saveTabDataToLocalStorage(); // ローカルストレージに保存
            }
        }

        function saveTabDataToLocalStorage() {
            try {
                localStorage.setItem('bassTabEditorData', JSON.stringify(tabData));
                localStorage.setItem('bassTabEditorTuning', JSON.stringify(currentTuning)); // チューニングも保存
                localStorage.setItem('bassTabEditorStringNames', JSON.stringify(STRING_NAMES)); // 弦名も保存
                console.log('TAB譜データを自動保存しました。');
            } catch (e) {
                console.error('TAB譜データの自動保存に失敗しました:', e);
                alert('TAB譜データの保存に失敗しました。ブラウザのストレージが上限に達している可能性があります。');
            }
        }

        function loadTabDataFromLocalStorage() {
            try {
                const savedData = localStorage.getItem('bassTabEditorData');
                const savedTuning = localStorage.getItem('bassTabEditorTuning');
                const savedStringNames = localStorage.getItem('bassTabEditorStringNames');

                if (savedData) {
                    tabData = JSON.parse(savedData);
                    console.log('TAB譜データを自動読み込みしました。');
                } else {
                    console.log('保存されたTAB譜データはありません。新規作成します。');
                    initializeTab();
                }

                if (savedTuning) {
                    currentTuning = JSON.parse(savedTuning);
                }
                if (savedStringNames) {
                    STRING_NAMES = JSON.parse(savedStringNames);
                    NUM_STRINGS = STRING_NAMES.length; // 弦の数も更新
                }

                // ロードされたチューニングと弦名に基づいて初期化
                initializeTuningUI(); 
                renderTab();
                activeMeasureIndex = 0;
                activeColumnIndex = 0;
                activeStringIndex = NUM_STRINGS - 1; 
                highlightCursor();
            } catch (e) {
                console.error('TAB譜データの読み込みに失敗しました:', e);
                alert('TAB譜データの読み込みに失敗しました。データが破損している可能性があります。新規作成します。');
                initializeTab();
            }
        }

        function exportTabAsText() {
            let exportText = '';
            let sectionMeasuresStartIndex = 0;
            let currentLineMeasures = [];

            exportText += "# 簡易ベースTAB譜エディターデータ\n";
            exportText += "# Strings: " + STRING_NAMES.join(', ') + "\n\n";

            if (tabData.length === 0) {
                const emptyMeasure = {};
                STRING_NAMES.forEach(name => {
                    emptyMeasure[name] = [{f: '-', t: 'rest'}];
                });
                currentLineMeasures.push(emptyMeasure); 
            } else {
                currentLineMeasures = [...tabData]; 
            }

            let fullTabString = '';
            let processedMeasuresCount = 0;

            // 各小節の最大幅を事前に計算する
            const measureMaxContentWidths = tabData.map(measureData => {
                let maxMeasureWidth = 0;
                STRING_NAMES.forEach(stringName => {
                    const elements = measureData[stringName] || [];
                    const stringWidth = calculateVisualWidthForStringData(elements);
                    if (stringWidth > maxMeasureWidth) {
                        maxMeasureWidth = stringWidth;
                    }
                });
                return Math.max(maxMeasureWidth, 4); 
            });
            
            while (processedMeasuresCount < tabData.length) {
                const lineMeasures = tabData.slice(processedMeasuresCount, processedMeasuresCount + MEASURES_PER_LINE);
                const widthsForLine = measureMaxContentWidths.slice(processedMeasuresCount, processedMeasuresCount + MEASURES_PER_LINE);

                let measureNumbersLine = [];
                let currentTotalCharOffset = 0; 
                const stringNameAndPipeDisplayWidth = STRING_NAMES[0].length + 1; 

                lineMeasures.forEach((mD, idxInLine) => {
                    const actualMeasureIndex = processedMeasuresCount + idxInLine;
                    const measureNum = actualMeasureIndex + 1;
                    const measureStr = String(measureNum);
                    
                    const currentMeasureCalculatedWidth = widthsForLine[idxInLine]; 

                    let currentMeasureStartCharOffsetInLine;
                    if (idxInLine === 0) { 
                        currentMeasureStartCharOffsetInLine = stringNameAndPipeDisplayWidth;
                    } else { 
                        const prevMeasureCalculatedWidth = widthsForLine[idxInLine - 1]; 
                        currentMeasureStartCharOffsetInLine = prevMeasureCalculatedWidth + 1; 
                    }
                    
                    const absoluteNumPosition = currentTotalCharOffset + currentMeasureStartCharOffsetInLine;
                    const numPosition = Math.max(0, Math.floor(absoluteNumPosition - measureStr.length / 2));

                    const spaceBeforeNum = Math.max(0, numPosition - measureNumbersLine.join('').length);
                    measureNumbersLine.push(' '.repeat(spaceBeforeNum) + measureStr);
                    
                    currentTotalCharOffset += currentMeasureStartCharOffsetInLine;
                });
                fullTabString += measureNumbersLine.join('') + "\n";

                STRING_NAMES.forEach(stringName => {
                    let stringContentArray = [];
                    lineMeasures.forEach((mD, idxInLine) => {
                        const elements = mD[stringName] || [];

                        if (idxInLine === 0) { 
                            stringContentArray.push('|');
                        }
                        
                        let measureString = '';
                        elements.forEach((el, elIdx) => {
                            measureString += (typeof el.f === 'number' ? String(el.f) : el.f);
                            if (!TECHNIQUE_SYMBOLS.includes(String(el.f).toLowerCase()) && (elIdx === elements.length - 1 || !TECHNIQUE_SYMBOLS.includes(String(elements[elIdx + 1]?.f).toLowerCase()))) {
                                measureString += '-';
                            }
                        });

                        const currentMeasureCalculatedWidth = widthsForLine[idxInLine];
                        const currentContentVisualWidth = calculateVisualWidthForStringData(elements);
                        const paddingNeeded = currentMeasureCalculatedWidth - currentContentVisualWidth;
                        measureString += '-'.repeat(Math.max(0, paddingNeeded));
                        
                        measureString += '|'; 

                        stringContentArray.push(measureString);
                    });
                    fullTabString += stringName + stringContentArray.join('') + "\n";
                });
                fullTabString += "\n"; 

                processedMeasuresCount += lineMeasures.length;
            }

            exportText += fullTabString;

            const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'my_bass_tab.txt'; 
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
        }

        async function copyTabAsTextToClipboard() {
            let textToCopy = '';
            let sectionMeasuresStartIndex = 0;
            let currentLineMeasures = [];

            textToCopy += "# 簡易ベースTAB譜エディターデータ\n";
            textToCopy += "# Strings: " + STRING_NAMES.join(', ') + "\n\n";

            if (tabData.length === 0) {
                const emptyMeasure = {};
                STRING_NAMES.forEach(name => {
                    emptyMeasure[name] = [{f: '-', t: 'rest'}];
                });
                currentLineMeasures.push(emptyMeasure); 
            } else {
                currentLineMeasures = [...tabData]; 
            }

            let fullTabString = '';
            let processedMeasuresCount = 0;

            // 各小節の最大幅を事前に計算する
            const measureMaxContentWidths = tabData.map(measureData => {
                let maxMeasureWidth = 0;
                STRING_NAMES.forEach(stringName => {
                    const elements = measureData[stringName] || [];
                    const stringWidth = calculateVisualWidthForStringData(elements);
                    if (stringWidth > maxMeasureWidth) {
                        maxMeasureWidth = stringWidth;
                    }
                });
                return Math.max(maxMeasureWidth, 4); 
            });
            
            while (processedMeasuresCount < tabData.length) {
                const lineMeasures = tabData.slice(processedMeasuresCount, processedMeasuresCount + MEASURES_PER_LINE);
                const widthsForLine = measureMaxContentWidths.slice(processedMeasuresCount, processedMeasuresCount + MEASURES_PER_LINE);
                
                let measureNumbersLine = [];
                let currentTotalCharOffset = 0; 
                const stringNameAndPipeDisplayWidth = STRING_NAMES[0].length + 1; 

                lineMeasures.forEach((mD, idxInLine) => {
                    const actualMeasureIndex = processedMeasuresCount + idxInLine;
                    const measureNum = actualMeasureIndex + 1;
                    const measureStr = String(measureNum);
                    
                    const currentMeasureCalculatedWidth = widthsForLine[idxInLine]; 

                    let currentMeasureStartCharOffsetInLine;
                    if (idxInLine === 0) { 
                        currentMeasureStartCharOffsetInLine = stringNameAndPipeDisplayWidth;
                    } else { 
                        const prevMeasureCalculatedWidth = widthsForLine[idxInLine - 1]; 
                        currentMeasureStartCharOffsetInLine = prevMeasureCalculatedWidth + 1; 
                    }
                    
                    const absoluteNumPosition = currentTotalCharOffset + currentMeasureStartCharOffsetInLine;
                    const numPosition = Math.max(0, Math.floor(absoluteNumPosition - measureStr.length / 2));

                    const spaceBeforeNum = Math.max(0, numPosition - measureNumbersLine.join('').length);
                    measureNumbersLine.push(' '.repeat(spaceBeforeNum) + measureStr);
                    
                    currentTotalCharOffset += currentMeasureStartCharOffsetInLine;
                });
                fullTabString += measureNumbersLine.join('') + "\n";

                STRING_NAMES.forEach(stringName => {
                    let stringContentArray = [];
                    lineMeasures.forEach((mD, idxInLine) => {
                        const elements = mD[stringName] || [];

                        if (idxInLine === 0) { 
                            stringContentArray.push('|');
                        }
                        
                        let measureString = '';
                        elements.forEach((el, elIdx) => {
                            measureString += (typeof el.f === 'number' ? String(el.f) : el.f);
                            if (!TECHNIQUE_SYMBOLS.includes(String(el.f).toLowerCase()) && (elIdx === elements.length - 1 || !TECHNIQUE_SYMBOLS.includes(String(elements[elIdx + 1]?.f).toLowerCase()))) {
                                measureString += '-';
                            }
                        });

                        const currentMeasureCalculatedWidth = widthsForLine[idxInLine];
                        const currentContentVisualWidth = calculateVisualWidthForStringData(elements);
                        const paddingNeeded = currentMeasureCalculatedWidth - currentContentVisualWidth;
                        measureString += '-'.repeat(Math.max(0, paddingNeeded));
                        
                        measureString += '|'; 

                        stringContentArray.push(measureString);
                    });
                    fullTabString += stringName + stringContentArray.join('') + "\n";
                });
                fullTabString += "\n"; 

                processedMeasuresCount += lineMeasures.length;
            }

            textToCopy += fullTabString;

            try {
                await navigator.clipboard.writeText(textToCopy);
                alert('TAB譜テキストをクリップボードにコピーしました！');
            } catch (err) {
                console.error('テキストのコピーに失敗しました:', err);
                alert('テキストのコピーに失敗しました。お使いのブラウザではサポートされていないか、権限がありません。');
            }
        }

        function exportTabAsImage() {
            const targetElement = document.getElementById('tab-display'); 

            const cursorElement = document.querySelector('.cursor');
            if (cursorElement) {
                cursorElement.style.visibility = 'hidden';
            }

            html2canvas(targetElement, {
                scale: 2, 
                backgroundColor: '#ffffff'
            }).then(canvas => {
                if (cursorElement) {
                    cursorElement.style.visibility = 'visible';
                }

                const link = document.createElement('a');
                link.download = 'bass_tab.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
                alert('TAB譜を画像として保存しました！');
            }).catch(error => {
                console.error('画像エクスポート中にエラーが発生しました:', error);
                alert('画像エクスポートに失敗しました。');
                if (cursorElement) {
                    cursorElement.style.visibility = 'visible';
                }
            });
        }

        // ★ チューニング設定機能
        function initializeTuningUI() {
            tuningOptionsDiv.innerHTML = '';
            // 既存の弦の数と名前を元にセレクトボックスを生成
            STRING_NAMES.forEach((stringName, index) => {
                const stringDiv = document.createElement('div');
                const label = document.createElement('label');
                label.textContent = `${stringName}弦:`;
                label.htmlFor = `tuning-${stringName}`;

                const select = document.createElement('select');
                select.id = `tuning-${stringName}`;
                select.dataset.stringName = stringName;

                // MIDI_NOTESからすべての利用可能な音符とシャープ/フラットを生成
const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

for (let octave = 0; octave <= 5; octave++) {
    notes.forEach(note => {
        const midiNoteNumber = (octave * 12) + notes.indexOf(note) + MIDI_NOTES['C']; // C0のMIDIノートを基準にオフセット
        if (midiNoteNumber >= 20 && midiNoteNumber <= 80) { // 一般的なベースの範囲 (B0 ~ C5くらい)
            const option = document.createElement('option');
            option.value = note + octave;
            option.textContent = note + octave;
            select.appendChild(option);
        }
    });
}

                // 現在のチューニングに合わせて選択肢を設定
                const currentMidi = currentTuning[stringName];
                if (currentMidi !== undefined) {
                    const closestNote = findNoteFromMidi(currentMidi);
                    if (closestNote) {
                        select.value = closestNote;
                    } else {
                        // 見つからなければ、デフォルトのE2/A2/D3/G3などを設定
                        const defaultMidiForString = MIDI_NOTES[stringName] !== undefined ? MIDI_NOTES[stringName] + (stringName === 'G' || stringName === 'D' ? 12 : 0) : MIDI_NOTES['E']; // G3, D3, A2, E2
                        select.value = findNoteFromMidi(defaultMidiForString);
                    }
                } else {
                    // 新しく追加された弦名の場合のデフォルト値
                    const defaultMidiForString = MIDI_NOTES[stringName] !== undefined ? MIDI_NOTES[stringName] + (stringName === 'G' || stringName === 'D' ? 12 : 0) : MIDI_NOTES['E']; // G3, D3, A2, E2
                    select.value = findNoteFromMidi(defaultMidiForString);
                }
                
                stringDiv.appendChild(label);
                stringDiv.appendChild(select);
                tuningOptionsDiv.appendChild(stringDiv);
            });

            // 弦の数を変更する機能は実装していないため、ここでは既存の弦名に対応
            // もし5弦ベースなどに対応させる場合は、UIで弦の追加/削除機能も必要
        }

        function findNoteFromMidi(midiNumber) {
            // MIDIノートナンバーから音名とオクターブを逆算
            const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            const octave = Math.floor(midiNumber / 12) - 1; // C0が12の場合、オクターブを調整
            const noteIndex = (midiNumber % 12 + 12) % 12; // 負の数を考慮して正しいインデックスを取得
            return notes[noteIndex] + octave;
        }

        function applyTuning() {
            const newTuning = {};
            const newStringNames = []; // 順序を保持するために新しい配列を作成

            const selectElements = tuningOptionsDiv.querySelectorAll('select');
            selectElements.forEach(select => {
                const stringName = select.dataset.stringName;
                const selectedNoteOctave = select.value;
                const noteMatch = selectedNoteOctave.match(/^[A-G][b#]?/);
                const octaveMatch = selectedNoteOctave.match(/\d+$/);

                if (!noteMatch || !octaveMatch) {
                    alert(`無効な音符またはオクターブが選択されました: ${selectedNoteOctave}`);
                    return;
                }

                const note = noteMatch[0];
                const octave = parseInt(octaveMatch[0], 10);
                
                // MIDI_NOTESのキーにシャープ/フラットがない場合は変換
                let baseNote = note;
                if (note.length > 1) {
                    // 例: Db -> C#
                    if (note === 'Db') baseNote = 'C#';
                    if (note === 'Eb') baseNote = 'D#';
                    if (note === 'Gb') baseNote = 'F#';
                    if (note === 'Ab') baseNote = 'G#';
                    if (note === 'Bb') baseNote = 'A#';
                }

                const baseMidi = MIDI_NOTES[baseNote];
                if (baseMidi === undefined) {
                    alert(`内部エラー: 未知の音符 ${baseNote} が検出されました。`);
                    return;
                }

                const midiNoteNumber = baseMidi + (octave - 4) * 12; // C4を基準に
                newTuning[stringName] = midiNoteNumber;
                newStringNames.push(stringName);
            });

            currentTuning = newTuning;
            NUM_STRINGS = STRING_NAMES.length; 

            saveTabDataToLocalStorage(); // チューニング設定も保存
            renderTab(); // TAB譜を再描画して、弦名を更新
            alert('チューニングが適用されました！');
        }

        // ★ メトロノーム機能
        function initAudioContext() {
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
        }

        function playClick() {
            if (!audioContext) {
                initAudioContext();
            }
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.type = 'sine'; // 正弦波
            oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // 880Hz (A5) for click

            gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.05); // 短く減衰

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.05); // 非常に短い音
        }

        function toggleMetronome() {
            if (!isMetronomePlaying) {
                initAudioContext();
                const bpm = parseInt(bpmInput.value, 10);
                if (isNaN(bpm) || bpm <= 0) {
                    alert('有効なテンポ (BPM) を入力してください。');
                    return;
                }
                const intervalTime = 60000 / bpm; // ms

                playClick(); // 最初のクリックを即座に鳴らす
                metronomeInterval = setInterval(playClick, intervalTime);
                metronomeToggleButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12"></rect></svg> 停止';
                isMetronomePlaying = true;
            } else {
                clearInterval(metronomeInterval);
                metronomeToggleButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> 再生';
                isMetronomePlaying = false;
            }
        }

        // ラッキーフレット機能
        function displayLuckyFret() {
            const randomStringIndex = Math.floor(Math.random() * STRING_NAMES.length);
            const randomStringName = STRING_NAMES[randomStringIndex];
            const randomFret = Math.floor(Math.random() * 13); // 0フレットから12フレットまで

            luckyFretDisplay.textContent = `${randomStringName}弦 ${randomFret}フレット！`;
        }

        // 初期化と自動読み込み
        loadTabDataFromLocalStorage();  // ← チューニング・弦構成の読み込みが先！
        initializeTuningUI(); // Initialize the UI based on loaded tuning and string names
        // renderTab(); // renderTabはloadTabDataFromLocalStorage内で呼ばれるので不要
        // activeMeasureIndex, activeColumnIndex, activeStringIndexもloadTabDataFromLocalStorageで設定される

        // 初期表示後の微調整（念のため）
        activeMeasureIndex = Math.max(0, Math.min(activeMeasureIndex, tabData.length - 1));
        const currentStringDataContent = tabData[activeMeasureIndex]?.[STRING_NAMES[activeStringIndex]] || [];
        activeColumnIndex = Math.max(0, Math.min(activeColumnIndex, currentStringDataContent.length)); 
        activeStringIndex = Math.max(0, Math.min(activeStringIndex, NUM_STRINGS - 1)); 

        highlightCursor();
        displayLuckyFret(); // ページ読み込み時にラッキーフレットを表示


        // イベントリスナー
        addHammerBtn.addEventListener('click', () => { insertElementAtCursor('h', 'hammer'); });
        addPullBtn.addEventListener('click', () => { insertElementAtCursor('p', 'pull'); });
        addSlideUpBtn.addEventListener('click', () => { insertElementAtCursor('/', 'slide-up'); });
        addSlideDownBtn.addEventListener('click', () => { insertElementAtCursor('\\', 'slide-down'); });
        addMuteBtn.addEventListener('click', () => { insertElementAtCursor('x', 'mute'); });

        deleteLastBtn.addEventListener('click', () => { deleteElementAtCursor(); });
        add4MeasuresBtn.addEventListener('click', () => { addMeasures(4); }); 
        clearAllBtn.addEventListener('click', () => { if (confirm('全てのTAB譜をクリアしますか？')) { clearAllTab(); } });

        saveTabBtn.addEventListener('click', exportTabAsText); 
        copyTextBtn.addEventListener('click', copyTabAsTextToClipboard);
        exportImageBtn.addEventListener('click', exportTabAsImage);     

        // チューニング設定イベントリスナー
        applyTuningBtn.addEventListener('click', applyTuning);

        // メトロノームイベントリスナー
        metronomeToggleButton.addEventListener('click', toggleMetronome);

        // ラッキーフレットイベントリスナー
        refreshLuckyFretBtn.addEventListener('click', displayLuckyFret);

        document.addEventListener('keydown', (e) => {
            // Input要素でのキーイベントは処理しない
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                return;
            }

            const handledKeys = [
                'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 
                'Backspace', ' ', 'h', 'p', '/', '\\', 'x',
                '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
            ];

            // 矢印キーでの画面スクロールを無効化
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault(); 
            }
            if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                e.preventDefault();
            }

            const currentStringDataContent = tabData[activeMeasureIndex][STRING_NAMES[activeStringIndex]]; 

            if (e.key === 'ArrowUp') {
                activeStringIndex = Math.max(0, activeStringIndex - 1);
                const newStringContent = tabData[activeMeasureIndex][STRING_NAMES[activeStringIndex]]; 
                activeColumnIndex = Math.min(activeColumnIndex, newStringContent.length);
                renderTab();
            } else if (e.key === 'ArrowDown') {
                activeStringIndex = Math.min(NUM_STRINGS - 1, activeStringIndex + 1);
                const newStringContent = tabData[activeMeasureIndex][STRING_NAMES[activeStringIndex]]; 
                activeColumnIndex = Math.min(activeColumnIndex, newStringContent.length);
                renderTab();
            } else if (e.key === 'ArrowLeft') {
                if (e.shiftKey) { 
                    if (activeMeasureIndex > 0) {
                        activeMeasureIndex--;
                        activeColumnIndex = 0; 
                    } else { 
                        activeColumnIndex = 0;
                    }
                } else { 
                    activeColumnIndex = Math.max(0, activeColumnIndex - 1);
                }
                renderTab();
            } else if (e.key === 'ArrowRight') {
                if (e.shiftKey) { 
                    if (activeMeasureIndex < tabData.length - 1) {
                        activeMeasureIndex++;
                        activeColumnIndex = 0; 
                    } else { 
                        activeColumnIndex = currentStringDataContent.length;
                    }
                } else { 
                    activeColumnIndex = Math.min(currentStringDataContent.length, activeColumnIndex + 1);
                }
                renderTab();
            } else if (e.key === 'Backspace') {
                deleteElementAtCursor();
                lastInputWasNumber = false; 
            } else if (e.key >= '0' && e.key <= '9') {
                const num = parseInt(e.key, 10);
                const currentTime = new Date().getTime();

                if (lastInputWasNumber && (currentTime - lastInputTime < DOUBLE_DIGIT_TIMEOUT) && activeColumnIndex > 0) {
                    const prevElement = currentStringDataContent[activeColumnIndex - 1]; 
                    if (prevElement && prevElement.t === 'note' && typeof prevElement.f === 'number' && prevElement.f < 10) {
                        const combinedFret = prevElement.f * 10 + num;
                        if (combinedFret <= 24) { 
                            currentStringDataContent[activeColumnIndex - 1] = {f: combinedFret, t: 'note'};
                            renderTab();
                            lastInputTime = currentTime; 
                            saveTabDataToLocalStorage(); 
                            return; 
                        }
                    }
                }
                insertElementAtCursor(num, 'note');
                lastInputWasNumber = true;
                lastInputTime = currentTime;
            } else if (e.key === ' ') {
                e.preventDefault(); // ★ ここを追加
                insertElementAtCursor('-', 'rest');
                lastInputWasNumber = false; 
            } else if (e.key.toLowerCase() === 'h') {
                insertElementAtCursor('h', 'hammer');
                lastInputWasNumber = false;
            } else if (e.key.toLowerCase() === 'p') {
                insertElementAtCursor('p', 'pull');
                lastInputWasNumber = false;
            } else if (e.key === '/') {
                insertElementAtCursor('/', 'slide-up');
                lastInputWasNumber = false;
            } else if (e.key === '\\') { // ★ バックスラッシュはエスケープが必要
                insertElementAtCursor('\\', 'slide-down');
                lastInputWasNumber = false;
            } else if (e.key.toLowerCase() === 'x') {
                insertElementAtCursor('x', 'mute');
                lastInputWasNumber = false;
            } else {
                lastInputWasNumber = false;
            }
        });
    } // End of initializeApp()
}); // End of DOMContentLoaded