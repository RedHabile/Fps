import type { Profile } from "./data";

const PROJECT_URL = "https://rrhulffyvltogdbbagir.supabase.co";
const API_KEY = "sb_publishable_zYunuTczRdpR804RxUXnNA_Q3mfNe4n";
const SESSION_KEY = "breachpoint-auth-session";
const REDIRECT_URL = "https://redhabile.github.io/Fps/";

export interface AuthUser { id: string; email?: string; }
interface AuthSession { access_token: string; refresh_token: string; expires_at: number; }
interface AuthResponse { access_token?: string; refresh_token?: string; expires_in?: number; expires_at?: number; user?: AuthUser; id?: string; email?: string; }
export interface SignUpResult { user: AuthUser; needsEmailConfirmation: boolean; }

function readSession(): AuthSession | null {
  try { const value = JSON.parse(localStorage.getItem(SESSION_KEY) || "null") as AuthSession | null; return value?.access_token && value.refresh_token ? value : null; }
  catch { return null; }
}
function storeSession(data: AuthResponse): AuthSession {
  if (!data.access_token || !data.refresh_token) throw new Error("Session de connexion invalide.");
  const session: AuthSession = { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at ?? Math.floor(Date.now()/1000) + (data.expires_in ?? 3600) };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}
function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch { /* stockage indisponible */ } }
function headers(token?: string) { return { apikey: API_KEY, Authorization: `Bearer ${token || API_KEY}`, "Content-Type": "application/json" }; }
async function responseError(response: Response): Promise<Error> {
  const data = await response.json().catch(() => ({})) as { message?: string; msg?: string; error_description?: string; error?: string; };
  return new Error(data.message || data.msg || data.error_description || data.error || `Erreur serveur (${response.status}).`);
}
async function refreshSession(session: AuthSession): Promise<AuthSession> {
  const response = await fetch(`${PROJECT_URL}/auth/v1/token?grant_type=refresh_token`, { method:"POST", headers:headers(), body:JSON.stringify({ refresh_token:session.refresh_token }) });
  if (!response.ok) { clearSession(); throw await responseError(response); }
  return storeSession(await response.json() as AuthResponse);
}
async function fetchUser(session: AuthSession): Promise<AuthUser> {
  const response = await fetch(`${PROJECT_URL}/auth/v1/user`, { headers:headers(session.access_token) });
  if (!response.ok) throw await responseError(response);
  return response.json() as Promise<AuthUser>;
}
async function validSession(): Promise<AuthSession> {
  const session = readSession();
  if (!session) throw new Error("Connecte-toi pour synchroniser ta progression.");
  if (session.expires_at <= Math.floor(Date.now()/1000) + 60) return refreshSession(session);
  return session;
}

export async function restoreAccount(): Promise<AuthUser | null> {
  let session = readSession();
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const accessToken = hash.get("access_token"), refreshToken = hash.get("refresh_token");
  if (accessToken && refreshToken) {
    session = storeSession({ access_token:accessToken, refresh_token:refreshToken, expires_in:Number(hash.get("expires_in") || 3600) });
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
  }
  if (!session) return null;
  try {
    if (session.expires_at <= Math.floor(Date.now()/1000) + 60) session = await refreshSession(session);
    return await fetchUser(session);
  } catch { clearSession(); return null; }
}
export async function signIn(email: string, password: string): Promise<AuthUser> {
  const response = await fetch(`${PROJECT_URL}/auth/v1/token?grant_type=password`, { method:"POST", headers:headers(), body:JSON.stringify({ email:email.trim(), password }) });
  if (!response.ok) throw await responseError(response);
  const data = await response.json() as AuthResponse;
  storeSession(data);
  return data.user || await fetchUser(readSession()!);
}
export async function signUp(email: string, password: string): Promise<SignUpResult> {
  const response = await fetch(`${PROJECT_URL}/auth/v1/signup?redirect_to=${encodeURIComponent(REDIRECT_URL)}`, {
    method:"POST", headers:headers(),
    body:JSON.stringify({ email:email.trim(), password, options:{ emailRedirectTo:REDIRECT_URL } }),
  });
  if (!response.ok) throw await responseError(response);
  const data = await response.json() as AuthResponse;
  if (data.access_token && data.refresh_token) storeSession(data);
  const user = data.user || (data.id ? { id:data.id, email:data.email } : null);
  if (!user) throw new Error("Réponse inattendue de Supabase. Réessaie dans quelques instants.");
  return { user, needsEmailConfirmation:!data.access_token };
}
export async function resendConfirmationEmail(email: string): Promise<void> {
  const response = await fetch(`${PROJECT_URL}/auth/v1/resend?redirect_to=${encodeURIComponent(REDIRECT_URL)}`, {
    method:"POST", headers:headers(),
    body:JSON.stringify({ type:"signup", email:email.trim(), options:{ emailRedirectTo:REDIRECT_URL } }),
  });
  if (!response.ok) throw await responseError(response);
}
export async function signOut(): Promise<void> {
  const session = readSession();
  try { if (session) await fetch(`${PROJECT_URL}/auth/v1/logout`, { method:"POST", headers:headers(session.access_token) }); }
  catch { /* la session locale doit aussi pouvoir être fermée hors ligne */ }
  finally { clearSession(); }
}
export async function loadCloudProfile(userId: string): Promise<Profile | null> {
  const session = await validSession();
  const response = await fetch(`${PROJECT_URL}/rest/v1/breachpoint_profiles?select=profile&user_id=eq.${encodeURIComponent(userId)}&limit=1`, { headers:headers(session.access_token) });
  if (!response.ok) throw await responseError(response);
  const rows = await response.json() as { profile?: Profile }[];
  return rows[0]?.profile || null;
}
export async function saveCloudProfile(userId: string, profile: Profile): Promise<void> {
  const session = await validSession();
  const response = await fetch(`${PROJECT_URL}/rest/v1/breachpoint_profiles?on_conflict=user_id`, {
    method:"POST",
    headers:{ ...headers(session.access_token), Prefer:"resolution=merge-duplicates,return=minimal" },
    body:JSON.stringify({ user_id:userId, profile, updated_at:new Date().toISOString() }),
  });
  if (!response.ok) throw await responseError(response);
}