"use client";

import { useRouter } from "next/navigation";

export default function LandingPage() {
  const router = useRouter();

  function enterApp() {
    router.push("/pm");
  }

  return (
    <main
      className="intro-screen"
      onClick={enterApp}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") enterApp();
      }}
      role="button"
      tabIndex={0}
      aria-label="Open InfraSync-AI"
    >
      <div className="intro-grid" />
      <div className="intro-content">
        <div className="intro-logo-wrap" aria-label="InfraSync-AI logo">
          <div className="intro-ring intro-ring-one" />
          <div className="intro-ring intro-ring-two" />
          <div className="intro-logo">IS</div>
        </div>
        <p className="intro-kicker">FIELD INTELLIGENCE PLATFORM</p>
        <h1>InfraSync<span>-AI</span></h1>
        <p className="intro-tagline">Syncing the field with the plan.</p>
        <div className="intro-loader" aria-label="Loading InfraSync-AI">
          <div className="intro-loader-bar" />
        </div>
        <p className="intro-status">Click anywhere to continue</p>
      </div>
    </main>
  );
}
