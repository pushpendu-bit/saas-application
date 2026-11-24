import { useEffect, useState } from "react";
import { api } from "./api";

export default function Login({ onLogin }) {
  const [ident, setIdent] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState(1);
  const [debugOtp, setDebugOtp] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function sendCode() {
    setErr("");
    setBusy(true);
    try {
      const r = await api.post("/auth/request-otp", { identifier: ident });
      setDebugOtp(r.debug_otp || "");
      setStep(2);
      setWait(30);
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  async function verify() {
    setErr("");
    setBusy(true);
    try {
      const r = await api.post("/auth/verify-otp", { identifier: ident, code });
      localStorage.setItem("token", r.token);
      localStorage.setItem("user", JSON.stringify(r.user));
      onLogin(r.user);
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  return (
    <div className="login-wrap">
      <div className="card login">
        <h1>🧺 Haat</h1>
        <p className="muted">Groceries & local specials, delivered.</p>
        {step === 1 ? (
          <>
            <label>Phone number or Gmail</label>
            <input
              value={ident}
              onChange={(e) => setIdent(e.target.value)}
              placeholder="98765 43210 or you@gmail.com"
              onKeyDown={(e) => e.key === "Enter" && sendCode()}
            />
            <button className="btn" disabled={busy || !ident} onClick={sendCode}>
              Send OTP
            </button>
          </>
        ) : (
          <>
            <label>Enter the 6-digit code sent to {ident}</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              inputMode="numeric"
              onKeyDown={(e) => e.key === "Enter" && code.length === 6 && verify()}
            />
            {debugOtp && <div className="note">Demo mode: your code is <b>{debugOtp}</b></div>}
            <button className="btn" disabled={busy || code.length !== 6} onClick={verify}>
              Verify & Login
            </button>
            <button className="link" disabled={wait > 0 || busy} onClick={sendCode}>
              {wait > 0 ? `Resend in ${wait}s` : "Resend code"}
            </button>
            <button className="link" onClick={() => setStep(1)}>Change number / email</button>
          </>
        )}
        {err && <div className="error">{err}</div>}
      </div>
    </div>
  );
}