# Tower of Hanoi with a Prolog backend

An animated Tower of Hanoi website. **All puzzle logic runs in SWI-Prolog**: the recursive solver and the validation of manual moves. The browser only draws and animates what Prolog returns.

## Project structure

```
hanoi-prolog/
├── README.md
├── backend/
│   ├── hanoi.pl     Pure Prolog logic: recursive solver, move rules, solved check
│   ├── server.pl    HTTP server: JSON API + serves the frontend files
│   └── tests.pl     Self-test (2^n - 1 moves for 1..10 disks, rule checks)
└── frontend/
    ├── index.html   Page structure
    ├── style.css    Layout, colors, responsive rules
    └── script.js    Animation, controls, calls to the Prolog API
```

## Prerequisites

- **SWI-Prolog 9.x** (the free Prolog system). Download the installer from https://www.swi-prolog.org/Download.html and tick **"Add swipl to the system PATH"** during setup.
- Any modern browser (Chrome, Edge, Firefox, Safari).

Check the install in **PowerShell** (any folder):

```powershell
swipl --version
```

## Run it (Windows PowerShell)

1. Open PowerShell and go into the `backend` folder (adjust the path to wherever you put the project):

   ```powershell
   cd C:\Users\YourName\Downloads\hanoi-prolog\backend
   ```

2. Start the server (run this in the `backend` folder; keep the window open):

   ```powershell
   swipl server.pl
   ```

   You should see `Tower of Hanoi server running at http://localhost:8080`.

3. Open **http://localhost:8080** in your browser. The badge at the top right should say *Prolog server online*.

4. Stop the server with `Ctrl+C` twice in the PowerShell window.

macOS / Linux use the same commands with `/` in the path.

## Run the Prolog self-test

In the `backend` folder:

```powershell
swipl tests.pl
```

Expected: ten `PASS` lines (one per disk count from 1 to 10, each confirming exactly 2^n - 1 legal moves ending with all disks on C), a `PASS` for the rule checks, then `All tests passed.`

## API reference

| Request | Result |
|---|---|
| `GET /api/health` | `{"status":"ok"}` |
| `GET /api/info?disks=4` | `{"disks":4,"minimum":15}` |
| `GET /api/solve?disks=3&from=a&to=c` | `{"moves":[{"disk":1,"from":"a","to":"c"}, ...],"count":7,"minimum":7}` |
| `POST /api/validate` | Body `{"state":{"a":[1,2],"b":[],"c":[3]},"from":"a","to":"b","target":"c"}` returns `{"valid":true,"state":{...},"solved":false,"move":{...}}` or `{"valid":false,"reason":"..."}` |

Stacks list the top disk first. Invalid input returns HTTP 400 with `{"error":"..."}`. Disk counts must be 1 to 10.

Quick check from PowerShell while the server runs:

```powershell
Invoke-RestMethod "http://localhost:8080/api/solve?disks=2"
```

## How to test each feature in the browser

- **Manual play:** pick *Manual*, click tower A (top disk lifts), click tower B (it slides and drops).
- **Invalid move:** with a small disk on B, lift a larger disk from A and click B. The tower shakes and a red message explains the rule (the message comes from Prolog).
- **Solved message:** move all disks to C. The board gets a green outline and shows your move count.
- **Automatic solving:** pick *Automatic*, choose 1 to 4 disks, press *Start*. The history list shows exactly 1, 3, 7, 15 moves.
- **Pause / Resume:** press *Pause* mid-run (the current move finishes, then it waits), then *Resume*. The timer stops while paused.
- **Reset:** press *Reset* any time, including mid-animation.
- **Speed:** drag the slider while a run is going; the next move uses the new speed.
- **Prolog is really used:** stop the server and press Start. You get a "Cannot reach the Prolog server" error because the browser cannot solve anything itself.

## Troubleshooting

| Problem | Fix |
|---|---|
| `swipl` is not recognized | Reinstall SWI-Prolog with "Add to PATH", or close and reopen PowerShell. Otherwise use the full path, e.g. `& "C:\Program Files\swipl\bin\swipl.exe" server.pl`. |
| `Could not start on port 8080` | Another program uses the port. Find it with `netstat -ano \| findstr :8080`, close it, or change `default_port(8080).` in `backend/server.pl` and use the new port in the URL. |
| Page says *Prolog server offline* | The server is not running, or you opened `index.html` by double-click. Run `swipl server.pl` and use http://localhost:8080. |
| Windows Firewall prompt | Click *Allow* for private networks, or ignore it; `localhost` still works. |
| Fonts look different offline | The Google Fonts link is optional; the page falls back to system fonts. |
| Browser shows old behaviour | Hard refresh with `Ctrl+Shift+R`. |
