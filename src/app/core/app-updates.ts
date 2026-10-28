import { inject, Injectable } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

/**
 * 새 버전이 배포되면 받아 두었다가, 입력 중인 이름이 날아가지 않도록
 * 앱을 다시 열었을 때(화면에 다시 보일 때) 새로고침한다.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdates {
  private readonly updates = inject(SwUpdate, { optional: true });
  private versionReady = false;

  start(): void {
    const updates = this.updates;
    if (!updates?.isEnabled) return;

    updates.versionUpdates.subscribe((event) => {
      if (event.type === 'VERSION_READY') this.versionReady = true;
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      if (this.versionReady) location.reload();
      else updates.checkForUpdate().catch(() => undefined);
    });
  }
}
