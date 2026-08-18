import { useTTSStore } from '@/lib/store/tts-store';
import { WorkerOutMessage } from '@/types';

class TTSEngine {
  private worker: Worker | null = null;
  private audioContext: AudioContext | null = null;
  private currentSourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private sentenceQueue: { id: number; text: string }[] = [];
  private audioBufferCache: Map<number, { buffer: AudioBuffer; sampleRate: number }> = new Map();

  private isSynthesizing = false;
  private isPlayingAudio = false;

  public initWorker() {
    if (this.worker || typeof window === 'undefined') return;

    useTTSStore.getState().setModelStatus('loading', 0);

    this.worker = new Worker(new URL('./tts-worker.ts', import.meta.url), {
      type: 'module',
    });

    this.worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
      const msg = event.data;

      if (msg.type === 'progress') {
        const percent = Math.round((msg.loaded / (msg.total || 63500000)) * 100);
        useTTSStore.getState().setModelStatus('loading', percent);
      } else if (msg.type === 'ready') {
        useTTSStore.getState().setModelStatus('ready', 100);
      } else if (msg.type === 'audio') {
        this.handleAudioReceived(msg.id, msg.buffer, msg.sampleRate);
      } else if (msg.type === 'error') {
        console.error('TTS Worker error:', msg.message);
        this.isSynthesizing = false;
        if (useTTSStore.getState().modelStatus !== 'ready') {
          useTTSStore.getState().setModelStatus('error', 0, msg.message);
        }
      }
    };

    // Send init message
    const modelUrl = process.env.NEXT_PUBLIC_MODEL_BASE_URL
      ? `${process.env.NEXT_PUBLIC_MODEL_BASE_URL}/ngochuyennew.onnx`
      : '/models/ngochuyennew.onnx';
    const configUrl = process.env.NEXT_PUBLIC_MODEL_BASE_URL
      ? `${process.env.NEXT_PUBLIC_MODEL_BASE_URL}/ngochuyennew.onnx.json`
      : '/models/ngochuyennew.onnx.json';

    this.worker.postMessage({
      type: 'init',
      modelUrl,
      configUrl,
    });
  }

  private initAudioContext() {
    if (!this.audioContext && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
    }

    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  public playSentences(sentences: string[], startIndex = 0, chapterTitle = '') {
    this.initAudioContext();
    this.stopPlayback();

    useTTSStore.getState().setSentences(sentences, chapterTitle, startIndex);
    useTTSStore.getState().setIsPlaying(true);

    this.sentenceQueue = sentences.map((text, idx) => ({ id: idx, text }));
    this.audioBufferCache.clear();

    // Start prefetching audio from current index
    this.prefetchNextSentences(startIndex);
    this.playNextAudioFromIndex(startIndex);
  }

  public pause() {
    if (this.currentSourceNode) {
      this.currentSourceNode.stop();
    }
    useTTSStore.getState().setIsPaused(true);
    this.isPlayingAudio = false;
  }

  public resume() {
    this.initAudioContext();
    const currentIndex = useTTSStore.getState().currentSentenceIndex;
    useTTSStore.getState().setIsPlaying(true);
    this.playNextAudioFromIndex(currentIndex);
  }

  public stopPlayback() {
    if (this.currentSourceNode) {
      try {
        this.currentSourceNode.stop();
      } catch (e) {
        // ignore
      }
      this.currentSourceNode = null;
    }
    this.isPlayingAudio = false;
    useTTSStore.getState().setIsPlaying(false);
  }

  public setSpeed(speed: number) {
    useTTSStore.getState().setPlaybackSpeed(speed);
    if (this.currentSourceNode) {
      this.currentSourceNode.playbackRate.value = speed;
    }
  }

  public setVolume(volume: number) {
    useTTSStore.getState().setVolume(volume);
    if (this.gainNode && this.audioContext) {
      this.gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
    }
  }

  private prefetchNextSentences(currentIndex: number) {
    if (!this.worker || this.isSynthesizing) return;

    // Prefetch up to 3 sentences ahead
    const toFetch = this.sentenceQueue.filter(
      (item) => item.id >= currentIndex && item.id < currentIndex + 3 && !this.audioBufferCache.has(item.id)
    );

    if (toFetch.length > 0) {
      const nextItem = toFetch[0];
      this.isSynthesizing = true;
      this.worker.postMessage({
        type: 'synthesize',
        id: nextItem.id,
        text: nextItem.text,
      });
    }
  }

  private handleAudioReceived(id: number, rawPcmBuffer: Float32Array, sampleRate: number) {
    this.isSynthesizing = false;

    if (this.audioContext && rawPcmBuffer.length > 0) {
      const audioBuf = this.audioContext.createBuffer(1, rawPcmBuffer.length, sampleRate);
      audioBuf.getChannelData(0).set(rawPcmBuffer);
      this.audioBufferCache.set(id, { buffer: audioBuf, sampleRate });
    }

    const currentIndex = useTTSStore.getState().currentSentenceIndex;

    // If waiting to play current sentence, play now
    if (id === currentIndex && useTTSStore.getState().isPlaying && !this.isPlayingAudio) {
      this.playNextAudioFromIndex(currentIndex);
    }

    // Prefetch next ones
    this.prefetchNextSentences(currentIndex + 1);
  }

  private playNextAudioFromIndex(index: number) {
    const store = useTTSStore.getState();
    if (!store.isPlaying) return;

    if (index >= store.sentences.length) {
      this.stopPlayback();
      return;
    }

    store.setCurrentSentenceIndex(index);

    const cached = this.audioBufferCache.get(index);

    if (!cached) {
      // Audio not ready yet, trigger synthesis and wait
      this.prefetchNextSentences(index);
      return;
    }

    this.initAudioContext();
    if (!this.audioContext || !this.gainNode) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = cached.buffer;
    source.playbackRate.value = store.playbackSpeed;
    source.connect(this.gainNode);

    this.currentSourceNode = source;
    this.isPlayingAudio = true;

    source.onended = () => {
      this.isPlayingAudio = false;
      // Clean old cache entries to save memory
      this.audioBufferCache.delete(index - 2);

      if (useTTSStore.getState().isPlaying) {
        const nextIdx = index + 1;
        this.prefetchNextSentences(nextIdx);
        this.playNextAudioFromIndex(nextIdx);
      }
    };

    source.start(0);
  }
}

export const ttsEngine = new TTSEngine();
