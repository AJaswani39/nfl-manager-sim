import React from 'react';
import ErrorBoundary from './ErrorBoundary';

export default function withErrorBoundary(ScreenComponent) {
  return function WrappedScreen(props) {
    return (
      <ErrorBoundary navigation={props.navigation}>
        <ScreenComponent {...props} />
      </ErrorBoundary>
    );
  };
}
