/**
 * game.js - ESL 視訊單字泡泡遊戲 核心遊戲邏輯
 * 適用教材：Page 15 Word List 16 個單字
 * 包含：狀態機、泡泡排布、碰撞反饋、補換泡泡、愛心扣血、計時器、排行榜
 */

// 課本 Page 15 單字資料庫 (16 個單字完整配置)
const VOCABULARY = [
  { id: 'climb',  word: 'climb',  type: 'action', zh: '攀爬', img: 'V1_flashcards_images/V1_climb.webp',  audio: 'V1_flashcards_audios/V1_climb.mp3' },
  { id: 'dog',    word: 'dog',    type: 'animal', zh: '小狗', img: 'V1_flashcards_images/V1_dog.webp',    audio: 'V1_flashcards_audios/V1_dog.mp3' },
  { id: 'duck',   word: 'duck',   type: 'animal', zh: '鴨子', img: 'V1_flashcards_images/V1_duck.webp',   audio: 'V1_flashcards_audios/V1_duck.mp3' },
  { id: 'eagle',  word: 'eagle',  type: 'animal', zh: '老鷹', img: 'V1_flashcards_images/V1_eagle.webp',  audio: 'V1_flashcards_audios/V1_eagle.mp3' },
  { id: 'fish',   word: 'fish',   type: 'animal', zh: '魚',   img: 'V1_flashcards_images/V1_fish.webp',   audio: 'V1_flashcards_audios/V1_fish.mp3' },
  { id: 'fly',    word: 'fly',    type: 'action', zh: '飛行', img: 'V1_flashcards_images/V1_fly.webp',    audio: 'V1_flashcards_audios/V1_fly.mp3' },
  { id: 'frog',   word: 'frog',   type: 'animal', zh: '青蛙', img: 'V1_flashcards_images/V1_frog.webp',   audio: 'V1_flashcards_audios/V1_frog.mp3' },
  { id: 'hop',    word: 'hop',    type: 'action', zh: '單腳跳', img: 'V1_flashcards_images/V1_hop.webp',    audio: 'V1_flashcards_audios/V1_hop.mp3' },
  { id: 'iguana', word: 'iguana', type: 'animal', zh: '鬣蜥', img: 'V1_flashcards_images/V1_iguana.webp', audio: 'V1_flashcards_audios/V1_iguana.mp3' },
  { id: 'jump',   word: 'jump',   type: 'action', zh: '跳躍', img: 'V1_flashcards_images/V1_jump.webp',   audio: 'V1_flashcards_audios/V1_jump.mp3' },
  { id: 'owl',    word: 'owl',    type: 'animal', zh: '貓頭鷹', img: 'V1_flashcards_images/V1_owl.webp',    audio: 'V1_flashcards_audios/V1_owl.mp3' },
  { id: 'rabbit', word: 'rabbit', type: 'animal', zh: '兔子', img: 'V1_flashcards_images/V1_rabbit.webp', audio: 'V1_flashcards_audios/V1_rabbit.mp3' },
  { id: 'run',    word: 'run',    type: 'action', zh: '奔跑', img: 'V1_flashcards_images/V1_run.webp',    audio: 'V1_flashcards_audios/V1_run.mp3' },
  { id: 'soar',   word: 'soar',   type: 'action', zh: '翱翔', img: 'V1_flashcards_images/V1_soar.webp',   audio: 'V1_flashcards_audios/V1_soar.mp3' },
  { id: 'swim',   word: 'swim',   type: 'action', zh: '游泳', img: 'V1_flashcards_images/V1_swim.webp',   audio: 'V1_flashcards_audios/V1_swim.mp3' },
  { id: 'walk',   word: 'walk',   type: 'action', zh: '漫步', img: 'V1_flashcards_images/V1_walk.webp',   audio: 'V1_flashcards_audios/V1_walk.mp3' },
];

// 6 個泡泡環繞位置（相應於草圖配置：上方、下方、左上、左下、右上、右下）
const BUBBLE_SLOT_CLASSES = [
  'slot-top',
  'slot-bottom',
  'slot-top-left',
  'slot-bottom-left',
  'slot-top-right',
  'slot-bottom-right'
];

class ESLBubbleGame {
  constructor() {
    // 遊戲狀態機
    this.state = {
      mode: 'menu',           // menu, playing, paused, gameover
      gameMode: 'timed',      // endless, timed
      customTimeLimit: 60,    // 秒
      remainingTime: 60,      // 秒
      elapsedTime: 0,         // 秒
      lives: 5,               // 初始 5 顆心
      maxLives: 5,
      score: 0,
      combo: 0,
      maxCombo: 0,
      correctCount: 0,
      wrongCount: 0,
      replaceOnWrong: true,   // 答錯時是否補換新泡泡（依設定切換）
      targetItem: null,       // 當前出題的單字物件
      currentBubbleWords: [], // 當前場上的 6 個單字 ID
      questionHistory: [],    // 出題防連跳
      isTransitioning: false
    };

    // 粒子系統 Canvas
    this.fxCanvas = document.getElementById('fx-canvas');
    this.fxCtx = this.fxCanvas.getContext('2d');
    this.particles = [];
    this.handTrails = [];

    // 定時器
    this.gameTimer = null;
    this.lastTimestamp = performance.now();

    // DOM 快取
    this.dom = {
      stage: document.getElementById('game-stage'),
      bubblesContainer: document.getElementById('bubbles-container'),
      centerCard: document.getElementById('center-card'),
      cardImage: document.getElementById('card-image'),
      cardWordZh: document.getElementById('card-word-zh'),
      cardRepeatBtn: document.getElementById('card-repeat-btn'),
      heartsContainer: document.getElementById('hearts-container'),
      timerDisplay: document.getElementById('timer-display'),
      scoreDisplay: document.getElementById('score-display'),
      comboDisplay: document.getElementById('combo-display'),
      statusNotice: document.getElementById('status-notice'),
      
      // 彈跳視窗
      startModal: document.getElementById('start-modal'),
      leaderboardModal: document.getElementById('leaderboard-modal'),
      gameoverModal: document.getElementById('gameover-modal'),
      pauseModal: document.getElementById('pause-modal'),

      // 按鈕與輸入
      startBtn: document.getElementById('start-btn'),
      showLeaderboardBtn: document.getElementById('show-leaderboard-btn'),
      closeLeaderboardBtn: document.getElementById('close-leaderboard-btn'),
      pauseBtn: document.getElementById('pause-btn'),
      topHomeBtn: document.getElementById('top-home-btn'),
      resumeBtn: document.getElementById('resume-btn'),
      restartBtn: document.getElementById('restart-btn'),
      homeBtn: document.getElementById('home-btn'),
      submitScoreBtn: document.getElementById('submit-score-btn'),
      playerNameInput: document.getElementById('player-name-input'),
      gameModeSelect: document.getElementById('game-mode-select'),
      wrongBubbleBehavior: document.getElementById('wrong-bubble-behavior'),
      timeSelectGroup: document.getElementById('time-select-group'),
      customTimeInput: document.getElementById('custom-time-input'),
      cameraToggle: document.getElementById('camera-toggle'),
      mirrorToggle: document.getElementById('mirror-toggle'),
      audioToggle: document.getElementById('audio-toggle'),
      bgmToggle: document.getElementById('bgm-toggle')
    };

    // 建立 HandTracker 實例
    this.handTracker = new HandTracker({
      videoElement: document.getElementById('webcam-video'),
      stageElement: this.dom.stage,
      onHandMove: (hands) => this.onHandMove(hands),
      onBubbleHit: (wordId, x, y) => this.onBubbleHit(wordId, x, y),
      onStatusChange: (text) => this.showNotice(text)
    });

    this.init();
  }

  // 初始化
  init() {
    this.bindEvents();
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // 啟動滑鼠/觸控點擊支援
    this.handTracker.bindMouseAndTouch(this.dom.stage);

    // 啟動 FX 粒子循環渲染
    requestAnimationFrame((ts) => this.renderFxLoop(ts));

    // 預先載入第一筆資料畫面
    this.renderHearts();
    this.updateScoreHUD();

    // 讓 Playwright 測試與無頭環境可全域訪問
    window.eslGame = this;
    window.render_game_to_text = () => JSON.stringify({
      mode: this.state.mode,
      gameMode: this.state.gameMode,
      score: this.state.score,
      lives: this.state.lives,
      target: this.state.targetItem ? this.state.targetItem.word : null,
      bubbles: this.state.currentBubbleWords,
      correctCount: this.state.correctCount,
      wrongCount: this.state.wrongCount,
      combo: this.state.combo,
      remainingTime: this.state.remainingTime,
      replaceOnWrong: this.state.replaceOnWrong
    });

    window.simulateBubbleHit = (wordId) => {
      this.onBubbleHit(wordId, window.innerWidth / 2, window.innerHeight / 2);
    };
  }

  // 事件綁定
  bindEvents() {
    // 遊戲模式切換
    this.dom.gameModeSelect.addEventListener('change', (e) => {
      this.state.gameMode = e.target.value;
      this.dom.timeSelectGroup.style.display = (this.state.gameMode === 'timed') ? 'flex' : 'none';
    });

    // 時間設定按鈕選取
    document.querySelectorAll('.time-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.time-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const seconds = parseInt(chip.dataset.time, 10);
        this.dom.customTimeInput.value = seconds;
        this.state.customTimeLimit = seconds;
      });
    });

    this.dom.customTimeInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (val > 0) this.state.customTimeLimit = val;
    });

    // 開始遊戲按鈕
    this.dom.startBtn.addEventListener('click', async () => {
      window.soundSystem.initAudioContext();
      if (this.dom.bgmToggle.checked) {
        window.soundSystem.startBgm();
      }
      this.dom.startModal.hidden = true;

      // 檢查是否需啟動鏡頭
      if (this.dom.cameraToggle.checked && !this.handTracker.cameraReady) {
        await this.handTracker.initCamera();
      }

      this.startGame();
    });

    // 鏡像開關
    this.dom.mirrorToggle.addEventListener('change', (e) => {
      const video = document.getElementById('webcam-video');
      this.handTracker.isMirrored = e.target.checked;
      video.style.transform = e.target.checked ? 'scaleX(-1)' : 'none';
    });

    // 音效開關
    this.dom.audioToggle.addEventListener('change', () => {
      window.soundSystem.toggleMute();
    });

    // 背景音樂開關
    this.dom.bgmToggle.addEventListener('change', (e) => {
      if (e.target.checked) window.soundSystem.startBgm();
      else window.soundSystem.stopBgm();
    });

    // 重聽題目發音按鈕
    this.dom.cardRepeatBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.state.targetItem) {
        window.soundSystem.playWordAudio(this.state.targetItem.id);
        this.dom.cardRepeatBtn.classList.add('pulse');
        setTimeout(() => this.dom.cardRepeatBtn.classList.remove('pulse'), 400);
      }
    });

    // 排行榜顯示與關閉
    this.dom.showLeaderboardBtn.addEventListener('click', () => this.showLeaderboard());
    this.dom.closeLeaderboardBtn.addEventListener('click', () => {
      this.dom.leaderboardModal.hidden = true;
    });

    // 排行榜分頁切換
    document.querySelectorAll('.lb-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.renderLeaderboardList(tab.dataset.tab);
      });
    });

    // 暫停與繼續
    this.dom.pauseBtn.addEventListener('click', () => this.pauseGame());
    this.dom.resumeBtn.addEventListener('click', () => this.resumeGame());

    // 右上角直接回到首頁按鈕
    if (this.dom.topHomeBtn) {
      this.dom.topHomeBtn.addEventListener('click', () => this.returnToHome());
    }

    // 結算畫面按鈕
    this.dom.submitScoreBtn.addEventListener('click', () => this.submitScoreToLeaderboard());
    this.dom.restartBtn.addEventListener('click', () => {
      this.dom.gameoverModal.hidden = true;
      this.startGame();
    });
    this.dom.homeBtn.addEventListener('click', () => this.returnToHome());
  }

  // 結束目前遊戲並返回首頁選單
  returnToHome() {
    this.state.mode = 'menu';
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
      this.gameTimer = null;
    }
    if (window.soundSystem) {
      window.soundSystem.stopBgm();
      if (window.soundSystem.currentVoice) {
        window.soundSystem.currentVoice.pause();
      }
    }
    this.dom.bubblesContainer.innerHTML = '';
    this.dom.pauseModal.hidden = true;
    this.dom.gameoverModal.hidden = true;
    this.dom.leaderboardModal.hidden = true;
    this.dom.startModal.hidden = false;
    this.showNotice('已回到首頁選單');
  }

  // 調整 FX Canvas 尺寸與畫布解析度
  resizeCanvas() {
    const rect = this.dom.stage.getBoundingClientRect();
    this.fxCanvas.width = rect.width;
    this.fxCanvas.height = rect.height;
  }

  // 開始全新一局遊戲
  startGame() {
    this.state.mode = 'playing';
    this.state.lives = this.state.maxLives;
    this.state.score = 0;
    this.state.combo = 0;
    this.state.maxCombo = 0;
    this.state.correctCount = 0;
    this.state.wrongCount = 0;
    this.state.elapsedTime = 0;
    this.state.isTransitioning = false;
    this.state.questionHistory = [];

    // 讀取答錯是否補換泡泡設定
    if (this.dom.wrongBubbleBehavior) {
      this.state.replaceOnWrong = (this.dom.wrongBubbleBehavior.value === 'replace');
    }

    if (this.state.gameMode === 'timed') {
      const customSeconds = parseInt(this.dom.customTimeInput.value, 10) || 60;
      this.state.customTimeLimit = customSeconds;
      this.state.remainingTime = customSeconds;
    }

    this.renderHearts();
    this.updateScoreHUD();
    this.updateTimerHUD();

    // 啟動計時器 (每秒遞減或遞增)
    if (this.gameTimer) clearInterval(this.gameTimer);
    this.gameTimer = setInterval(() => this.tickTimer(), 1000);

    // 出第一題
    this.nextQuestion();
    this.showNotice('揮動雙手戳破正確的單字泡泡！');
  }

  // 計時器跳動
  tickTimer() {
    if (this.state.mode !== 'playing') return;

    this.state.elapsedTime++;

    if (this.state.gameMode === 'timed') {
      this.state.remainingTime--;
      this.updateTimerHUD();

      if (this.state.remainingTime <= 0) {
        this.gameOver('時間到！');
      }
    } else {
      this.updateTimerHUD();
    }
  }

  // 更新計時器顯示
  updateTimerHUD() {
    const formatTime = (totalSec) => {
      const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
      const s = (totalSec % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
    };

    if (this.state.gameMode === 'timed') {
      this.dom.timerDisplay.textContent = `⏱️ ${formatTime(Math.max(0, this.state.remainingTime))}`;
      if (this.state.remainingTime <= 10) {
        this.dom.timerDisplay.classList.add('urgent');
      } else {
        this.dom.timerDisplay.classList.remove('urgent');
      }
    } else {
      this.dom.timerDisplay.textContent = `⏱️ ${formatTime(this.state.elapsedTime)}`;
      this.dom.timerDisplay.classList.remove('urgent');
    }
  }

  // 更新分數與連擊 HUD
  updateScoreHUD() {
    this.dom.scoreDisplay.innerHTML = `<span class="star-icon">⭐</span> 分數: <b>${this.state.score}</b>`;
    if (this.state.combo > 1) {
      this.dom.comboDisplay.style.display = 'inline-block';
      this.dom.comboDisplay.textContent = `✦ 連擊 x${this.state.combo}`;
    } else {
      this.dom.comboDisplay.style.display = 'none';
    }
  }

  // 渲染 5 顆愛心血條
  renderHearts() {
    this.dom.heartsContainer.innerHTML = '';
    for (let i = 0; i < this.state.maxLives; i++) {
      const heart = document.createElement('span');
      heart.className = `heart-icon ${i < this.state.lives ? 'active' : 'lost'}`;
      heart.textContent = '❤️';
      this.dom.heartsContainer.appendChild(heart);
    }
  }

  // 出題：決定目標單字並分派 6 顆泡泡
  nextQuestion() {
    if (this.state.mode !== 'playing') return;

    // 隨機選題（排除最近剛出過的 2 題）
    const availablePool = VOCABULARY.filter(item => !this.state.questionHistory.includes(item.id));
    const pool = availablePool.length >= 6 ? availablePool : VOCABULARY;
    const target = pool[Math.floor(Math.random() * pool.length)];

    this.state.targetItem = target;
    this.state.questionHistory.push(target.id);
    if (this.state.questionHistory.length > 4) this.state.questionHistory.shift();

    // 挑選 5 個不重複干擾項目
    const distractors = VOCABULARY.filter(i => i.id !== target.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 5);

    // 混合正確答案與干擾項，隨機排序
    const questionChoices = [target, ...distractors].sort(() => Math.random() - 0.5);
    this.state.currentBubbleWords = questionChoices.map(c => c.id);

    // 渲染中央閃卡
    this.renderCenterCard(target);

    // 播放目標單字真人發音
    window.soundSystem.playWordAudio(target.id);

    // 渲染 6 顆環繞單字泡泡
    this.renderBubbles(questionChoices);

    this.state.isTransitioning = false;
  }

  // 渲染中央閃卡卡片
  renderCenterCard(target) {
    this.dom.cardImage.src = target.img;
    this.dom.cardImage.alt = target.word;
    this.dom.cardImage.onerror = () => {
      if (!this.dom.cardImage.src.includes('../')) {
        this.dom.cardImage.src = '../' + target.img;
      }
    };
    this.dom.cardWordZh.textContent = `(${target.zh})`;

    // 閃卡翻轉出現動畫
    this.dom.centerCard.classList.remove('flip-in');
    void this.dom.centerCard.offsetWidth; // 強制重繪
    this.dom.centerCard.classList.add('flip-in');
  }

  // 渲染 6 顆單字泡泡
  renderBubbles(choices) {
    this.dom.bubblesContainer.innerHTML = '';

    choices.forEach((item, index) => {
      const slotClass = BUBBLE_SLOT_CLASSES[index] || 'slot-top';
      const bubble = document.createElement('div');
      bubble.className = `word-bubble ${slotClass}`;
      bubble.dataset.wordId = item.id;
      bubble.dataset.slotIndex = index;

      // 泡泡內部結構 (含高光層與單字文字)
      bubble.innerHTML = `
        <div class="bubble-reflection"></div>
        <div class="bubble-word-content">
          <span class="bubble-en">${item.word}</span>
        </div>
        <div class="bubble-glow"></div>
      `;

      this.dom.bubblesContainer.appendChild(bubble);
    });
  }

  // 泡泡碰撞處理 (手勢碰觸或滑鼠點擊)
  onBubbleHit(wordId, hitX, hitY) {
    const now = performance.now();
    if (this.state.mode !== 'playing' || this.state.isTransitioning) return;
    if (now - (this.lastGlobalHitTime || 0) < 550) return; // 全局 550ms 防連擊與防手勢誤刷保護

    const bubbleEl = this.dom.bubblesContainer.querySelector(`.word-bubble[data-word-id="${wordId}"]`);
    if (!bubbleEl || bubbleEl.classList.contains('popping')) return;

    this.lastGlobalHitTime = now;
    // 標記為正在爆破
    bubbleEl.classList.add('popping');

    // 1. 播放泡泡爆破聲 + 播放該泡泡對應單字語音
    window.soundSystem.playBubblePop();
    window.soundSystem.playWordAudio(wordId);

    // 2. 觸發爆破粒子
    this.spawnBubblePopParticles(hitX, hitY);

    const isCorrect = (wordId === this.state.targetItem.id);

    if (isCorrect) {
      // ===== 答對流程 =====
      this.state.isTransitioning = true;
      this.state.score += 10 + Math.min(this.state.combo * 2, 30);
      this.state.combo++;
      this.state.maxCombo = Math.max(this.state.maxCombo, this.state.combo);
      this.state.correctCount++;

      // 播放正確琶音音效
      window.soundSystem.playCorrect();

      // 正確視覺回饋 (全場星芒 + 分數飄浮字)
      this.spawnFloatingScore(`+10`, hitX, hitY, '#48bb78');
      this.spawnCorrectStars(hitX, hitY);
      this.showNotice(`太棒了！答對了！`, 'success');
      this.updateScoreHUD();

      // 泡泡全體漸隱，短暫延遲後進入下一題
      setTimeout(() => {
        this.dom.bubblesContainer.querySelectorAll('.word-bubble').forEach(b => b.classList.add('fade-out'));
      }, 350);

      setTimeout(() => {
        this.nextQuestion();
      }, 750);

    } else {
      // ===== 答錯流程 =====
      this.state.combo = 0;
      this.state.wrongCount++;
      this.state.lives--;

      // 扣血震動與提示
      this.renderHearts();
      this.updateScoreHUD();
      this.spawnFloatingScore(`-1 ❤️`, hitX, hitY, '#f56565');
      this.dom.stage.classList.add('shake-error');
      setTimeout(() => this.dom.stage.classList.remove('shake-error'), 450);

      // 播放答錯提示音
      window.soundSystem.playWrong();
      this.showNotice(`再試一次！請找：${this.state.targetItem.word} (${this.state.targetItem.zh})`, 'error');

      // 檢查愛心是否扣完
      if (this.state.lives <= 0) {
        this.gameOver('愛心用盡！');
        return;
      }

      // 依使用者設定：答錯時可選擇補換新泡泡或直接移除該泡泡
      const slotIndex = parseInt(bubbleEl.dataset.slotIndex, 10);
      if (this.state.replaceOnWrong) {
        setTimeout(() => {
          this.replaceDistractorBubble(bubbleEl, slotIndex);
        }, 400);
      } else {
        setTimeout(() => {
          bubbleEl.remove();
          this.state.currentBubbleWords[slotIndex] = null;
        }, 380);
      }
    }
  }

  // 補上另一顆別的單字泡泡
  replaceDistractorBubble(oldBubbleEl, slotIndex) {
    if (this.state.mode !== 'playing') return;

    // 找出目前場上沒有出現的單字候選
    const availablePool = VOCABULARY.filter(item => 
      !this.state.currentBubbleWords.includes(item.id) &&
      item.id !== this.state.targetItem.id
    );

    const replacement = (availablePool.length > 0)
      ? availablePool[Math.floor(Math.random() * availablePool.length)]
      : VOCABULARY.find(i => i.id !== this.state.targetItem.id);

    if (!replacement) return;

    // 更新場上名單
    this.state.currentBubbleWords[slotIndex] = replacement.id;

    // 移除舊泡泡並建立新泡泡
    oldBubbleEl.remove();

    const slotClass = BUBBLE_SLOT_CLASSES[slotIndex] || 'slot-top';
    const newBubble = document.createElement('div');
    newBubble.className = `word-bubble ${slotClass} bubble-spawn-in`;
    newBubble.dataset.wordId = replacement.id;
    newBubble.dataset.slotIndex = slotIndex;

    newBubble.innerHTML = `
      <div class="bubble-reflection"></div>
      <div class="bubble-word-content">
        <span class="bubble-en">${replacement.word}</span>
      </div>
      <div class="bubble-glow"></div>
    `;

    this.dom.bubblesContainer.appendChild(newBubble);
  }

  // 手部動態座標傳入（繪製魔法光點游標）
  onHandMove(hands) {
    this.handTrails = hands.map(h => ({
      x: h.x,
      y: h.y,
      alpha: 1.0,
      radius: 18
    }));
  }

  // 粒子物理循環 (Canvas 60 FPS)
  renderFxLoop(timestamp) {
    const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.05);
    this.lastTimestamp = timestamp;

    const ctx = this.fxCtx;
    ctx.clearRect(0, 0, this.fxCanvas.width, this.fxCanvas.height);

    // 1. 繪製手勢指尖魔法游標光暈與星軌
    this.handTrails.forEach(h => {
      ctx.save();
      const gradient = ctx.createRadialGradient(h.x, h.y, 4, h.x, h.y, 35);
      gradient.addColorStop(0, 'rgba(255, 240, 150, 0.9)');
      gradient.addColorStop(0.3, 'rgba(66, 153, 225, 0.6)');
      gradient.addColorStop(1, 'rgba(66, 153, 225, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(h.x, h.y, 35, 0, Math.PI * 2);
      ctx.fill();

      // 指尖中心光芒
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(h.x, h.y, 6, 0, Math.PI * 2);
      ctx.fill();

      // 十字星芒
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(h.x - 14, h.y);
      ctx.lineTo(h.x + 14, h.y);
      ctx.moveTo(h.x, h.y - 14);
      ctx.lineTo(h.x, h.y + 14);
      ctx.stroke();

      ctx.restore();
    });

    // 2. 更新與繪製所有爆破粒子
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.gravity || 150) * dt; // 重力

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;

      if (p.type === 'circle') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (2 - alpha), 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'star') {
        ctx.fillStyle = p.color;
        ctx.font = `${p.size}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', p.x, p.y);
      } else if (p.type === 'text') {
        ctx.fillStyle = p.color;
        ctx.font = `bold ${p.size}px "Outfit", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(p.text, p.x, p.y);
      }

      ctx.restore();
    }

    requestAnimationFrame((ts) => this.renderFxLoop(ts));
  }

  // 生成泡泡破裂噴濺水滴水花
  spawnBubblePopParticles(x, y) {
    // 膨脹光環
    this.particles.push({
      type: 'ring',
      x, y,
      vx: 0, vy: 0,
      gravity: 0,
      size: 40,
      color: 'rgba(144, 205, 244, 0.8)',
      life: 0.3,
      maxLife: 0.3
    });

    // 水滴彩珠
    const colors = ['#63b3ed', '#76e4f7', '#90cdf4', '#bbf7d0', '#fed7aa', '#fefcbf'];
    for (let i = 0; i < 22; i++) {
      const angle = (Math.PI * 2 / 22) * i + (Math.random() - 0.5);
      const speed = 80 + Math.random() * 220;
      this.particles.push({
        type: 'circle',
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 240,
        size: 3 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 0.5 + Math.random() * 0.3,
        maxLife: 0.8
      });
    }
  }

  // 生成答對金色星星
  spawnCorrectStars(x, y) {
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 180;
      this.particles.push({
        type: 'star',
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        gravity: 120,
        size: 16 + Math.random() * 12,
        color: '#f6e05e',
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1.0
      });
    }
  }

  // 飄浮得分字樣
  spawnFloatingScore(text, x, y, color) {
    this.particles.push({
      type: 'text',
      text,
      x, y: y - 10,
      vx: 0,
      vy: -70,
      gravity: -10,
      size: 26,
      color,
      life: 0.8,
      maxLife: 0.8
    });
  }

  // 顯示操作指示或鼓勵提示
  showNotice(msg, type = 'info') {
    this.dom.statusNotice.textContent = msg;
    this.dom.statusNotice.className = `status-notice notice-${type}`;
  }

  // 暫停遊戲
  pauseGame() {
    if (this.state.mode !== 'playing') return;
    this.state.mode = 'paused';
    this.dom.pauseModal.hidden = false;
  }

  // 繼續遊戲
  resumeGame() {
    if (this.state.mode !== 'paused') return;
    this.state.mode = 'playing';
    this.dom.pauseModal.hidden = true;
  }

  // 遊戲結算 (Game Over)
  gameOver(reason = '') {
    this.state.mode = 'gameover';
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
      this.gameTimer = null;
    }

    window.soundSystem.playGameOver();

    // 計算統計數據
    const totalAttempts = this.state.correctCount + this.state.wrongCount;
    const accuracy = totalAttempts > 0 ? Math.round((this.state.correctCount / totalAttempts) * 100) : 0;

    // 填充結算視窗
    document.getElementById('go-reason').textContent = reason;
    document.getElementById('go-score').textContent = this.state.score;
    document.getElementById('go-combo').textContent = this.state.maxCombo;
    document.getElementById('go-correct').textContent = `${this.state.correctCount} 題`;
    document.getElementById('go-accuracy').textContent = `${accuracy}%`;
    document.getElementById('go-time').textContent = `${this.state.elapsedTime} 秒`;

    this.dom.gameoverModal.hidden = false;
  }

  // 提交玩家分數至 LocalStorage 排行榜
  submitScoreToLeaderboard() {
    const name = this.dom.playerNameInput.value.trim() || 'Hero';
    const totalAttempts = this.state.correctCount + this.state.wrongCount;
    const accuracy = totalAttempts > 0 ? Math.round((this.state.correctCount / totalAttempts) * 100) : 0;

    const entry = {
      name,
      score: this.state.score,
      maxCombo: this.state.maxCombo,
      accuracy,
      duration: this.state.elapsedTime,
      date: new Date().toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    };

    const storageKey = `esl_bubble_lb_${this.state.gameMode}`;
    let list = [];
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) list = JSON.parse(stored);
    } catch (e) {
      list = [];
    }

    list.push(entry);
    // 按分數由大至小排序，若分數相同則比較答對率
    list.sort((a, b) => b.score - a.score || b.accuracy - a.accuracy);
    // 僅保留前 15 名
    list = list.slice(0, 15);

    try {
      localStorage.setItem(storageKey, JSON.stringify(list));
    } catch (e) {}

    // 關閉 Game Over Modal 並切換至排行榜
    this.dom.gameoverModal.hidden = true;
    this.showLeaderboard(this.state.gameMode);
  }

  // 開啟排行榜
  showLeaderboard(mode = 'timed') {
    this.dom.leaderboardModal.hidden = false;
    document.querySelectorAll('.lb-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === mode);
    });
    this.renderLeaderboardList(mode);
  }

  // 渲染排行榜表格清單
  renderLeaderboardList(mode) {
    const storageKey = `esl_bubble_lb_${mode}`;
    let list = [];
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) list = JSON.parse(stored);
    } catch (e) {
      list = [];
    }

    const container = document.getElementById('lb-list-content');
    if (list.length === 0) {
      container.innerHTML = `<div class="lb-empty">目前尚無挑戰紀錄，快來奪下第一個名次吧！</div>`;
      return;
    }

    let html = `
      <table class="lb-table">
        <thead>
          <tr>
            <th>名次</th>
            <th>玩家姓名</th>
            <th>得分</th>
            <th>連擊</th>
            <th>準確率</th>
            <th>遊玩時間</th>
            <th>日期</th>
          </tr>
        </thead>
        <tbody>
    `;

    list.forEach((item, index) => {
      let rankBadge = `${index + 1}`;
      if (index === 0) rankBadge = '🥇 1';
      else if (index === 1) rankBadge = '🥈 2';
      else if (index === 2) rankBadge = '🥉 3';

      html += `
        <tr class="${index < 3 ? 'top-rank' : ''}">
          <td class="rank-col">${rankBadge}</td>
          <td class="name-col"><b>${this.escapeHtml(item.name)}</b></td>
          <td class="score-col">⭐ ${item.score}</td>
          <td>✦ ${item.maxCombo || 0}</td>
          <td>${item.accuracy}%</td>
          <td>${item.duration}s</td>
          <td class="date-col">${item.date}</td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  }

  escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }
}

// 頁面載入完成後啟動遊戲主體
window.addEventListener('DOMContentLoaded', () => {
  new ESLBubbleGame();
});
