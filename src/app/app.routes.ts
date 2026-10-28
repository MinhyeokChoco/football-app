import { Routes } from '@angular/router';
import { EventView } from './features/event-view/event-view';
import { Home } from './features/home/home';

export const routes: Routes = [
  // 친구들이 받는 링크. /e/모임아이디 (주최자 링크는 뒤에 ?key= 가 붙는다)
  { path: 'e/:id', component: EventView },

  // 링크 없이 들어왔거나 주소를 잘못 쳤을 때
  { path: '', component: Home },
  { path: '**', redirectTo: '' },
];
