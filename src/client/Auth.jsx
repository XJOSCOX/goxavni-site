import React, { useState } from "react";
import { api, messageForError, payload } from "./api.js";

export function Auth({ onAuth, systemMessage = "" }) {
  const [mode, setMode] = useState("signin");
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    setMessage("");
    try {
      const endpoint = mode === "signin" ? "/api/login" : "/api/signup";
      const data = await api(endpoint, {
        method: "POST",
        body: JSON.stringify(payload(event.currentTarget))
      });
      onAuth(data.user, data.provider || "supabase");
    } catch (error) {
      setMessage(messageForError(error));
    }
  }

  return (
    <main className="login-view">
      <div className="auth-wrap">
        <div className="auth-copy">
          <a className="auth-brand" href="/" aria-label="GoXAvni home">Go<span>X</span>Avni</a>
          <div className="auth-identity">
            <h1>Internal Finance Portal</h1>
          </div>
        </div>

        <div className="login-panel">
          <div className="auth-tabs" role="tablist" aria-label="Authentication">
            <button className={`auth-tab ${mode === "signin" ? "active" : ""}`} type="button" onClick={() => setMode("signin")}>Sign in</button>
            <button className={`auth-tab ${mode === "signup" ? "active" : ""}`} type="button" onClick={() => setMode("signup")}>Sign up</button>
          </div>

          <form className="stack auth-form" onSubmit={submit}>
            {mode === "signup" && (
              <label>
                Name
                <input name="name" type="text" autoComplete="name" required placeholder="Full name" />
              </label>
            )}
            <label>
              Email
              <input name="email" type="email" autoComplete="email" required placeholder="you@goxavni.com" />
            </label>
            <label>
              Password
              <input name="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={mode === "signup" ? 8 : undefined} required placeholder={mode === "signin" ? "Your password" : "At least 8 characters"} />
            </label>
            {mode === "signup" && (
              <label>
                Role code
                <input name="adminCode" type="password" autoComplete="off" required placeholder="Role access code" />
              </label>
            )}
            <button type="submit">{mode === "signin" ? "Sign in" : "Create account"}</button>
            <p className="form-message" role="alert">{message || systemMessage}</p>
          </form>
        </div>
      </div>
    </main>
  );
}
