import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth } from '../../core/auth';
import { EventForm, formFrom, readForm, won } from '../../core/event-form';
import { EventStore, NameTakenError, nameProblem } from '../../core/event-store';
import { iga, euro } from '../../core/josa';
import { Level, balancedSplit, headcount, lineup, playerNames } from '../../core/lineup';
import {
  forgetEvent,
  lastName,
  rememberEvent,
  rememberName,
  rememberSkill,
  skills,
} from '../../core/local';
import { Activity, Attendee, RsvpStatus } from '../../core/models';
import { copyText, eventUrl, hostUrl, shareOrCopy } from '../../core/share';
import { ago, ddayLabel, whenLabel } from '../../core/time';
import { EventFields } from '../../shared/event-fields';

// 불참을 누르면 뜨는 문구. 매번 같으면 그냥 넘기는 팝업이 된다.
const NUDGES = [
  { title: '정말 안 갈 거야?', sub: '너 빠지면 팀이 안 맞아' },
  { title: '한 번만 더 생각해봐', sub: '30분만 얼굴 비춰도 되는데' },
  { title: '진심이야?', sub: '다들 너 온다고 알고 있는데' },
];

const STATUS_LABEL: Record<RsvpStatus, string> = { YES: '참석', NO: '불참' };

const DEFAULT_HINT = '이름 쓰고 버튼 하나 누르면 바로 명단에 올라가.';
const CLOSED_HINT = '주최자가 마감했어. 못 가게 되면 주최자한테 말해줘.';

const MAX_GUESTS = 5;

export const LEVELS: { level: Level; label: string }[] = [
  { level: 3, label: '상' },
  { level: 2, label: '중' },
  { level: 1, label: '하' },
];

function activityText(a: Activity): string {
  switch (a.kind) {
    case 'join':
      return `${iga(a.name!)} ${STATUS_LABEL[a.status!]}으로 응답했어`;
    case 'change':
      return `${iga(a.name!)} ${STATUS_LABEL[a.status!]}으로 바꿨어`;
    case 'cancel':
      return `${iga(a.name!)} 응답을 취소했어`;
    case 'remove':
      return `주최자가 ${a.name}의 응답을 지웠어`;
    case 'guests':
      return a.guests ? `${iga(a.name!)} 친구 ${a.guests}명 데려온대` : `${iga(a.name!)} 친구 안 데려온대`;
    case 'close':
      return a.closed ? '주최자가 모임을 마감했어' : '주최자가 모임을 다시 열었어';
    case 'place':
      return `장소가 ${euro(a.place!)} 바뀌었어`;
    case 'time':
      return '시간이 변경됐어';
    case 'teams':
      return '주최자가 팀을 나눴어';
  }
}

@Component({
  selector: 'app-event-view',
  imports: [RouterLink, EventFields],
  templateUrl: './event-view.html',
  styleUrl: './event-view.scss',
})
export class EventView {
  private readonly store = inject(EventStore);
  private readonly auth = inject(Auth);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly eventId = this.route.snapshot.paramMap.get('id') ?? '';

  // Firestore 실시간 구독. 친구가 누르면 새로고침 없이 바로 바뀐다.
  private readonly live = this.store.watch(this.eventId, inject(DestroyRef));
  readonly event = this.live.event;
  readonly attendees = this.live.attendees;
  readonly missing = this.live.missing;

  // 주최자면 경기 정보 수정, 남의 응답 삭제, 팀 공개가 보인다.
  readonly isHost = signal(false);
  readonly draft = signal<EventForm | null>(null);
  readonly draftError = signal('');

  readonly name = signal(lastName());
  readonly hint = signal(DEFAULT_HINT);
  readonly hintIsError = signal(false);
  readonly busy = signal(false);

  readonly logOpen = signal(false);
  // 기록 지우기·모임 삭제는 두 번 눌러야 한다. 처음 누르면 "정말 지울까?"로 바뀐다
  readonly confirmClearLog = signal(false);
  readonly confirmDelete = signal(false);

  // 주최자가 실력을 매기는 목록. 이 기기에만 저장된다
  readonly skillOpen = signal(false);
  readonly skillMap = signal(skills());
  readonly levels = LEVELS;

  // 공유 버튼·계좌 복사 아래 잠깐 뜨는 결과 문구
  readonly shareNote = signal('');
  readonly feeNote = signal('');

  // 불참 확인 다이얼로그
  readonly nudge = signal<{ title: string; sub: string } | null>(null);

  // 카운터가 굴러 올라가는 값. 참석 수로 서서히 다가간다.
  readonly shownCount = signal(0);

  // 주최자가 아닌 사람이 혼자 섞어보는 팀. 저장하지 않는다.
  readonly localTeams = signal<{ a: string[]; b: string[]; at: Date } | null>(null);

  // 참석을 누른 순서대로 정원까지 확정, 넘치면 대기
  private readonly lineup = computed(() => lineup(this.attendees(), this.event()?.maxPeople ?? null));
  readonly going = computed(() => this.lineup().confirmed);
  readonly waiting = computed(() => this.lineup().waiting);
  /** 친구까지 센 확정 인원 */
  readonly count = computed(() => this.lineup().count);
  readonly notGoing = computed(() => this.attendees().filter((a) => a.status === 'NO'));
  readonly minPeople = computed(() => this.event()?.minPeople ?? 0);
  readonly maxPeople = computed(() => this.event()?.maxPeople ?? null);
  readonly isFull = computed(() => this.count() >= this.minPeople());
  readonly shortBy = computed(() => Math.max(0, this.minPeople() - this.count()));
  readonly barPct = computed(() =>
    Math.min(100, (this.count() / Math.max(1, this.maxPeople() ?? this.minPeople())) * 100),
  );
  // 정원이 있으면 막대 위에 최소 인원 자리를 표시한다
  readonly minMarkPct = computed(() => {
    const max = this.maxPeople();
    return max && max > this.minPeople() ? (this.minPeople() / max) * 100 : null;
  });
  readonly capText = computed(() => {
    const max = this.maxPeople();
    if (max == null) return '';
    const waiting = headcount(this.waiting());
    if (waiting) return `정원 ${max}명 꽉 참 · 대기 ${waiting}명`;
    return this.count() >= max ? `정원 ${max}명 꽉 참` : `정원 ${max}명 · ${max - this.count()}자리 남음`;
  });

  readonly closed = computed(() => !!this.event()?.closed);
  /** 마감되면 주최자 말고는 명단을 못 바꾼다 */
  readonly locked = computed(() => this.closed() && !this.isHost());

  // 지금 입력칸에 쓴 이름의 응답. 내 것이면 버튼에 눌린 상태로 보여준다.
  readonly typed = computed(() => this.attendees().find((a) => a.name === this.name().trim()));
  readonly mine = computed(() => {
    const t = this.typed();
    return t && t.uid === this.auth.uid() ? t : null;
  });
  readonly myStatus = computed(() => this.mine()?.status ?? null);
  /** 내가 대기 몇 번인지. 대기가 아니면 0 */
  readonly myWait = computed(() => {
    const me = this.mine();
    return me ? this.waiting().indexOf(me) + 1 : 0;
  });
  readonly maxGuests = MAX_GUESTS;

  // ── 회비 ──
  readonly fee = computed(() => this.event()?.fee ?? null);
  // 참석 확정인 사람, 그리고 이미 냈는데 빠진 사람(돌려줘야 하니까)
  readonly feeRows = computed(() => {
    const fee = this.fee() ?? 0;
    const rows = [...this.going(), ...this.attendees().filter((a) => a.paid && !this.going().includes(a))];
    return rows.map((a) => ({ a, amount: fee * (1 + a.guests), out: !this.going().includes(a) }));
  });
  readonly feeSummary = computed(() => {
    const rows = this.feeRows().filter((r) => !r.out);
    const paid = rows.filter((r) => r.a.paid);
    const sum = (list: typeof rows) => list.reduce((n, r) => n + r.amount, 0);
    return `${paid.length}/${rows.length}명 냄 · ${won(sum(paid))} / ${won(sum(rows))}`;
  });
  readonly won = won;

  readonly whenText = computed(() => {
    const e = this.event();
    return e ? whenLabel(e.eventAt) : '';
  });
  readonly dday = computed(() => {
    const e = this.event();
    return e ? ddayLabel(e.eventAt) : '';
  });

  readonly activities = computed(() =>
    this.live.activities().map((a) => ({ id: a.id, text: activityText(a), ago: ago(a.at) })),
  );

  // 주최자가 공개한 팀이 있으면 그걸, 없으면 내가 섞어본 팀
  readonly teams = computed(() => this.event()?.teams ?? this.localTeams());
  readonly teamsPublished = computed(() => !!this.event()?.teams);

  readonly teamSides = computed(() => {
    const t = this.teams();
    if (!t) return [];
    return [
      { nm: 'A팀', arr: t.a, cls: 'a' },
      { nm: 'B팀', arr: t.b, cls: 'b' },
    ];
  });

  // 섞은 뒤에 명단이 바뀌었으면 알려준다.
  readonly teamsStale = computed(() => {
    const t = this.teams();
    if (!t) return false;
    const now = playerNames(this.going()).sort().join('\n');
    return now !== [...t.a, ...t.b].sort().join('\n');
  });

  readonly teamStamp = computed(() => {
    const t = this.teams();
    if (!t) return '';
    return (
      new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit' }).format(t.at) + ' 기준'
    );
  });

  constructor() {
    this.checkHost();

    // 처음 들어왔을 때 이 기기로 응답한 이름이 있으면 그 이름을 채운다
    let filled = false;
    effect(() => {
      const uid = this.auth.uid();
      const mine = this.attendees().find((a) => a.uid === uid);
      if (filled || !uid || !mine) return;
      filled = true;
      untracked(() => this.name.set(mine.name));
    });

    // 홈의 "최근 모임"에 남긴다
    // 홈의 "최근 모임"에 남긴다. 다시 만들기에 쓰도록 장소·인원·회비도 같이
    effect(() => {
      const e = this.event();
      if (!e) return;
      const { id, title, place, minPeople, maxPeople, fee, account } = e;
      rememberEvent({
        id, title, place, minPeople, maxPeople, fee, account,
        eventAt: e.eventAt.getTime(),
        host: this.isHost(),
      });
    });

    // 마감되면 입력칸 안내도 바꿔준다
    effect(() => {
      const locked = this.locked();
      untracked(() => {
        if (locked) this.setHint(CLOSED_HINT);
        else if (this.hint() === CLOSED_HINT) this.setHint(DEFAULT_HINT);
      });
    });

    effect(() => {
      const target = this.count();
      untracked(() => this.rollTo(target));
    });
  }

  // ?key= 로 들어오면 이 기기를 주최자로 등록하고 주소창에서 지운다.
  // 그대로 두면 화면을 캡처하거나 링크를 복사해 단톡방에 올릴 때 키가 같이 새어 나간다.
  private async checkHost() {
    const key = this.route.snapshot.queryParamMap.get('key');
    if (key) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { key: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
      if (!(await this.store.isHost(this.eventId))) {
        const ok = await this.store.claimHost(this.eventId, key);
        if (!ok) this.setHint('주최자 링크가 맞지 않아. 처음 받은 주최자 링크로 다시 들어와줘.', true);
      }
    }
    this.isHost.set(await this.store.isHost(this.eventId));
  }

  // 숫자가 뚝 바뀌는 대신 굴러 올라가게 한다.
  // 내 응답이 전체에 반영됐다는 인과를 눈으로 보여주는 역할.
  private rollTo(target: number) {
    const from = this.shownCount();
    if (from === target) return;

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.shownCount.set(target);
      return;
    }

    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 420);
      const eased = 1 - Math.pow(1 - k, 3);
      this.shownCount.set(Math.round(from + (target - from) * eased));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  onNameInput(value: string) {
    this.name.set(value);
    if (this.hintIsError()) this.setHint(DEFAULT_HINT);
  }

  private setHint(text: string, isError = false) {
    this.hint.set(text);
    this.hintIsError.set(isError);
  }

  // 참석은 바로, 불참은 한 번 더 물어본다.
  press(status: RsvpStatus) {
    if (this.locked()) return this.setHint(CLOSED_HINT, true);
    const problem = nameProblem(this.name().trim());
    if (problem) return this.setHint(problem, true);

    if (status === 'NO' && this.myStatus() !== 'NO') {
      this.nudge.set(NUDGES[Math.floor(Math.random() * NUDGES.length)]);
      return;
    }
    this.submit(status);
  }

  async changeGuests(delta: number) {
    const me = this.mine();
    if (!me || this.locked()) return;
    const guests = Math.min(MAX_GUESTS, Math.max(0, me.guests + delta));
    if (guests === me.guests) return;
    this.busy.set(true);
    try {
      await this.store.setGuests(this.eventId, me.name, guests);
    } catch {
      this.setHint('저장이 안 됐어. 잠시 후 다시 눌러줘.', true);
    } finally {
      this.busy.set(false);
    }
  }

  // 다이얼로그의 강조 버튼. 허들의 유일한 목적이 이 전환이다.
  changeMind() {
    this.nudge.set(null);
    this.submit('YES');
  }

  confirmDecline() {
    this.nudge.set(null);
    this.submit('NO');
  }

  private async submit(status: RsvpStatus) {
    const name = this.name().trim();
    this.busy.set(true);
    try {
      await this.store.rsvp(this.eventId, name, status, this.typed());
      rememberName(name);
      this.setHint(`${name} → ${STATUS_LABEL[status]}으로 저장했어.`);
    } catch (err) {
      this.setHint(
        err instanceof NameTakenError ? err.message : '저장이 안 됐어. 잠시 후 다시 눌러줘.',
        true,
      );
    } finally {
      this.busy.set(false);
    }
  }

  isMine(a: Attendee) {
    return a.uid === this.auth.uid();
  }

  canRemove(a: Attendee) {
    return this.isHost() || (this.isMine(a) && !this.closed());
  }

  async remove(a: Attendee) {
    this.busy.set(true);
    try {
      await this.store.remove(this.eventId, a);
      if (this.isMine(a)) this.setHint(`${a.name}의 응답을 취소했어.`);
    } catch {
      this.setHint('지우지 못했어. 잠시 후 다시 눌러줘.', true);
    } finally {
      this.busy.set(false);
    }
  }

  // ── 경기 정보 수정 (주최자만) ─────────────────────────────

  openEdit() {
    const e = this.event();
    if (!e) return;
    this.draftError.set('');
    this.draft.set(formFrom(e));
  }

  setDraft(next: EventForm) {
    this.draft.set(next);
    if (this.draftError()) this.draftError.set('');
  }

  async saveEdit() {
    const d = this.draft();
    const e = this.event();
    if (!d || !e) return;

    const read = readForm(d);
    if ('error' in read) return this.draftError.set(read.error);

    this.busy.set(true);
    try {
      await this.store.update(e, read.input);
      this.draft.set(null);
    } catch {
      this.draftError.set('저장이 안 됐어. 잠시 후 다시 눌러줘.');
    } finally {
      this.busy.set(false);
    }
  }

  // 주최자 링크를 잃어버렸을 때 여기서 다시 복사한다
  async copyHostLink() {
    const key = await this.store.hostKey(this.eventId);
    const ok = key && (await copyText(hostUrl(this.eventId, key))) === 'copied';
    this.shareNote.set(ok ? '주최자 링크를 복사했어. 단톡방엔 올리지 마!' : '복사가 안 됐어.');
  }

  async clearLog() {
    if (!this.confirmClearLog()) return this.confirmClearLog.set(true);
    this.confirmClearLog.set(false);
    this.busy.set(true);
    try {
      await this.store.clearActivities(this.eventId);
    } catch {
      this.setHint('기록을 지우지 못했어.', true);
    } finally {
      this.busy.set(false);
    }
  }

  async toggleClosed() {
    this.busy.set(true);
    try {
      await this.store.setClosed(this.eventId, !this.closed());
    } catch {
      this.setHint('바꾸지 못했어. 잠시 후 다시 눌러줘.', true);
    } finally {
      this.busy.set(false);
    }
  }

  async deleteEvent() {
    if (!this.confirmDelete()) return this.confirmDelete.set(true);
    this.busy.set(true);
    try {
      await this.store.deleteEvent(this.eventId);
      forgetEvent(this.eventId);
      this.router.navigate(['/'], { replaceUrl: true });
    } catch {
      this.confirmDelete.set(false);
      this.setHint('모임을 지우지 못했어. 잠시 후 다시 눌러줘.', true);
    } finally {
      this.busy.set(false);
    }
  }

  // ── 회비 (표시는 주최자만) ──────────────────────────────

  async togglePaid(a: Attendee) {
    if (!this.isHost()) return;
    try {
      await this.store.setPaid(this.eventId, a.name, !a.paid);
    } catch {
      this.setHint('회비 표시를 저장하지 못했어.', true);
    }
  }

  async copyAccount() {
    const account = this.event()?.account;
    const ok = account && (await copyText(account)) === 'copied';
    this.feeNote.set(ok ? '계좌를 복사했어!' : '복사가 안 됐어.');
  }

  // ── 팀 나누기 ────────────────────────────────────────

  levelOf = (name: string): Level => this.skillMap()[name] ?? 2;

  setSkill(name: string, level: Level) {
    // 같은 걸 다시 누르면 매긴 걸 지운다
    const next = this.skillMap()[name] === level ? null : level;
    rememberSkill(name, next);
    this.skillMap.set(skills());
  }

  // 주최자가 섞으면 실력을 고려해서 모두에게 보이고, 다른 사람은 자기 화면에서만 무작위로 섞어본다.
  async splitTeams() {
    const names = playerNames(this.going());
    const split = this.isHost() ? balancedSplit(names, this.levelOf) : balancedSplit(names, () => 2);
    if (!this.isHost()) {
      this.localTeams.set({ ...split, at: new Date() });
      return;
    }
    this.busy.set(true);
    try {
      await this.store.publishTeams(this.eventId, split);
    } catch {
      this.setHint('팀을 저장하지 못했어.', true);
    } finally {
      this.busy.set(false);
    }
  }

  async clearTeams() {
    if (!this.teamsPublished()) return this.localTeams.set(null);
    if (!this.isHost()) return;
    this.busy.set(true);
    try {
      await this.store.publishTeams(this.eventId, null);
    } finally {
      this.busy.set(false);
    }
  }

  // 단톡방에 다시 올릴 링크. 지금 몇 명인지 같이 적어서 아직 답 안 한 사람을 부른다.
  async share() {
    const e = this.event();
    if (!e) return;
    const max = this.maxPeople();
    const status = this.closed()
      ? `${this.count()}명으로 마감!`
      : max != null && this.count() >= max
        ? `정원 ${max}명 꽉 참, 대기 신청 받는 중`
        : this.isFull()
          ? `지금 ${this.count()}명, 인원 충족!`
          : `지금 ${this.count()}/${e.minPeople}명, ${this.shortBy()}명 더 필요해`;
    const result = await shareOrCopy({
      text: `⚽ ${e.title}\n${this.whenText()} · ${e.place}\n${status}`,
      url: eventUrl(e.id),
    });
    const notes = {
      copied: '복사했어! 단톡방에 붙여넣어줘.',
      failed: '복사가 안 됐어. 주소창 링크를 직접 복사해줘.',
    };
    this.shareNote.set(result === 'copied' || result === 'failed' ? notes[result] : '');
  }

  // 주소창에 붙여넣거나 링크만 따로 보낼 때
  async copyLink() {
    const ok = (await copyText(eventUrl(this.eventId))) === 'copied';
    this.shareNote.set(ok ? '링크를 복사했어!' : '복사가 안 됐어. 주소창 링크를 직접 복사해줘.');
  }
}
