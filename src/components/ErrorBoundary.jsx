"use client";

import React from 'react';
import { AlertTriangle, Download, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, recoveryStatus: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const label = this.props.type ? "AutoTester crashed:" : "App error boundary caught:";
    console.error(label, error, errorInfo);
  }

  handleDownloadRecovered = async () => {
    try {
      const savedText = localStorage.getItem(`auto_tester_results_${this.props.type || 'image'}`);
      if (!savedText) {
        this.setState({ recoveryStatus: { kind: "info", message: "No recovered data found in local storage." } });
        return;
      }
      const parsed = JSON.parse(savedText);
      const results = parsed.results || [];
      if (results.length === 0) {
        this.setState({ recoveryStatus: { kind: "info", message: "Recovered data is empty." } });
        return;
      }

      const XLSX = await import("xlsx-js-style");
      const wb = XLSX.utils.book_new();
      const wsData = [["Marketplace", "Mode", "Model", "Prompt Text", "Status", "Error Details"]];

      results.forEach(r => {
        if (r.prompts && r.prompts.length > 0) {
          r.prompts.forEach(p => {
             wsData.push([r.marketplace, r.mode, r.modelLabel, p, r.status, ""]);
          });
        } else {
          wsData.push([r.marketplace, r.mode, r.modelLabel, "", r.status, r.error || ""]);
        }
      });

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "Recovered");
      XLSX.writeFile(wb, `emergency_recovered_prompts_${Date.now()}.xlsx`);
      this.setState({ recoveryStatus: { kind: "success", message: "Recovered data downloaded." } });
    } catch (e) {
      this.setState({ recoveryStatus: { kind: "error", message: "Failed to recover data: " + e.message } });
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-container card">
          <div className="error-boundary-icon">
            <AlertTriangle size={48} color="#ef4444" />
          </div>
          <h2 className="error-boundary-title">Something Went Wrong</h2>
          <p className="error-boundary-message">
            An unexpected error occurred. Your unsaved work may still be recoverable. 
            Try reloading the page or download any saved data below.
          </p>
          
          <div className="error-boundary-actions">
            <button
              className="btn btn-secondary"
              onClick={() => window.location.reload()}
            >
              <RefreshCw size={16} /> Reload Page
            </button>

            {this.props.type && (
              <button
                className="btn error-boundary-recover-btn"
                onClick={this.handleDownloadRecovered}
              >
                <Download size={16} /> Recover & Download Saved Data
              </button>
            )}
          </div>

          {this.state.recoveryStatus && (
            <div
              className={`error-boundary-status error-boundary-status-${this.state.recoveryStatus.kind}`}
              role="status"
            >
              {this.state.recoveryStatus.message}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
