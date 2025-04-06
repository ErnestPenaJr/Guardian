// devConsole.ts - Utility for development console logging
// This utility helps with development logging and debugging

/**
 * Development console utility for controlled logging
 * Only logs in development environment or when explicitly enabled
 */
export const devConsole = {
  /**
   * Log a message to the console
   * @param message The message to log
   */
  log: (message: string) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] ${message}`);
      
      // Set a meta tag to indicate dev mode for other components to detect
      let metaTag = document.querySelector('meta[name="console-output"]');
      if (!metaTag) {
        metaTag = document.createElement('meta');
        metaTag.setAttribute('name', 'console-output');
        document.head.appendChild(metaTag);
      }
      metaTag.setAttribute('content', message);
    }
  },
  
  /**
   * Log an error to the console
   * @param message The error message to log
   */
  error: (message: string) => {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[DEV ERROR] ${message}`);
    }
  },
  
  /**
   * Log a warning to the console
   * @param message The warning message to log
   */
  warn: (message: string) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[DEV WARNING] ${message}`);
    }
  }
};

export default devConsole;
