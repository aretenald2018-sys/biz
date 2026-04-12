# Project Rules — biz

## Environment
- Project root: `C:\Users\USER\Desktop\biz`
- Stack: Vite + React Router (client, port 5173) / Hono (API server, port 3001)
- Always run `npm`, `node`, and `git` commands from the project root.
- Never run `npm` commands from `C:\Users\USER`.

## After Code Changes — Run Dev Server (MANDATORY)

After implementing or modifying code, you MUST do the following:

1. Run `node scripts/dev-start.mjs` from the project root.
   - This kills stale processes on ports 5173 and 3001, starts `npm run dev`
     in background, and waits for both servers to be healthy.
   - Pure Node.js — bash/PowerShell 불필요, 샌드박스 제약 없음.
2. Once the script prints "Dev servers running", check the **actual port numbers** in the output.
   Tell the user the actual URL (may differ from default if ports were occupied).
   **Open http://localhost:<ACTUAL_PORT> in your browser (Ctrl+Shift+R to hard refresh).**
3. If the script fails, read the error output, fix the issue, and retry.
4. Use `curl http://localhost:3001/api/...` to verify any changed API endpoints.

**Do NOT tell the user to run the dev server manually.
You have elevated sandbox permissions and the project is trusted.
Run it yourself.**

## Port Conflicts
- `dev-start.mjs`는 **이 프로젝트의 node/tsx 프로세스만** kill함. 다른 프로젝트(tomatofarm 등)의 python 프로세스는 건드리지 않음.
- 포트가 다른 프로젝트에 의해 점유된 경우, 스크립트가 자동으로 다음 포트를 탐색함.
- 수동으로 `taskkill`을 실행하지 말 것 — 다른 프로젝트의 서버를 죽일 수 있음.
- 스크립트 출력에서 실제 사용 포트를 확인하고 사용자에게 알려줄 것.

## Build & Production
- Build: `npm run build` (from project root)
- Production: `npm start` → single Hono server on port 3000 serving static + API

## Final Verification Checklist
After every implementation, confirm:
1. Dev server is running (via `scripts/dev-start.mjs`)
2. `curl` returns expected data for changed endpoints
3. List changed files and the URL/flow the user should test
