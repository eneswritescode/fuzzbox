import { randomChoice } from '../core';

/**
 * Scramble, delete, or alter response headers.
 * The goal is to make CORS fail, mess up Content-Type, or introduce subtle bugs.
 */
export function applyHeaderHavoc(
  headers: Record<string, string | string[]>,
  action: 'delete' | 'scramble' | 'alter',
  targetHeader?: string
): Record<string, string | string[]> {
  const modifiedHeaders = { ...headers };
  const headerKeys = Object.keys(modifiedHeaders);

  if (headerKeys.length === 0) {
    return modifiedHeaders;
  }

  const headerToMess = targetHeader && modifiedHeaders[targetHeader]
    ? targetHeader
    : randomChoice(headerKeys);

  switch (action) {
    case 'delete':
      delete modifiedHeaders[headerToMess];
      break;

    case 'scramble':
      // Reverse the header value for maximum confusion
      const originalValue = modifiedHeaders[headerToMess];
      if (typeof originalValue === 'string') {
        modifiedHeaders[headerToMess] = originalValue.split('').reverse().join('');
      } else if (Array.isArray(originalValue)) {
        modifiedHeaders[headerToMess] = originalValue.map(v => v.split('').reverse().join(''));
      }
      break;

    case 'alter':
      // Change Content-Type to something wrong
      if (headerToMess.toLowerCase() === 'content-type') {
        modifiedHeaders[headerToMess] = 'text/plain';
      } else {
        // Otherwise just append garbage
        const currentValue = modifiedHeaders[headerToMess];
        if (typeof currentValue === 'string') {
          modifiedHeaders[headerToMess] = currentValue + '; chaos=true';
        }
      }
      break;
  }

  return modifiedHeaders;
}

/**
 * Get common response headers as an array for random selection.
 */
export function getCommonHeaders(): string[] {
  return [
    'Content-Type',
    'Content-Length',
    'Cache-Control',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Methods',
    'Access-Control-Allow-Headers',
  ];
}
