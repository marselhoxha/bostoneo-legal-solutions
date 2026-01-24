import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpResponse } from '@angular/common/http';


@Injectable({ providedIn: 'root' })
export class HttpCacheService {

     private httpResponseCache: { [key: string]: HttpResponse<any> } = {};

     put = (key: string, httpResponse: HttpResponse<any>): void => {
        this.httpResponseCache[key] = httpResponse;
     }

     get = (key: string): HttpResponse<any>  | null | undefined => this.httpResponseCache[key];

     evict = (key: string): boolean => delete this.httpResponseCache[key];

     evictAll = (): void => {
        this.httpResponseCache = {};
     }

     logCache = (): void => {
        // Cache logging disabled in production
     }
     

    
}
