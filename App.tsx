import React, { useState, useRef, useEffect, useCallback } from 'react';
import { analyzeScreenImage, generateGuideForSuggestion } from './services/geminiService';
import { saveGuideToHistory } from './services/storageService';
import AutomationCard from './components/AutomationCard';
import GuideView from './components/GuideView';
import HistoryView from './components/HistoryView';
import { ICONS } from './constants';
import { AppState, AutomationSuggestion, DetailedGuide } from './types';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [suggestions, setSuggestions] = useState<AutomationSuggestion[]>([]);
  const [selectedGuide, setSelectedGuide] = useState<DetailedGuide | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastImage, setLastImage] = useState<string | null>(null); // Store captured frame for Guide Gen
  const [previousState, setPreviousState] = useState<AppState>(AppState.IDLE); // To handle closing history
  
  // Auto Scan States
  const [isAutoScan, setIsAutoScan] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize Video Stream when stream state changes
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleStopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsAutoScan(false);

    // If we have content (suggestions/guide) or history is open, don't fully reset
    const hasContent = suggestions.length > 0 || selectedGuide !== null || appState === AppState.HISTORY;

    if (!hasContent) {
        setAppState(AppState.IDLE);
    } else {
         // If we were recording/analyzing, switch to suggesting (showing results or last state)
         if (appState === AppState.RECORDING || appState === AppState.ANALYZING) {
             setAppState(AppState.SUGGESTING);
         }
         // Otherwise stay in VIEWING_GUIDE, HISTORY, etc.
    }
  }, [stream, suggestions.length, selectedGuide, appState]);

  const handleReset = () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      setIsAutoScan(false);
      setAppState(AppState.IDLE);
      setSuggestions([]);
      setSelectedGuide(null);
      setLastImage(null);
  };

  const startScreenShare = async (autoStart: boolean = false) => {
    try {
      setErrorMsg(null);
      // Verify API exists
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error("Screen sharing is not supported in this browser/environment.");
      }

      // Simplified constraints for better compatibility
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });
      
      setStream(displayStream);
      setAppState(AppState.RECORDING);
      setIsAutoScan(autoStart);

      // Handle user stopping stream via browser UI
      displayStream.getVideoTracks()[0].onended = () => {
        // We can't access the latest state in this closure comfortably without refs or careful dependency management,
        // but checking the stream state isn't strictly necessary if we just trigger the stop logic.
        // However, we need to ensure we call the version of handleStopStream that has access to current state.
        // Since this is an event listener attached once, we need to be careful. 
        // Best approach in React effect/callback world: trigger a state update that effects can react to, or rely on the fact that 
        // we re-attach if stream changes? No, track.onended is native.
        // Simplest: Just set stream null here, and let an effect handle the rest? 
        // Or simpler: dispatch a custom event or just accept that we might reset to IDLE if we don't handle state persistence here well.
        // Actually, calling the state setter from here works fine.
        
        // IMPORTANT: Direct state access inside this callback refers to closure state. 
        // We'll use a functional update on setStream to detect change, but logic is complex.
        // Instead, let's manually trigger the stop logic which we will try to keep consistent.
        
        // Workaround: The handleStopStream function is recreated on state change. 
        // But the onended listener is attached to the track object which doesn't update.
        // We need a ref to the stop handler.
        stopStreamRef.current();
      };

    } catch (err: any) {
      console.error("Error accessing screen:", err);
      // Handle various permission denial cases
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
        setErrorMsg("Permission denied. Please allow screen sharing when prompted, and check your System Settings (Privacy > Screen Recording) if on macOS.");
      } else if (err.message && err.message.includes('permissions policy')) {
        setErrorMsg("Screen sharing is blocked by the environment policy. Please check if 'display-capture' permission is enabled.");
      } else {
        setErrorMsg("Failed to access screen: " + (err.message || "Unknown error"));
      }
    }
  };

  // Ref pattern to ensure onended always calls the latest handleStopStream
  const stopStreamRef = useRef(handleStopStream);
  useEffect(() => {
      stopStreamRef.current = handleStopStream;
  }, [handleStopStream]);

  const captureAndAnalyze = useCallback(async (isAuto = false) => {
    if (!videoRef.current || !canvasRef.current) return;
    if (isAnalyzing) return; // Prevent overlapping scans

    setIsAnalyzing(true);

    // Visual feedback - only block UI if manual scan
    if (!isAuto) {
        setAppState(AppState.ANALYZING);
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw current frame
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        setIsAnalyzing(false);
        return;
    }
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64Image = canvas.toDataURL('image/png');
    setLastImage(base64Image); // Save for later use in guide generation

    try {
      // Step 1: Analyze Screen
      const results = await analyzeScreenImage(base64Image);
      setSuggestions(results);
      
      if (!isAuto) {
          // Manual Mode: Auto-generate guide if found
          if (results.length > 0) {
            // Step 2: Auto-generate guide for the top suggestion
            const bestSuggestion = results[0];
            setAppState(AppState.GUIDE_LOADING);
    
            try {
              const guide = await generateGuideForSuggestion(bestSuggestion, base64Image);
              setSelectedGuide(guide);
              saveGuideToHistory(guide); // Save automatically
              setAppState(AppState.VIEWING_GUIDE);
            } catch (guideError) {
              console.warn("Auto-guide generation failed, falling back to suggestion list", guideError);
              setAppState(AppState.SUGGESTING);
              setErrorMsg("Could not auto-generate guide. Please select a suggestion from the list.");
            }
          } else {
            setAppState(AppState.SUGGESTING);
          }
      } else {
          // Auto Mode: 
          // If we found results and are currently just recording or already suggesting, show them.
          // Don't interrupt if the user is doing something else (logic handled in interval, but good to be safe)
          if (results.length > 0 && (appState === AppState.RECORDING || appState === AppState.SUGGESTING)) {
               setAppState(AppState.SUGGESTING);
          }
      }
    } catch (err) {
      console.error("Analysis failed:", err);
      if (!isAuto) {
          setErrorMsg("AI Analysis failed. Please try again.");
          setAppState(AppState.RECORDING);
      }
    } finally {
        setIsAnalyzing(false);
    }
  }, [appState, isAnalyzing]);

  // Auto Scan Interval
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    // Run if auto scan is on, stream exists, and we are in a passive state (Recording or Suggesting)
    if (isAutoScan && stream && (appState === AppState.RECORDING || appState === AppState.SUGGESTING)) {
        interval = setInterval(() => {
            captureAndAnalyze(true);
        }, 5000); // Scan every 5 seconds
    }
    return () => clearInterval(interval);
  }, [isAutoScan, stream, appState, captureAndAnalyze]);


  const handleSelectSuggestion = async (suggestion: AutomationSuggestion) => {
    if (!lastImage) return;

    setAppState(AppState.GUIDE_LOADING);
    try {
      const guide = await generateGuideForSuggestion(suggestion, lastImage);
      setSelectedGuide(guide);
      saveGuideToHistory(guide); // Save automatically
      setAppState(AppState.VIEWING_GUIDE);
    } catch (err) {
      console.error("Guide generation failed:", err);
      setErrorMsg("Could not generate guide. Please try again.");
      setAppState(AppState.SUGGESTING);
    }
  };

  const handleBackToSuggestions = () => {
    setAppState(AppState.SUGGESTING);
    setSelectedGuide(null);
  };

  const handleToggleHistory = () => {
    if (appState === AppState.HISTORY) {
        // Close history, revert to previous or IDLE
        setAppState(previousState !== AppState.HISTORY ? previousState : AppState.IDLE);
    } else {
        // Open history
        setPreviousState(appState);
        setAppState(AppState.HISTORY);
    }
  };

  const handleSelectHistoryGuide = (guide: DetailedGuide) => {
      setSelectedGuide(guide);
      setAppState(AppState.VIEWING_GUIDE);
  };

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden">
      
      {/* Sidebar / Left Panel - Controls & Preview */}
      <div className={`flex flex-col border-r border-slate-800 transition-all duration-500 ease-in-out ${appState === AppState.VIEWING_GUIDE || appState === AppState.HISTORY ? 'w-1/3' : 'w-full md:w-1/2'}`}>
        
        {/* Header */}
        <header className="p-6 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center">
              <ICONS.Bolt className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              AutoMate AI
            </h1>
          </div>
          <button 
            onClick={handleToggleHistory}
            className={`p-2 rounded-lg transition-colors ${appState === AppState.HISTORY ? 'bg-cyan-500/20 text-cyan-400' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}`}
            title="View History"
          >
             <ICONS.History className="w-5 h-5" />
          </button>
        </header>

        {/* Main Content Area (Video Preview) */}
        <div className="flex-1 relative flex flex-col items-center justify-center bg-slate-950 p-6 overflow-hidden">
          
          {errorMsg && (
            <div className="absolute top-4 z-50 bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm shadow-lg max-w-[90%] flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              {errorMsg}
            </div>
          )}

          {appState === AppState.IDLE ? (
            <div className="text-center space-y-6 max-w-md w-full">
              <div className="w-20 h-20 bg-slate-800 rounded-2xl mx-auto flex items-center justify-center mb-6 ring-1 ring-slate-700 shadow-2xl">
                <ICONS.ScreenShare className="w-10 h-10 text-slate-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">Share Your Screen</h2>
              <p className="text-slate-400">
                Let our AI analyze your workflow. Share a window or screen where you perform repetitive tasks.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center w-full pt-4">
                <button 
                    onClick={() => startScreenShare(false)}
                    className="flex-1 inline-flex items-center justify-center px-6 py-3 text-sm font-medium text-slate-200 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 hover:text-white transition-all hover:shadow-lg hover:-translate-y-0.5"
                >
                    <ICONS.ScreenShare className="w-5 h-5 mr-2" />
                    Manual Scan
                </button>
                <button 
                    onClick={() => startScreenShare(true)}
                    className="flex-1 inline-flex items-center justify-center px-6 py-3 text-sm font-medium text-white bg-cyan-600 rounded-xl hover:bg-cyan-500 transition-all shadow-[0_0_20px_rgba(8,145,178,0.3)] hover:shadow-[0_0_30px_rgba(8,145,178,0.5)] hover:-translate-y-0.5"
                >
                    <ICONS.Sparkles className="w-5 h-5 mr-2" />
                    Auto Scan
                </button>
              </div>
            </div>
          ) : (
            <div className="relative w-full h-full flex flex-col">
              {/* Live Tag / Snapshot Tag */}
              {stream ? (
                  <div className="absolute top-4 left-4 z-10 flex items-center space-x-2 bg-black/60 backdrop-blur px-3 py-1 rounded-full border border-white/10">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                    <span className="text-xs font-medium text-white">LIVE PREVIEW</span>
                  </div>
              ) : (
                  <div className="absolute top-4 left-4 z-10 flex items-center space-x-2 bg-black/60 backdrop-blur px-3 py-1 rounded-full border border-white/10">
                    <div className="w-2 h-2 rounded-full bg-slate-500"></div>
                    <span className="text-xs font-medium text-slate-300">SNAPSHOT PREVIEW</span>
                  </div>
              )}
              
              {/* Auto Scan Indicator (Floating) */}
              {isAutoScan && isAnalyzing && appState !== AppState.ANALYZING && (
                  <div className="absolute top-4 right-4 z-10 flex items-center space-x-2 bg-cyan-900/60 backdrop-blur px-3 py-1 rounded-full border border-cyan-500/30 animate-pulse">
                      <ICONS.Sparkles className="w-3 h-3 text-cyan-400" />
                      <span className="text-xs font-medium text-cyan-200">Scanning...</span>
                  </div>
              )}

              {/* Video Element */}
              <div className="relative flex-1 rounded-xl overflow-hidden border border-slate-700 bg-black shadow-2xl">
                 {stream ? (
                    <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        muted 
                        className="w-full h-full object-contain"
                    />
                 ) : lastImage ? (
                    <div className="w-full h-full relative">
                         <img 
                            src={lastImage} 
                            alt="Snapshot" 
                            className="w-full h-full object-contain opacity-70" 
                        />
                         <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-slate-200 font-medium flex items-center">
                                <ICONS.Stop className="w-4 h-4 mr-2 text-slate-400" />
                                Stream Paused
                            </div>
                        </div>
                    </div>
                 ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500 flex-col">
                         <ICONS.ScreenShare className="w-12 h-12 mb-3 opacity-20" />
                         <p>Stream Ended</p>
                    </div>
                 )}
                
                {/* Analysis Overlay (Only for blocking manual states) */}
                {(appState === AppState.ANALYZING || appState === AppState.GUIDE_LOADING) && (
                  <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                     <div className="relative w-16 h-16 mb-4">
                        <div className="absolute inset-0 rounded-full border-4 border-cyan-900"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-t-cyan-400 animate-spin"></div>
                     </div>
                     <p className="text-cyan-400 font-mono animate-pulse">
                       {appState === AppState.ANALYZING ? "ANALYZING WORKFLOW..." : "GENERATING GUIDE..."}
                     </p>
                  </div>
                )}
              </div>

              {/* Action Bar */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
                {stream ? (
                    <button 
                        onClick={handleStopStream}
                        className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors border border-slate-700 flex items-center text-sm"
                    >
                        <ICONS.Stop className="w-4 h-4 mr-2" />
                        Stop
                    </button>
                ) : (
                    <button 
                        onClick={handleReset}
                        className="px-6 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition-colors shadow-lg shadow-cyan-900/50 flex items-center font-medium"
                    >
                        <ICONS.ScreenShare className="w-4 h-4 mr-2" />
                        New Scan
                    </button>
                )}
                
                {stream && (
                    <>
                        <button 
                            onClick={() => setIsAutoScan(!isAutoScan)}
                            className={`px-4 py-2 rounded-lg transition-all border flex items-center text-sm font-medium ${
                                isAutoScan 
                                ? 'bg-cyan-900/30 text-cyan-400 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]' 
                                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                            }`}
                        >
                            <ICONS.Sparkles className={`w-4 h-4 mr-2 ${isAutoScan ? 'animate-pulse' : ''}`} />
                            Auto: {isAutoScan ? 'ON' : 'OFF'}
                        </button>

                        <button 
                            onClick={() => captureAndAnalyze(false)}
                            disabled={appState === AppState.ANALYZING || appState === AppState.GUIDE_LOADING || isAnalyzing}
                            className="px-6 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition-colors shadow-lg shadow-cyan-900/50 flex items-center font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ICONS.Scan className="w-5 h-5 mr-2" />
                            {suggestions.length > 0 ? "Re-Scan" : "Scan"}
                        </button>
                    </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Suggestions & Guides & History */}
      {(appState === AppState.SUGGESTING || appState === AppState.VIEWING_GUIDE || appState === AppState.GUIDE_LOADING || appState === AppState.HISTORY) && (
        <div className={`bg-slate-900 transition-all duration-500 ease-in-out ${appState === AppState.VIEWING_GUIDE || appState === AppState.HISTORY ? 'w-2/3' : 'w-full md:w-1/2'} border-l border-slate-800 overflow-hidden flex flex-col`}>
          
          {appState === AppState.HISTORY ? (
              <HistoryView onSelectGuide={handleSelectHistoryGuide} onClose={handleToggleHistory} />
          ) : appState === AppState.VIEWING_GUIDE && selectedGuide ? (
            <GuideView guide={selectedGuide} onBack={handleBackToSuggestions} />
          ) : (
            <div className="flex-1 overflow-y-auto p-8">
              <div className="mb-8 flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2 flex items-center">
                    <ICONS.Sparkles className="w-6 h-6 text-amber-400 mr-2" />
                    Automation Opportunities
                    </h2>
                    <p className="text-slate-400">
                    Based on your screen, we found {suggestions.length} ways to optimize your workflow.
                    </p>
                </div>
                {isAutoScan && (
                    <div className="text-xs px-2 py-1 bg-cyan-900/30 text-cyan-400 rounded border border-cyan-800 animate-pulse">
                        Auto-updating...
                    </div>
                )}
              </div>

              <div className="grid gap-6">
                {suggestions.map((suggestion) => (
                  <AutomationCard 
                    key={suggestion.id} 
                    suggestion={suggestion} 
                    onClick={handleSelectSuggestion} 
                  />
                ))}
              </div>
              
              {suggestions.length === 0 && appState !== AppState.GUIDE_LOADING && (
                <div className="text-center py-20 text-slate-500">
                   {isAutoScan ? "Scanning for opportunities..." : 'No suggestions yet. Click "Scan" to analyze.'}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Hidden Canvas for Frame Capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default App;