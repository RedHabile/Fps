import { useState } from "react";
import { createPortal } from "react-dom";
import { Cloud, LogIn, LogOut, ShieldCheck, UserRound, X } from "lucide-react";
import { resendConfirmationEmail, signIn, signOut, signUp, type AuthUser } from "../game/cloud";

export function AccountWidget({ user, onAuthenticated, onSignedOut }: {
  user: AuthUser | null;
  onAuthenticated: (user: AuthUser) => Promise<void>;
  onSignedOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      if (mode === "login") {
        const account = await signIn(email, password);
        await onAuthenticated(account);
        setPassword("");
        setMessage("Connexion réussie. Progression synchronisée.");
      } else {
        const result = await signUp(email, password);
        if (result.needsEmailConfirmation) {
          setMessage("Compte créé ! Vérifie ta boîte Gmail et confirme ton adresse avant de te connecter.");
        } else {
          await onAuthenticated(result.user);
          setPassword("");
          setMessage("Compte créé et progression synchronisée.");
        }
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Une erreur est survenue."); }
    finally { setBusy(false); }
  };
  const resend = async () => {
    setBusy(true); setError(""); setMessage("");
    try { await resendConfirmationEmail(email); setMessage("Nouveau mail de confirmation envoyé. Vérifie aussi les courriers indésirables."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de renvoyer le mail."); }
    finally { setBusy(false); }
  };
  const logout = async () => {
    setBusy(true); setError("");
    try { await signOut(); onSignedOut(); setMessage("Déconnexion effectuée."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Déconnexion impossible."); }
    finally { setBusy(false); }
  };

  return <>
    <button className="account-trigger" onClick={() => { setOpen(true); setError(""); setMessage(""); }}>
      {user ? <Cloud size={15} /> : <UserRound size={15} />}
      <span>{user ? "COMPTE CONNECTÉ" : "COMPTE"}</span>
    </button>
    {open && createPortal(<div className="account-backdrop" role="dialog" aria-modal="true" aria-label="Compte Breach Point" onClick={() => setOpen(false)}>
      <section className="account-panel" onClick={(event) => event.stopPropagation()}>
        <div className="account-heading">
          <div><small><ShieldCheck size={13} /> IDENTITÉ EN LIGNE</small><h2>MON COMPTE</h2></div>
          <button className="account-close" onClick={() => setOpen(false)} aria-label="Fermer"><X size={19} /></button>
        </div>
        {user ? <div className="account-session">
          <small>SESSION ACTIVE</small><strong>{user.email || "Compte joueur"}</strong>
          <p>Ta progression Breach Point est liée à ce compte et peut être retrouvée sur tes autres appareils.</p>
          <button className="account-submit" onClick={() => void logout()} disabled={busy}><LogOut size={15} />{busy ? "DÉCONNEXION..." : "SE DÉCONNECTER"}</button>
        </div> : <div className="account-form">
          <div className="account-tabs">
            <button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setMessage(""); setError(""); }}>CONNEXION</button>
            <button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setMessage(""); setError(""); }}>CRÉER UN COMPTE</button>
          </div>
          <label>ADRESSE GMAIL / E-MAIL</label>
          <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="toi@gmail.com" />
          <label>MOT DE PASSE</label>
          <input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submit(); }} placeholder="8 caractères minimum" />
          {mode === "register" && <p>Utilise une adresse Gmail à laquelle tu as accès. Un e-mail de confirmation peut être demandé.</p>}
          <button className="account-resend" onClick={() => void resend()} disabled={busy || !email.trim()}>RENVOYER LE MAIL DE CONFIRMATION</button>
          <button className="account-submit" onClick={() => void submit()} disabled={busy || !email.trim() || password.length < 8}><LogIn size={15} />{busy ? "PATIENTE..." : mode === "login" ? "SE CONNECTER" : "CRÉER MON COMPTE"}</button>
        </div>}
        {error && <p className="account-error" role="alert">{error}</p>}
        {message && <p className="account-message" role="status">{message}</p>}
        <p className="account-note">Ne partage jamais ton mot de passe. La session reste privée sur chaque appareil.</p>
      </section>
    </div>, document.body)}
  </>;
}
