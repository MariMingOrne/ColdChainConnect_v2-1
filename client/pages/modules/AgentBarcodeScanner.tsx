import { useEffect, useRef, useState, type FormEvent } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { SwitchCamera } from "lucide-react";

interface AgentBarcodeScannerProps {
  onClose: () => void;
  onDetected: (code: string) => void;
}

export function AgentBarcodeScanner({ onClose, onDetected }: AgentBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [manualCode, setManualCode] = useState("");
  const [scanError, setScanError] = useState("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let active = true;
    let stopScanner: (() => void) | undefined;

    if (videoRef.current) {
      reader.decodeFromConstraints(
        { video: { facingMode: { ideal: facingMode } } },
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
  }, [facingMode, onDetected]);

  const submitManualCode = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = manualCode.trim();
    if (code) onDetected(code);
  };

  return (
    <div className="fixed inset-x-0 bottom-16 top-16 z-30 flex flex-col bg-black text-white">
      <header className="flex items-center justify-between px-5 pb-4 pt-5">
        <p className="font-rajdhani text-xl font-bold">Barcode Scanner</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setScanError("");
              setFacingMode((current) => current === "environment" ? "user" : "environment");
            }}
            aria-label={`Switch to ${facingMode === "environment" ? "front" : "rear"} camera`}
            className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white"
          >
            <SwitchCamera size={18} />
            {facingMode === "environment" ? "Rear" : "Front"}
          </button>
          <button type="button" onClick={onClose} aria-label="Close scanner" className="text-3xl leading-none">
            ×
          </button>
        </div>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 overflow-y-auto px-6 py-4">
        <div className="relative w-full max-w-md overflow-hidden rounded-xl border-2 border-accent-2 bg-black">
          <video ref={videoRef} autoPlay muted playsInline className="aspect-[4/3] w-full object-cover" />
          <div className="pointer-events-none absolute inset-[15%] rounded-xl border-2 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.25)]" />
        </div>
        <p className="max-w-md text-center text-sm text-white/80">
          Point the {facingMode === "environment" ? "rear" : "front"} camera at a pallet or order barcode.
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
