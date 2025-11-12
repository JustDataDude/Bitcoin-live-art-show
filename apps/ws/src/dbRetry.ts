/**
 * Database Retry Utility
 * Handles SQLite lock errors and other transient database issues
 */

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 100
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a retryable error
      const isRetryable = 
        error?.code === 'SQLITE_BUSY' ||
        error?.code === 'SQLITE_LOCKED' ||
        error?.message?.includes('database is locked') ||
        error?.message?.includes('SQLITE_BUSY');
      
      if (!isRetryable || attempt === maxRetries - 1) {
        throw error;
      }
      
      // Exponential backoff with jitter
      const backoffDelay = delayMs * Math.pow(2, attempt) + Math.random() * 100;
      console.log(`[DB Retry] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${Math.round(backoffDelay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
  
  throw lastError;
}

