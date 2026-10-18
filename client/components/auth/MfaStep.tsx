import { useState } from "react";
import { MfaSetupResponse } from "@shared/api";

interface MfaStepProps {
  mode: "setup" | "verify";
  setupInfo: MfaSetupResponse | null;
  error: string;
  isLoading: boolean;
  onSubmit: (code: string) => void;
  onBack: () => void;
}

export function MfaStep({ mode, setupInfo, error, isLoading, onSubmit, onBack }: MfaStepProps) {
  const [code, setCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(code.trim());
  };

  return (
    <form className="w-full flex flex-col gap-3.5" onSubmit={handleSubmit}>
      {error && (
        <div className="w-full px-3.5 py-2.5 bg-red-50 border-2 border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {mode === "setup" && setupInfo ? (
        <div className="flex flex-col items-center gap-3 text-center text-sm text-navy">
          <p>
            Scan this QR code with Google Authenticator, Microsoft Authenticator, or Authy to set up
            sign-in codes.
          </p>
          <img src={setupInfo.qr_data_url} alt="MFA setup QR code" className="w-44 h-44" />
          <p className="text-xs text-gray-500">
            Can't scan? Enter this key manually:{" "}
            <span className="font-mono break-all text-navy">{setupInfo.secret}</span>
          </p>
        </div>
      ) : (
        <p className="text-center text-sm text-navy">
          Enter the 6-digit code from your authenticator app.
        </p>
      )}

      <div>
        <label className="block text-xs font-semibold text-navy mb-1.5 letter-spacing-tight">
          Authentication code
        </label>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          disabled={isLoading}
          className="w-full px-3.5 py-2.5 border-2 border-blue-200 rounded-lg text-sm text-navy bg-blue-50 tracking-widest text-center transition-colors focus:outline-none focus:border-accent disabled:opacity-50"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading || code.length !== 6}
        className="w-full py-3.5 bg-navy text-white rounded-xl font-rajdhani text-xl letter-spacing-widest font-semibold cursor-pointer transition-colors hover:bg-navy-mid mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? "Verifying..." : mode === "setup" ? "Finish setup" : "Verify"}
      </button>

      <button
        type="button"
        onClick={onBack}
        disabled={isLoading}
        className="text-center text-xs text-gray-500 hover:text-navy"
      >
        Back to login
      </button>
    </form>
  );
}
