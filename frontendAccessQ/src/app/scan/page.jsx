"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Camera, ShieldCheck, ShieldAlert, ArrowLeft, History } from "lucide-react";
import Link from "next/link";

export default function ScanPage() {
    const [scanResult, setScanResult] = useState(null); // { success, message, holder, reason }
    const [isScanning, setIsScanning] = useState(false);
    const [loading, setLoading] = useState(false);
    const [flash, setFlash] = useState(null); // 'success' | 'error'
    const [lastScans, setLastScans] = useState([]);
    const [cameraError, setCameraError] = useState(null);
    
    const scannerRef = useRef(null);

    // Load html5-qrcode from CDN
    useEffect(() => {
        const script = document.createElement("script");
        script.src = "https://unpkg.com/html5-qrcode";
        script.async = true;
        script.onload = () => {
            console.log("Scanner library loaded");
        };
        document.body.appendChild(script);

        return () => {
            const scanner = scannerRef.current;
            if (scanner) {
                // If scanning, stop first, then clear
                const stopPromise = scanner.isScanning ? scanner.stop() : Promise.resolve();
                stopPromise.then(() => {
                    try { scanner.clear(); } catch(e) {}
                }).catch(() => {
                    try { scanner.clear(); } catch(e) {}
                });
            }
            if (document.body.contains(script)) {
                document.body.removeChild(script);
            }
        };
    }, []);

    const startScanner = () => {
        if (!window.Html5Qrcode) return;
        
        setIsScanning(true);
        setCameraError(null);

        const html5QrCode = new window.Html5Qrcode("reader");
        scannerRef.current = html5QrCode;

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        html5QrCode.start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            onScanFailure
        ).catch(err => {
            setCameraError("Impossible d'accéder à la caméra. Vérifiez les permissions.");
            setIsScanning(false);
        });
    };

    const stopScanner = async () => {
        if (scannerRef.current) {
            await scannerRef.current.stop();
            setIsScanning(false);
        }
    };

    const onScanSuccess = async (decodedText) => {
        // Pause scanner briefly or stop it
        await stopScanner();
        verifyToken(decodedText);
    };

    const onScanFailure = (error) => {
        // Silent failure for continuous scanning
    };

    const verifyToken = async (token) => {
        setLoading(true);
        try {
            const res = await fetch("https://tidy-teeth-turn.loca.lt/qr/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
                credentials: "include"
            });
            const data = await res.json();
            
            setScanResult(data);
            
            if (data.success) {
                setFlash('success');
                // Auto-clear success flash and restart scanner after 2s
                setTimeout(() => {
                    setFlash(null);
                    setScanResult(null);
                    startScanner();
                }, 2500);
                
                // Track history locally for the session
                setLastScans(prev => [{
                    id: Date.now(),
                    name: data.holder?.name || "Inconnu",
                    status: 'authorized',
                    time: new Date().toLocaleTimeString()
                }, ...prev].slice(0, 5));

            } else {
                setFlash('error');
            }
        } catch (err) {
            setScanResult({ success: false, message: "Erreur de connexion serveur" });
            setFlash('error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`min-h-screen flex flex-col font-sans transition-colors duration-300 ${
            flash === 'success' ? 'bg-emerald-600' : flash === 'error' ? 'bg-red-600' : 'bg-slate-900 dark:bg-slate-100'
        }`}>
            {/* Header */}
            <div className="p-4 flex items-center justify-between text-white border-b border-white/10 bg-black/20 backdrop-blur-md">
                <Link href="/dashboard" className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <h1 className="text-lg font-bold tracking-tight">Scanner QR Access</h1>
                <div className="w-10"></div> {/* Spacer */}
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
                
                {/* Visual Feedback Overlay */}
                {flash && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center text-white px-6 text-center animate-in fade-in duration-300">
                        {flash === 'success' ? (
                            <>
                                <div className="w-32 h-32 bg-white/20 dark:bg-slate-950/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
                                    <ShieldCheck className="w-20 h-20" />
                                </div>
                                <h2 className="text-4xl font-black mb-2">AUTORISÉ</h2>
                                <p className="text-xl font-medium opacity-90">{scanResult?.holder?.name}</p>
                                {scanResult?.holder?.level && (
                                    <span className="mt-4 px-4 py-1.5 bg-white/20 dark:bg-slate-950/20 rounded-full text-sm font-bold uppercase tracking-widest leading-none">
                                        Niveau {scanResult?.holder?.level}
                                    </span>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="w-32 h-32 bg-white/20 dark:bg-slate-950/20 rounded-full flex items-center justify-center mb-6">
                                    <ShieldAlert className="w-20 h-20" />
                                </div>
                                <h2 className="text-4xl font-black mb-2">REFUSÉ</h2>
                                <p className="text-xl font-medium mb-8 opacity-90">{scanResult?.reason || scanResult?.message}</p>
                                <button 
                                    onClick={() => { setFlash(null); setScanResult(null); startScanner(); }}
                                    className="px-8 py-3 bg-white dark:bg-slate-950 text-red-600 font-bold rounded-full shadow-xl active:scale-95 transition-transform"
                                >
                                    RÉESSAYER
                                </button>
                            </>
                        )}
                    </div>
                )}

                {!isScanning && !flash && (
                    <div className="text-center space-y-8 animate-in fade-in zoom-in duration-500">
                        <div className="w-64 h-64 mx-auto bg-slate-800 dark:bg-slate-200 rounded-[4rem] flex items-center justify-center border-4 border-slate-700 shadow-2xl relative overflow-hidden group">
                            <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            {loading ? (
                                <Loader2 className="w-20 h-20 text-blue-500 animate-spin" />
                            ) : (
                                <Camera className="w-24 h-24 text-slate-500 dark:text-slate-400 group-hover:text-blue-500 transition-colors" />
                            )}
                        </div>
                        <div className="space-y-3">
                            <h2 className="text-2xl font-bold text-white">Prêt à scanner ?</h2>
                            <p className="text-slate-400 dark:text-slate-500 max-w-xs mx-auto text-sm leading-relaxed">
                                Positionnez le code QR dans le cadre pour la vérification instantanée.
                            </p>
                        </div>
                        <button
                            onClick={startScanner}
                            className="w-full max-w-xs py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/25 active:scale-95 transition-all text-lg"
                        >
                            Démarrer la Caméra
                        </button>
                        {cameraError && <p className="text-red-400 text-sm font-medium mt-4 bg-red-400/10 p-3 rounded-xl border border-red-400/20">{cameraError}</p>}
                    </div>
                )}

                <div id="reader" className={`w-full max-w-sm mx-auto overflow-hidden rounded-3xl border-4 border-white/20 shadow-2xl ${isScanning && !flash ? 'block' : 'hidden'}`}></div>
                
                {isScanning && !flash && (
                    <button 
                        onClick={stopScanner}
                        className="mt-8 px-6 py-2 bg-white/10 dark:bg-slate-950/10 text-white/60 hover:text-white rounded-full text-sm font-medium transition-colors"
                    >
                        Annuler le scan
                    </button>
                )}
            </div>

            {/* Footer / History Toggle */}
            <div className="p-6 bg-black/40 backdrop-blur-lg border-t border-white/5 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-4 text-white/50">
                    <History className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Derniers scans autorisés</span>
                </div>
                <div className="space-y-2">
                    {lastScans.length === 0 ? (
                        <p className="text-slate-600 dark:text-slate-300 text-sm italic">Aucun scan récent.</p>
                    ) : (
                        lastScans.map(s => (
                            <div key={s.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 dark:border-slate-800">
                                <span className="text-white font-medium text-sm">{s.name}</span>
                                <span className="text-emerald-400 text-xs font-mono">{s.time}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
