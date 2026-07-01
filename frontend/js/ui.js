// Screen Components — Vue 3 CDN Options API
window.ViruComponents = window.ViruComponents ?? {};

// ─── ScreenMenu ───────────────────────────────────────────────────────────────
// Màn hình chọn mode + difficulty và mở modal hướng dẫn; emit "start" khi người
// chơi bấm Start.
window.ViruComponents["screen-menu"] = {
  name: "screen-menu",
  emits: ["start"],

  data() {
    return {
      selectedMode:       "detective",
      selectedDifficulty: "easy",
      showGuide:          false,
      modes: [
        { id: "detective", label: "Detective",  icon: "assets/icons/detective.svg", desc: "Hãy sử dụng khả năng suy luận thiên tài của bạn để tìm tất cả virus.", tag: "CSP + Backtracking" },
        { id: "maze",      label: "Maze",       icon: "assets/icons/maze.svg",      desc: "Hãy tìm lối thoát duy nhất ra khỏi mê cung đầy virus này.",          tag: "Dijkstra + A*"     },
        { id: "virusZone", label: "Virus Zone", icon: "assets/icons/zone.svg",      desc: "Liệu hình dáng có phải là 1 vấn đề lớn?",                            tag: "DFS Shape"         },
      ],
      difficulties: [
        { id: "easy",   label: "Easy",   icon: "○" },
        { id: "medium", label: "Medium", icon: "◐" },
        { id: "hard",   label: "Hard",   icon: "●" },
      ],
      guide: {
        basics: [
          { icon: "🖱️", title: "Click trái", desc: "Lật ô — nếu trúng virus là thua ngay." },
          { icon: "assets/icons/warning.svg", title: "Click phải", desc: "Đặt / bỏ cờ cảnh báo ⚠ lên ô nghi có virus.", isSvg: true },
          { icon: "🔢", title: "Con số",     desc: "Cho biết có bao nhiêu virus trong 8 ô xung quanh ô đó." },
          { icon: "🛡️", title: "Click đầu", desc: "Lần click đầu tiên luôn an toàn — board tạo sau đó." },
        ],
        modes: [
          { icon: "assets/icons/detective.svg", name: "Detective",  desc: "Board được thiết kế giải được 100% bằng logic. Không bao giờ cần đoán mò." },
          { icon: "assets/icons/maze.svg",      name: "Maze",       desc: "Luôn tồn tại ít nhất 1 đường an toàn từ góc trên trái ▶ đến góc dưới phải ■. Tìm đường đó! Mê cung được tạo thành từ các block 3x3 chứa virus ngẫu nhiên. Để tiện cho việc tìm đường, bạn có thể xem danh sách các sample block bất cứ lúc nào để hỗ trợ suy luận." },
          { icon: "assets/icons/zone.svg",      name: "Virus Zone", desc: "Vùng chơi có hình dạng bất kỳ do thuật toán DFS tạo ra. Các ô tối là vùng ngoài — không click được." },
        ],
        win: "Lật hết tất cả ô không có virus là thắng. Số cờ không cần khớp số virus — chỉ cần lật đủ ô an toàn.",
      },
    };
  },

  computed: {
    // Hiển thị thông tin kích cỡ board + số virus theo mode + difficulty đang chọn.
    gridInfo() {
      const configs = {
        detective: { easy: "9×9 · 10 viruses",   medium: "16×16 · 35 viruses",  hard: "16×30 · 75 viruses"  },
        maze:      { easy: "9×9 · 18 viruses",   medium: "16×16 · 60 viruses",  hard: "16×30 · 120 viruses" },
        virusZone: { easy: "12×12 · 12 viruses", medium: "18×18 · 30 viruses",  hard: "24×24 · 70 viruses"  },
      };
      return configs[this.selectedMode]?.[this.selectedDifficulty] ?? "";
    },
  },

  methods: {
    // Emit "start" với mode + difficulty hiện tại.
    startGame() {
      this.$emit("start", { mode: this.selectedMode, difficulty: this.selectedDifficulty });
    },
  },

  template: `
    <div class="screen screen--menu">
      <header class="menu-header">
        <div class="menu-logo">
          <span class="menu-logo__icon">☣</span>
          <h1 class="menu-logo__title text-glow cursor">ViruSecurity</h1>
        </div>
        <p class="menu-logo__sub text-secondary">Neutralize the threat. Trust your logic.</p>
      </header>

      <section class="menu-section">
        <p class="section-title">// SELECT MODE</p>
        <div class="mode-grid">
          <button
            v-for="m in modes" :key="m.id"
            class="mode-card" :class="{ 'mode-card--active': selectedMode === m.id }"
            :data-mode="m.id"
            @click="selectedMode = m.id"
          >
            <img class="mode-card__icon" :src="m.icon" :alt="m.label" />
            <span class="mode-card__label">{{ m.label }}</span>
            <span class="mode-card__tag badge badge--cyan">{{ m.tag }}</span>
            <p class="mode-card__desc">{{ m.desc }}</p>
          </button>
        </div>
      </section>

      <section class="menu-section">
        <p class="section-title">// DIFFICULTY</p>
        <div class="diff-row">
          <button
            v-for="d in difficulties" :key="d.id"
            class="diff-btn" :class="{ 'diff-btn--active': selectedDifficulty === d.id }"
            :data-diff="d.id"
            @click="selectedDifficulty = d.id"
          >
            <span>{{ d.icon }}</span> {{ d.label }}
          </button>
        </div>
        <p class="mono text-muted" style="margin-top:10px">{{ gridInfo }}</p>
      </section>

      <div class="menu-actions">
        <button class="btn btn--primary menu-start-btn" @click="startGame">
          ▶ &nbsp; INITIALIZE SYSTEM
        </button>
        <button class="btn btn--ghost menu-guide-btn" @click="showGuide = true">
          ? &nbsp; HƯỚNG DẪN CHƠI
        </button>
      </div>

      <transition name="fade">
        <div v-if="showGuide" class="guide-overlay" @click.self="showGuide = false">
          <div class="guide-modal card">

            <div class="guide-modal__header">
              <h2 class="text-glow">Hướng dẫn chơi</h2>
              <button class="btn btn--ghost btn--icon" @click="showGuide = false">✕</button>
            </div>

            <div class="guide-modal__body">

              <p class="section-title">// THAO TÁC CƠ BẢN</p>
              <div class="guide-basics">
                <div v-for="b in guide.basics" :key="b.title" class="guide-basic-item">
                  <img v-if="b.isSvg" :src="b.icon" class="guide-basic-item__icon guide-basic-item__icon--svg" :alt="b.title" />
                  <span v-else class="guide-basic-item__icon">{{ b.icon }}</span>
                  <div>
                    <div class="guide-basic-item__title">{{ b.title }}</div>
                    <div class="guide-basic-item__desc text-secondary">{{ b.desc }}</div>
                  </div>
                </div>
              </div>

              <div class="divider" />

              <p class="section-title">// Ý NGHĨA CON SỐ</p>
              <div class="guide-numbers">
                <span v-for="n in [1,2,3,4,5,6,7,8]" :key="n" :class="['guide-num', 'num-' + n]">{{ n }}</span>
              </div>
              <p class="text-secondary" style="font-size:0.78rem;margin-top:8px">
                Màu khác nhau giúp phân biệt nhanh — số càng lớn, xung quanh càng nhiều virus.
              </p>

              <div class="divider" />

              <p class="section-title">// CÁC MODE</p>
              <div class="guide-modes">
                <div v-for="m in guide.modes" :key="m.name" class="guide-mode-item">
                  <img class="guide-mode-item__icon" :src="m.icon" :alt="m.name" />
                  <div>
                    <div class="guide-mode-item__name">{{ m.name }}</div>
                    <div class="guide-mode-item__desc text-secondary">{{ m.desc }}</div>
                  </div>
                </div>
              </div>

              <div class="divider" />

              <p class="section-title">// ĐIỀU KIỆN THẮNG</p>
              <p class="text-secondary" style="font-size:0.82rem;line-height:1.6">{{ guide.win }}</p>

            </div>

            <div class="guide-modal__footer">
              <button class="btn btn--primary" style="width:100%" @click="showGuide = false">
                ✓ &nbsp; ĐÃ HIỂU, CHƠI THÔI
              </button>
            </div>

          </div>
        </div>
      </transition>

    </div>
  `,
};

// ─── ScreenGame ───────────────────────────────────────────────────────────────
// Màn hình game chính: HUD (mode, difficulty, virus count, timer, progress bar)
// + game-board; emit "reveal"/"warn" lên root app để gọi API.
window.ViruComponents["screen-game"] = {
  name: "screen-game",
  props: {
    game:       { type: Object, required: true },
    mode:       { type: String, default: "detective" },
    difficulty: { type: String, default: "easy" },
    elapsed:    { type: Number, default: 0 },
  },
  emits: ["reveal", "warn", "new-game"],

  computed: {
    status()     { return this.game?.status ?? "playing"; },
    isPlaying()  { return this.status === "playing"; },
    virusesLeft(){ return this.game?.virusesLeftEstimate ?? 0; },
    // Phần trăm ô an toàn đã mở.
    progress() {
      const total    = this.game?.totalSafeCells    ?? 1;
      const revealed = this.game?.revealedSafeCount ?? 0;
      return Math.min(100, Math.round((revealed / total) * 100));
    },
    elapsedFormatted() {
      const m = Math.floor(this.elapsed / 60).toString().padStart(2, "0");
      const s = (this.elapsed % 60).toString().padStart(2, "0");
      return `${m}:${s}`;
    },
    modeLabel() {
      return { detective: "Detective", maze: "Maze", virusZone: "Virus Zone" }[this.mode] ?? this.mode;
    },
    // Badge trạng thái game hiển thị ở HUD center.
    statusBadge() {
      return {
        playing: { cls: "badge--cyan",  label: "ACTIVE"   },
        won:     { cls: "badge--green", label: "SECURED"  },
        lost:    { cls: "badge--red",   label: "INFECTED" },
      }[this.status] ?? { cls: "badge--cyan", label: "" };
    },
  },

  template: `
    <div class="screen screen--game"
      :class="{
        'screen--infected': status === 'lost',
        'screen--secured':  status === 'won',
      }"
    >
      <transition name="fade">
        <div v-if="status === 'won'" class="win-overlay">
          <img src="assets/icons/win.svg" class="win-mascot win-mascot--left"  alt="win" />
          <img src="assets/icons/win.svg" class="win-mascot win-mascot--right" alt="win" />
        </div>
      </transition>

      <transition name="fade">
        <div v-if="status === 'lost'" class="lose-overlay">
          <img src="assets/icons/lose.svg" class="lose-mascot lose-mascot--left"  alt="lose" />
          <img src="assets/icons/lose.svg" class="lose-mascot lose-mascot--right" alt="lose" />
        </div>
      </transition>

      <transition name="fade">
        <div v-if="status === 'lost'" class="lose-overlay">
          <img src="assets/icons/lose.svg" class="lose-mascot lose-mascot--left"  alt="lose" />
          <img src="assets/icons/lose.svg" class="lose-mascot lose-mascot--right" alt="lose" />
        </div>
      </transition>

      <header class="game-hud">
        <div class="hud-left">
          <button class="btn btn--ghost btn--icon" @click="$emit('new-game')" title="Menu">←</button>
          <div class="stat-block">
            <span class="stat-block__label">Mode</span>
            <span class="stat-block__value">{{ modeLabel }}</span>
          </div>
          <div class="stat-block">
            <span class="stat-block__label">Level</span>
            <span class="stat-block__value">{{ difficulty.toUpperCase() }}</span>
          </div>
        </div>

        <div class="hud-center">
          <span :class="['badge', statusBadge.cls]">
            <span class="pulse-dot" v-if="isPlaying"></span>
            {{ statusBadge.label }}
          </span>
        </div>

        <div class="hud-right">
          <div class="stat-block" style="text-align:right">
            <span class="stat-block__label"><img src="assets/icons/virus.svg" class="hud-icon" alt="virus" /> Viruses</span>
            <span class="stat-block__value stat-block__value--danger">{{ virusesLeft }}</span>
          </div>
          <div class="stat-block" style="text-align:right">
            <span class="stat-block__label"><img src="assets/icons/clock.svg" class="hud-icon" alt="time" /> Time</span>
            <span class="stat-block__value stat-block__value--accent">{{ elapsedFormatted }}</span>
          </div>
        </div>
      </header>

      <div class="game-progress">
        <div class="game-progress__bar" :style="{ width: progress + '%' }"></div>
      </div>

      <main class="game-main">
        <game-board
          :game="game"
          :mode="mode"
          :disabled="!isPlaying"
          @reveal="$emit('reveal', $event)"
          @warn="$emit('warn', $event)"
        ></game-board>
      </main>

      <footer class="game-footer">
        <span class="mono text-muted">LEFT CLICK — reveal</span>
        <span class="mono text-muted">RIGHT CLICK — warning</span>
        <span class="mono text-muted">{{ progress }}% cleared</span>
      </footer>
    </div>
  `,
};

// ─── ScreenResult ─────────────────────────────────────────────────────────────
// Màn hình kết quả: hiển thị thắng/thua, thống kê, form lưu điểm (chỉ khi thắng).
window.ViruComponents["screen-result"] = {
  name: "screen-result",
  props: {
    game:    { type: Object, required: true },
    elapsed: { type: Number, default: 0 },
  },
  emits: ["new-game", "leaderboard"],

  data() {
    return {
      playerName:  "",
      savingScore: false,
      scoreSaved:  false,
      saveError:   null,
    };
  },

  computed: {
    isWon()  { return this.game?.status === "won"; },
    moves()  { return this.game?.moves ?? 0; },
    mode()   { return this.game?.mode  ?? "detective"; },
    diff()   { return this.game?.difficulty ?? "easy"; },
    elapsedFormatted() {
      const m = Math.floor(this.elapsed / 60).toString().padStart(2, "0");
      const s = (this.elapsed % 60).toString().padStart(2, "0");
      return `${m}:${s}`;
    },
    modeLabel() {
      return { detective: "Detective", maze: "Maze", virusZone: "Virus Zone" }[this.mode] ?? this.mode;
    },
    // Cho phép submit khi đã nhập tên, chưa đang save, và chưa saved.
    canSave() {
      return this.playerName.trim().length > 0 && !this.savingScore && !this.scoreSaved;
    },
  },

  methods: {
    // Gửi điểm lên server; chỉ cần truyền playerName + gameId (server tự tính còn lại).
    async submitScore() {
      if (!this.canSave) return;
      this.savingScore = true;
      this.saveError   = null;
      try {
        await API.saveScore({ playerName: this.playerName.trim(), gameId: this.game.id });
        this.scoreSaved = true;
      } catch (err) {
        this.saveError = err.message || "Không thể lưu điểm. Kiểm tra lại kết nối server.";
      } finally {
        this.savingScore = false;
      }
    },
  },

  template: `
    <div class="screen screen--result">
      <div class="result-card card card--glow">
        <div class="result-icon" :class="isWon ? 'result-icon--won' : 'result-icon--lost'">
          {{ isWon ? '✓' : '☣' }}
        </div>

        <h1 :class="['result-headline', isWon ? 'text-glow' : 'text-danger']">
          {{ isWon ? 'SYSTEM SECURED' : 'SYSTEM INFECTED' }}
        </h1>
        <p class="result-subline text-secondary">
          {{ isWon ? 'All threats neutralized. Well played.' : 'A virus slipped through. Try again.' }}
        </p>

        <div class="divider"></div>

        <div class="result-stats">
          <div class="stat-block">
            <span class="stat-block__label">Mode</span>
            <span class="stat-block__value">{{ modeLabel }}</span>
          </div>
          <div class="stat-block">
            <span class="stat-block__label">Difficulty</span>
            <span class="stat-block__value">{{ diff.toUpperCase() }}</span>
          </div>
          <div class="stat-block">
            <span class="stat-block__label">Time</span>
            <span class="stat-block__value stat-block__value--accent">{{ elapsedFormatted }}</span>
          </div>
          <div class="stat-block">
            <span class="stat-block__label">Moves</span>
            <span class="stat-block__value">{{ moves }}</span>
          </div>
        </div>

        <div class="divider"></div>

        <div v-if="isWon" class="result-save">
          <template v-if="!scoreSaved">
            <p class="result-save__label label">Lưu kết quả vào bảng xếp hạng</p>
            <div class="result-save__row">
              <input
                v-model="playerName"
                class="result-save__input"
                type="text"
                placeholder="Nhập tên của bạn..."
                maxlength="50"
                :disabled="savingScore"
                @keyup.enter="submitScore"
              />
              <button
                class="btn btn--primary"
                :disabled="!canSave"
                @click="submitScore"
              >
                {{ savingScore ? '...' : 'LƯU' }}
              </button>
            </div>
            <p v-if="saveError" class="result-save__error">{{ saveError }}</p>
          </template>
          <div v-else class="result-save__success">
            <span class="text-glow">✓ Đã lưu điểm!</span>
            <button class="btn btn--ghost" style="margin-left:12px" @click="$emit('leaderboard')">
              Xem bảng xếp hạng →
            </button>
          </div>
        </div>

        <div class="divider"></div>

        <div class="result-actions">
          <button class="btn btn--primary" @click="$emit('new-game')">↺ &nbsp; NEW GAME</button>
          <button class="btn btn--ghost"   @click="$emit('leaderboard')">▦ &nbsp; LEADERBOARD</button>
        </div>
      </div>
    </div>
  `,
};

// ─── ScreenLeaderboard ────────────────────────────────────────────────────────
// Màn hình bảng xếp hạng: filter theo mode + difficulty, fetch từ server và
// hiển thị top 10.
window.ViruComponents["screen-leaderboard"] = {
  name: "screen-leaderboard",
  props: {
    mode: { type: String, default: "detective" },
  },
  emits: ["back"],

  data() {
    return {
      selectedMode:       this.mode,
      selectedDifficulty: "easy",
      entries:            [],
      loading:            false,
      error:              null,
      modeLabels:  { detective: "Detective", maze: "Maze", virusZone: "Virus Zone" },
      modes:       ["detective", "maze", "virusZone"],
      difficulties:["easy", "medium", "hard"],
    };
  },

  watch: {
    selectedMode()       { this.fetchLeaderboard(); },
    selectedDifficulty() { this.fetchLeaderboard(); },
  },

  mounted() { this.fetchLeaderboard(); },

  methods: {
    // Fetch top 10 từ server theo mode + difficulty đang chọn.
    async fetchLeaderboard() {
      this.loading = true;
      this.error   = null;
      try {
        const data   = await API.getLeaderboard(this.selectedMode, this.selectedDifficulty, 10);
        this.entries = data.leaderboard ?? [];
      } catch {
        this.error   = "Leaderboard chưa khả dụng.";
        this.entries = [];
      } finally {
        this.loading = false;
      }
    },
    // Chuyển time_ms thành chuỗi "mm:ss".
    formatTime(ms) {
      const t = Math.floor(ms / 1000);
      return `${Math.floor(t/60).toString().padStart(2,"0")}:${(t%60).toString().padStart(2,"0")}`;
    },
  },

  template: `
    <div class="screen screen--leaderboard">
      <div class="lb-container">
        <div class="lb-header">
          <button class="btn btn--ghost btn--icon" @click="$emit('back')">←</button>
          <h2 class="text-glow">LEADERBOARD</h2>
        </div>

        <div class="lb-filters">
          <div class="diff-row">
            <button v-for="m in modes" :key="m"
              class="diff-btn" :class="{ 'diff-btn--active': selectedMode === m }"
              @click="selectedMode = m">{{ modeLabels[m] }}</button>
          </div>
          <div class="diff-row">
            <button v-for="d in difficulties" :key="d"
              class="diff-btn" :class="{ 'diff-btn--active': selectedDifficulty === d }"
              @click="selectedDifficulty = d">{{ d.toUpperCase() }}</button>
          </div>
        </div>

        <div class="lb-table-wrap">
          <div v-if="loading"              class="lb-state mono text-muted">Scanning records...</div>
          <div v-else-if="error"           class="lb-state mono text-muted">{{ error }}</div>
          <div v-else-if="!entries.length" class="lb-state mono text-muted">No records found.</div>
          <table v-else class="lb-table">
            <thead>
              <tr>
                <th class="label">#</th>
                <th class="label">Player</th>
                <th class="label">Time</th>
                <th class="label">Moves</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(entry, i) in entries" :key="entry.id" :class="{ 'lb-row--top': i < 3 }">
                <td class="lb-rank">
                  <span v-if="i===0">🥇</span>
                  <span v-else-if="i===1">🥈</span>
                  <span v-else-if="i===2">🥉</span>
                  <span v-else class="text-muted">{{ i+1 }}</span>
                </td>
                <td class="lb-player">{{ entry.player_name }}</td>
                <td class="lb-time stat-block__value--accent">{{ formatTime(entry.time_ms) }}</td>
                <td class="lb-moves text-muted">{{ entry.moves }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
};