# 목표

향후 진행할 AAS 디지털 트윈 쇼케이스용 대시보드 형식의 electron 앱을 본격적으로 개발하기에 앞서, 목업 앱을 만들려고 합니다.

# 기능

다음과 같은 기능의 목업 디스플레이가 제공되어야 합니다.

- landing 화면 - 아직 데이터 모델과 데이터를 불러오지 않은 화면, AAS 모델 데이터를 drag and drop으로 업로드하며, loading 과정도 목업으로 구현. 우선 아무 파일이나 드래그 앤 드롭하면 AAS 모델 load 화면으로 넘어가게 구현하고, 실제 파일 내용은 읽지 않음
- AAS 모델 load 화면 -
  - 목업용으로, 화면에 3D 모델(간단한 회색 정육면체)를 isometric view로 띄움. 
  - cube의 top/left/front에 각각 글래스모피즘으로 구현된 card가 선으로 연결되어 표시됨. 
  - card의 텍스트는 2줄로, 두 줄 다 placeholder. 위쪽 줄이 더 위계가 높아야 함. 
  - 클릭 시 cube가 약간 회전하며 확대됨. 
  - 해당 화면에서 드래그 앤 드롭으로 데이터 업로드 가능하나, 목업으로 구현
  - Solid view / Wireframe view 전환이 가능해야 함
    - Solid view는 claude 아티팩트의 pslte 컬러팔레트를 참고하되, 해당 디자인 시스템 전체를 반드시 준수할 필요는 없음.
    - Wireframe view는 digital twin의 wireframe에서 주로 사용하는 형광색의 터키색과 black 계열의 바탕을 사용. 
    - 두 모드는 마치 dark mode/light 모드처럼 동작
    - 두 모드를 오갈 때는 마치 ppt의 checkerboard 트랜지션과 같은 효과가 화면 전반적으로 보여야 하나, 이를 더 잘게 쪼개고, 색상을 각 모드의 강조색인 주황색/형광터키색과 배경색인 아이보리/black을 기반으로 하며, 체커보드 트랜지션 효과를 현대적으로 재해석
      - 사실상 이번 목업에서 가장 중요한 포인트
    - 두 모드 모두 큐브를 해체할 수 있는 compose/decompose 버튼이 있어야 함.
      - 완전히 해체되서 멀리 떨어진다기보다, 하기 레퍼런스를 참고한 정도로 조립된 게 살짝 떨어지는 느낌
        - [MOM, I'LL FIX IT - Andrii Horulko](https://kr.pinterest.com/pin/491807221815099107/)
        - [cyber 💿에 있는 핀](https://kr.pinterest.com/pin/811633164117335710/)
        - [Ps4](https://kr.pinterest.com/pin/839147343068524441/)
  - 3D 게임처럼 끌어서 이동/회전 조작이 가능해야 함
- 기타 상단/side pannel/하단 등은 맡기되, 실제 기능 구현 시 UI/UX의 통일성(예 : 뒤로가기 버튼의 위치, 정보가 표시되는 곳의 통일성 등)을 고려하여 적절히 배치

# 디자인

- **조작감이 쫄깃해야 함**
- **트랜지션, 애니메이션, 디자인의 완성도가 높아야 함**
- 디자인 레퍼런스 : 
  - [Alibaba Cloud Design 2019 Yearbook Part 3 - Alibaba Design](https://kr.pinterest.com/pin/1087337903784272394/)
  - [Parking Lots Digital Twin](https://kr.pinterest.com/pin/1057923768696691757/)
  - [Scad에 있는 핀](https://kr.pinterest.com/pin/784118985156330238/)
  - [Network Operations Dashboard UI - OptivionAi 3D Tower Monitoring](https://kr.pinterest.com/pin/571112796519042930/)
  - [factory monitor system - blues jazz](https://kr.pinterest.com/pin/801570433708056267/)
  - [UI에 있는 핀](https://kr.pinterest.com/pin/96053404552530268/)
  - [CG Generalist ShowReel 2020 - Artem Patyn](https://kr.pinterest.com/pin/729653577133585859/)
- 앱 아이콘은 cube를 isometric view로 본 모습, 왼쪽 절반은 주황색 solid, 오른쪽 절반은 형광터키색 wireframe

# 구현

- portable windows용 exe만 목표로 함

# 제약

- 가운데점(·) 절대 사용 금지
- Avoid unnecessary secondary labels and descriptions. Let the layout do the explaining.

