import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { PRIMARY_BLUE_BTN, SECONDARY_WHITE_BTN } from './ui/PremiumPrimitives.tsx';

interface ErrorBoundaryProps {
  title?: string;
  onReset?: () => void;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected rendering error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[RepoMind ErrorBoundary]', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, message: '' });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[280px] w-full flex items-center justify-center p-6 bg-[#F8FAFC]">
          <div className="max-w-lg w-full rounded-2xl border border-[#FECDD3] bg-white p-6 space-y-4 shadow-[0_12px_30px_-10px_rgba(15,23,42,0.1)]">
            <div className="flex items-start gap-3">
              <div className="rounded-xl border border-[#FECDD3] bg-[#FFF1F2] p-2 text-[#E11D48] shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-[15px] font-semibold text-[#0F172A]">
                  {this.props.title || 'Something went wrong while rendering this view'}
                </h2>
                <p className="mt-1.5 text-[12px] font-mono text-[#E11D48] break-words">
                  {this.state.message}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={this.handleReset}
                className={`${PRIMARY_BLUE_BTN} h-9 px-3.5 text-[12px]`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset View</span>
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className={`${SECONDARY_WHITE_BTN} h-9 px-3.5 text-[12px]`}
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
