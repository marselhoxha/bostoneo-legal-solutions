export interface CustomHttpResponse<T> {
  timestamp?: string;
  statusCode: number;
  message: string;
  data: T;
}