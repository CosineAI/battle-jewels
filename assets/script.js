// Optional JavaScript goes here
console.log("Static site loaded!");

(() => {
  const TILE = 36;
  const COLS = 8;
  const ROWS = 14;
  const COLORS = ["#e74c3c", "#27ae60", "#3498db", "#f1c40f", "#9b59b6"];
  const ORB = -1; // special power-up tile
  const BOMB_ROW = -2; // row bomb
  const BOMB_COL = -3; // column bomb
  const BASE_RISE = TILE / 8; // baseline speed
  let speedMultiplier = 1; // slow:0.5, normal:1, fast:1.5
  let progressMultiplier = 1; // gentle speed-up factor
  const SPEEDUP_RATE = 0.005; // +0.5% per second while idle
  const SPEEDUP_MAX = 2.5; // cap to prevent excessive speed

  // Animation timings
  const VANISH_MS = 220;
  const DROP_MS = 240;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  canvas.setAttribute("tabindex", "0"); // allow focus

  const speedSelect = document.getElementById("speed");
  const startBtn = document.getElementById("startBtn");

  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE;

  let grid = createGrid();
  let riseOffset = 0;
  let gameOver = false;
  let nextRow = makeRandomRow();
  let selRow = ROWS - 4;
  let selCol = Math.max(0, Math.floor(COLS / 2) - 1);
  let dragStart = null;
  let lastTime = 0;
  let gameFocused = false;

  // Scoring
  let score = 0;
  let shownScore = 0;
  const scoreEl = document.getElementById("scoreValue");

  // Chain / Combo tracking
  let chainDepth = 0;   // 0 before first vanish, then 1, 2, ...
  let chainActive = false;

  // Animation state
  let phase = "idle"; // "idle" | "vanish" | "drop"
  let vanishMask = makeMask(false);
  let vanishStart = 0;
  let dropAnim = Array.from({ length: ROWS }, () => Array(COLS).fill(0)); // px offset (negative -> above target)
  initBoard();

  function updateSpeedFromSelect() {
    const v = (speedSelect && speedSelect.value) || "normal";
    speedMultiplier = v === "slow" ? 0.5 : v === "fast" ? 1.5 : 1;
  }
  // initialize from UI
  updateSpeedFromSelect();

  if (startBtn) {
    startBtn.addEventListener("click", () => {
      updateSpeedFromSelect();
      restart();
      canvas.focus();
    });
  }

  // Input
  canvas.addEventListener("mousedown", (e) => {
    const cell = toCell(e);
    if (!cell || phase !== "idle") return;
    dragStart = cell;
  });

  window.addEventListener("mouseup", (e) => {
    if (!dragStart || phase !== "idle") return;
    const cell = toCell(e);
    if (cell && isAdjacent(dragStart, cell)) {
      swapAndStartCycle(dragStart, cell);
    }
    dragStart = null;
  });

  // Focus and scroll control
  canvas.addEventListener("focus", () => { gameFocused = true; });
  canvas.addEventListener("blur", () => { gameFocused = false; });
  canvas.addEventListener("mouseenter", () => { gameFocused = true; });
  canvas.addEventListener("mouseleave", () => { gameFocused = false; });
  canvas.addEventListener("pointerdown", () => { gameFocused = true; });
  window.addEventListener("wheel", (e) => {
    if (gameFocused) e.preventDefault();
  }, { passive: false });
  window.addEventListener("touchmove", (e) => {
    if (gameFocused) e.preventDefault();
  }, { passive: false });

  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") {
      updateSpeedFromSelect();
      restart();
      return;
    }
    if (gameFocused) {
      const blockKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "Space", "Spacebar"];
      if (blockKeys.includes(e.key)) e.preventDefault();
    }
    if (gameOver || phase !== "idle") return;
    switch (e.key) {
      case "ArrowLeft":
        if (selCol > 0) selCol--;
        break;
      case "ArrowRight":
        if (selCol < COLS - 2) selCol++;
        break;
      case "ArrowUp":
        if (selRow > 0) selRow--;
        break;
      case "ArrowDown":
        if (selRow < ROWS - 1) selRow++;
        break;
      case " ":
      case "Enter":
        swapAndStartCycle(
          { row: selRow, col: selCol },
          { row: selRow, col: selCol + 1 }
        );
        break;
    }
  });

  // Loop
  function loop(ts) {
    if (!lastTime) lastTime = ts;
    const dt = Math.min(0.05, (ts - lastTime) / 1000);
    lastTime = ts;

    // Handle animation phase transitions
    const now = performance.now();
    if (phase === "vanish") {
      if (now - vanishStart >= VANISH_MS) {
        finishVanish();
      }
    } else if (phase === "drop") {
      if (now - dropStart >= DROP_MS) {
        finishDrop();
      }
    }

    // Rise only when idle
    if (!gameOver && phase === "idle") {
      // Gentle speed-up over time while rising
      progressMultiplier = Math.min(SPEEDUP_MAX, progressMultiplier + SPEEDUP_RATE * dt);

      riseOffset += BASE_RISE * speedMultiplier * progressMultiplier * dt;
      while (riseOffset >= TILE) {
        pushRow();
        riseOffset -= TILE;
      }
    }

    // Score count-up animation
    if (scoreEl && shownScore < score) {
      const inc = Math.max(1, Math.floor(2000 * dt));
      shownScore = Math.min(score, shownScore + inc);
      scoreEl.textContent = shownScore.toLocaleString();
    }

    draw();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  // Helpers
  function createGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function makeMask(fill = false) {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(fill));
  }

  const SCORE_TABLE = { 3: 500, 4: 1200, 5: 2500 };
  const COMBO_BONUS_PER_EXTRA_GROUP = 300;   // per additional simultaneous group
  const CASCADE_MULTIPLIER_STEP = 0.5;       // +50% per chain step beyond the first

  function scoreFor(len) {
    return len >= 5 ? SCORE_TABLE[5] : (SCORE_TABLE[len] || 0);
  }

  function isOrb(v) { return v === ORB; }
  function isBombRow(v) { return v === BOMB_ROW; }
  function isBombCol(v) { return v === BOMB_COL; }
  function isSpecial(v) { return typeof v === "number" &&  <v 0; }
  function is}

  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  function easeOutCubic(t) {
    t = clamp01(t);
    return 1 - Math.pow(1 - t, 3);
  }

  function randomInt(n) {
    return Math.floor(Math.random() * n);
  }

  function makeRandomRow() {
    const row = Array.from({ length: COLS }, () => randomInt(COLORS.length));
    const r = Math.random();
    if (r < 0.02) {
      row[randomInt(COLS)] = ORB;
    } else if (r < 0.03) {
      row[randomInt(COLS)] = Math.random() < 0.5 ? BOMB_ROW : BOMB_COL;
    }
    return row;
  }

  function initBoard() {
    // Fill bottom 6 rows with random blocks, avoiding initial matches
    for (let r = ROWS - 6; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        let color;
        do {
          color = randomInt(COLORS.length);
        } while (
          (c >= 2 && grid[r][c - 1] === color && grid[r][c - 2] === color) ||
          (r >= 2 && grid[r - 1][c] === color && grid[r - 2][c] === color)
        );
        grid[r][c] = color;
      }
    }
  }

  function toCell(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const col = Math.floor(x / TILE);
    const row = Math.floor((y + riseOffset) / TILE);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
    return { row, col };
  }

  function isAdjacent(a, b) {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
  }

  function swapAndStartCycle(a, b) {
    const { row: r0, col: c0 } = a;
    const { row: r1, col: c1 } = b;
    const v0 = grid[r0][c0];
    const v1 = grid[r1][c1];

    // Perform swap
    grid[r0][c0] = v1;
    grid[r1][c1] = v0;

    // Begin a new chain from player input
    chainActive = true;
    chainDepth = 0;

    // Bomb activation: if swapped, blow row/column depending on bomb type
    const bombGroups = [];
    if (isBombRow(v0)) {
      const cells = [];
      for (let cc = 0; cc < COLS; cc++) {
        if (grid[r1][cc] !== null) cells.push({ row: r1, col: cc });
      }
      bombGroups.push({ cells, length: cells.length, type: "bomb_row" });
    } else if (isBombCol(v0)) {
      const cells = [];
      for (let rr = 0; rr < ROWS; rr++) {
        if (grid[rr][c1] !== null) cells.push({ row: rr, col: c1 });
      }
      bombGroups.push({ cells, length: cells.length, type: "bomb_col" });
    }
    if (isBombRow(v1)) {
      const cells = [];
      for (let cc = 0; cc < COLS; cc++) {
        if (grid[r0][cc] !== null) cells.push({ row: r0, col: cc });
      }
      bombGroups.push({ cells, length: cells.length, type: "bomb_row" });
    } else if (isBombCol(v1)) {
      const cells = [];
      for (let rr = 0; rr < ROWS; rr++) {
        if (grid[rr][c0] !== null) cells.push({ row: rr, col: c0 });
      }
      bombGroups.push({ cells, length: cells.length, type: "bomb_col" });
    }
    if (bombGroups.length) {
      startVanish(bombGroups);
      return;
    }

    // Orb activation: if swapped with a colored block, remove all of that color
    let colorToClear = null;
    let orbPos = null;
    if (isOrb(v0) && isColor(v1)) {
      colorToClear = v1;
      orbPos = { row: r1, col: c1 };
    } else if (isOrb(v1) && isColor(v0)) {
      colorToClear = v0;
      orbPos = { row: r0, col: c0 };
    }

    if (colorToClear !== null) {
      const cells = [];
      for (let rr = 0; rr < ROWS; rr++) {
        for (let cc = 0; cc < COLS; cc++) {
          if (grid[rr][cc] === colorToClear) {
            cells.push({ row: rr, col: cc });
          }
        }
      }
      // Consume the orb itself
      cells.push(orbPos);

      startVanish([{ cells, length: cells.length, type: "orb" }]);
      return;
    }

    startCascadeDropThenMatch();
  }

  function findMatchGroups() {
    const groups = [];

    // Horizontal
    for (let r = 0; r < ROWS; r++) {
      let c = 0;
      while (c < COLS) {
        const color = grid[r][c];
        if (!isColor(color)) {
          c++;
          continue;
        }
        let len = 1;
        while (c + len < COLS && grid[r][c + len] === color) len++;
        if (len >= 3) {
          const cells = [];
          for (let k = 0; k < len; k++) cells.push({ row: r, col: c + k });
          groups.push({ cells, length: len, type: "h" });
        }
        c += len;
      }
    }

    // Vertical
    for (let c = 0; c < COLS; c++) {
      let r = 0;
      while (r < ROWS) {
        const color = grid[r][c];
        if (!isColor(color)) {
          r++;
          continue;
        }
        let len = 1;
        while (r + len < ROWS && grid[r + len][c] === color) len++;
        if (len >= 3) {
          const cells = [];
          for (let k = 0; k < len; k++) cells.push({ row: r + k, col: c });
          groups.push({ cells, length: len, type: "v" });
        }
        r += len;
      }
    }

    return groups;
  }

  // Computes gravity target positions, updates grid to target,
  // and initializes dropAnim offsets for animated falling.
  // Returns true if any block needs to drop.
  function prepareDropAnim() {
    let moved = false;
    dropAnim = Array.from({ length: ROWS }, () => Array(COLS).fill(0));

    for (let c = 0; c < COLS; c++) {
      const newCol = Array(ROWS).fill(null);
      let write = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (grid[r][c] !== null) {
          const v = grid[r][c];
          newCol[write] = v;
          const dist = write - r;
          if (dist > 0) {
            moved = true;
            dropAnim[write][c] = -dist * TILE; // start above target
          }
          write--;
        }
      }
      for (let r = 0; r < ROWS; r++) grid[r][c] = newCol[r];
    }
    return moved;
  }

  function startCascadeDropThenMatch() {
    if (phase !== "idle") return;
    // First, animate any necessary drops (gravity always applies)
    if (prepareDropAnim()) {
      dropStart = performance.now();
      phase = "drop";
      return;
    }
    // If no drops, check for matches
    const groups = findMatchGroups();
    if (groups.length) {
      startVanish(groups);
    } else {
      // End chain with no matches
      chainActive = false;
      chainDepth = 0;
      phase = "idle";
    }
  }

  function startVanish(groups) {
    vanishMask = makeMask(false);
    for (const g of groups) {
      for (const cell of g.cells) vanishMask[cell.row][cell.col] = true;
    }

    // Spawn an orb only for natural 5+ matches (horizontal/vertical)
    for (const g of groups) {
      if ((g.type === "h" || g.type === "v") && g.length >= 5) {
        const spawn = g.cells[Math.floor(g.length / 2)];
        grid[spawn.row][spawn.col] = ORB;
        vanishMask[spawn.row][spawn.col] = false; // preserve the orb
      }
    }

    // Increment chain depth on each vanish phase within an active chain
    if (chainActive) chainDepth++;

    // Base points + combo bonus + cascade multiplier
    let basePoints = 0;
    for (const g of groups) basePoints += scoreFor(g.length);

    const comboCount = groups.length;
    const comboBonus = Math.max(0, comboCount - 1) * COMBO_BONUS_PER_EXTRA_GROUP;

    const cascadeMultiplier = 1 + Math.max(0, chainDepth - 1) * CASCADE_MULTIPLIER_STEP;

    const pointsEarned = Math.round((basePoints + comboBonus) * cascadeMultiplier);
    score += pointsEarned;

    vanishStart = performance.now();
    phase = "vanish";
  }

  function finishVanish() {
    // Clear matched tiles
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (vanishMask[r][c]) grid[r][c] = null;
      }
    }
    vanishMask = makeMask(false);
    vanishStart = 0;

    // After vanish, drop tiles
    if (prepareDropAnim()) {
      dropStart = performance.now();
      phase = "drop";
    } else {
      // If no drop needed, check if new matches appear (rare)
      const groups = findMatchGroups();
      if (groups.length) {
        startVanish(groups);
      } else {
        // End of chain
        chainActive = false;
        chainDepth = 0;
        phase = "idle";
      }
    }
  }

  function finishDrop() {
    // End of drop animation; ensure offsets are zeroed
    dropAnim = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    dropStart = 0;

    // After dropping, check for matches (cascades)
    const groups = findMatchGroups();
    if (groups.length) {
      startVanish(groups);
    } else {
      // End of chain if no further matches
      chainActive = false;
      chainDepth = 0;
      phase = "idle";
    }
  }

  function pushRow() {
    for (let r = 0; r < ROWS - 1; r++) {
      grid[r] = grid[r + 1].slice();
    }
    grid[ROWS - 1] = nextRow.slice();
    if (grid[0].some((v) => v !== null)) gameOver = true;

    // Keep the selector attached to the same block content across a push
    if (selRow > 0) selRow--;

    // Rising can also trigger a new chain
    chainActive = true;
    chainDepth = 0;

    nextRow = makeRandomRow();
    startCascadeDropThenMatch();
  }

  function drawTile(x, y, colorIdx, scale = 1, alpha = 1) {
    const cx = x + TILE / 2;
    const cy = y + TILE / 2;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    if (colorIdx === ORB) {
      // Base tile
      ctx.fillStyle = "#14171d";
      ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);

      // Shiny orb gradient
      const rOrb = TILE / 2 - 8;
      const grd = ctx.createRadialGradient(cx - 4, cy - 6, 2, cx, cy, rOrb);
      grd.addColorStop(0, "rgba(255,255,255,0.95)");
      grd.addColorStop(0.35, "rgba(180,220,255,0.75)");
      grd.addColorStop(1, "rgba(70,120,255,0.25)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx, cy, rOrb, 0, Math.PI * 2);
      ctx.fill();

      // Rim
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, rOrb, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
      return;
    }

    if (colorIdx === BOMB_ROW || colorIdx === BOMB_COL) {
      // Base tile
      ctx.fillStyle = "#1a1e26";
      ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);

      // Bomb body
      const rb = TILE / 2 - 9;
      ctx.fillStyle = "#0b0d12";
      ctx.beginPath();
      ctx.arc(cx, cy + 2, rb, 0, Math.PI * 2);
      ctx.fill();

      // Gloss
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.beginPath();
      ctx.arc(cx - 6, cy - 4, rb * 0.6, 0, Math.PI * 2);
      ctx.fill();

      // Fuse
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - rb - 2);
      ctx.quadraticCurveTo(cx + 4, cy - rb - 8, cx + 8, cy - rb - 4);
      ctx.stroke();

      // Arrow overlay
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 2.2;
      if (colorIdx === BOMB_ROW) {
        // Left-right arrow
        const ay = cy;
        const ax0 = x + 8;
        const ax1 = x + TILE - 8;
        ctx.beginPath();
        ctx.moveTo(ax0, ay);
        ctx.lineTo(ax1, ay);
        ctx.stroke();
        // Arrowheads
        ctx.beginPath();
        ctx.moveTo(ax0, ay);
        ctx.lineTo(ax0 + 6, ay - 6);
        ctx.lineTo(ax0 + 6, ay + 6);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ax1, ay);
        ctx.lineTo(ax1 - 6, ay - 6);
        ctx.lineTo(ax1 - 6, ay + 6);
        ctx.closePath();
        ctx.stroke();
      } else {
        // Up-down arrow
        const ax = cx;
        const ay0 = y + 8;
        const ay1 = y + TILE - 8;
        ctx.beginPath();
        ctx.moveTo(ax, ay0);
        ctx.lineTo(ax, ay1);
        ctx.stroke();
        // Arrowheads
        ctx.beginPath();
        ctx.moveTo(ax, ay0);
        ctx.lineTo(ax - 6, ay0 + 6);
        ctx.lineTo(ax + 6, ay0 + 6);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ax, ay1);
        ctx.lineTo(ax - 6, ay1 - 6);
        ctx.lineTo(ax + 6, ay1 - 6);
        ctx.closePath();
        ctx.stroke();
      }

      ctx.restore();
      return;
    }

    const color = COLORS[colorIdx];

    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
    ctx.strokeStyle = "#1d1f24";
    ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);

    // Shape overlay for visual differentiation
    const inset = 8;
    const r = TILE / 2 - inset;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;

    if (colorIdx === 0) {
      const a0 = -Math.PI / 2;
      const a1 = a0 + (2 * Math.PI) / 3;
      const a2 = a0 + (4 * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(cx + r * Math.cos(a0), cy + r * Math.sin(a0));
      ctx.lineTo(cx + r * Math.cos(a1), cy + r * Math.sin(a1));
      ctx.lineTo(cx + r * Math.cos(a2), cy + r * Math.sin(a2));
      ctx.closePath();
      ctx.stroke();
    } else if (colorIdx === 1) {
      const s = r * Math.SQRT2;
      ctx.strokeRect(cx - s / 2, cy - s / 2, s, s);
    } else if (colorIdx === 2) {
      const outer = r;
      const inner = r * 0.48;
      const start = -Math.PI / 2;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const ang = start + (i * Math.PI) / 5;
        const rad = i % 2 === 0 ? outer : inner;
        const px = cx + rad * Math.cos(ang);
        const py = cy + rad * Math.sin(ang);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    } else if (colorIdx === 3) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    } else if (colorIdx === 4) {
      const start = -Math.PI / 2;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const ang = start + (i * 2 * Math.PI) / 5;
        const px = cx + r * Math.cos(ang);
        const py = cy + r * Math.sin(ang);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }

    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Board background
    ctx.fillStyle = "#101317";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const now = performance.now();
    const dropProgress = phase === "drop" ? clamp01((now - dropStart) / DROP_MS) : 1;
    const dropEase = easeOutCubic(dropProgress);
    const vanishProgress = phase === "vanish" ? clamp01((now - vanishStart) / VANISH_MS) : 0;

    // Existing grid
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = grid[r][c];
        if (v === null) continue;

        let y = r * TILE - riseOffset;
        if (y > canvas.height) continue;

        // Apply drop animation offset (interpolated towards 0)
        const startOffset = dropAnim[r][c];
        if (startOffset) {
          y += startOffset * (1 - dropEase);
        }

        const x = c * TILE;

        // Apply vanish animation if marked
        if (vanishMask[r][c]) {
          const alpha = 1 - vanishProgress;
          const scale = 1 - 0.4 * vanishProgress;
          drawTile(x, y, v, scale, alpha);
        } else {
          drawTile(x, y, v, 1, 1);
        }
      }
    }

    // Upcoming row preview
    const previewY = ROWS * TILE - riseOffset;
    if (previewY < canvas.height) {
      for (let c = 0; c < COLS; c++) {
        drawTile(c * TILE, previewY, nextRow[c]);
      }
    }

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    for (let c = 0; c <= COLS; c++) {
      const x = c * TILE + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      const y = r * TILE - riseOffset + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Selection overlay (follows block motion including drop animation)
    const sx = selCol * TILE;
    const syLeft = selRow * TILE - riseOffset + (dropAnim[selRow]?.[selCol] || 0) * (1 - dropEase);
    const syRight = selRow * TILE - riseOffset + (dropAnim[selRow]?.[selCol + 1] || 0) * (1 - dropEase);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(sx + 2, syLeft + 2, TILE - 4, TILE - 4);
    ctx.strokeRect(sx + TILE + 2, syRight + 2, TILE - 4, TILE - 4);
    ctx.lineWidth = 1;

    if (gameOver) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 20px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 8);
      ctx.font = "14px system-ui, sans-serif";
      ctx.fillText("Press R to restart", canvas.width / 2, canvas.height / 2 + 18);
    }
  }

  function restart() {
    grid = createGrid();
    riseOffset = 0;
    gameOver = false;
    nextRow = makeRandomRow();

    selRow = ROWS - 4;
    selCol = Math.max(0, Math.floor(COLS / 2) - 1);
    dragStart = null;

    vanishMask = makeMask(false);
    vanishStart = 0;
    dropAnim = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    dropStart = 0;
    phase = "idle";

    // Reset score
    score = 0;
    shownScore = 0;
    if (scoreEl) scoreEl.textContent = "0";

    // Reset gentle speed-up
    progressMultiplier = 1;

    initBoard();
  }
})();