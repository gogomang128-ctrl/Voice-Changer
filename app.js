// ==========================================
//    Voice Changer Pro - مغير الأصوات
//         Web Audio API Engine
// ==========================================

// ===== DOM ELEMENTS =====
const recordBtn = document.getElementById('record-btn');
const stopBtn = document.getElementById('stop-btn');
const playBtn = document.getElementById('play-btn');
const downloadBtn = document.getElementById('download-btn');
const visualizerCanvas = document.getElementById('visualizer');
const visualizerCtx = visualizerCanvas.getContext('2d');
const recordingTimeEl = document.getElementById('recording-time');
const statusDot = document.querySelector('.status-dot');
const statusText = document.querySelector('.status-text');
const recordingsList = document.getElementById('recordings-list');

// Sliders
const volumeSlider = document.getElementById('volume-slider');
const pitchSlider = document.getElementById('pitch-slider');
const speedSlider = document.getElementById('speed-slider');
const bassSlider = document.getElementById('bass-slider');
const trebleSlider = document.getElementById('treble-slider');
const reverbSlider = document.getElementById('reverb-slider');
const distortionSlider = document.getElementById('distortion-slider');
const tremoloSlider = document.getElementById('tremolo-slider');
const resetBtn = document.getElementById('reset-btn');

// ===== AUDIO STATE =====
let audioContext = null;
let mediaRecorder = null;
let mediaStream = null;
let analyser = null;
let recordedChunks = [];
let recordedBlob = null;
let recordedBuffer = null;
let isRecording = false;
let isPlaying = false;
let currentSource = null;
let recordingTimer = null;
let recordingSeconds = 0;
let currentEffect = 'normal';
let savedRecordings = [];
let animationFrame = null;

// ===== EFFECT PRESETS =====
const EFFECTS = {
    normal: { pitch: 100, speed: 100, bass: 0, treble: 0, reverb: 0, distortion: 0, tremolo: 0, volume: 100 },
    deep: { pitch: 50, speed: 85, bass: 15, treble: -10, reverb: 20, distortion: 5, tremolo: 0, volume: 110 },
    chipmunk: { pitch: 200, speed: 130, bass: -10, treble: 10, reverb: 0, distortion: 0, tremolo: 0, volume: 100 },
    robot: { pitch: 80, speed: 100, bass: 5, treble: 5, reverb: 10, distortion: 50, tremolo: 20, volume: 100 },
    echo: { pitch: 100, speed: 100, bass: 0, treble: 0, reverb: 80, distortion: 0, tremolo: 0, volume: 100 },
    alien: { pitch: 150, speed: 110, bass: 10, treble: 15, reverb: 40, distortion: 20, tremolo: 30, volume: 100 },
    underwater: { pitch: 80, speed: 90, bass: 15, treble: -15, reverb: 60, distortion: 0, tremolo: 10, volume: 80 },
    telephone: { pitch: 110, speed: 100, bass: -15, treble: -5, reverb: 0, distortion: 30, tremolo: 0, volume: 90 },
    cave: { pitch: 90, speed: 95, bass: 10, treble: -5, reverb: 90, distortion: 0, tremolo: 0, volume: 100 },
    megaphone: { pitch: 110, speed: 100, bass: -10, treble: 15, reverb: 15, distortion: 40, tremolo: 0, volume: 150 },
    ghost: { pitch: 70, speed: 80, bass: 5, treble: -10, reverb: 70, distortion: 10, tremolo: 40, volume: 80 },
    radio: { pitch: 105, speed: 100, bass: -15, treble: -10, reverb: 5, distortion: 25, tremolo: 0, volume: 90 },
    helium: { pitch: 250, speed: 120, bass: -15, treble: 15, reverb: 0, distortion: 0, tremolo: 0, volume: 100 },
    darth: { pitch: 55, speed: 90, bass: 20, treble: -5, reverb: 30, distortion: 15, tremolo: 10, volume: 120 },
    chorus: { pitch: 100, speed: 100, bass: 5, treble: 5, reverb: 50, distortion: 0, tremolo: 15, volume: 110 },
    reverse: { pitch: 100, speed: 100, bass: 0, treble: 0, reverb: 20, distortion: 0, tremolo: 0, volume: 100 }
};

// ===== INITIALIZE =====
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

// ===== VISUALIZER =====
function setupVisualizer() {
    visualizerCanvas.width = visualizerCanvas.offsetWidth * 2;
    visualizerCanvas.height = visualizerCanvas.offsetHeight * 2;
    drawIdleVisualizer();
}

function drawIdleVisualizer() {
    const w = visualizerCanvas.width;
    const h = visualizerCanvas.height;
    visualizerCtx.clearRect(0, 0, w, h);

    // Background gradient
    const bg = visualizerCtx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, 'rgba(10, 10, 30, 0.8)');
    bg.addColorStop(1, 'rgba(10, 10, 30, 0.4)');
    visualizerCtx.fillStyle = bg;
    visualizerCtx.fillRect(0, 0, w, h);

    // Center line
    visualizerCtx.strokeStyle = 'rgba(108, 99, 255, 0.2)';
    visualizerCtx.lineWidth = 1;
    visualizerCtx.beginPath();
    visualizerCtx.moveTo(0, h / 2);
    visualizerCtx.lineTo(w, h / 2);
    visualizerCtx.stroke();

    // Idle wave
    const time = Date.now() * 0.002;
    visualizerCtx.strokeStyle = 'rgba(108, 99, 255, 0.3)';
    visualizerCtx.lineWidth = 2;
    visualizerCtx.beginPath();

    for (let x = 0; x < w; x++) {
        const y = h / 2 + Math.sin(x * 0.02 + time) * 5 + Math.sin(x * 0.01 + time * 0.5) * 3;
        if (x === 0) visualizerCtx.moveTo(x, y);
        else visualizerCtx.lineTo(x, y);
    }
    visualizerCtx.stroke();

    if (!isRecording && !isPlaying) {
        animationFrame = requestAnimationFrame(drawIdleVisualizer);
    }
}

function drawLiveVisualizer() {
    if (!analyser) return;

    const w = visualizerCanvas.width;
    const h = visualizerCanvas.height;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
        if (!isRecording && !isPlaying) {
            drawIdleVisualizer();
            return;
        }

        animationFrame = requestAnimationFrame(draw);
        analyser.getByteTimeDomainData(dataArray);

        visualizerCtx.clearRect(0, 0, w, h);

        // Background
        const bg = visualizerCtx.createLinearGradient(0, 0, 0, h);
        bg.addColorStop(0, 'rgba(10, 10, 30, 0.9)');
        bg.addColorStop(1, 'rgba(10, 10, 30, 0.5)');
        visualizerCtx.fillStyle = bg;
        visualizerCtx.fillRect(0, 0, w, h);

        // Frequency bars background
        analyser.getByteFrequencyData(dataArray);
        const barWidth = w / bufferLength * 4;

        for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * h * 0.6;
            const x = i * barWidth;

            const gradient = visualizerCtx.createLinearGradient(0, h, 0, h - barHeight);
            gradient.addColorStop(0, 'rgba(108, 99, 255, 0.1)');
            gradient.addColorStop(1, 'rgba(0, 217, 255, 0.05)');

            visualizerCtx.fillStyle = gradient;
            visualizerCtx.fillRect(x, h - barHeight, barWidth - 1, barHeight);
        }

        // Waveform
        analyser.getByteTimeDomainData(dataArray);
        visualizerCtx.lineWidth = 3;

        const waveGrad = visualizerCtx.createLinearGradient(0, 0, w, 0);
        waveGrad.addColorStop(0, isRecording ? '#FF5252' : '#6C63FF');
        waveGrad.addColorStop(0.5, isRecording ? '#FF8A80' : '#00D9FF');
        waveGrad.addColorStop(1, isRecording ? '#FF5252' : '#6C63FF');

        visualizerCtx.strokeStyle = waveGrad;
        visualizerCtx.beginPath();

        const sliceWidth = w / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * h) / 2;
            if (i === 0) visualizerCtx.moveTo(x, y);
            else visualizerCtx.lineTo(x, y);
            x += sliceWidth;
        }

        visualizerCtx.lineTo(w, h / 2);
        visualizerCtx.stroke();

        // Glow effect
        visualizerCtx.shadowBlur = 15;
        visualizerCtx.shadowColor = isRecording ? '#FF5252' : '#6C63FF';
        visualizerCtx.stroke();
        visualizerCtx.shadowBlur = 0;
    }

    draw();
}

// ===== RECORDING =====
async function startRecording() {
    try {
        initAudioContext();

        mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                sampleRate: 44100
            }
        });

        // Setup analyser for visualization
        const source = audioContext.createMediaStreamSource(mediaStream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);

        // Setup recorder
        mediaRecorder = new MediaRecorder(mediaStream, {
            mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : 'audio/webm'
        });

        recordedChunks = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunks.push(e.data);
        };

        mediaRecorder.onstop = async () => {
            recordedBlob = new Blob(recordedChunks, { type: 'audio/webm' });
            const arrayBuffer = await recordedBlob.arrayBuffer();
            recordedBuffer = await audioContext.decodeAudioData(arrayBuffer);

            playBtn.disabled = false;
            downloadBtn.disabled = false;

            showToast('✅ تم التسجيل بنجاح!');
        };

        mediaRecorder.start(100);
        isRecording = true;

        // UI updates
        recordBtn.classList.add('recording');
        recordBtn.querySelector('.btn-icon').textContent = '⏺️';
        recordBtn.querySelector('.btn-label').textContent = 'جاري...';
        stopBtn.disabled = false;
        playBtn.disabled = true;
        downloadBtn.disabled = true;

        statusDot.classList.add('recording');
        statusText.textContent = 'جاري التسجيل...';

        // Timer
        recordingSeconds = 0;
        recordingTimer = setInterval(() => {
            recordingSeconds++;
            const mins = Math.floor(recordingSeconds / 60).toString().padStart(2, '0');
            const secs = (recordingSeconds % 60).toString().padStart(2, '0');
            recordingTimeEl.textContent = `${mins}:${secs}`;
        }, 1000);

        // Start visualizer
        cancelAnimationFrame(animationFrame);
        drawLiveVisualizer();

    } catch (err) {
        console.error('Recording error:', err);
        showToast('❌ لم يتم السماح بالوصول للميكروفون!');
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }

    if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
    }

    isRecording = false;

    // UI
    recordBtn.classList.remove('recording');
    recordBtn.querySelector('.btn-icon').textContent = '⏺️';
    recordBtn.querySelector('.btn-label').textContent = 'تسجيل';
    stopBtn.disabled = true;

    statusDot.classList.remove('recording');
    statusText.textContent = 'تم التسجيل';

    clearInterval(recordingTimer);
}

// ===== PLAYBACK WITH EFFECTS =====
function playRecording() {
    if (!recordedBuffer || isPlaying) return;

    initAudioContext();

    let bufferToPlay = recordedBuffer;

    // Reverse effect
    if (currentEffect === 'reverse') {
        bufferToPlay = reverseBuffer(recordedBuffer);
    }

    // Create source
    currentSource = audioContext.createBufferSource();
    currentSource.buffer = bufferToPlay;

    // Playback rate (pitch + speed)
    const pitchValue = pitchSlider.value / 100;
    const speedValue = speedSlider.value / 100;
    currentSource.playbackRate.value = pitchValue * speedValue;

    // Build audio chain
    let lastNode = currentSource;

    // Bass EQ
    const bassFilter = audioContext.createBiquadFilter();
    bassFilter.type = 'lowshelf';
    bassFilter.frequency.value = 200;
    bassFilter.gain.value = parseFloat(bassSlider.value);
    lastNode.connect(bassFilter);
    lastNode = bassFilter;

    // Treble EQ
    const trebleFilter = audioContext.createBiquadFilter();
    trebleFilter.type = 'highshelf';
    trebleFilter.frequency.value = 3000;
    trebleFilter.gain.value = parseFloat(trebleSlider.value);
    lastNode.connect(trebleFilter);
    lastNode = trebleFilter;

    // Distortion
    const distValue = parseInt(distortionSlider.value);
    if (distValue > 0) {
        const distortion = audioContext.createWaveShaper();
        distortion.curve = makeDistortionCurve(distValue * 4);
        distortion.oversample = '4x';
        lastNode.connect(distortion);
        lastNode = distortion;
    }

    // Tremolo
    const tremoloValue = parseInt(tremoloSlider.value);
    if (tremoloValue > 0) {
        const tremoloGain = audioContext.createGain();
        const tremoloOsc = audioContext.createOscillator();
        const tremoloDepth = audioContext.createGain();

        tremoloOsc.frequency.value = 5 + tremoloValue * 0.2;
        tremoloDepth.gain.value = tremoloValue / 200;

        tremoloOsc.connect(tremoloDepth);
        tremoloDepth.connect(tremoloGain.gain);
        tremoloOsc.start();

        lastNode.connect(tremoloGain);
        lastNode = tremoloGain;
    }

    // Reverb (Convolver)
    const reverbValue = parseInt(reverbSlider.value);
    if (reverbValue > 0) {
        const convolver = audioContext.createConvolver();
        convolver.buffer = createReverbIR(reverbValue / 100 * 3);

        const dryGain = audioContext.createGain();
        const wetGain = audioContext.createGain();
        const merger = audioContext.createGain();

        dryGain.gain.value = 1 - reverbValue / 200;
        wetGain.gain.value = reverbValue / 100;

        lastNode.connect(dryGain);
        lastNode.connect(convolver);
        convolver.connect(wetGain);
        dryGain.connect(merger);
        wetGain.connect(merger);

        lastNode = merger;
    }

    // Volume
    const volumeGain = audioContext.createGain();
    volumeGain.gain.value = volumeSlider.value / 100;
    lastNode.connect(volumeGain);
    lastNode = volumeGain;

    // Analyser for visualization
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    lastNode.connect(analyser);
    analyser.connect(audioContext.destination);

    // Play
    currentSource.start();
    isPlaying = true;

    // UI
    playBtn.querySelector('.btn-icon').textContent = '⏸️';
    playBtn.querySelector('.btn-label').textContent = 'إيقاف';
    statusDot.classList.add('playing');
    statusText.textContent = 'جاري التشغيل...';

    cancelAnimationFrame(animationFrame);
    drawLiveVisualizer();

    currentSource.onended = () => {
        isPlaying = false;
        playBtn.querySelector('.btn-icon').textContent = '▶️';
        playBtn.querySelector('.btn-label').textContent = 'تشغيل';
        statusDot.classList.remove('playing');
        statusText.textContent = 'انتهى التشغيل';
        cancelAnimationFrame(animationFrame);
        drawIdleVisualizer();
    };
}

function stopPlayback() {
    if (currentSource) {
        try { currentSource.stop(); } catch (e) {}
        currentSource = null;
    }
    isPlaying = false;
    playBtn.querySelector('.btn-icon').textContent = '▶️';
    playBtn.querySelector('.btn-label').textContent = 'تشغيل';
    statusDot.classList.remove('playing');
    statusText.textContent = 'جاهز';
}

// ===== AUDIO UTILITIES =====
function makeDistortionCurve(amount) {
    const samples = 44100;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
        const x = (i * 2) / samples - 1;
        curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) /
            (Math.PI + amount * Math.abs(x));
    }
    return curve;
}

function createReverbIR(duration) {
    const sampleRate = audioContext.sampleRate;
    const length = sampleRate * duration;
    const impulse = audioContext.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
        const data = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
        }
    }
    return impulse;
}

function reverseBuffer(buffer) {
    const reversed = audioContext.createBuffer(
        buffer.numberOfChannels,
        buffer.length,
        buffer.sampleRate
    );

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const inputData = buffer.getChannelData(ch);
        const outputData = reversed.getChannelData(ch);
        for (let i = 0; i < buffer.length; i++) {
            outputData[i] = inputData[buffer.length - 1 - i];
        }
    }
    return reversed;
}

// ===== DOWNLOAD =====
async function downloadRecording() {
    if (!recordedBuffer) return;

    showToast('⏳ جاري تجهيز الملف...');

    try {
        const offlineCtx = new OfflineAudioContext(
            recordedBuffer.numberOfChannels,
            recordedBuffer.length * (speedSlider.value / 100),
            recordedBuffer.sampleRate
        );

        let bufferToUse = currentEffect === 'reverse' ? reverseBuffer(recordedBuffer) : recordedBuffer;
        const source = offlineCtx.createBufferSource();
        source.buffer = bufferToUse;
        source.playbackRate.value = (pitchSlider.value / 100) * (speedSlider.value / 100);

        let lastNode = source;

        // Bass
        const bass = offlineCtx.createBiquadFilter();
        bass.type = 'lowshelf';
        bass.frequency.value = 200;
        bass.gain.value = parseFloat(bassSlider.value);
        lastNode.connect(bass);
        lastNode = bass;

        // Treble
        const treble = offlineCtx.createBiquadFilter();
        treble.type = 'highshelf';
        treble.frequency.value = 3000;
        treble.gain.value = parseFloat(trebleSlider.value);
        lastNode.connect(treble);
        lastNode = treble;

        // Volume
        const vol = offlineCtx.createGain();
        vol.gain.value = volumeSlider.value / 100;
        lastNode.connect(vol);
        vol.connect(offlineCtx.destination);

        source.start();
        const rendered = await offlineCtx.startRendering();

        // Convert to WAV
        const wav = audioBufferToWav(rendered);
        const blob = new Blob([wav], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `voice_${currentEffect}_${Date.now()}.wav`;
        a.click();

        URL.revokeObjectURL(url);
        saveRecordingToList(blob);
        showToast('✅ تم التحميل بنجاح!');
    } catch (err) {
        console.error('Download error:', err);
        showToast('❌ حدث خطأ أثناء التحميل');
    }
}

function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    let interleaved;
    if (numChannels === 2) {
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);
        interleaved = new Float32Array(left.length + right.length);
        for (let i = 0; i < left.length; i++) {
            interleaved[i * 2] = left[i];
            interleaved[i * 2 + 1] = right[i];
        }
    } else {
        interleaved = buffer.getChannelData(0);
    }

    const dataLength = interleaved.length * (bitDepth / 8);
    const headerLength = 44;
    const wavBuffer = new ArrayBuffer(headerLength + dataLength);
    const view = new DataView(wavBuffer);

    // WAV Header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
    view.setUint16(32, numChannels * (bitDepth / 8), true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    // Write samples
    let offset = 44;
    for (let i = 0; i < interleaved.length; i++) {
        const sample = Math.max(-1, Math.min(1, interleaved[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
    }

    return wavBuffer;
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

// ===== RECORDINGS LIST =====
function saveRecordingToList(blob) {
    const recording = {
        id: Date.now(),
        name: `تسجيل ${savedRecordings.length + 1}`,
        effect: currentEffect,
        time: new Date().toLocaleTimeString('ar'),
        duration: recordingTimeEl.textContent,
        url: URL.createObjectURL(blob)
    };

    savedRecordings.push(recording);
    renderRecordingsList();
}

function renderRecordingsList() {
    if (savedRecordings.length === 0) {
        recordingsList.innerHTML = `
            <div class="empty-state">
                <span>🎙️</span>
                <p>لا يوجد تسجيلات بعد</p>
                <small>ابدأ بالتسجيل لإضافة تسجيلات هنا</small>
            </div>`;
        return;
    }

    const effectEmojis = {
        normal:'🎤', deep:'👹', chipmunk:'🐿️', robot:'🤖',
        echo:'🏔️', alien:'👽', underwater:'🌊', telephone:'📞',
        cave:'🦇', megaphone:'📢', ghost:'👻', radio:'📻',
        helium:'🎈', darth:'⚔️', chorus:'🎶', reverse:'🔄'
    };

    recordingsList.innerHTML = savedRecordings.map(rec => `
        <div class="recording-item" data-id="${rec.id}">
            <span class="rec-icon">${effectEmojis[rec.effect] || '🎤'}</span>
            <div class="rec-info">
                <div class="rec-name">${rec.name} (${rec.effect})</div>
                <div class="rec-meta">${rec.time} • ${rec.duration}</div>
            </div>
            <div class="rec-actions">
                <button class="rec-action-btn" onclick="playFromList('${rec.url}')" title="تشغيل">▶️</button>
                <button class="rec-action-btn" onclick="downloadFromList('${rec.url}', '${rec.name}')" title="تحميل">💾</button>
                <button class="rec-action-btn delete" onclick="deleteRecording(${rec.id})" title="حذف">🗑️</button>
            </div>
        </div>
    `).join('');
}

function playFromList(url) {
    const audio = new Audio(url);
    audio.play();
    showToast('▶️ جاري التشغيل...');
}

function downloadFromList(url, name) {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.webm`;
    a.click();
}

function deleteRecording(id) {
    savedRecordings = savedRecordings.filter(r => r.id !== id);
    renderRecordingsList();
    showToast('🗑️ تم حذف التسجيل');
}

// ===== TOAST =====
function showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 50);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// ===== FLOATING NOTES =====
function createFloatingNotes() {
    const container = document.getElementById('floating-notes');
    const notes = ['🎵', '🎶', '🎼', '🎧', '🎤', '🎸', '🥁', '🎹', '🎺', '🎷'];

    for (let i = 0; i < 15; i++) {
        const note = document.createElement('div');
        note.className = 'floating-note';
        note.textContent = notes[Math.floor(Math.random() * notes.length)];
        note.style.left = Math.random() * 100 + '%';
        note.style.animationDelay = Math.random() * 10 + 's';
        note.style.animationDuration = 6 + Math.random() * 8 + 's';
        note.style.fontSize = 14 + Math.random() * 20 + 'px';
        container.appendChild(note);
    }
}

// ===== EVENT LISTENERS =====

// Record button
recordBtn.addEventListener('click', () => {
    if (isRecording) return;
    if (isPlaying) stopPlayback();
    startRecording();
});

// Stop button
stopBtn.addEventListener('click', () => {
    stopRecording();
});

// Play button
playBtn.addEventListener('click', () => {
    if (isPlaying) {
        stopPlayback();
    } else {
        playRecording();
    }
});

// Download button
downloadBtn.addEventListener('click', downloadRecording);

// Effect cards
document.querySelectorAll('.effect-card').forEach(card => {
    card.addEventListener('click', () => {
        // Remove active from all
        document.querySelectorAll('.effect-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');

        currentEffect = card.dataset.effect;
        const preset = EFFECTS[currentEffect];

        // Apply preset to sliders
        pitchSlider.value = preset.pitch;
        speedSlider.value = preset.speed;
        bassSlider.value = preset.bass;
        trebleSlider.value = preset.treble;
        reverbSlider.value = preset.reverb;
        distortionSlider.value = preset.distortion;
        tremoloSlider.value = preset.tremolo;
        volumeSlider.value = preset.volume;

        updateAllSliderValues();
        showToast(`🎭 تم اختيار تأثير: ${card.querySelector('.effect-name').textContent}`);
    });
});

// Slider updates
function updateAllSliderValues() {
    document.getElementById('volume-value').textContent = volumeSlider.value + '%';
    document.getElementById('pitch-value').textContent = (pitchSlider.value / 100).toFixed(1) + 'x';
    document.getElementById('speed-value').textContent = (speedSlider.value / 100).toFixed(1) + 'x';
    document.getElementById('bass-value').textContent = bassSlider.value + ' dB';
    document.getElementById('treble-value').textContent = trebleSlider.value + ' dB';
    document.getElementById('reverb-value').textContent = reverbSlider.value + '%';
    document.getElementById('distortion-value').textContent = distortionSlider.value + '%';
    document.getElementById('tremolo-value').textContent = tremoloSlider.value + '%';
}

[volumeSlider, pitchSlider, speedSlider, bassSlider, trebleSlider, reverbSlider, distortionSlider, tremoloSlider].forEach(slider => {
    slider.addEventListener('input', updateAllSliderValues);
});

// Reset button
resetBtn.addEventListener('click', () => {
    currentEffect = 'normal';
    document.querySelectorAll('.effect-card').forEach(c => c.classList.remove('active'));
    document.querySelector('[data-effect="normal"]').classList.add('active');

    const preset = EFFECTS.normal;
    pitchSlider.value = preset.pitch;
    speedSlider.value = preset.speed;
    bassSlider.value = preset.bass;
    trebleSlider.value = preset.treble;
    reverbSlider.value = preset.reverb;
    distortionSlider.value = preset.distortion;
    tremoloSlider.value = preset.tremolo;
    volumeSlider.value = preset.volume;

    updateAllSliderValues();
    showToast('🔄 تم إعادة الضبط');
});

// Window resize
window.addEventListener('resize', setupVisualizer);

// ===== INIT =====
setupVisualizer();
createFloatingNotes();
updateAllSliderValues();