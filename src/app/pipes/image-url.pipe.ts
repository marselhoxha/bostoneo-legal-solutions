import { Pipe, PipeTransform } from '@angular/core';
import { UserService } from '../service/user.service';

@Pipe({ name: 'imageUrl', standalone: true })
export class ImageUrlPipe implements PipeTransform {
  private readonly defaultAvatar = 'assets/images/users/user-dummy-img.jpg';

  constructor(private userService: UserService) {}

  transform(url: string | null | undefined, fallback?: string): string {
    if (!url) {
      return fallback || this.defaultAvatar;
    }
    return this.userService.normalizeImageUrl(url);
  }
}
