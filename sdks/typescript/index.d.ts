export declare class Flap {
  constructor(apiKey: string, baseUrl?: string);
  request(method: string, path: string, body?: unknown): Promise<any>;
  send(message: Record<string, unknown>): Promise<any>;
  domains(): Promise<any>;
}
export default Flap;
