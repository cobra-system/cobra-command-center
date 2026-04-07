import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { logger } from "@/lib/logger";
import { getSentry } from "@/lib/sentry";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error("[ErrorBoundary]", error, { componentStack: errorInfo.componentStack });
    getSentry()?.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex min-h-screen items-center justify-center bg-background p-4"
          dir="rtl"
        >
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-2xl font-bold text-destructive">משהו השתבש</h1>
            <p className="text-muted-foreground">
              אירעה שגיאה בלתי צפויה. אנא נסה שוב או חזור לדף הראשי.
            </p>
            {this.state.error && (
              <details className="text-xs text-muted-foreground text-left bg-muted p-3 rounded-md">
                <summary className="cursor-pointer text-right">פרטי השגיאה</summary>
                <pre className="mt-2 whitespace-pre-wrap break-words">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                נסה שוב
              </button>
              <a
                href="/"
                className="px-4 py-2 border border-input rounded-md hover:bg-accent transition-colors"
              >
                חזרה לדף הראשי
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
