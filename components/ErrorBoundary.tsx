"use client";
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; retry: () => void }>;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} retry={this.retry} />;
      }

      return <DefaultErrorFallback error={this.state.error} retry={this.retry} />;
    }

    return this.props.children;
  }
}

function DefaultErrorFallback({ error, retry }: { error?: Error; retry: () => void }) {
  const isNetworkError = error?.message?.includes('network') || 
                         error?.message?.includes('fetch') ||
                         error?.message?.includes('429');

  return (
    <Card className="bg-white border-destructive shadow-sm">
      <CardContent className="p-4 text-center">
        <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-destructive-foreground0" />
        <h3 className="text-lg font-semibold text-destructive mb-2">
          {isNetworkError ? 'Network Issue' : 'Something went wrong'}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {isNetworkError 
            ? 'Having trouble connecting to the network. Please check your connection and try again.'
            : 'An unexpected error occurred. Please try refreshing the page.'
          }
        </p>
        <Button 
          onClick={retry}
          className="bg-destructive hover:bg-destructive text-white"
          size="sm"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </CardContent>
    </Card>
  );
}