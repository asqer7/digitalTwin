# AAS Twin

AAS 디지털 트윈 쇼케이스 대시보드를 본격적으로 만들기 전에 화면 흐름과 인터랙션을 검증하는 Electron 목업입니다. 기획은 [mockup.md](mockup.md)에 있습니다.

## 실행

```
npm install
npm start          # 개발 실행
npm run dist       # dist/AAS-Twin-<version>-portable.exe 생성
```

`npm start`와 `npm run dist`는 실행 전에 three.js와 폰트를 `src/vendor`로 복사합니다. electron-builder가 `node_modules`의 `examples` 폴더를 패키지에서 빼기 때문입니다.

## 조작

| 입력 | 동작 |
|---|---|
| 왼쪽 드래그 | 회전 |
| 오른쪽 드래그 | 이동 (조립체 주변 반경 안으로 제한) |
| 휠 | 줌 |
| 부품 또는 카드 클릭 | 해당 부품 쪽으로 카메라 회전과 확대 |
| `V` | Solid / Wireframe 전환 |
| `E` | 해체 / 조립 |
| `F` | 포커스 |
| `R` | 시점 초기화 |
| `[` `]` | 왼쪽 / 오른쪽 패널 접기 |
| `Esc` | 선택 해제 |

파일을 끌어다 놓으면 이름만 읽고 내용은 읽지 않습니다. 로딩과 데이터 연결은 시간 기반 목업입니다.

## 구조

- `src/app.js` 화면 흐름, 카드와 지시선, 패널, 드래그 앤 드롭
- `src/scene.js` three.js 장면, 조립체, 해체 애니메이션, 카메라 포커스
- `src/transition.js` 체커보드 모드 전환
- `main.js`, `preload.js` Electron 창과 화면 캡처 IPC
