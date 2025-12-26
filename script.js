const video = document.getElementById('video');
const startBtn = document.getElementById('start-btn');

// 중복 출근 방지용 깃발 (이게 true면 더 이상 요청 안 보냄)
let isCheckedIn = false;

// 모델 로딩
Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('./models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('./models'),
    faceapi.nets.ssdMobilenetv1.loadFromUri('./models')
]).then(start);

async function start() {
    console.log("모델 로딩 완료! 데이터 학습 중...");
    const labeledFaceDescriptors = await loadLabeledImages();
    const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);
    
    console.log("학습 완료! 버튼을 누르세요.");
    
    startBtn.addEventListener('click', () => {
        navigator.mediaDevices.getUserMedia({ video: {} })
            .then(stream => { video.srcObject = stream; })
            .catch(err => console.error(err));
    });

    video.addEventListener('play', () => {
        const canvas = faceapi.createCanvasFromMedia(video);
        document.getElementById('video-container').append(canvas);
        const displaySize = { width: video.width, height: video.height };
        faceapi.matchDimensions(canvas, displaySize);

        setInterval(async () => {
            const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceDescriptors();
            
            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

            const results = resizedDetections.map(d => faceMatcher.findBestMatch(d.descriptor));

            results.forEach((result, i) => {
                const box = resizedDetections[i].detection.box;
                const drawBox = new faceapi.draw.DrawBox(box, { label: result.toString() });
                drawBox.draw(canvas);

                // 🔥 [핵심 기능] Jeong이 인식되었고, 아직 출근 안 찍혔다면?
                if (result.label === 'Jeong' && !isCheckedIn) {
                    recordAttendance('Jeong'); // 출근 기록 함수 호출!
                }
            });
        }, 100);
    });
}

// 서버에 출근 기록 보내는 함수
function recordAttendance(name) {
    isCheckedIn = true; // 깃발 꽂기 (중복 방지)
    
    fetch('http://localhost:3000/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert(`✅ ${data.message}`); // 화면에 알림창 띄우기
            console.log("출근 기록 성공!");
        }
    })
    .catch(err => {
        console.error("서버 통신 에러:", err);
        isCheckedIn = false; // 실패하면 다시 시도할 수 있게 깃발 뽑기
    });
}

// (사진 로딩 함수는 그대로 유지)
function loadLabeledImages() {
    const labels = ['Jeong'];
    return Promise.all(
        labels.map(async label => {
            const descriptions = [];
            const img = await faceapi.fetchImage(`./images/${label}.jpg`);
            const detections = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
            if (!detections) throw new Error(`${label} 얼굴 없음`);
            descriptions.push(detections.descriptor);
            return new faceapi.LabeledFaceDescriptors(label, descriptions);
        })
    );
}