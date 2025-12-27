const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// 📂 [핵심] 'public' 폴더를 열어서 누구나 접속 가능하게 함
// (index.html, admin.html, script.js, models 폴더 등을 다 여기로 옮겨야 함!)
app.use(express.static(path.join(__dirname, 'public')));

// 📂 images 폴더도 공개 (사진 보여줘야 하니까)
app.use('/images', express.static(path.join(__dirname, 'images')));

// 🔒 관리자 계정 (여기서 설정!)
const ADMIN_ID = "admin";
const ADMIN_PW = "1234";

// 💾 이미지 저장 설정
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'images/'),
    filename: (req, file, cb) => {
        const name = Buffer.from(req.body.name, 'latin1').toString('utf8');
        cb(null, `${name}.jpg`);
    }
});
const upload = multer({ storage: storage });

const db = mysql.createConnection({
    host: 'localhost', user: 'root', password: '1234', database: 'attendance_db'
});
db.connect((err) => err ? console.error('❌ DB 실패') : console.log('✅ DB 연결 성공'));

// --- API 목록 ---

// 1. 출근/퇴근 처리
app.post('/api/attendance', (req, res) => {
    const { name, type } = req.body;
    db.query('SELECT id FROM users WHERE username = ?', [name], (err, users) => {
        if (err || users.length === 0) return res.status(404).json({ success: false, message: '직원 없음' });
        const userId = users[0].id;

        if (type === 'in') {
            const checkQuery = `SELECT log_id FROM attendance_log WHERE user_id = ? AND DATE(check_in_time) = CURDATE() AND check_out_time IS NULL`;
            db.query(checkQuery, [userId], (err, rows) => {
                if (rows.length > 0) return res.json({ success: false, message: '이미 근무 중입니다!' });
                db.query(`INSERT INTO attendance_log (user_id, check_in_time, status) VALUES (?, NOW(), '근무중')`, [userId], 
                    () => res.json({ success: true, message: `${name}님 출근 완료!` }));
            });
        } else {
            const updateQuery = `UPDATE attendance_log SET check_out_time = NOW(), status = '퇴근' WHERE user_id = ? AND check_out_time IS NULL`;
            db.query(updateQuery, [userId], (err, result) => {
                if (result.changedRows === 0) return res.json({ success: false, message: '이미 퇴근했거나 출근 기록이 없습니다.' });
                res.json({ success: true, message: `${name}님 퇴근 처리됨.` });
            });
        }
    });
});

// 2. 직원 등록
app.post('/api/users', upload.single('photo'), (req, res) => {
    db.query('INSERT INTO users (username, department) VALUES (?, ?)', [req.body.name, req.body.department], 
        (err) => {
            if(err) return res.status(500).json({success: false, message: "DB 에러"});
            res.json({success:true, message:'등록됨'});
        });
});

// 3. 직원 목록 조회
app.get('/api/users', (req, res) => { 
    db.query('SELECT * FROM users', (err, r) => res.json(r)); 
});

// 4. 직원 삭제
app.delete('/api/users/:id', (req, res) => {
    const { adminId, adminPw, username } = req.body;
    if (adminId !== ADMIN_ID || adminPw !== ADMIN_PW) return res.status(401).json({ success: false, message: "관리자 정보 틀림" });

    db.query('DELETE FROM users WHERE id = ?', [req.params.id], (err) => {
        if(err) return res.status(500).json({success: false, message: "삭제 실패"});
        const filePath = path.join(__dirname, 'images', `${username}.jpg`);
        fs.unlink(filePath, () => {});
        res.json({ success: true, message: "직원 삭제 완료" });
    });
});

// 5. 실시간 현황
app.get('/api/current', (req, res) => {
    const query = `SELECT users.username, users.department, attendance_log.check_in_time FROM attendance_log JOIN users ON attendance_log.user_id = users.id WHERE attendance_log.check_out_time IS NULL AND DATE(attendance_log.check_in_time) = CURDATE() ORDER BY attendance_log.check_in_time DESC`;
    db.query(query, (err, results) => res.json(results));
});

// 6. 전체 기록 조회
app.get('/api/logs', (req, res) => {
    const query = `SELECT attendance_log.log_id, users.username, users.department, attendance_log.check_in_time, attendance_log.check_out_time, attendance_log.status FROM attendance_log JOIN users ON attendance_log.user_id = users.id ORDER BY attendance_log.check_in_time DESC LIMIT 100`;
    db.query(query, (err, results) => res.json(results));
});

// [server.js 수정] 7. 기록 수정 API (퇴근 시간 수정 기능 추가!)
app.put('/api/logs/:id', (req, res) => {
    const logId = req.params.id;
    const { adminId, adminPw, type, value } = req.body;

    // 🕵️‍♂️ 보안 검사
    if (adminId !== ADMIN_ID || adminPw !== ADMIN_PW) {
        return res.status(401).json({ success: false, message: "관리자 정보가 틀렸습니다!" });
    }

    let query = '';
    // 요청 타입에 따라 쿼리 결정
    if (type === 'status') {
        query = 'UPDATE attendance_log SET status = ? WHERE log_id = ?';
    } else if (type === 'time') {
        // 이건 '출근' 시간 수정
        query = 'UPDATE attendance_log SET check_in_time = ? WHERE log_id = ?';
    } else if (type === 'out_time') {
        // 🔥 [추가됨] 이건 '퇴근' 시간 수정!
        query = 'UPDATE attendance_log SET check_out_time = ? WHERE log_id = ?';
    } else {
        return res.status(400).json({ success: false, message: "잘못된 요청입니다." });
    }

    db.query(query, [value, logId], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: "DB 수정 에러 발생" });
        }
        res.json({ success: true, message: "수정 성공했습니다!" });
    });
});

// 8. 기록 삭제 API
app.delete('/api/logs/:id', (req, res) => {
    const { adminId, adminPw } = req.body;
    if (adminId !== ADMIN_ID || adminPw !== ADMIN_PW) return res.status(401).json({ success: false, message: "관리자 정보 틀림" });

    db.query('DELETE FROM attendance_log WHERE log_id=?', [req.params.id], 
        (err) => {
            if(err) return res.status(500).json({success:false, message:"삭제 실패"});
            res.json({success:true, message:"삭제 완료"});
        });
});

app.listen(3000, () => console.log('🚀 서버 재시작 완료!'));