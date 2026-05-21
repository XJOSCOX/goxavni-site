import React from "react";

export function Home() {
  return (
    <main className="site">
      <header className="header">
        <a className="home-brand" href="/" aria-label="GoXAvni home">
          Go<span>X</span>Avni
        </a>
        <div className="header-actions">
          <a href="mailto:contact@goxavni.com">contact@goxavni.com</a>
          <a className="login-link" href="/bookkeeper">Login</a>
        </div>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-inner">
          <h1 id="hero-title">Go<span>X</span>Avni</h1>
          <p>Moving toward the infinite future.</p>
          <a className="button" href="mailto:contact@goxavni.com">Contact</a>
        </div>
      </section>

      <footer className="footer">
        <p>&copy; 2026 GoXAvni LLC. All rights reserved.</p>
      </footer>
    </main>
  );
}
