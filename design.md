# 현대 디자인 시스템 (Hyundai Design System) — 작업 가이드

> **이 문서의 목적**: 이 프로젝트(`biz`)에서 일하는 모든 AI/개발자가 UI를 추가·수정할 때 **일관된 품질**을 보장하기 위한 단일 소스 오브 트루스(Single Source of Truth). 타이포그래피·컬러·컴포넌트·모듈 모든 층위에서 이 문서의 규칙을 따르면 현대자동차 디자인 시스템(HyundaiDS_Web_Design_Kit v1.1.0 + ICT DS)과 정합성이 맞는 결과가 나온다.
>
> **원칙**: 이 문서와 `src/app/globals.css`의 정의가 충돌하면 **globals.css가 정답**. 이 문서가 맞지 않으면 문서를 갱신할 것.

---

## 0. 황금률 (Golden Rules) — 반드시 지킬 것

1. **색은 하드코딩하지 말고 CSS 변수 또는 지정된 Hex만 사용**. `#002C5F`, `#00AAD2`, `#121416`, `#EFEFF0` 등 이 문서에 명시된 값만 허용.
2. **Primary Navy(`#002C5F`)는 강조 CTA·헤더·활성 상태에만**. 넓은 면적 배경으로 쓰지 말 것.
3. **Neon(Cyan/Magenta/Green/Red/Amber) glow 효과는 금지**. 현대 테마에서는 `box-shadow: none` 또는 미묘한 `0 1px 3px rgba(0,0,0,0.06)`만.
4. **폰트는 HyundaiSansTextKR (body) / HyundaiSansHeadKR (heading) 고정**. 다른 폰트 import 금지.
5. **최소 폰트 크기 12px**. 11px 이하 금지 (가독성).
6. **모든 간격·크기는 8px 그리드 배수** (4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 56, 64).
7. **Border-radius는 4 / 8 / 40(pill) 세 가지 중 하나**. 임의 값 사용 금지.
8. **대문자/`text-transform: uppercase`는 네비게이션 라벨 트래킹(예: 사이드바 `TICKETS`)에서만** 사용. 본문은 자연스러운 대소문자 유지.
9. **애니메이션은 목적이 있을 때만**. 네온 펄스·깜빡임·글로우는 기본적으로 끄고, 꼭 필요한 상태(pending, 진행 중)에만 차분한 `opacity` 변화로 제한.
10. **shadcn/radix의 무분별한 variant 확장 금지**. 버튼은 Primary / Secondary / Tertiary / Danger / Icon 5종만.

---

## 1. 타이포그래피 (Typography)

### 1.1 폰트 패밀리

| 용도 | 패밀리 | 경로 |
|---|---|---|
| Body | `HyundaiSansTextKR` (Regular 400, Medium 500) | `/public/fonts/hyundai/HyundaiSansTextKR*.woff2` |
| Heading | `HyundaiSansHeadKR` (Regular 400, Medium 500) | `/public/fonts/hyundai/HyundaiSansHeadKR*.woff2` |
| Monospace | `JetBrains Mono`, `Fira Code`, `Consolas` | system |

**CSS 적용**:
```css
body, html { font-family: 'HyundaiSansTextKR', 'Pretendard', -apple-system, 'Segoe UI', sans-serif; }
h1, h2, h3, .font-bold, .font-semibold { font-family: 'HyundaiSansHeadKR', 'HyundaiSansTextKR', sans-serif; }
```

### 1.2 스케일 (Type Scale)

| 역할 | Size | Weight | Color | line-height | letter-spacing | 비고 |
|---|---|---|---|---|---|---|
| Page Title (H1) | 28px | 500 (Medium) | `#121416` | 1.3 | -0.02em | 페이지 최상단 |
| Section Heading (H2) | 22px | 500 | `#121416` | 1.35 | -0.01em | 섹션 구분 |
| Sub Heading (H3) | 18px | 500 | `#121416` | 1.4 | 0 | 카드/모듈 제목 |
| Card/Item Title | 15px | 500 | `#121416` | 1.5 | 0 | 카드 내 소제목 |
| Body | 14px | 400 | `#535356` | 1.6 | 0 | 기본 본문 |
| Body Strong | 14px | 500 | `#121416` | 1.6 | 0 | 강조 본문 |
| Secondary | 13px | 400 | `#69696E` | 1.5 | 0 | 보조 정보 |
| Caption | 12px | 400 | `#929296` | 1.45 | 0 | 라벨, 메타 |
| Micro / Tracking Label | 11px → **12px 강제** | 500 | `#002C5F` | 1 | 0.24em, UPPERCASE | 트래킹 라벨(사이드바 `TICKETS` 등) |

**최소 폰트 크기는 12px.** 디자인상 11px이 필요해도 `font-size: 12px`로 올리고 `letter-spacing: 0.24em` + `UPPERCASE`로 존재감 조절.

### 1.3 Markdown/Rich Text 내부 규칙
- H1 `1.5em / 700` → 색 `#002C5F`, 하단 1px 보더
- H2 `1.25em / 600` → 색 `#002C5F`
- H3 `1.1em / 600` → 색 `#121416`
- p `line-height: 1.8`
- code `background: #F5F5F5, padding: 0.15em 0.4em, radius: 3px`

---

## 2. 컬러 토큰 (Color Tokens)

### 2.1 Primary & Accent

| 토큰 | Hex | RGB | 사용처 |
|---|---|---|---|
| **Primary Navy** | `#002C5F` | 0, 44, 95 | 주요 CTA 버튼 배경·텍스트, 헤더, 활성 상태, 사이드바 배경 |
| Primary Hover | `#3D5F85` | 61, 95, 133 | Primary 버튼 hover |
| Primary Active | `#1F4572` | 31, 69, 114 | Primary 버튼 pressed |
| **Active Blue (Accent)** | `#00AAD2` | 0, 170, 210 | 선택·포커스·보조 강조 |
| **Progressive Blue (Info)** | `#0672ED` | 6, 114, 237 | 정보성 강조, 링크성 요소 |
| Progressive Blue Alt | `#00809E` | 0, 128, 158 | 보조 차트, 3차 강조 |
| **Warning Amber** | `#EC8E01` | 236, 142, 1 | 주의, 경고 |
| **Error Red** | `#E81F2C` | 232, 31, 44 | 에러, 파괴적 액션 |

### 2.2 Greyscale (10단계 — Hyundai ICT DS)

| 토큰 | Hex | 주 용도 |
|---|---|---|
| `--color-grey-90` | `#121416` | 기본 텍스트(최고 명암) |
| `--color-grey-80` | `#3A3A3C` | 부제목, 강한 텍스트 |
| `--color-grey-70` | `#535356` | 본문 텍스트 |
| `--color-grey-60` | `#69696E` | 보조 텍스트, muted-foreground |
| `--color-grey-50` | `#929296` | placeholder, 비활성 |
| `--color-grey-40` | `#EAEAEB` | 입력 보더, 구분선 |
| `--color-grey-30` | `#EFEFF0` | 카드 보더, 섬세한 구분 |
| `--color-grey-20` | `#F5F5F5` | hover 배경 |
| `--color-grey-10` | `#FAFAFB` | 페이지 배경, 교차행 |
| white | `#FFFFFF` | 카드, 주 표면 |

### 2.3 시맨틱 배경

| 토큰 | Hex | 용도 |
|---|---|---|
| `--color-info-bg` | `#EDF2FF` | 정보 메시지 배경 |
| `--color-warning-bg` | `#FFF5DD` | 경고 메시지 배경 |
| `--color-error-bg` | `#FFF1F3` | 에러 메시지 배경 |
| `--color-success-bg` | `#F0FCFF` | 성공 메시지 배경 |

### 2.4 Surface & Border

| 용도 | 값 |
|---|---|
| 페이지 배경 | `#FAFAFB` |
| 카드 배경 | `#FFFFFF` |
| 섹션 보더(섬세) | `#EFEFF0` |
| 입력 보더 | `#EAEAEB` |
| Divider | `#EFEFF0` 또는 `#EAEAEB` |
| Hover 배경(중성) | `#F5F5F5` |
| Hover 배경(강조) | `#F6F9FE` (옅은 블루 틴트) |
| 선택 활성 배경 | `#F5F7F9` (사이드바 active), `#F6F9FE` (블루 틴트) |

### 2.5 차트 팔레트

```
--chart-1: #002C5F  (Navy — primary)
--chart-2: #00AAD2  (Active Blue — secondary)
--chart-3: #00809E  (Progressive Alt — tertiary)
--chart-4: #EC8E01  (Amber — highlight)
--chart-5: #0672ED  (Progressive — quaternary)
```

순서대로 사용. 5색 이상 필요하면 위 색상의 60% opacity 버전을 6~10으로 사용.

### 2.6 Ring (포커스 링) & Selection

| 토큰 | 값 |
|---|---|
| `--ring` | `rgba(0, 44, 95, 0.3)` |
| focus outline | `2px solid #002C5F`, `outline-offset: 2px` |
| 포커스 글로우 | `0 0 0 2px rgba(0, 44, 95, 0.08)` |
| 텍스트 selection | 기본값 (브라우저 위임) |

---

## 3. 모양·공간 (Shape & Spacing)

### 3.1 Border Radius

| 토큰 | px | 사용처 |
|---|---|---|
| `rounded-sm` (≈ radius × 0.6) | 4px | 버튼, 입력, 작은 카드 |
| `rounded-md` (≈ radius × 0.8) | 6px | 중간 모듈 |
| `rounded-lg` (base radius) | 8px | 카드, 다이얼로그 |
| `rounded-xl` | 11.2px | 큰 모듈 |
| `rounded-2xl` | 14.4px | 히어로 섹션 |
| pill | **40px** | 뱃지, 칩 |
| full | 9999px | 아바타, 점 인디케이터 |

> **원칙**: 대부분의 UI는 **4px 또는 8px** 두 가지만 써도 충분. pill은 뱃지 전용.

### 3.2 Spacing (8px Grid)

| 토큰 | px | 용도 |
|---|---|---|
| `gap-1` | 4 | 아이콘-텍스트 최소 간격 |
| `gap-2` | 8 | 인라인 요소 사이 |
| `gap-3` | 12 | 카드 내부 밀집 요소 |
| `gap-4` | 16 | 섹션 내부 표준 |
| `gap-5` | 20 | 카드 간 |
| `gap-6` | 24 | 섹션 간 |
| `gap-8` | 32 | 페이지 섹션 간 |

Padding은 카드/모듈 기준:
- 컴팩트: `12px 16px`
- 표준: `16px 20px` (가장 많이 사용)
- 넓은: `20px 24px` 또는 `24px 28px`
- 페이지 컨테이너: `24px 32px` (1280px 이상은 `32px 48px`)

### 3.3 Elevation (Shadow)

| 단계 | 값 | 용도 |
|---|---|---|
| 0 (평면) | `none` | 기본 카드, 패널 |
| 1 (낮음) | `0 1px 4px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)` | 약간 떠 있는 카드 |
| 2 (중간) | `4px 4px 10px rgba(18,20,22,0.12)` | 드롭다운, 툴팁 |
| 3 (높음) | `6px 6px 14px rgba(18,20,22,0.20)` | 알림, 토스트 |
| 4 (최상) | `0 24px 28px rgba(18,20,22,0.40)` | 모달, 다이얼로그 |

> **네온 glow(`box-shadow: 0 0 20px cyan`) 금지**. 현대 테마는 차분한 평면+미세 그림자가 원칙.

---

## 4. 컴포넌트 가이드

### 4.1 버튼 (Button)

5종 계층(Primary / Secondary / Tertiary / Danger / Icon). **이외의 variant를 만들지 말 것**.

#### Primary (Navy Filled)
```css
background: #002C5F; color: #FFFFFF; border: 1px solid #002C5F;
font-weight: 500; padding: 10px 20px; min-height: 40px; border-radius: 4px;
```
- hover: `background: #3D5F85`
- active: `background: #1F4572`
- disabled: `background: #EAEAEB; color: #929296; cursor: not-allowed`

#### Secondary (Outline)
```css
background: #FFFFFF; color: #002C5F; border: 1px solid #002C5F;
```
- hover: `background: #F5F7F9`

#### Tertiary (Ghost)
```css
background: transparent; color: #535356; border: none;
```
- hover: `background: #F5F5F5; color: #121416`

#### Danger
```css
background: #FFFFFF; color: #E81F2C; border: 1px solid #E81F2C;
```
- hover: `background: #FFF1F3`

#### Icon Button
- `icon-xs`: 24×24 / `icon-sm`: 28×28 / `icon`: 32×32 / `icon-lg`: 36×36
- 배경 transparent, hover `#F5F5F5`

**사이즈**:
| 사이즈 | 높이 | Padding-X | font-size |
|---|---|---|---|
| sm | 32px | 12px | 13px |
| md (default) | 40px | 20px | 14px |
| lg | 48px | 24px | 15px |

### 4.2 입력 (Input)

```css
height: 32px; padding: 6px 12px;
background: #FFFFFF;
border: 1px solid #EAEAEB; border-radius: 4px;
color: #121416; font-size: 14px;
placeholder-color: #929296;
transition: border-color 0.15s;
```
- focus: `outline: 2px solid #002C5F; outline-offset: 2px; box-shadow: 0 0 0 2px rgba(0,44,95,0.08)`
- error: `border-color: #E81F2C; background: #FFF1F3`
- disabled: `background: #EAEAEB; color: #929296`

**라벨 구조**:
```
<label> (12px, 500, #535356, margin-bottom: 6px)
<input>
<caption> (12px, 400, #69696E) — 도움말
```

### 4.3 카드 (Card)

```css
background: #FFFFFF;
border: 1px solid #EFEFF0;
border-radius: 8px;
padding: 20px;  /* 또는 16px / 24px */
box-shadow: 0 1px 4px rgba(0,0,0,0.06);  /* 선택 */
```

**섹션 카드 (헤더 포함)**:
```
┌──────────────────────────┐
│ [Header: border-bottom]  │  padding: 12px 16px; border-bottom: 1px solid #EFEFF0
│  Title (14px, 600, navy) │
├──────────────────────────┤
│ [Body]                   │  padding: 16px 20px
│                          │
└──────────────────────────┘
```

### 4.4 뱃지 (Badge)

```css
display: inline-flex; align-items: center;
height: 20px; padding: 0 8px;
border-radius: 40px;  /* pill */
font-size: 12px; font-weight: 500;
```

**변형**:
| variant | bg | text | border |
|---|---|---|---|
| default (Navy) | `#002C5F` | `#FFFFFF` | `#002C5F` |
| info | `#EDF2FF` | `#0672ED` | `#0672ED` |
| success | `#F0FCFF` | `#00809E` | `#00809E` |
| warning | `#FFF5DD` | `#EC8E01` | `#EC8E01` |
| danger | `#FFF1F3` | `#E81F2C` | `#E81F2C` |
| neutral | `#F5F5F5` | `#535356` | `#EAEAEB` |
| ghost | transparent | `#535356` | `#EAEAEB` |

### 4.5 다이얼로그/모달 (Dialog)

```css
background: #FFFFFF; border-radius: 8px;
padding: 24px; max-width: calc(100% - 2rem);
box-shadow: 0 24px 28px rgba(18,20,22,0.40);
```
- Overlay: `background: rgba(0,0,0,0.1); backdrop-filter: blur(2px)`
- 헤더: 제목(18px, 500) + 닫기 버튼(icon-sm)
- 푸터: 오른쪽 정렬, 버튼 간 `gap: 8px`, Secondary → Primary 순서

### 4.6 표 (Table)

```
Header:  background #FAFAFB | color #535356 | font 12px 500 | border-bottom 1px #EFEFF0 | padding 8px 12px
Row:     background #FFFFFF | color #121416 | font 14px 400 | border-bottom 1px #EFEFF0 | padding 10px 12px
Row hover: background #F5F5F5
Row alt:   background #FAFAFB  (교차행)
```

### 4.7 사이드바 / 네비게이션

**전역 사이드바** (주: 현대 시스템의 사이드바는 **Navy 배경 / White 텍스트**):
- 배경: `#002C5F`
- 기본 텍스트: `#FFFFFF`
- active 아이템: 좌측 보더 3px `#00AAD2` + 배경 `rgba(0, 170, 210, 0.12)`
- inactive hover: 배경 `rgba(255, 255, 255, 0.08)`
- 라벨 트래킹: 12px, letter-spacing 0.24em, UPPERCASE (예: `TICKETS`)

**컨테이너 내부 서브 네비** (흰 배경):
- 배경: `#FFFFFF`, 보더: `1px #EFEFF0`
- active: 좌측 보더 `#002C5F`, 배경 `#F5F7F9`, 텍스트 `#002C5F`
- inactive: 텍스트 `#535356`

### 4.8 탭 (Tabs)

```
TabsList:    border-bottom 1px #EFEFF0, background transparent
TabsTrigger: padding 10px 16px, font 14px 500, color #69696E
  active:    color #002C5F, border-bottom 2px #002C5F
  hover:     color #121416
```

### 4.9 드롭존 / 파일 업로드

```css
border: 2px dashed #EAEAEB;
background: #FAFAFB;
border-radius: 8px;
padding: 32px 24px;
text-align: center;
color: #69696E;
transition: all 0.15s;
```
- drag-over: `border-color: #002C5F; background: #F6F9FE; color: #002C5F`

### 4.10 다이브 (Diff) / 비교 뷰

```
추가 라인:   background #E6FFEC | 좌측 보더 2px #00809E
삭제 라인:   background #FFEEF0 | 좌측 보더 2px #E81F2C
변경 라인:   background #FFF8C5 | 좌측 보더 2px #EC8E01
동일 라인:   배경 없음 | 색 #535356
라인 번호:   color #929296, font 12px JetBrains Mono
```

### 4.11 공통 상태

| 상태 | 처리 |
|---|---|
| **Focus** | `outline: 2px solid #002C5F; outline-offset: 2px` |
| **Hover** | 배경 옵션 1: `#F5F5F5` (중성) / 옵션 2: `rgba(0,170,210,0.08)` (옅은 블루) |
| **Active/Pressed** | `transform: translateY(1px); opacity: 0.95` |
| **Disabled** | `background: #EAEAEB !important; color: #929296; cursor: not-allowed` |
| **Loading** | 스피너 대신 차분한 `opacity: 0.6` + 커서 `wait` |

### 4.12 애니메이션 & 모션

- 기본 전환: `transition: all 0.15s ease`
- 긴 동작: 200~300ms
- **허용되는 애니메이션**:
  - `file-pending-pulse`: 0.8s `opacity: 1 ↔ 0.25` (첨부 대기 표시)
  - `domain-pulse`: 2s 차분한 배경 변화 (실시간 업데이트)
- **금지**:
  - `neon-pulse`, `badge-pulse` (글로우 기반) — 현대 테마에서 자동으로 `animation: none` 처리됨
  - 0.5초 미만의 흔들림/바운스
  - 이유 없이 항상 돌고 있는 회전 그라디언트

---

## 5. 레이아웃 패턴

### 5.1 페이지 표준 구조

```
┌─────────────────────────────────────────────┐
│ Global Header (Navy #002C5F, height 56px)   │
├──────────┬──────────────────────────────────┤
│          │                                  │
│ Sidebar  │   Page Container                 │
│ (Navy,   │   padding: 24px 32px             │
│  240px)  │   max-width: 1440px              │
│          │                                  │
│          │   [Page Title (28px)]            │
│          │   [Page Subtitle (14px #69696E)] │
│          │   ─────────────────────          │
│          │   [Content Sections]             │
│          │                                  │
└──────────┴──────────────────────────────────┘
```

### 5.2 섹션 카드 배치

- **2열 그리드**: `grid-cols-1 md:grid-cols-2 gap-6` 반응형
- **3열 그리드**: `md:grid-cols-3 gap-5` (지표 카드)
- **Sidebar + Main**: `grid-cols-[280px_1fr] gap-6`
- **Split Pane**: `split-pane` 컴포넌트 활용, 가이드 보더 `#EFEFF0`

### 5.3 반응형 브레이크포인트

Tailwind v4 기본값:
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

현대 디자인 시스템은 **1280px 기준** 최적. 그 이하에서는 사이드바 collapse, 그리드 1~2열로 축소.

---

## 6. 접근성 (Accessibility)

1. **포커스 가시성**: 모든 인터랙티브 요소에 `outline: 2px solid #002C5F` 필수.
2. **색 대비**: 본문 텍스트 최소 AA (4.5:1). Navy `#002C5F` on white = 12.6:1 ✓
3. **ARIA**: `aria-invalid`, `aria-expanded`, `aria-haspopup`, `aria-label` 적극 사용.
4. **키보드 내비**: Tab, Enter, Esc, Arrow 키 지원. 모달은 focus-trap.
5. **sr-only**: 아이콘만 있는 버튼은 반드시 `<span class="sr-only">설명</span>` 동반.
6. **reduced motion**: `@media (prefers-reduced-motion: reduce)`에서 모든 애니메이션 비활성화.

---

## 7. 아이콘

- **라이브러리**: `lucide-react`만 사용. 외부 svg는 `/public/icons/hyundai/` 시스템 아이콘으로.
- **사이즈**: 14 / 16 / 20 / 24 (8 그리드에 맞춤, 14/16이 본문용 표준)
- **stroke-width**: 1.5 (lucide 기본) 유지. 굵은 아이콘 금지.
- **색**: currentColor 상속. 비활성 상태 외에는 절대 단독 색 지정 금지.

---

## 8. 모듈 패턴 (조합 예시)

### 8.1 검색 바

```
[🔍 아이콘][input placeholder="검색어"][Button "검색" Primary]
- Input: height 40px, flex-1
- Button: height 40px, padding 10px 20px
- 아이콘: 16px, color #929296, left inside input (padding-left 36px)
```

### 8.2 상단 KPI 카드

```
┌─────────────────────────┐
│ 라벨 (12px #69696E)      │
│ 29건 (28px 500 #121416) │
│ ↗ +12% (12px #00809E)   │
└─────────────────────────┘
padding 20px, radius 8px, border 1px #EFEFF0
```

### 8.3 필터 바

```
[탭1][탭2][탭3]  ............  [정렬 Select][뷰 토글]
- 좌: Tabs (border-bottom 2px 선택)
- 우: Secondary 버튼들, gap 8px
```

### 8.4 빈 상태 (Empty State)

```
중앙 정렬:
  [아이콘 40px #929296]
  [제목 16px 500 #535356]
  [설명 14px #69696E]
  [Primary Button (선택)]
padding: 48px 24px
```

---

## 9. 체크리스트 (PR 전 확인)

새 UI를 추가했다면 PR 전에 다음을 통과해야 함:

- [ ] 모든 색이 이 문서 §2 토큰으로 설명 가능한가?
- [ ] 모든 폰트 사이즈가 §1.2 스케일에 있는가?
- [ ] 모든 radius가 4 / 8 / 40(pill) / 9999(full) 중 하나인가?
- [ ] 모든 spacing이 8px 그리드 배수인가?
- [ ] 버튼이 Primary / Secondary / Tertiary / Danger / Icon 5종 안에 들어가는가?
- [ ] 포커스 링이 `2px solid #002C5F`로 보이는가?
- [ ] 애니메이션이 §4.12 허용 목록에 있는가?
- [ ] `prefers-reduced-motion`을 존중하는가?
- [ ] 본문 대비 AA 이상인가?
- [ ] 모바일(<768px)에서 깨지지 않는가?

---

## 10. 참조 파일 (구현 시 이곳을 볼 것)

| 목적 | 경로 |
|---|---|
| 전체 CSS 토큰 정의 | `src/app/globals.css` |
| 테마 적용 래퍼 | `src/components/layout/theme-provider.tsx` |
| 테마 상태 | `src/stores/theme-store.ts` |
| 기본 UI 컴포넌트 | `src/components/ui/` (button, card, input, badge, dialog, tabs 등) |
| 전역 레이아웃 | `src/components/layout/{header,sidebar}.tsx` |
| 폰트 파일 | `/public/fonts/hyundai/*.woff2` |
| 아이콘 | `/public/icons/hyundai/*.svg` + `lucide-react` |
| 시각 데모 | `mock.html` (프로젝트 루트) |

---

## 11. 라이브러리

이 프로젝트에서 허용된 UI 관련 의존성:

- **스타일**: `tailwindcss` (v4), `tailwind-merge`, `clsx`, `class-variance-authority`
- **프리미티브**: `@base-ui/react` (Button, Input, Dialog 등 unstyled base)
- **아이콘**: `lucide-react`
- **애니메이션 유틸**: `tw-animate-css` (최소 사용)

**신규 UI 라이브러리 추가는 금지**. 새 컴포넌트가 필요하면 `@base-ui/react` + Tailwind로 직접 구현.

---

_이 문서는 `src/app/globals.css`와 함께 진화한다. 토큰이 추가/변경될 때마다 이 파일도 갱신할 것._
