// Game Board Component — Vue 3 CDN Options API

window.ViruComponents = window.ViruComponents ?? {};

// Trả về CSS class tương ứng với số virus kề cạnh để tô màu số.
function numClass(value) {
  if (typeof value !== "number") return "";
  return `num-${value}`;
}

window.ViruComponents["game-board"] = {
  name: "game-board",

  props: {
    game:     { type: Object,  required: true },
    mode:     { type: String,  default: "detective" },
    disabled: { type: Boolean, default: false },
  },

  emits: ["reveal", "warn"],

  data() {
    return {
      revealedVirusCells: new Set(),
      _revealTimer: null,
      animationDone: false,
      showSampleModal: false,

      // 27 sample block fetch từ backend khi mở modal lần đầu; cache lại sau đó.
      sampleBlocks:        [],
      sampleBlocksLoading: false,
      sampleBlocksError:   null,
    };
  },

  computed: {
    board()       { return this.game?.board ?? []; },
    rows()        { return this.game?.rows  ?? 0; },
    cols()        { return this.game?.cols  ?? 0; },
    status()      { return this.game?.status ?? "playing"; },
    isLost()      { return this.status === "lost"; },
    isMaze()      { return this.mode === "maze"; },
    isVirusZone() { return this.mode === "virusZone"; },
    boardStyle()  { return { "--cols": this.cols, "--rows": this.rows }; },

    // Thêm class nhấp nháy đỏ khi thua (bật ngay lúc thua, trước animation reveal virus).
    boardStatusClass() {
      if (this.status === "lost" && this.animationDone) return "board--blink-lose";
      return "";
    },

    // Tọa độ x (pixel, viewBox 40px/ô) của các đường kẻ dọc chia macro-cell 3x3 — chỉ dùng ở Maze.
    mazeVerticalLines() {
      const lines = [];
      const macroCount = Math.floor(this.cols / 3);
      for (let i = 1; i < macroCount; i++) lines.push(i * 3 * 40);
      return lines;
    },

    // Tọa độ y của các đường kẻ ngang chia macro-cell 3x3 — chỉ dùng ở Maze.
    mazeHorizontalLines() {
      const lines = [];
      const macroCount = Math.floor(this.rows / 3);
      for (let i = 1; i < macroCount; i++) lines.push(i * 3 * 40);
      return lines;
    },

    // Flatten tất cả ô có virus từ board để dùng cho animation reveal khi thua.
    virusCells() {
      const cells = [];
      for (const row of this.board) {
        for (const cell of row) {
          if (cell.isVirus || cell.value === "virus") {
            cells.push(cell);
          }
        }
      }
      return cells;
    },
  },

  watch: {
    status(newVal) {
      if (newVal === "won" || newVal === "lost") {
        if (newVal === "lost") this.animationDone = true;
        this.$nextTick(() => this._animateVirusReveal());
      }
    },
  },

  beforeUnmount() {
    if (this._revealTimer) clearTimeout(this._revealTimer);
  },

  methods: {
    // Reveal từng ô virus theo thứ tự ngẫu nhiên, cách nhau 80ms.
    _animateVirusReveal() {
      const toReveal = this.virusCells.filter(cell => {
        return !this.revealedVirusCells.has(`${cell.row}-${cell.col}`);
      });

      toReveal.sort(() => Math.random() - 0.5);

      toReveal.forEach((cell, i) => {
        this._revealTimer = setTimeout(() => {
          const next = new Set(this.revealedVirusCells);
          next.add(`${cell.row}-${cell.col}`);
          this.revealedVirusCells = next;
        }, i * 80);
      });
    },

    // Kiểm tra ô này đang được reveal bởi animation khi thua không.
    isVirusAnimated(cell) {
      return this.revealedVirusCells.has(`${cell.row}-${cell.col}`);
    },

    handleClick(cell) {
      if (this.disabled) return;
      if (cell.state === "disabled" || cell.state === "revealed") return;
      this.$emit("reveal", { row: cell.row, col: cell.col });
    },

    handleRightClick(event, cell) {
      event.preventDefault();
      if (this.disabled) return;
      if (cell.state === "disabled" || cell.state === "revealed") return;
      this.$emit("warn", { row: cell.row, col: cell.col });
    },

    // Kiểm tra ô (r,c) trong mini-grid 3x3 của 1 sample block có virus không.
    isSampleVirus(blockCells, r, c) {
      return blockCells.some(([br, bc]) => br === r && bc === c);
    },

    // Mở modal sample blocks; fetch từ backend lần đầu rồi cache lại.
    async openSampleModal() {
      this.showSampleModal = true;
      if (this.sampleBlocks.length > 0) return;

      this.sampleBlocksLoading = true;
      this.sampleBlocksError   = null;
      try {
        this.sampleBlocks = await API.getMazeSampleBlocks();
      } catch (err) {
        this.sampleBlocksError = err.message || "Không thể tải danh sách mẫu block.";
      } finally {
        this.sampleBlocksLoading = false;
      }
    },

    isMazeStart(cell) {
      return this.isMaze && cell.row === 0 && cell.col === 0;
    },
    isMazeEnd(cell) {
      return this.isMaze && cell.row === this.rows - 1 && cell.col === this.cols - 1;
    },

    // Tính danh sách CSS class cho 1 ô board.
    cellClasses(cell) {
      const classes = ["cell", `cell--${cell.state}`];

      if (cell.state === "revealed") {
        if (cell.value === "virus") classes.push("cell--virus");
        else if (typeof cell.value === "number") classes.push(numClass(cell.value));
      }

      const animated = this.isVirusAnimated(cell);
      if (animated) {
        classes.push("cell--virus-reveal");
        if (cell.state === "warned") {
          classes.push("cell--virus-warned");
        }
      }

      if (this.isMazeStart(cell)) classes.push("cell--maze-start");
      if (this.isMazeEnd(cell))   classes.push("cell--maze-end");

      return classes;
    },

    // Trả về text label hiển thị bên trong ô (chỉ số adjacent > 0, còn lại để trống).
    cellLabel(cell) {
      if (cell.state === "disabled") return "";
      if (cell.state === "warned")   return "";
      if (cell.state !== "revealed") return "";
      if (cell.value === "virus")    return "";
      if (cell.value === 0)          return "";
      return cell.value;
    },

    // Trả về aria-label cho ô để hỗ trợ accessibility.
    cellAriaLabel(cell) {
      if (cell.state === "disabled") return "Disabled cell";
      if (cell.state === "hidden")   return `Row ${cell.row} Col ${cell.col} hidden`;
      if (cell.state === "warned")   return `Row ${cell.row} Col ${cell.col} warned`;
      if (cell.state === "revealed") return `Row ${cell.row} Col ${cell.col} value ${cell.value}`;
      return "";
    },

    // Kiểm tra ô có cần render virus.svg không (revealed virus, hoặc đang animated reveal).
    isVirusCell(cell) {
      if (cell.state === "revealed" && cell.value === "virus") return true;
      const animated = this.isVirusAnimated(cell);
      if (animated) return true;
      return false;
    },

    // Kiểm tra ô có cần render warning.svg không (warned + không bị animated reveal).
    isWarnCell(cell) {
      return cell.state === "warned" && !this.isVirusAnimated(cell);
    },
  },

  template: `
    <div
      class="board-wrapper"
      :class="[
        'board--' + mode,
        status !== 'playing' ? 'board--ended' : '',
        isVirusZone ? 'board--virus-zone' : '',
        boardStatusClass,
      ]"
    >
      <!-- Board chính -->
      <div class="board" :style="boardStyle" style="position:relative">
        <div v-for="row in board" :key="row[0].row" class="board-row">
          <button
            v-for="cell in row"
            :key="cell.col"
            :class="cellClasses(cell)"
            :disabled="disabled || cell.state === 'disabled'"
            :aria-label="cellAriaLabel(cell)"
            @click="handleClick(cell)"
            @contextmenu="handleRightClick($event, cell)"
          >
            <template v-if="isVirusAnimated(cell) && cell.state === 'warned'">
              <img src="assets/icons/virus.svg"   class="cell__virus-icon cell__virus-icon--behind" alt="virus" />
              <img src="assets/icons/warning.svg" class="cell__warn-icon  cell__warn-icon--over"   alt="warning" />
            </template>
            <img
              v-else-if="isVirusCell(cell)"
              src="assets/icons/virus.svg"
              class="cell__virus-icon"
              alt="virus"
            />
            <img
              v-else-if="isWarnCell(cell)"
              src="assets/icons/warning.svg"
              class="cell__warn-icon"
              alt="warning"
            />
            <span v-else class="cell__label">{{ cellLabel(cell) }}</span>
            <span v-if="cell.state === 'revealed' && cell.value !== 'virus'" class="cell__ripple" />
          </button>
        </div>

        <!-- SVG overlay kẻ lưới macro-cell — chỉ hiện ở Maze Mode -->
        <svg
          v-if="isMaze && rows > 0"
          class="maze-grid-overlay"
          :viewBox="'0 0 ' + (cols * 40) + ' ' + (rows * 40)"
          preserveAspectRatio="none"
        >
          <line
            v-for="x in mazeVerticalLines"
            :key="'v' + x"
            :x1="x" :y1="0"
            :x2="x" :y2="rows * 40"
            class="maze-grid-line"
          />
          <line
            v-for="y in mazeHorizontalLines"
            :key="'h' + y"
            :x1="0"          :y1="y"
            :x2="cols * 40"  :y2="y"
            class="maze-grid-line"
          />
        </svg>
      </div>

      <!-- Legend + nút xem mẫu -->
      <div v-if="isMaze" class="maze-legend">
        <span class="badge badge--green">▶ START (0,0)</span>
        <span class="badge badge--red">■ END ({{ rows-1 }},{{ cols-1 }})</span>
        <button class="btn btn--ghost maze-sample-btn" @click="openSampleModal">
          ⊞ &nbsp;XEM MẪU BLOCK
        </button>
      </div>

      <!-- Modal 27 sample block -->
      <teleport to="body">
        <div v-if="showSampleModal" class="sample-modal-backdrop" @click.self="showSampleModal = false">
          <div class="sample-modal">
            <div class="sample-modal__header">
              <h3 class="text-glow">27 MẪU VIRUS BLOCK</h3>
              <button class="btn btn--icon btn--ghost" @click="showSampleModal = false">✕</button>
            </div>
            <p class="sample-modal__sub text-secondary">
              Map Maze được ghép từ các mẫu 3×3 này. Mỗi mẫu có thể bị xoay hoặc lật ngẫu nhiên.
            </p>

            <div v-if="sampleBlocksLoading" class="sample-modal__state mono text-muted">
              Đang tải dữ liệu...
            </div>
            <div v-else-if="sampleBlocksError" class="sample-modal__state text-danger">
              {{ sampleBlocksError }}
            </div>
            <div v-else class="sample-modal__grid">
              <div
                v-for="(blockCells, idx) in sampleBlocks"
                :key="idx"
                class="sample-block"
              >
                <div class="sample-block__id label">#{{ String(idx + 1).padStart(2,'0') }}</div>
                <div class="sample-block__grid">
                  <div
                    v-for="r in [0,1,2]"
                    :key="r"
                    class="sample-block__row"
                  >
                    <div
                      v-for="c in [0,1,2]"
                      :key="c"
                      class="sample-block__cell"
                      :class="isSampleVirus(blockCells, r, c) ? 'sample-block__cell--virus' : 'sample-block__cell--empty'"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </teleport>
    </div>
  `,
};