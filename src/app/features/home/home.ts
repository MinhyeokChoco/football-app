import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY_FORM, readForm } from '../../core/event-form';
import { EventStore } from '../../core/event-store';
import { nextSameSlot } from '../../core/lineup';
import { RecentEvent, forgetEvent, recentEvents, rememberEvent } from '../../core/local';
import { copyText, eventUrl, hostUrl, shareOrCopy } from '../../core/share';
import { daysUntil, seoulDay, seoulTime, whenLabel } from '../../core/time';
import { EventFields } from '../../shared/event-fields';

// 만든 직후 보여줄 정보
interface Made {
  id: string;
  key: string;
  title: string;
  when: string;
  place: string;
}

// 처음 들어온 사람에게 보여주는 화면. 여기서 모임을 만들고 링크를 받아간다.
@Component({
  selector: 'app-home',
  imports: [RouterLink, EventFields],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly store = inject(EventStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly today = seoulDay(new Date());

  readonly form = signal(EMPTY_FORM);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly made = signal<Made | null>(null);

  // 방금 복사한 칸. 버튼 글자를 "복사했어"로 잠깐 바꾼다.
  readonly copied = signal<'friend' | 'link' | 'admin' | null>(null);

  // 이 기기에서 봤던 모임. 다가오는 경기가 위로
  private readonly recentAll = signal(recentEvents());
  readonly recent = computed(() =>
    this.recentAll()
      .map((r) => ({ ...r, when: whenLabel(new Date(r.eventAt)), days: daysUntil(new Date(r.eventAt)) }))
      .sort((a, b) => (a.days < 0 ? 1 : 0) - (b.days < 0 ? 1 : 0) || a.eventAt - b.eventAt),
  );

  readonly friendUrl = computed(() => {
    const m = this.made();
    return m ? eventUrl(m.id) : '';
  });

  // 이 모임 그대로 또 만들기. 홈의 최근 모임이나 모임 화면(?again=)에서 온다
  readonly againFrom = signal('');

  constructor() {
    const again = this.route.snapshot.queryParamMap.get('again');
    const r = again && recentEvents().find((e) => e.id === again);
    if (r) this.again(r);
    if (again) this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  setForm(next: typeof EMPTY_FORM) {
    this.form.set(next);
    if (this.error()) this.error.set('');
  }

  async submit() {
    const read = readForm(this.form());
    if ('error' in read) return this.error.set(read.error);
    const input = read.input;
    if (input.eventAt.getTime() < Date.now()) return this.error.set('이미 지난 시간이야');

    this.busy.set(true);
    try {
      const { id, key } = await this.store.create(input);
      rememberEvent({ ...input, id, eventAt: input.eventAt.getTime(), host: true });
      this.made.set({ id, key, title: input.title, place: input.place, when: whenLabel(input.eventAt) });
      this.againFrom.set('');
    } catch {
      this.error.set('만들지 못했어. 잠시 후 다시 눌러줘.');
    } finally {
      this.busy.set(false);
    }
  }

  async shareFriend() {
    const m = this.made();
    if (!m) return;
    const result = await shareOrCopy({
      text: `⚽ ${m.title}\n${m.when} · ${m.place}\n올 사람 눌러줘!`,
      url: this.friendUrl(),
    });
    if (result === 'copied') this.flash('friend');
  }

  async copyAdmin() {
    const m = this.made();
    if (m && (await copyText(hostUrl(m.id, m.key))) === 'copied') this.flash('admin');
  }

  async copyFriendLink() {
    if ((await copyText(this.friendUrl())) === 'copied') this.flash('link');
  }

  private flash(which: 'friend' | 'link' | 'admin') {
    this.copied.set(which);
    setTimeout(() => this.copied.set(null), 1800);
  }

  // 같은 화면에서 모임을 하나 더 만들 때
  reset() {
    this.made.set(null);
    this.form.set(EMPTY_FORM);
    this.recentAll.set(recentEvents());
  }

  /** 지난 모임의 제목·장소·인원·회비를 채우고 날짜만 다음 주 같은 요일로 */
  again(r: RecentEvent) {
    const at = nextSameSlot(new Date(r.eventAt));
    this.made.set(null);
    this.error.set('');
    this.againFrom.set(r.title);
    this.form.set({
      title: r.title,
      date: seoulDay(at),
      time: seoulTime(at),
      place: r.place ?? '',
      minPeople: r.minPeople ?? EMPTY_FORM.minPeople,
      maxPeople: r.maxPeople ?? null,
      fee: r.fee ?? null,
      account: r.account ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  forget(id: string) {
    forgetEvent(id);
    this.recentAll.set(recentEvents());
  }
}
