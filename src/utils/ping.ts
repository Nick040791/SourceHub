export interface PingResult {
  status: 'ok';
  timestamp: number;
}

export function ping(): PingResult {
  return { status: 'ok', timestamp: Date.now() };
}