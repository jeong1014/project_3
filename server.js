const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();

app.use(cors()); // 보안 해제 (프론트에서 요청 허용)
app.use(express.json()); // JSON 데이터 읽기 허용

// 1. 데이터베이스 연결 설정
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '1234', // <-- 여기 비밀번호 꼭 확인!
    database: 'attendance_db'
});

db.connect((err) => {
    if (err) {
        console.error('DB 연결 실패:', err);
    } else {
        console.log('✅ DB 연결 성공!');
    }
});

// 2. 출근 기록 API (프론트에서 이 주소로 요청을 보냄)
app.post('/api/attendance', (req, res) => {
    const { name } = req.body; // 프론트에서 보낸 이름 ('Jeong')
    console.log(`출근 요청 받음: ${name}`);

    // 이름을 이용해 user_id 찾기
    const findUserQuery = 'SELECT id FROM users WHERE username = ?';
    db.query(findUserQuery, [name], (err, results) => {
        if (err) return res.status(500).send(err);
        if (results.length === 0) return res.status(404).send('사용자를 찾을 수 없음');

        const userId = results[0].id;

        // 출근 기록 저장
        const insertLogQuery = `
            INSERT INTO attendance_log (user_id, check_in_time, status)
            VALUES (?, NOW(), '출근')
        `;
        db.query(insertLogQuery, [userId], (err, result) => {
            if (err) return res.status(500).send(err);
            console.log(`✅ ${name}님 출근 처리 완료!`);
            res.send({ success: true, message: `${name}님 출근 환영합니다!` });
        });
    });
});

// 3. 서버 실행
app.listen(3000, () => {
    console.log('🚀 서버가 3000번 포트에서 실행 중...');
});