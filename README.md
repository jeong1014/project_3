출퇴근용 얼굴인식 시스템 입니다.


구분       기술 이름             설명 (역할)<br />
Frontend  HTML5 / CSS3        "사용자 화면 구성 (키오스크 UI, 반응형 디자인)"<br />
         JavaScript (Vanilla) "화면 로직 제어, 카메라 제어, 비동기 통신(Fetch API)"<br />
AI        ML,face-api.js,     (핵심) 브라우저에서 실시간으로 얼굴을 탐지하고 분석하는 AI 모델<br />
Backend   Node.js              자바스크립트로 서버를 돌리는 런타임 환경<br />
          Express.js           서버를 쉽게 만들게 도와주는 웹 프레임워크 (API 구축)<br />
Database  MySQL                직원 정보와 출퇴근 로그를 저장하는 관계형 데이터베이스<br />
Infra     Ngrok                로컬 서버를 외부(아이폰 등)에서 접속할 수 있게 뚫어주는 터널링 도구<br />
<br />
수정할점<br />
<br />
1. 얼굴인식 데이터를 학습하는 부분을 얼굴인식 페이지를 로딩할 때가 아닌 업로드 하는 시점으로 바꾸기.<br />
2. 지금의 ngrok는 무료버전이라서 ip가 바뀌면 바꿔줘야함
