// Optional JavaScript goes here
console.log("Static site loaded!");

(() => {
  const TILE = 36;
  const COLS = 8;
  const ROWS = 14;
  const COLORS = ["#e74c3c", "#27ae60", "#3498db", "#f1c40f", "#9b59b6"];
  const RISE_SPEED = TILE / 8; // slowed by ~50%

  // Animation timings
  const VANISH_MS = 220;
  const DROP_MS = 240;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  canvas.setAttribute("tabindex", "0"); // allow focus

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

  // Animation state
  let phase = "idle"; // "idle" | "vanish" | "drop"
  let vanishMask = makeMask(false);
  let vanishStart = 0;
  let dropAnim = Array.from({ length: ROWS }, () => Array(COLS).fill(0)); // px offset (negative -> above target)
  let dropStart = 0;

  initBoard();

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
      riseOffset += RISE_SPEED * dt;
      while (riseOffset >= TILE) {
        pushRow();
        riseOffset -= TILE;
      }
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
    return Array.from({ length: COLS }, () => randomInt(COLORS.length));
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
    const tmp = grid[r0][c0];
    grid[r0][c0] = grid[r1][c1];
    grid[r1][c1] = tmp;
    startCascadeDropThenMatch();
  }

  function findMatches() {
    const marked = Array.from({ length: ROWS }, () => Array(COLS).fill(false));

    // Horizontal
    for (let r = 0; r < ROWS; r++) {
      let c = 0;
      while (c < COLS) {
        const color = grid[r][c];
        if (color === null) {
          c++;
          continue;
        }
        let len = 1;
        while (c + len < COLS && grid[r][c + len] === color) len++;
        if (len >= 3) {
          for (let k = 0; k < len; k++) marked[r][c + k] = true;
        }
        c += len;
      }
    }

    // Vertical
    for (let c = 0; c < COLS; c++) {
      let r = 0;
      while (r < ROWS) {
        const color = grid[r][c];
        if (color === null) {
          r++;
          continue;
        }
        let len = 1;
        while (r + len < ROWS && grid[r + len][c] === color) len++;
        if (len >= 3) {
          for (let k = 0; k < len; k++) marked[r + k][c] = true;
        }
        r += len;
      }
    }

    const cells = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (marked[r][c]) cells.push({ row: r, col: c });
      }
    }
    return cells;
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
    const matches = findMatches();
    if (matches.length) {
      startVanish(matches);
    } else {
      phase = "idle";
    }
  }

  function startVanish(matches) {
    vanishMask = makeMask(false);
    for (const m of matches) vanishMask[m.row][m.col] = true;
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
      const matches = findMatches();
      if (matches.length) {
        startVanish(matches);
      } else {
        phase = "idle";
      }
    }
  }

  function finishDrop() {
    // End of drop animation; ensure offsets are zeroed
    dropAnim = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    dropStart = 0;

    // After dropping, check for matches (cascades)
    const matches = findMatches();
    if (matches.length) {
      startVanish(matches);
    } else {
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

    nextRow = makeRandomRow();
    startCascadeDropThenMatch();
  }

  function drawTile(x, y, colorIdx, scale = 1, alpha = 1) {
    const color = COLORS[colorIdx];
    const cx = x + TILE / 2;
    const cy = y + TILE / 2;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
    ctx.strokeStyle = "#1d1f24";
    ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);

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

    initBoard();
  }
})();