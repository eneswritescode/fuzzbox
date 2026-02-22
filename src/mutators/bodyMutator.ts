/**
 * Mutate a JSON response body to test client parsing resilience.
 * Randomly changes strings to undefined, numbers to -999, booleans to opposites.
 * Recursively walks objects and arrays with a probability of mutation per field.
 */
export function mutateBody(body: any, fieldProbability: number): any {
  if (body === null || body === undefined) {
    return body;
  }

  // Primitive mutation
  if (typeof body === 'string') {
    return Math.random() < fieldProbability ? undefined : body;
  }

  if (typeof body === 'number') {
    return Math.random() < fieldProbability ? -999 : body;
  }

  if (typeof body === 'boolean') {
    return Math.random() < fieldProbability ? !body : body;
  }

  // Array mutation
  if (Array.isArray(body)) {
    return body.map((item) => mutateBody(item, fieldProbability));
  }

  // Object mutation
  if (typeof body === 'object') {
    const mutated: any = {};
    for (const [key, value] of Object.entries(body)) {
      mutated[key] = mutateBody(value, fieldProbability);
    }
    return mutated;
  }

  return body;
}

/**
 * Try to parse a response body as JSON.
 * If it's not JSON, return null.
 */
export function tryParseJSON(body: string): any | null {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}
