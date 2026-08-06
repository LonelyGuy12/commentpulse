// Home.jsx — Landing page with Vercel-inspired design

import { Link } from 'react-router-dom';
import heroImage from '../assets/hero.png';

export default function Home() {
  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-badge">
            <span className="badge-dot"></span>
            <span>AI-Powered Threat Detection</span>
          </div>
          
          <h1 className="hero-title">
            Protect Your YouTube
            <br />
            <span className="gradient-text">Community in Real-Time</span>
          </h1>
          
          <p className="hero-description">
            CommentPulse uses advanced AI to detect impersonators, scams, and malicious content
            in YouTube comments before they harm your audience. Stop threats instantly.
          </p>
          
          <div className="hero-actions">
            <Link to="/dashboard" className="btn btn-primary btn-large">
              <span>Open Dashboard</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            <a href="#features" className="btn btn-ghost btn-large">
              Learn More
            </a>
          </div>

          <div className="hero-stats">
            <div className="stat-item">
              <div className="stat-value">99.7%</div>
              <div className="stat-label">Accuracy Rate</div>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <div className="stat-value">&lt;100ms</div>
              <div className="stat-label">Detection Time</div>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <div className="stat-value">24/7</div>
              <div className="stat-label">Live Monitoring</div>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <div className="visual-glow"></div>
          <img src={heroImage} alt="CommentPulse Dashboard" className="hero-image" />
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="section-header">
          <h2 className="section-title">
            Everything you need to <span className="gradient-text">secure your community</span>
          </h2>
          <p className="section-description">
            Advanced threat detection powered by AI and real-time monitoring
          </p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🔍</div>
            <h3 className="feature-title">Impersonator Detection</h3>
            <p className="feature-description">
              Automatically detect fake accounts trying to impersonate creators using homoglyph analysis and AI pattern matching.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3 className="feature-title">Real-Time Monitoring</h3>
            <p className="feature-description">
              Monitor live streams and video comments as they happen. Get instant alerts for suspicious activity.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🛡️</div>
            <h3 className="feature-title">Obfuscated Link Detection</h3>
            <p className="feature-description">
              Identify hidden phishing links and scam URLs disguised with unicode characters and URL shorteners.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🤖</div>
            <h3 className="feature-title">AI Risk Scoring</h3>
            <p className="feature-description">
              Every comment gets a risk score from 0-100 using LLM-powered analysis for nuanced threat assessment.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🚫</div>
            <h3 className="feature-title">One-Click Banning</h3>
            <p className="feature-description">
              Take action instantly. Ban users and hide comments directly from the dashboard with a single click.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3 className="feature-title">Threat Analytics</h3>
            <p className="feature-description">
              Track threat patterns, analyze attack vectors, and understand your community's security posture.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-section">
        <div className="section-header">
          <h2 className="section-title">
            How it <span className="gradient-text">works</span>
          </h2>
          <p className="section-description">
            Three simple steps to protect your community
          </p>
        </div>

        <div className="steps-container">
          <div className="step-card">
            <div className="step-number">01</div>
            <h3 className="step-title">Connect Your Channel</h3>
            <p className="step-description">
              Sign in with your YouTube account and authorize CommentPulse to monitor your content.
            </p>
          </div>

          <div className="step-arrow">→</div>

          <div className="step-card">
            <div className="step-number">02</div>
            <h3 className="step-title">Scan Videos</h3>
            <p className="step-description">
              Paste any video URL or start live monitoring. Our AI analyzes every comment in real-time.
            </p>
          </div>

          <div className="step-arrow">→</div>

          <div className="step-card">
            <div className="step-number">03</div>
            <h3 className="step-title">Take Action</h3>
            <p className="step-description">
              Review flagged threats in your dashboard and ban malicious users with one click.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-content">
          <h2 className="cta-title">Ready to protect your community?</h2>
          <p className="cta-description">
            Start monitoring your YouTube comments in seconds. No credit card required.
          </p>
          <Link to="/dashboard" className="btn btn-primary btn-large">
            Get Started Now
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="footer-logo">🛡️</div>
            <span className="footer-title">CommentPulse</span>
          </div>
          <p className="footer-text">
            AI-powered threat detection for YouTube creators
          </p>
        </div>
      </footer>
    </div>
  );
}
