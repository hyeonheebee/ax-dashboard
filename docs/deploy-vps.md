# 직원용 AX 사이트 — VPS 배포 가이드

Guide Check Bot이 돌고 있는 VPS에 정적 서빙으로 올린다. 서버 앱 불필요.

## 1) 최초 1회 설정 (VPS에서)

```bash
sudo git clone https://github.com/hyeonheebee/ax-dashboard.git /opt/ax-dashboard
sudo tee /etc/nginx/sites-available/ax-site <<'EOF'
server {
    listen 8080;                     # Guide Check Bot 포트와 겹치지 않게 조정
    root /opt/ax-dashboard;
    index index.html;
    location / { try_files $uri $uri/ =404; }
    add_header Cache-Control "no-cache";
}
EOF
sudo ln -s /etc/nginx/sites-available/ax-site /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 2) 자동 갱신 (cron, 1분마다 pull)

```bash
( crontab -l 2>/dev/null; echo '* * * * * cd /opt/ax-dashboard && git pull --ff-only >> /var/log/ax-pull.log 2>&1' ) | crontab -
```

이후 갱신 경로:
- 프로젝트·채널 데이터: 회사 컴 수집기 push → 1분 내 반영 (기존 파이프라인)
- 참석 기록: attendance.json 수정·push → 1분 내 반영
- 사이트 코드: push만 하면 배포 끝

## 3) 직원 공유 URL

`http://<VPS주소>:8080/site/` — 슬랙 채널 북마크에 등록 권장.
(루트 `/`는 운영 현황판이므로 직원 공유 링크는 반드시 `/site/`로.)

## 4) 추후 HTTPS/도메인 (Google 로그인 대비)

Google 로그인(seoulaihub.kr 계정)을 붙이려면 도메인 + HTTPS(Let's Encrypt)가 선행 조건.
그 시점에 `site/identity.js`만 Google Identity Services 기반으로 교체하면 된다.
