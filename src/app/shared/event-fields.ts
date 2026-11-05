import { Component, input, model } from '@angular/core';
import { EventForm, numberOrNull } from '../core/event-form';

// 모임 만들기 폼과 경기 정보 수정 다이얼로그가 같이 쓰는 입력칸
@Component({
  selector: 'app-event-fields',
  template: `
    <div class="field">
      <label class="label" [for]="id('title')">제목</label>
      <input [id]="id('title')" maxlength="40" placeholder="예: 토요일 풋살" [value]="form().title"
             (input)="set('title', $any($event.target).value)" />
    </div>
    <div class="field-row">
      <div class="field">
        <label class="label" [for]="id('date')">날짜</label>
        <input [id]="id('date')" type="date" [min]="minDate()" [value]="form().date"
               (input)="set('date', $any($event.target).value)" />
      </div>
      <div class="field">
        <label class="label" [for]="id('time')">시간</label>
        <input [id]="id('time')" type="time" [value]="form().time"
               (input)="set('time', $any($event.target).value)" />
      </div>
    </div>
    <div class="field">
      <label class="label" [for]="id('place')">장소</label>
      <input [id]="id('place')" maxlength="60" placeholder="예: 잠실 풋살장 2구장" [value]="form().place"
             (input)="set('place', $any($event.target).value)" />
    </div>
    <div class="field-row keep">
      <div class="field">
        <label class="label" [for]="id('min')">최소 인원</label>
        <input [id]="id('min')" type="number" inputmode="numeric" min="1" max="50" [value]="form().minPeople"
               (input)="set('minPeople', $any($event.target).valueAsNumber)" />
      </div>
      <div class="field">
        <label class="label" [for]="id('max')">정원 <small>· 선택</small></label>
        <input [id]="id('max')" type="number" inputmode="numeric" min="1" max="50" placeholder="제한 없음"
               [value]="form().maxPeople ?? ''"
               (input)="set('maxPeople', num($any($event.target).valueAsNumber))" />
      </div>
    </div>
    <details class="more" [open]="!!form().fee">
      <summary>회비 받기 <small>· 선택</small></summary>
      <div class="more-body">
      <div class="field">
        <label class="label" [for]="id('fee')">1인 회비 (원)</label>
        <input [id]="id('fee')" type="number" inputmode="numeric" min="0" step="1000" placeholder="예: 10000"
               [value]="form().fee ?? ''"
               (input)="set('fee', num($any($event.target).valueAsNumber))" />
      </div>
      <div class="field">
        <label class="label" [for]="id('account')">받을 계좌</label>
        <input [id]="id('account')" maxlength="60" placeholder="예: 토스뱅크 1000-0000-0000 홍길동"
               [value]="form().account" (input)="set('account', $any($event.target).value)" />
      </div>
      </div>
    </details>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 14px; }
    .label small { font-weight: 400; letter-spacing: 0; }
    /* 인원 두 칸은 좁은 폰에서도 나란히 */
    .field-row.keep { grid-template-columns: 1fr 1fr; }
    .more {
      border-top: 1px solid var(--line); padding-top: 12px;
      summary { cursor: pointer; font-weight: 700; font-size: 0.9rem; }
      summary small { font-weight: 400; color: var(--muted); }
    }
    .more-body { display: flex; flex-direction: column; gap: 14px; margin-top: 12px; }
  `,
})
export class EventFields {
  readonly form = model.required<EventForm>();
  /** 한 화면에 두 벌이 있을 수 있어서 id 가 겹치지 않게 */
  readonly prefix = input('f');
  readonly minDate = input('');

  readonly num = numberOrNull;

  id(name: string) {
    return `${this.prefix()}-${name}`;
  }

  set<K extends keyof EventForm>(key: K, value: EventForm[K]) {
    this.form.update((f) => ({ ...f, [key]: value }));
  }
}
