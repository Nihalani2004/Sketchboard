/** Privacy-safe, opt-in production error monitoring through Sentry. */

import * as Sentry from '@sentry/browser';

let monitoringEnabled = false;

function asError(reason) {
  return reason instanceof Error ? reason : new Error(typeof reason === 'string' ? reason : 'Unknown application error');
}

export function initMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (dsn && import.meta.env.PROD) {
    Sentry.init({
      dsn,
      environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || 'production',
      release: import.meta.env.VITE_APP_VERSION,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      // This is a harmless browser layout warning, not an app failure.
      ignoreErrors: [/^ResizeObserver loop (limit exceeded|completed with undelivered notifications)$/i],
      // Interaction breadcrumbs can contain more context than this drawing app
      // needs to diagnose a stack trace, so do not transmit any of them.
      beforeBreadcrumb() {
        return null;
      },
      beforeSend(event) {
        delete event.user;
        delete event.request;
        return event;
      },
    });
    monitoringEnabled = true;
  }
}

export function reportError(reason, context = {}) {
  const error = asError(reason);
  console.error('Sketchboard error', context, error);
  if (!monitoringEnabled) return;
  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([key, value]) => scope.setTag(key, String(value).slice(0, 80)));
    Sentry.captureException(error);
  });
}

export function isMonitoringEnabled() { return monitoringEnabled; }
