/*
 * sound.js - ESL 視訊單字泡泡遊戲 音效與語音模組 (V2 專用)
 * 包含：教材真人發音播放 (英/中)、Web Audio 擬真泡泡爆破音、答對答錯琶音、背景音樂
 */

class SoundSystem {
  constructor() {
    this.audioCtx = null;
    this.currentVoice = null;
    this.isMuted = false;
    this.bgmPlaying = false;
    this.bgmTimer = null;
    this.audioCache = new Map();
  }

  // 初始化 Web Audio Context（需在使用者點擊或互動後觸發）
  initAudioContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // 切換靜音
  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopBgm();
      if (this.currentVoice) this.currentVoice.pause();
    }
    return this.isMuted;
  }

  // 播放教材真人發音 MP3（支援空白檔名編碼與降級 TTS）
  playWordAudio(wordId, onEnded = null) {
    if (this.isMuted) {
      if (onEnded) setTimeout(onEnded, 300);
      return;
    }

    if (this.currentVoice) {
      this.currentVoice.pause();
      this.currentVoice.currentTime = 0;
    }

    // 處理空白檔名如 "wake up" -> "V1_wake%20up.mp3"
    const fileName = `V1_${wordId}.mp3`;
    const audioPath = `V1_flashcards_audios/${fileName}`;
    const audio = new Audio(encodeURI(audioPath));
    this.currentVoice = audio;

    audio.onended = () => {
      if (onEnded) onEnded();
    };

    audio.onerror = () => {
      // 嘗試備援父目錄路徑
      const backupPath = `../V1_flashcards_audios/${fileName}`;
      const backupAudio = new Audio(encodeURI(backupPath));
      backupAudio.onended = () => { if (onEnded) onEnded(); };
      backupAudio.onerror = () => {
        console.warn(`無法載入語音檔案 ${audioPath}，改用語音合成 (TTS)`);
        this.speakTTS(wordId, onEnded);
      };
      backupAudio.play().catch(() => this.speakTTS(wordId, onEnded));
    };

    audio.play().catch(err => {
      console.warn('音訊播放遭瀏覽器攔截，改用 TTS 或等待使用者互動:', err);
      this.speakTTS(wordId, onEnded);
    });
  }

  // 播放中文真人說明語音
  playZhAudio(wordId, onEnded = null) {
    if (this.isMuted) {
      if (onEnded) setTimeout(onEnded, 300);
      return;
    }

    if (this.currentVoice) {
      this.currentVoice.pause();
      this.currentVoice.currentTime = 0;
    }

    const fileName = `V1_${wordId}_zh.mp3`;
    const audioPath = `V1_flashcards_audios/${fileName}`;
    const audio = new Audio(encodeURI(audioPath));
    this.currentVoice = audio;

    audio.onended = () => {
      if (onEnded) onEnded();
    };

    audio.onerror = () => {
      const backupPath = `../V1_flashcards_audios/${fileName}`;
      const backupAudio = new Audio(encodeURI(backupPath));
      backupAudio.onended = () => { if (onEnded) onEnded(); };
      backupAudio.play().catch(() => {
        if (onEnded) setTimeout(onEnded, 300);
      });
    };

    audio.play().catch(err => {
      console.warn('中文音訊播放失敗:', err);
      if (onEnded) setTimeout(onEnded, 300);
    });
  }

  // 瀏覽器 Web Speech API 降級朗讀
  speakTTS(text, onEnded = null) {
    if (!('speechSynthesis' in window)) {
      if (onEnded) setTimeout(onEnded, 300);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1.1;
    utterance.onend = () => {
      if (onEnded) onEnded();
    };
    utterance.onerror = () => {
      if (onEnded) onEnded();
    };
    window.speechSynthesis.speak(utterance);
  }

  // 擬真泡泡爆破音效 (Web Audio API 合成波)
  playBubblePop() {
    if (this.isMuted) return;
    this.initAudioContext();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      // 頻率自 320Hz 快速滑動至 880Hz，呈現水泡破裂質感
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.08);

      // 加入輕微雜訊啵聲
      const bufferSize = Math.floor(this.audioCtx.sampleRate * 0.02);
      const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const noise = this.audioCtx.createBufferSource();
      noise.buffer = noiseBuffer;
      const noiseFilter = this.audioCtx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = 1200;

      const noiseGain = this.audioCtx.createGain();
      noiseGain.gain.setValueAtTime(0.15, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.audioCtx.destination);

      noise.start(now);
      noise.stop(now + 0.03);
    } catch (e) {
      console.warn('播放泡泡音效失敗:', e);
    }
  }

  // 答對音效（清脆悅耳的大調三和弦琶音 C5-E5-G5-C6）
  playCorrect() {
    if (this.isMuted) return;
    this.initAudioContext();
    if (!this.audioCtx) return;

    try {
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      const now = this.audioCtx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        const noteStart = now + idx * 0.07;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, noteStart);

        gain.gain.setValueAtTime(0.001, noteStart);
        gain.gain.linearRampToValueAtTime(0.22, noteStart + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.35);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(noteStart);
        osc.stop(noteStart + 0.35);
      });
    } catch (e) {
      console.warn('播放答對音效失敗:', e);
    }
  }

  // 答錯音效（柔和的低音雙警示，避免嚇到小朋友）
  playWrong() {
    if (this.isMuted) return;
    this.initAudioContext();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      [220, 185].forEach((freq, idx) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        const noteStart = now + idx * 0.12;

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, noteStart);

        gain.gain.setValueAtTime(0.18, noteStart);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.18);

        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 650;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(noteStart);
        osc.stop(noteStart + 0.18);
      });
    } catch (e) {
      console.warn('播放答錯音效失敗:', e);
    }
  }

  // 遊戲結束音效（勝利或結算和弦）
  playGameOver() {
    if (this.isMuted) return;
    this.initAudioContext();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      const chords = [
        [523.25, 659.25, 783.99], // C
        [587.33, 739.99, 880.00], // D
        [659.25, 830.61, 987.77], // E
        [783.99, 987.77, 1174.66, 1567.98] // G + high G
      ];

      chords.forEach((chord, i) => {
        const chordStart = now + i * 0.18;
        chord.forEach(freq => {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, chordStart);

          gain.gain.setValueAtTime(0.001, chordStart);
          gain.gain.linearRampToValueAtTime(0.12, chordStart + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, chordStart + (i === 3 ? 0.9 : 0.28));

          osc.connect(gain);
          gain.connect(this.audioCtx.destination);

          osc.start(chordStart);
          osc.stop(chordStart + (i === 3 ? 0.9 : 0.28));
        });
      });
    } catch (e) {
      console.warn('播放結束音效失敗:', e);
    }
  }

  // 背景旋律 (可愛的 8-bit / 輕柔八音盒搖擺琶音)
  startBgm() {
    if (this.bgmPlaying || this.isMuted) return;
    this.initAudioContext();
    if (!this.audioCtx) return;

    this.bgmPlaying = true;
    const melody = [
      { note: 523.25, dur: 0.25 }, // C5
      { note: 659.25, dur: 0.25 }, // E5
      { note: 783.99, dur: 0.25 }, // G5
      { note: 659.25, dur: 0.25 }, // E5
      { note: 880.00, dur: 0.25 }, // A5
      { note: 783.99, dur: 0.25 }, // G5
      { note: 659.25, dur: 0.25 }, // E5
      { note: 587.33, dur: 0.25 }  // D5
    ];

    let noteIdx = 0;
    const playNext = () => {
      if (!this.bgmPlaying || this.isMuted || !this.audioCtx) return;

      const item = melody[noteIdx];
      const now = this.audioCtx.currentTime;

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(item.note, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.035, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + item.dur * 1.8);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + item.dur * 1.8);

      noteIdx = (noteIdx + 1) % melody.length;
      this.bgmTimer = setTimeout(playNext, item.dur * 1000);
    };

    playNext();
  }

  // 停止背景音樂
  stopBgm() {
    this.bgmPlaying = false;
    if (this.bgmTimer) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}

// 建立全域音效單例
window.soundSystem = new SoundSystem();
