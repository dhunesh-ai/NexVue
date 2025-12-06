import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Upload, RefreshCw, Zap, AlertTriangle, Eye, Volume2, VolumeX, Play, Pause, Scan } from 'lucide-react';
import { analyzeRoadScene } from './services/geminiService';
import AnalysisPanel from './components/AnalysisPanel';
import { AnalysisResult } from './types';

const App: React.FC = () => {
  // Modes
  const [mode, setMode] = useState<'initial' | 'camera' | 'upload'>('initial');
  const [fileType, setFileType] = useState<'image' | 'video' | null>(null);

  // Data
  const [mediaSource, setMediaSource] = useState<string | null>(null); // For uploaded files (URL)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null); // For live camera
  const [result, setResult] = useState<AnalysisResult | null>(null);

  // States
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isAutoScan, setIsAutoScan] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const autoScanInterval = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Voice / TTS Logic ---
  const speak = useCallback((text: string, priority: boolean = false) => {
    if (!isVoiceEnabled || !window.speechSynthesis) return;

    // Cancel current speech if priority (e.g. Danger)
    if (priority) window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1; // Slightly faster for alerts
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }, [isVoiceEnabled]);

  // React to new results with Voice
  useEffect(() => {
    if (result && isVoiceEnabled) {
      if (result.safetyLevel === 'DANGER') {
        speak(`Warning. ${result.recommendation}`, true);
      } else if (result.safetyLevel === 'CAUTION') {
        speak(`Caution. ${result.recommendation}`);
      } else {
        // Only speak safe messages if it's not spamming in auto-scan
        if (!isAutoScan) speak(result.recommendation);
      }
    }
  }, [result, isVoiceEnabled, speak, isAutoScan]);

  // --- Camera Logic ---
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      setCameraStream(stream);
      setMode('camera');
      setFileType('video'); // Camera is treated as a video stream
      setError(null);
      setResult(null);
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Could not access camera. Check permissions or try a different browser.");
    }
  };

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [cameraStream]);

  // Attach stream to video element when ready
  useEffect(() => {
    if (mode === 'camera' && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(e => console.error("Video play error:", e));
    }
  }, [mode, cameraStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      if (autoScanInterval.current) {
        clearInterval(autoScanInterval.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- File Upload Logic ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setMediaSource(url);
      setMode('upload');
      setResult(null);
      setError(null);

      if (file.type.startsWith('video/')) {
        setFileType('video');
      } else {
        setFileType('image');
      }
    }
  };

  // --- Analysis Logic ---
  const captureAndAnalyze = async () => {
    if (analyzing) return; // Prevent overlapping requests

    let imageDataUrl: string | null = null;

    // Capture from Video (Camera or File)
    if (fileType === 'video' && videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      // Ensure we have dimensions
      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        imageDataUrl = canvas.toDataURL('image/jpeg', 0.8); // 0.8 quality for speed
      }
    }
    // Capture from Image
    else if (fileType === 'image' && mediaSource) {
      try {
        const response = await fetch(mediaSource);
        const blob = await response.blob();
        imageDataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        console.error("Error converting image to base64:", error);
        return;
      }
    }

    if (imageDataUrl) {
      setAnalyzing(true);
      try {
        const analysis = await analyzeRoadScene(imageDataUrl);
        setResult(analysis);
        setError(null);
      } catch (err) {
        // Don't show full error in auto-scan mode to avoid flicker, just log
        console.error(err);
        if (!isAutoScan) setError("Analysis failed. Try again.");
      } finally {
        setAnalyzing(false);
      }
    }
  };

  // --- Auto Scan Effect ---
  useEffect(() => {
    if (isAutoScan) {
      const id = window.setInterval(() => {
        captureAndAnalyze();
      }, 4000); // Scan every 4 seconds
      autoScanInterval.current = id;
    } else {
      if (autoScanInterval.current) {
        clearInterval(autoScanInterval.current);
        autoScanInterval.current = null;
      }
    }
    return () => {
      if (autoScanInterval.current) clearInterval(autoScanInterval.current);
    };
  }, [isAutoScan, fileType, mediaSource, mode, cameraStream]); // Dependencies for auto-scan

  const reset = () => {
    stopCamera();
    setIsAutoScan(false);
    setMode('initial');
    setMediaSource(null);
    setResult(null);
    setFileType(null);
    setError(null);
  };

  // Render Helpers
  const renderVisualizer = () => {
    if (mode === 'initial') {
      return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-gray-800 rounded-lg bg-gray-900/20 m-4">
          <div className="w-20 h-20 rounded-full bg-hud-cyan/10 flex items-center justify-center mb-6 animate-pulse">
            <Eye className="w-10 h-10 text-hud-cyan" />
          </div>
          <h2 className="text-2xl font-mono font-bold text-white mb-2">SYSTEM STANDBY</h2>
          <p className="text-gray-400 max-w-md mb-8">Select an input source to begin autonomous road analysis and hazard detection.</p>
        </div>
      );
    }

    return (
      <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden group">

        {/* Constrained Media Container */}
        <div className="relative max-w-[60%] max-h-[60%] w-full h-full flex items-center justify-center rounded-xl overflow-hidden border border-gray-800 shadow-[0_0_50px_rgba(0,0,0,0.5)] bg-black/50">
          {/* Media Player */}
          {fileType === 'video' ? (
            <video
              ref={videoRef}
              src={mode === 'upload' && mediaSource ? mediaSource : undefined}
              autoPlay
              playsInline
              controls={mode === 'upload'}
              loop={mode === 'upload'}
              muted
              className="w-full h-full object-contain"
            />
          ) : (
            <img ref={imageRef} src={mediaSource!} alt="Analysis Target" className="w-full h-full object-contain" />
          )}

          {/* HUD Overlay (Scanning Effect) - Scoped to Media */}
          {(analyzing || isAutoScan) && (
            <div className="absolute inset-0 pointer-events-none z-10">
              <div className="absolute top-0 left-0 w-full h-1 bg-hud-cyan/50 shadow-[0_0_15px_rgba(0,240,255,0.8)] animate-[scan_2s_linear_infinite]"></div>
              <div className="absolute inset-0 border-[2px] border-hud-cyan/30 rounded-xl"></div>
              <div className="absolute top-4 right-4 text-hud-cyan font-mono text-[10px] animate-pulse bg-black/50 px-2 py-1 rounded">ANALYZING FRAME DATA...</div>
            </div>
          )}
        </div>

        {/* HUD Grid (Background) */}
        <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(rgba(0,240,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,240,255,0.1)_1px,transparent_1px)] bg-[size:40px_40px] -z-10"></div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans flex flex-col md:flex-row overflow-hidden">
      {/* Decorative Scan Line */}
      <div className="scan-line"></div>

      {/* LEFT: Main Visual Area */}
      <div className="flex-1 flex flex-col relative border-r border-hud-border">
        {/* Header */}
        <div className="absolute top-0 left-0 w-full p-4 z-40 flex justify-between items-center bg-gradient-to-b from-black/90 via-black/50 to-transparent">
          <div className="flex items-center space-x-3">
            <Eye className="text-hud-cyan w-6 h-6" />
            <h1 className="font-mono font-bold text-xl tracking-wider text-hud-cyan drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]">
              Nex<span className="text-white">Vue</span>
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-hud-border text-gray-400 border border-gray-700">
              V3
            </span>
          </div>

          {/* Centered Input & Action Controls */}
          <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-3">
            {mode === 'initial' ? (
              <>
                <button
                  onClick={startCamera}
                  className="flex items-center gap-2 px-4 py-2 rounded border transition-all group bg-black/40 border-gray-700 text-gray-400 hover:text-hud-cyan hover:border-hud-cyan/50"
                >
                  <Camera className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span className="font-mono text-xs sm:text-sm tracking-wide">LIVE CAMERA</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 rounded border transition-all group bg-black/40 border-gray-700 text-gray-400 hover:text-white hover:border-white"
                >
                  <Upload className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span className="font-mono text-xs sm:text-sm tracking-wide">UPLOAD MEDIA</span>
                </button>
              </>
            ) : (
              <>
                {!isAutoScan && (
                  <button
                    onClick={captureAndAnalyze}
                    disabled={analyzing}
                    className="flex items-center gap-2 px-4 py-2 bg-hud-cyan text-black font-bold font-mono text-xs sm:text-sm rounded hover:bg-white transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(0,240,255,0.4)]"
                  >
                    <Scan className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
                    {analyzing ? 'SCANNING' : 'SCAN'}
                  </button>
                )}

                {fileType === 'video' && (
                  <button
                    onClick={() => setIsAutoScan(!isAutoScan)}
                    className={`flex items-center gap-2 px-4 py-2 border font-mono text-xs sm:text-sm rounded transition-all ${isAutoScan
                      ? 'bg-hud-red/20 border-hud-red text-hud-red animate-pulse'
                      : 'bg-black/40 border-hud-cyan/50 text-hud-cyan hover:bg-hud-cyan/10'
                      }`}
                  >
                    {isAutoScan ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {isAutoScan ? 'STOP' : 'AUTO'}
                  </button>
                )}

                <button
                  onClick={reset}
                  className="flex items-center gap-2 px-4 py-2 bg-black/40 border border-gray-700 text-gray-400 font-mono text-xs sm:text-sm rounded hover:text-white hover:border-white transition-all"
                  title="Reset Mode"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span className="hidden sm:inline">RESET</span>
                </button>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          <div className="flex items-center gap-4">
            {/* Voice Toggle */}
            <button
              onClick={() => {
                const newState = !isVoiceEnabled;
                setIsVoiceEnabled(newState);
                if (!newState && window.speechSynthesis) {
                  window.speechSynthesis.cancel();
                }
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${isVoiceEnabled
                ? 'bg-hud-cyan/20 border-hud-cyan text-hud-cyan shadow-[0_0_10px_rgba(0,240,255,0.3)]'
                : 'bg-black/40 border-gray-700 text-gray-500 hover:border-gray-500'
                }`}
            >
              {isVoiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="text-xs font-mono uppercase hidden sm:inline">
                {isVoiceEnabled ? 'Voice Active' : 'Voice Muted'}
              </span>
            </button>

            <div className="text-[10px] font-mono text-hud-green flex items-center gap-2 hidden sm:flex">
              <span className={`w-2 h-2 rounded-full ${analyzing || isAutoScan ? 'bg-hud-amber animate-ping' : 'bg-hud-green animate-pulse'}`}></span>
              {analyzing ? 'PROCESSING' : 'SYSTEM ONLINE'}
            </div>
          </div>
        </div>

        {/* Viewport Content */}
        <div className="flex-1 relative bg-black flex flex-col">
          {renderVisualizer()}
        </div>

        {/* Hidden Canvas for Capture */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* RIGHT: Analysis Panel */}
      <div className="w-full md:w-[400px] h-[40vh] md:h-auto bg-hud-dark border-l border-hud-border flex flex-col relative z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
        <AnalysisPanel result={result} loading={analyzing} />

        {/* Error Notification */}
        {error && (
          <div className="absolute bottom-4 left-4 right-4 bg-red-950/90 border border-red-500/50 p-4 rounded backdrop-blur-sm flex items-start gap-3 animate-in slide-in-from-bottom-5 fade-in shadow-lg">
            <AlertTriangle className="text-red-400 w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-red-400 font-mono text-xs font-bold uppercase mb-1">System Error</h4>
              <p className="text-xs text-red-200 leading-relaxed">{error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;