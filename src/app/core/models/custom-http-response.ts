export interface CustomHttpResponse<T = any> {
    timeStamp: string;
    statusCode: number;
    status: string;
    message: string;
    reason?: string;
    developerMessage?: string;
    data?: T;
} 