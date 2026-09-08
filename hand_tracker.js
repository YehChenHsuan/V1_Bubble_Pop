/**
 * hand_tracker.js - ESL 視訊單字泡泡遊戲 鏡頭與手勢追蹤核心
 * 具備：
 * 1. 視訊鏡頭串流與鏡像校正 (Mirrored Video Feed)
 * 2. MediaPipe Hands AI 指尖追蹤 (食指與掌心座標)
 * 3. 影格像素差異動態感應 (Motion Detection 離線秒開備援)
 * 4. 滑鼠 / 觸控降級支援
 * 5. 防抖平滑濾波 (Exponential Moving Average) 與氣泡碰撞偵測
 */

class HandTracker {
  constructor(options = {}) {
    this.videoElement = options.videoElement || null;
    this.stageElement = options.stageElement || document.body;
    this.onHandMove = options.onHandMove || (() => {});
    this.onBubbleHit = options.onBubbleHit || (() => {});
    this.statusCallback = options.onStatusChange || (() => {});

    this.stream = null;
    this.cameraReady = false;
    this.mediaPipeActive = false;
    this.motionActive = true;
    this.isMirrored = true;

    // 平滑座標紀錄
    this.hands = []; // 儲存當前偵測到的手勢 [{x, y, rawX, rawY, id}]
    this.lastHitTimes = new Map(); // 泡泡碰撞防連擊冷卻時間

    // 動態感測用離線 Canvas (低解析度保證 60 FPS)
    this.motionCanvas = document.createElement('canvas');
    this.motionCanvas.width = 160;
    this.motionCanvas.height = 120;
    this.motionCtx = this.motionCanvas.getContext('2d', { willReadFrequently: true });
    this.prevFrameData = null;

    // 動畫輪詢 handle
    this.animFrameId = null;
    this.mpHands = null;

    // 靈敏度 (可透過設定調整: low, medium, high)
    this.motionThreshold = 28; // 像素差異閥值
    this.motionHitTriggerScore = 18; // 觸發碰撞之動態點數
  }

  // 啟動視訊鏡頭與追蹤
  async initCamera() {
    this.statusCallback('正在啟動視訊鏡頭...');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      });

      if (this.videoElement) {
        this.videoElement.srcObject = this.stream;
        await this.videoElement.play();
        this.cameraReady = true;
        this.statusCallback('視訊鏡頭已啟動');
      }

      // 嘗試初始化 MediaPipe Hands
      this.initMediaPipeHands();

      // 啟動影格循環分析
      this.startLoop();
      return true;
    } catch (err) {
      console.warn('無法存取視訊鏡頭或被拒絕授權:', err);
      this.cameraReady = false;
      this.statusCallback('無法存取鏡頭，已自動啟用滑鼠/觸控模式');
      return false;
    }
  }

  // 嘗試載入 MediaPipe Hands AI 模型
  initMediaPipeHands() {
    if (typeof window.Hands !== 'function') {
      console.info('未載入 MediaPipe 函式庫，自動切換至高效率動態差異感應引擎');
      return;
    }

    try {
      this.mpHands = new window.Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
      });

      this.mpHands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      this.mpHands.onResults((results) => {
        this.handleMediaPipeResults(results);
      });

      this.mediaPipeActive = true;
      this.statusCallback('AI 手勢辨識已就緒');
    } catch (e) {
      console.warn('MediaPipe 初始化失敗，使用動態感測:', e);
      this.mediaPipeActive = false;
    }
  }

  // 解析 MediaPipe 偵測結果
  handleMediaPipeResults(results) {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      if (this.mediaPipeActive) {
        // 沒有偵測到手時清空
        this.hands = [];
        this.onHandMove([]);
      }
      return;
    }

    const rect = this.stageElement.getBoundingClientRect();
    const currentHands = [];

    results.multiHandLandmarks.forEach((landmarks, idx) => {
      // 8 為食指尖 (Index Finger Tip), 4 為拇指尖, 9 為中指掌指關節
      const tip = landmarks[8];
      if (!tip) return;

      // 鏡像計算：使用者身體右移，鏡頭左側，鏡像翻轉後應在畫面右側
      const normX = this.isMirrored ? (1 - tip.x) : tip.x;
      const targetX = normX * rect.width;
      const targetY = tip.y * rect.height;

      // 平滑濾波 (EMA)
      const prevHand = this.hands.find(h => h.id === idx);
      let smoothX = targetX;
      let smoothY = targetY;

      if (prevHand) {
        smoothX = prevHand.x * 0.45 + targetX * 0.55;
        smoothY = prevHand.y * 0.45 + targetY * 0.55;
      }

      currentHands.push({
        id: idx,
        x: smoothX,
        y: smoothY,
        normX: normX,
        normY: tip.y
      });

      // 進行泡泡命中測試
      this.checkBubbleCollisions(smoothX, smoothY);
    });

    this.hands = currentHands;
    this.onHandMove(this.hands);
  }

  // 循環監控分析影格 (同時支援 MediaPipe 送針與 Motion Differencing)
  startLoop() {
    let lastMpProcessTime = 0;

    const loop = async (timestamp) => {
      if (this.cameraReady && this.videoElement && this.videoElement.readyState >= 2) {
        // 1. 若 MediaPipe 啟用，每秒分析約 25~30 幀
        if (this.mediaPipeActive && this.mpHands && timestamp - lastMpProcessTime > 33) {
          lastMpProcessTime = timestamp;
          try {
            await this.mpHands.send({ image: this.videoElement });
          } catch (e) {
            // 避免單幀異常中斷整體循環
          }
        }

        // 2. 當 MediaPipe 未啟動或暫無手部時，使用光流動態感測
        if (!this.mediaPipeActive || this.hands.length === 0) {
          this.processMotionDifferencing();
        }
      }

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  // 像素差異動態感應演算法 (極速 60FPS 備援機制)
  processMotionDifferencing() {
    if (!this.videoElement || this.videoElement.paused || this.videoElement.ended) return;

    const w = this.motionCanvas.width;
    const h = this.motionCanvas.height;

    this.motionCtx.drawImage(this.videoElement, 0, 0, w, h);
    const currentFrame = this.motionCtx.getImageData(0, 0, w, h);
    const curr = currentFrame.data;

    if (!this.prevFrameData) {
      this.prevFrameData = curr;
      return;
    }

    const prev = this.prevFrameData;
    let motionCount = 0;
    let sumX = 0;
    let sumY = 0;

    // 取得當前所有作用中之泡泡元素幾何範圍
    const stageRect = this.stageElement.getBoundingClientRect();
    const bubbleElements = Array.from(document.querySelectorAll('.word-bubble:not(.popping)'));
    const bubbleHitMap = new Map();

    bubbleElements.forEach(el => {
      const rect = el.getBoundingClientRect();
      // 轉為 stage 相對坐標
      const bX = rect.left - stageRect.left + rect.width / 2;
      const bY = rect.top - stageRect.top + rect.height / 2;
      const radius = rect.width / 2;
      bubbleHitMap.set(el.dataset.wordId, {
        id: el.dataset.wordId,
        x: bX,
        y: bY,
        r: radius,
        hits: 0
      });
    });

    // 遍歷像素取樣 (每隔 2 像素採樣一次提升效能)
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const i = (y * w + x) * 4;
        const diff = Math.abs(curr[i] - prev[i]) +
                     Math.abs(curr[i + 1] - prev[i + 1]) +
                     Math.abs(curr[i + 2] - prev[i + 2]);

        if (diff > this.motionThreshold * 3) {
          // 鏡像座標換算
          const normX = this.isMirrored ? (1 - x / w) : (x / w);
          const normY = y / h;
          const stageX = normX * stageRect.width;
          const stageY = normY * stageRect.height;

          sumX += stageX;
          sumY += stageY;
          motionCount++;
        }
      }
    }

    // 紀錄上一幀
    this.prevFrameData = curr;

    // 若有明顯動態 (揮手動作)，計算動態質心並檢查泡泡碰撞
    if (motionCount >= 30) {
      const avgX = sumX / motionCount;
      const avgY = sumY / motionCount;
      this.hands = [{ id: 0, x: avgX, y: avgY, isMotionCentroid: true }];
      this.onHandMove(this.hands);

      // 當 MediaPipe 未啟動時，以動態質心檢測泡泡碰撞
      if (!this.mediaPipeActive) {
        this.checkBubbleCollisions(avgX, avgY);
      }
    } else {
      if (!this.mediaPipeActive) {
        this.hands = [];
        this.onHandMove([]);
      }
    }
  }

  // 泡泡碰撞檢測 (MediaPipe 專用)
  checkBubbleCollisions(handX, handY) {
    const stageRect = this.stageElement.getBoundingClientRect();
    const bubbleElements = document.querySelectorAll('.word-bubble:not(.popping)');

    bubbleElements.forEach(el => {
      const rect = el.getBoundingClientRect();
      const bX = rect.left - stageRect.left + rect.width / 2;
      const bY = rect.top - stageRect.top + rect.height / 2;
      const radius = rect.width / 2 + 10; // 稍微增加感應邊界寬容度

      const dx = handX - bX;
      const dy = handY - bY;
      const distSq = dx * dx + dy * dy;

      if (distSq <= radius * radius) {
        this.triggerBubbleHit(el.dataset.wordId, bX, bY);
      }
    });
  }

  // 觸發泡泡命中 (加入 450ms 冷卻避免連擊)
  triggerBubbleHit(wordId, hitX, hitY) {
    const now = performance.now();
    const lastHit = this.lastHitTimes.get(wordId) || 0;
    if (now - lastHit < 450) return;

    this.lastHitTimes.set(wordId, now);
    this.onBubbleHit(wordId, hitX, hitY);
  }

  // 滑鼠 / 觸控點擊降級相容
  bindMouseAndTouch(stage) {
    stage.addEventListener('pointerdown', (e) => {
      const rect = this.stageElement.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // 更新手勢光點
      this.hands = [{ id: 'pointer', x, y }];
      this.onHandMove(this.hands);

      // 檢查點擊目標是否為泡泡
      const targetBubble = e.target.closest('.word-bubble');
      if (targetBubble && !targetBubble.classList.contains('popping')) {
        const wordId = targetBubble.dataset.wordId;
        this.triggerBubbleHit(wordId, x, y);
      }
    });

    stage.addEventListener('pointermove', (e) => {
      const rect = this.stageElement.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.hands = [{ id: 'pointer', x, y }];
      this.onHandMove(this.hands);
    });
  }

  // 銷毀與停止
  stop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.cameraReady = false;
  }
}

window.HandTracker = HandTracker;
