export interface CustomHttpResponse<T> {
  statusCode: number;
  message: string;
  data: T;
}

 
 