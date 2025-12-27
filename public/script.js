const video = document.getElementById('video');
const powerBtn = document.getElementById('power-btn');
const offScreen = document.getElementById('off-screen');
const modeBtn = document.getElementById('mode-btn');
const toast = document.getElementById('toast'); // 알림창

let isPowerOn = false;
let isCheckedIn = false;
let detectionInterval;
let currentMode = 'in';

// 🎵 삐빅 소리 데이터 (mp3 파일 없어도 됨!)
const beepSound = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU"); 
// (실제 삐빅 소리는 조금 더 긴 코드가 필요하지만, 간단한 비프음 예시입니다. 
//  더 좋은 소리를 원하면 'beep.mp3' 파일을 images 폴더에 넣고 new Audio('beep.mp3')로 바꾸세요!)
//  여기서는 편의상 짧은 비프음 코드를 넣거나, 아래처럼 실제 파일 경로를 쓰는 게 좋습니다.
//  우선 테스트용으로 '짧은 비프음'을 낼 수 있게 간단히 처리하거나 
//  PC 시스템음이 안 난다면 mp3 파일을 구해서 넣는 걸 추천합니다.
//  지금은 코드가 너무 길어지니 로직만 넣겠습니다.

// 🤖 모델 로딩
Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('./models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('./models'),
    faceapi.nets.ssdMobilenetv1.loadFromUri('./models')
]).then(() => {
    console.log("🤖 모델 로딩 완료!");
});

function togglePower() {
    isPowerOn = !isPowerOn;
    if (isPowerOn) {
        powerBtn.classList.add('on');
        offScreen.style.display = 'none';
        startVideo();
    } else {
        powerBtn.classList.remove('on');
        offScreen.style.display = 'flex';
        stopVideo();
    }
}

function toggleMode() {
    if (currentMode === 'in') {
        currentMode = 'out';
        modeBtn.innerText = "🔴 퇴근 모드";
        modeBtn.className = "out";
    } else {
        currentMode = 'in';
        modeBtn.innerText = "🟢 출근 모드";
        modeBtn.className = "in";
    }
}

function startVideo() {
    navigator.mediaDevices.getUserMedia({ video: {} })
        .then(stream => { video.srcObject = stream; })
        .catch(err => console.error("카메라 에러:", err));
}

function stopVideo() {
    const stream = video.srcObject;
    if (stream) { stream.getTracks().forEach(track => track.stop()); video.srcObject = null; }
    clearInterval(detectionInterval);
    const canvas = document.querySelector('canvas');
    if (canvas) canvas.remove();
}

video.addEventListener('play', async () => {
    if (!isPowerOn) return;
    const canvas = faceapi.createCanvasFromMedia(video);
    document.getElementById('camera-wrapper').append(canvas);
    const displaySize = { width: video.clientWidth, height: video.clientHeight };
    faceapi.matchDimensions(canvas, displaySize);
    const labeledFaceDescriptors = await loadLabeledImages();
    const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);

    detectionInterval = setInterval(async () => {
        if (!isPowerOn) return;
        const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptors();
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        const results = resizedDetections.map(d => faceMatcher.findBestMatch(d.descriptor));

        results.forEach((result, i) => {
            const box = resizedDetections[i].detection.box;
            const drawBox = new faceapi.draw.DrawBox(box, { label: result.toString() });
            drawBox.draw(canvas);
            
            if (result.label !== 'unknown' && !isCheckedIn) {
                recordAttendance(result.label);
            }
        });
    }, 100);
});

// script.js 안에 있는 showToast 함수를 이걸로 교체!

function showToast(message, isError = false) {
    // 1. 🎨 화면 알림부터 먼저 띄우기 (이게 제일 중요하니까!)
    const toast = document.getElementById('toast');
    if (toast) {
        toast.innerText = message;
        toast.style.backgroundColor = isError ? "rgba(255, 50, 50, 0.9)" : "rgba(50, 200, 50, 0.9)";
        toast.className = "show";

        // 3초 뒤에 사라지게
        setTimeout(() => { 
            toast.className = toast.className.replace("show", ""); 
        }, 3000);
    } else {
        console.error("토스트 요소를 찾을 수 없음! HTML에 <div id='toast'>가 있는지 확인하세요.");
    }

    // 2. 🎵 소리 재생 (안전장치 추가: 소리 안 나도 멈추지 않게)
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // 아이폰은 오디오가 'suspended(일시정지)' 상태로 시작함 -> 깨워야 함
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        // 성공(높은음), 실패(낮은음)
        if (isError) {
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
        } else {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
            oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime + 0.1);
        }

        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.2);

    } catch (e) {
        // 아이폰이 소리를 막아도, 에러만 찍고 시스템은 계속 돌아가게 함
        console.log("브라우저 정책으로 소리가 차단되었습니다 (화면 알림은 뜸):", e);
    }
}

function recordAttendance(name) {
    isCheckedIn = true;
    const actionName = currentMode === 'in' ? "출근" : "퇴근";

    fetch('https://unanachronous-tacketed-orpha.ngrok-free.dev/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, type: currentMode })
    })
    .then(res => res.json())
    .then(data => {
        // alert 대신 showToast 사용!
        if(data.success) {
            showToast(`✅ [${actionName}] ${data.message}`);
        } else {
            showToast(`⚠️ ${data.message}`, true); // 실패 시 빨간색
        }
        setTimeout(() => { isCheckedIn = false; }, 5000);
    })
    .catch(err => {
        console.error(err);
        showToast("❌ 서버 연결 실패", true);
        isCheckedIn = false;
    });
}

async function loadLabeledImages() {
    const response = await fetch('https://unanachronous-tacketed-orpha.ngrok-free.dev/api/users');
    const users = await response.json();
    return Promise.all(
        users.map(async user => {
            const label = user.username;
            try {
                const img = await faceapi.fetchImage(`https://unanachronous-tacketed-orpha.ngrok-free.dev/images/${label}.jpg?t=${new Date().getTime()}`);
                const detections = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
                return detections ? new faceapi.LabeledFaceDescriptors(label, [detections.descriptor]) : new faceapi.LabeledFaceDescriptors(label, []);
            } catch (e) { return new faceapi.LabeledFaceDescriptors(label, []); }
        })
    );
}