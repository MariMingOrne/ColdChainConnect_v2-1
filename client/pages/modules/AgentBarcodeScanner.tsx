interface AgentBarcodeScannerProps {
  onClose: () => void;
}

export function AgentBarcodeScanner({ onClose }: AgentBarcodeScannerProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col">
      <header className="flex items-center justify-between px-5 pt-5 pb-4">
        <p className="font-rajdhani text-xl font-bold">Barcode Scanner</p>
        <button type="button" onClick={onClose} aria-label="Close scanner" className="text-3xl leading-none">
          ×
        </button>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
        <div className="w-72 h-40 border-2 border-accent-2 rounded-xl" />
        <p className="text-sm text-white/80 text-center">Align barcode within the frame to scan</p>
      </div>
    </div>
  );
}
