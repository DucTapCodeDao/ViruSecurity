// Root Vue app: quản lý screen routing, game state, timer, toast, audio.
// Components (screen-menu, screen-game, screen-result, screen-leaderboard,
// game-board) được đăng ký từ ui.js và board.js — phải load trước main.js.

const { createApp } = Vue;

const app = createApp({
  data() {
    return {
      // 'menu' | 'game' | 'result' | 'leaderboard'
      screen: "menu",

      game: null,

      activeMode:       "detective",
      activeDifficulty: "easy",

      elapsed:     0,       // seconds
      _timerStart: null,    // Date.now() khi bắt đầu đếm
      _timerId:    null,    // setInterval id

      toast: {
        visible: false,
        message: "",
        type:    "info",   // 'info' | 'success' | 'error' | 'warn'
      },
      _toastTimer: null,

      loading: false,       // tránh double-click

      _winAudio:       null,
      _loseAudio:      null,
      _clickAudio:     null,
      _clickAudioBase: null,  // preloaded — clone khi cần để tránh delay
      _warnAudioBase:  null,  // preloaded
    };
  },

  computed: {
    isPlaying() {
      return this.game?.status === "playing";
    },
    isWon() {
      return this.game?.status === "won";
    },
    isLost() {
      return this.game?.status === "lost";
    },
    // Định dạng elapsed seconds thành "mm:ss".
    elapsedFormatted() {
      const m = Math.floor(this.elapsed / 60).toString().padStart(2, "0");
      const s = (this.elapsed % 60).toString().padStart(2, "0");
      return `${m}:${s}`;
    },
  },

  methods: {

    // ── Screen navigation ────────────────────────────────────────────────────

    goMenu() {
      this._stopTimer();
      this._stopWinAudio();
      this.screen = "menu";
      this.game   = null;
      this.elapsed = 0;
    },

    goGame() {
      this.screen = "game";
    },

    goResult() {
      this._stopTimer();
      this._stopWinAudio();
      this.screen = "result";
    },

    goLeaderboard() {
      this.screen = "leaderboard";
    },

    // ── Game lifecycle ───────────────────────────────────────────────────────

    // Gọi từ screen-menu khi người chơi bấm Start: tạo game mới trên server
    // rồi chuyển sang màn hình game.
    async onStart({ mode, difficulty }) {
      if (this.loading) return;
      this.loading = true;

      try {
        this.activeMode       = mode;
        this.activeDifficulty = difficulty;

        const game = await API.startGame({ mode, difficulty });
        this.game    = game;
        this.elapsed = 0;
        this._stopTimer();

        this.goGame();
        this.showToast(`${this._modeLabel(mode)} — ${difficulty.toUpperCase()}`, "info");
      } catch (err) {
        this.showToast(err.message || "Không thể tạo game mới.", "error");
      } finally {
        this.loading = false;
      }
    },

    // Gọi từ screen-game khi click ô: gửi reveal lên server, bắt đầu timer ở
    // lần reveal đầu tiên, xử lý âm thanh và chuyển màn hình khi thắng/thua.
    async onReveal({ row, col }) {
      if (!this.game || !this.isPlaying || this.loading) return;
      this.loading = true;
      this._playClick();

      try {
        const result = await API.revealCell(this.game.id, row, col);

        if (!this.game.boardGenerated && result.game.boardGenerated) {
          this._startTimer();
        }

        this.game = result.game;

        if (result.changed) {
          if (this.isWon) {
            this._stopTimer();
            this.showToast("✓ SYSTEM SECURED", "success", 7000);
            try {
              this._winAudio = new Audio("assets/sounds/win.mp3");
              this._winAudio.volume = 0.7;
              this._winAudio.onended = () => this.goResult();
              this._winAudio.play();
            } catch (e) {
              setTimeout(() => this.goResult(), 8000);
            }
          } else if (this.isLost) {
            this._stopTimer();
            this.showToast("✗ INFECTED", "error", 7000);
            try {
              this._loseAudio = new Audio("assets/sounds/lose.mp3");
              this._loseAudio.volume = 0.7;
              this._loseAudio.onended = () => this.goResult();
              this._loseAudio.play();
            } catch (e) {
              setTimeout(() => this.goResult(), 9000);
            }
          }
        } else if (result.message) {
          this.showToast(result.message, "warn");
        }
      } catch (err) {
        this.showToast(err.message || "Lỗi kết nối server.", "error");
      } finally {
        this.loading = false;
      }
    },

    // Gọi từ screen-game khi right-click ô: gửi warn lên server, bắt đầu
    // timer nếu chưa có (warn cũng trigger generateBoard).
    async onWarn({ row, col }) {
      if (!this.game || !this.isPlaying || this.loading) return;
      this.loading = true;
      this._playWarn();

      try {
        if (!this.game.boardGenerated) {
          this._startTimer();
        }

        const result = await API.warnCell(this.game.id, row, col);
        this.game = result.game;
      } catch (err) {
        this.showToast(err.message || "Lỗi kết nối server.", "error");
      } finally {
        this.loading = false;
      }
    },

    // ── Audio helpers ────────────────────────────────────────────────────────

    // Phát âm thanh click ô bằng cách clone từ node đã preload (gần như tức thì).
    _playClick() {
      try {
        if (this._clickAudioBase) {
          const sfx = this._clickAudioBase.cloneNode();
          sfx.volume = 0.5;
          sfx.play();
        }
      } catch (e) {}
    },

    // Phát âm thanh warn (right-click đặt/xóa warning flag).
    _playWarn() {
      try {
        if (this._warnAudioBase) {
          const sfx = this._warnAudioBase.cloneNode();
          sfx.volume = 0.35;
          sfx.playbackRate = 0.75;
          sfx.play();
        }
      } catch (e) {}
    },

    // ── Timer ────────────────────────────────────────────────────────────────

    // Bắt đầu đếm giờ từ vị trí hiện tại của elapsed (resume-safe).
    _startTimer() {
      if (this._timerId) return;
      this._timerStart = Date.now() - this.elapsed * 1000;
      this._timerId = setInterval(() => {
        this.elapsed = Math.floor((Date.now() - this._timerStart) / 1000);
      }, 500);
    },

    // Dừng đếm giờ.
    _stopTimer() {
      if (this._timerId) {
        clearInterval(this._timerId);
        this._timerId = null;
      }
    },

    // Dừng và reset audio thắng/thua (gọi khi rời màn hình game).
    _stopWinAudio() {
      if (this._winAudio) {
        this._winAudio.pause();
        this._winAudio.currentTime = 0;
        this._winAudio = null;
      }
      if (this._loseAudio) {
        this._loseAudio.pause();
        this._loseAudio.currentTime = 0;
        this._loseAudio = null;
      }
    },

    // ── Toast ────────────────────────────────────────────────────────────────

    // Hiện toast message với type và duration (ms) tuỳ chỉnh.
    showToast(message, type = "info", duration = 2500) {
      if (this._toastTimer) clearTimeout(this._toastTimer);

      this.toast = { visible: true, message, type };

      this._toastTimer = setTimeout(() => {
        this.toast.visible = false;
      }, duration);
    },

    // ── Helpers ──────────────────────────────────────────────────────────────

    // Chuyển mode id thành label hiển thị.
    _modeLabel(mode) {
      return {
        detective: "Detective Mode",
        maze:      "Maze Mode",
        virusZone: "Virus Zone",
      }[mode] ?? mode;
    },
  },

  mounted() {
    // Preload audio khi app mount để tránh delay khi click lần đầu.
    try {
      this._clickAudioBase = new Audio("assets/sounds/click.mp3");
      this._clickAudioBase.volume = 0.5;
      this._clickAudioBase.load();

      this._warnAudioBase = new Audio("assets/sounds/click.mp3");
      this._warnAudioBase.volume = 0.35;
      this._warnAudioBase.playbackRate = 0.75;
      this._warnAudioBase.load();
    } catch (e) {}
  },

  beforeUnmount() {
    this._stopTimer();
  },
});

// Đăng ký tất cả components được expose qua window.ViruComponents (ui.js, board.js).
if (window.ViruComponents) {
  for (const [name, def] of Object.entries(window.ViruComponents)) {
    app.component(name, def);
  }
}

app.mount("#app");