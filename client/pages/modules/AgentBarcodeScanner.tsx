import { useEffect, useRef, useState, type FormEvent } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

interface AgentBarcodeScannerProps {
  onClose: () => void;
  onDetected: (code: string) => void;
}

export function AgentBarcodeScanner({ onClose, onDetected }: AgentBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [manualCode, setManualCode] = useState("");
  const [scanError, setScanError] = useState("");

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let active = true;
    let stopScanner: (() => void) | undefined;

    if (videoRef.current) {
      reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        videoRef.current,
        (result, _error, controls) => {
          if (!active || !result) return;
          active = false;
          controls.stop();
          onDetected(result.getText());
        },
      ).then((controls) => {
        stopScanner = controls.stop;
        if (!active) controls.stop();
      }).catch((error: unknown) => {
        if (active) {
          setScanError(error instanceof Error ? error.message : "Camera could not be started.");
        }
      });
    }

    return () => {
      active = false;
      stopScanner?.();
    };
  }, [onDetected]);

  const submitManualCode = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = manualCode.trim();
    if (code) onDetected(code);
  };

  return (
    <div className="fixed inset-x-0 bottom-16 top-16 z-30 flex flex-col bg-black text-white">
      <header className="flex items-center justify-between px-5 pb-4 pt-5">
        <p className="font-rajdhani text-xl font-bold">Barcode Scanner</p>
        <button type="button" onClick={onClose} aria-label="Close scanner" className="text-3xl leading-none">
          ×
        </button>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 overflow-y-auto px-6 py-4">
        <div className="relative w-full max-w-md overflow-hidden rounded-xl border-2 border-accent-2 bg-black">
          <video ref={videoRef} autoPlay muted playsInline className="aspect-[4/3] w-full object-cover" />
          <div className="pointer-events-none absolute inset-[15%] rounded-xl border-2 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.25)]" />
        </div>
        <p className="max-w-md text-center text-sm text-white/80">
          Point the rear camera at a pallet or order barcode.
        </p>
        {scanError && <p role="alert" className="max-w-md text-center text-sm text-red-300">{scanError}</p>}
        <form onSubmit={submitManualCode} className="flex w-full max-w-md gap-2">
          <input
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value)}
            aria-label="Enter barcode manually"
            placeholder="Enter barcode or order code"
            className="min-w-0 flex-1 rounded-lg border border-white/30 bg-white px-3 py-2 text-sm text-navy placeholder:text-muted"
          />
          <button type="submit" disabled={!manualCode.trim()} className="rounded-lg bg-accent-2 px-4 py-2 text-sm font-semibold disabled:opacity-50">
            Search
          </button>
        </form>
      </div>
    </div>
  );
}
