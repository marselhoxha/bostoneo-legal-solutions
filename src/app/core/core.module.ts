import { NgModule } from '@angular/core';
import { HTTP_INTERCEPTORS } from '@angular/common/http';

import { ClientService } from '../service/client.service';
import { HttpCacheService } from '../service/http.cache.service';
import { CacheInterceptor } from '../interceptor/cache.interceptor';
import { TokenInterceptor } from '../interceptor/token.interceptor';
import { NotificationService } from '../service/notification.service';
import { UserService } from '../service/user.service';
import { HttpRequestInterceptorService } from './services/http-request-interceptor.service';

@NgModule({

  providers: [
    
    NotificationService, UserService, ClientService, HttpCacheService,
    
    {provide: HTTP_INTERCEPTORS, useClass: TokenInterceptor, multi: true},
    {provide: HTTP_INTERCEPTORS, useClass: CacheInterceptor, multi: true},
    {provide: HTTP_INTERCEPTORS, useClass: HttpRequestInterceptorService, multi: true}
  ],
 
})
export class CoreModule { }
