import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EventStore } from '../../core/event-store';
import { forgetEvent, recentEvents, rememberEvent } from '../../core/local';
import { copyText, eventUrl, hostUrl, shareOrCopy } from '../../core/share';
import { daysUntil, fromSeoul, seoulDay, whenLabel } from '../../core/time';

// 모임 만들기 폼. 날짜·시간은 한국 시간으로 받는다.
interface Form {
  title: string;
  date: string;
  time: string;
  place: string;
  minPeople: number;
}

// 만든 직후 보여줄 정보
interface Made {
  id: string;
  key: string;
  title: string;
  when: string;
  place: string;
}

const EMPTY: Form = { title: '', date: '', time: '', place: '', minPeople: 10 };

// 처음 들어온 사람에게 보여주는 화면. 여기서 모임을 만들고 링크를 받아간다.
@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly store = inject(EventStore);

  readonly today = seoulDay(new Date());

  readonly form = signal<Form>(EMPTY);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly made = signal<Made | null>(null);

  // 방금 복사한 칸. 버튼 글자를 "복사했어"로 잠깐 바꾼다.
  readonly copied = signal<'friend' | 'admin' | null>(null);

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

  set<K extends keyof Form>(key: K, value: Form[K]) {
    this.form.update((f) => ({ ...f, [key]: value }));
    if (this.error()) this.error.set('');
  }

  async submit() {
    const f = this.form();
    const title = f.title.trim();
    const place = f.place.trim();
    const minPeople = Math.round(Number(f.minPeople));
    if (!title || !place) return this.error.set('제목이랑 장소를 써줘');
    if (!f.date || !f.time) return this.error.set('날짜랑 시간을 골라줘');
    if (!(minPeople >= 1 && minPeople <= 50)) return this.error.set('인원은 1~50명 사이로');

    const eventAt = fromSeoul(f.date, f.time);
    if (eventAt.getTime() < Date.now()) return this.error.set('이미 지난 시간이야');

    this.busy.set(true);
    try {
      const { id, key } = await this.store.create({ title, place, eventAt, minPeople });
      rememberEvent({ id, title, eventAt: eventAt.getTime(), host: true });
      this.made.set({ id, key, title, place, when: whenLabel(eventAt) });
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
      title: m.title,
      text: `⚽ ${m.title}\n${m.when} · ${m.place}\n올 사람 눌러줘!`,
      url: this.friendUrl(),
    });
    if (result === 'copied') this.flash('friend');
  }

  async copyAdmin() {
    const m = this.made();
    if (m && (await copyText(hostUrl(m.id, m.key))) === 'copied') this.flash('admin');
  }

  private flash(which: 'friend' | 'admin') {
    this.copied.set(which);
    setTimeout(() => this.copied.set(null), 1800);
  }

  // 같은 화면에서 모임을 하나 더 만들 때
  reset() {
    this.made.set(null);
    this.form.set(EMPTY);
    this.recentAll.set(recentEvents());
  }

  forget(id: string) {
    forgetEvent(id);
    this.recentAll.set(recentEvents());
  }
}
