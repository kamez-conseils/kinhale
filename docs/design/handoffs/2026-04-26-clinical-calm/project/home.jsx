// Kinhale — Home / today's status
// Receives all tweak values via props so iOS + Android frames stay in sync.

const COPY = {
  fr: {
    appName: 'Kinhale',
    childName: 'Votre enfant',
    today: "Aujourd'hui",
    morning: 'Matin',
    evening: 'Soir',
    noon: 'Midi',
    statusOnTrack: 'Tout est à jour',
    statusDue: 'Prise du soir prévue',
    statusOverdue: 'Prise du soir en retard',
    statusDueSub: 'à 20:00 · dans {min} min',
    statusOverdueSub: 'depuis {min} min · à confirmer',
    statusOnTrackSub: 'Prochaine prise demain à 8:00',
    btnFond: 'Pompe de fond donnée',
    btnFondSub: 'Fluticasone · 2 bouffées',
    btnSecours: 'Pompe de secours',
    btnSecoursSub: 'Salbutamol · 1–2 bouffées',
    schedule: 'Programme du jour',
    done: 'Donnée',
    pending: 'À venir',
    overdue: 'En retard',
    missed: 'Manquée',
    activity: 'Activité récente',
    caregivers: 'Aidants',
    online: 'En ligne',
    offline: 'Hors ligne',
    syncPending: 'En attente de sync',
    inventory: 'Mes pompes',
    dosesLeft: '{n} doses',
    dosesLeftLong: '{n} doses restantes',
    refillSoon: 'Renouveler bientôt',
    expires: 'Expire le {d}',
    expiresSoon: 'Expire dans {n} j',
    expired: 'Expirée',
    quickAction: 'Enregistrer une prise',
    quickFond: 'Fond',
    quickSecours: 'Secours',
    confirmRescue: 'Pourquoi ?',
    rescueLog: '1 prise de secours · ce mois',
    pillFond: 'Fond',
    pillSecours: 'Secours',
    by: 'par {name}',
    you: 'Vous',
    coparent: 'Co-parent',
    daycare: 'Garderie',
    grandparent: 'Grand-père',
    daycareView: 'Vue garderie',
    daycarePrompt: 'Prêt·e pour la pompe de midi.',
    daycareBtn: 'Pompe donnée',
    daycareDone: 'Enregistré · 12:15',
    daycareSession: "Session jusqu'à 18:00",
    notMedicalDevice: 'Ne remplace pas un avis médical.',
    history: 'Historique',
    report: 'Rapport médecin',
    every: 'Chaque jour',
    role_admin: 'Admin',
    role_contributor: 'Contributeur',
    role_restricted: 'Garderie',
    confirmed: 'Confirmée à {t}',
    administered: 'Administrée à {t}',
    causeEffort: 'Effort',
    causeNight: 'Nuit',
    causeAllergy: 'Allergène',
    minAgo: 'il y a {n} min',
    hAgo: 'il y a {n} h',
  },
  en: {
    appName: 'Kinhale',
    childName: 'Your child',
    today: 'Today',
    morning: 'Morning',
    evening: 'Evening',
    noon: 'Noon',
    statusOnTrack: 'All caught up',
    statusDue: 'Evening dose coming up',
    statusOverdue: 'Evening dose is late',
    statusDueSub: 'at 8:00 PM · in {min} min',
    statusOverdueSub: '{min} min late · please confirm',
    statusOnTrackSub: 'Next dose tomorrow at 8:00 AM',
    btnFond: 'Maintenance dose given',
    btnFondSub: 'Fluticasone · 2 puffs',
    btnSecours: 'Rescue inhaler',
    btnSecoursSub: 'Salbutamol · 1–2 puffs',
    schedule: "Today's schedule",
    done: 'Given',
    pending: 'Up next',
    overdue: 'Late',
    missed: 'Missed',
    activity: 'Recent activity',
    caregivers: 'Caregivers',
    online: 'Online',
    offline: 'Offline',
    syncPending: 'Sync pending',
    inventory: 'My inhalers',
    dosesLeft: '{n} doses',
    dosesLeftLong: '{n} doses left',
    refillSoon: 'Refill soon',
    expires: 'Expires {d}',
    expiresSoon: 'Expires in {n} d',
    expired: 'Expired',
    quickAction: 'Log a dose',
    quickFond: 'Maintenance',
    quickSecours: 'Rescue',
    confirmRescue: 'What happened?',
    rescueLog: '1 rescue dose · this month',
    pillFond: 'Maintenance',
    pillSecours: 'Rescue',
    by: 'by {name}',
    you: 'You',
    coparent: 'Co-parent',
    daycare: 'Daycare',
    grandparent: 'Grandpa',
    daycareView: 'Daycare view',
    daycarePrompt: 'Ready for the noon dose.',
    daycareBtn: 'Dose given',
    daycareDone: 'Logged · 12:15',
    daycareSession: 'Session until 6:00 PM',
    notMedicalDevice: 'Not a substitute for medical advice.',
    history: 'History',
    report: 'Medical report',
    every: 'Every day',
    role_admin: 'Admin',
    role_contributor: 'Contributor',
    role_restricted: 'Daycare',
    confirmed: 'Confirmed at {t}',
    administered: 'Administered at {t}',
    causeEffort: 'Effort',
    causeNight: 'Night',
    causeAllergy: 'Allergen',
    minAgo: '{n} min ago',
    hAgo: '{n} h ago',
  },
};

function fmt(s, vars = {}) {
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

// ── Tiny SVG glyphs (geometric, original — no brand marks) ─────────────────
const Icon = {
  inhalerMaint: (size = 18, color = 'currentColor') => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="6" y="9" width="9" height="11" rx="2" />
      <path d="M15 12h3a2 2 0 010 4h-3" />
      <path d="M9 5v4M12 5v4" />
    </svg>
  ),
  inhalerRescue: (size = 18, color = 'currentColor') => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 13l5-5 4 4 5-5" />
      <circle cx="10.5" cy="10.5" r="2" />
    </svg>
  ),
  check: (size = 14, color = 'currentColor') => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 7.5l3 3 6-6" />
    </svg>
  ),
  clock: (size = 14, color = 'currentColor') => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      stroke={color}
      strokeWidth="1.5"
    >
      <circle cx="7" cy="7" r="5.5" />
      <path d="M7 4v3.2l2 1.3" strokeLinecap="round" />
    </svg>
  ),
  alert: (size = 14, color = 'currentColor') => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
    >
      <path d="M7 2.5L12.5 11.5h-11L7 2.5z" />
      <path d="M7 6v2.5M7 10v.01" />
    </svg>
  ),
  arrow: (size = 14, color = 'currentColor') => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7h8M7.5 3.5L11 7l-3.5 3.5" />
    </svg>
  ),
  wifi: (size = 12, color = 'currentColor') => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      stroke={color}
      strokeWidth="1.3"
      strokeLinecap="round"
    >
      <path d="M2 5.5a6 6 0 018 0M3.5 7.5a4 4 0 015 0" />
      <circle cx="6" cy="9.5" r="0.6" fill={color} stroke="none" />
    </svg>
  ),
};

// ── Status hero ─────────────────────────────────────────────────────────────
function StatusHero({ t, time, accent }) {
  // time: 'morning' | 'evening' | 'overdue'
  const isOverdue = time === 'overdue';
  const isEvening = time === 'evening';

  let title, sub, tone;
  if (isOverdue) {
    title = t.statusOverdue;
    sub = fmt(t.statusOverdueSub, { min: 24 });
    tone = 'amber';
  } else if (isEvening) {
    title = t.statusDue;
    sub = fmt(t.statusDueSub, { min: 38 });
    tone = 'maint';
  } else {
    title = t.statusOnTrack;
    sub = t.statusOnTrackSub;
    tone = 'ok';
  }

  const toneStyle = {
    maint: { bg: 'var(--k-maint-soft)', dot: 'var(--k-maint)', ink: 'var(--k-maint-ink)' },
    amber: { bg: 'var(--k-amber-soft)', dot: 'var(--k-amber)', ink: 'var(--k-amber-ink)' },
    ok: { bg: 'var(--k-ok-soft)', dot: 'var(--k-ok)', ink: 'oklch(35% 0.08 155)' },
  }[tone];

  // Override with custom accent for maint state when user picks one
  if (tone === 'maint' && accent) {
    toneStyle.dot = accent;
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: 'var(--k-pad)',
        background: toneStyle.bg,
        borderRadius: 'var(--k-r-lg)',
        border: '0.5px solid var(--k-line)',
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: 99,
          background: toneStyle.dot,
          marginTop: 7,
          flexShrink: 0,
          boxShadow: `0 0 0 4px color-mix(in oklch, ${toneStyle.dot} 18%, transparent)`,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="k-display"
          style={{
            fontSize: 22,
            lineHeight: 1.15,
            color: toneStyle.ink,
            fontWeight: 500,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--k-ink-2)',
            marginTop: 4,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {sub}
        </div>
      </div>
    </div>
  );
}

// ── Big primary buttons ─────────────────────────────────────────────────────
function ActionButton({ kind, t, accent, role, onPress }) {
  const isMaint = kind === 'maint';
  const restricted = role === 'restricted';

  const bg = isMaint ? accent || 'var(--k-maint)' : 'var(--k-surface)';
  const fg = isMaint ? '#fff' : 'var(--k-rescue-ink)';
  const border = isMaint ? 'transparent' : 'var(--k-rescue)';
  const sub = isMaint ? t.btnFondSub : t.btnSecoursSub;
  const label = isMaint ? t.btnFond : t.btnSecours;

  if (restricted && !isMaint) return null;

  return (
    <button
      onClick={onPress}
      style={{
        appearance: 'none',
        border: `1px solid ${border}`,
        background: bg,
        color: fg,
        textAlign: 'left',
        padding: '14px 16px',
        borderRadius: 'var(--k-r-md)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        cursor: 'pointer',
        fontFamily: 'inherit',
        boxShadow: isMaint ? '0 1px 0 rgba(0,0,0,0.04)' : 'none',
        minHeight: 56,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: isMaint ? 'rgba(255,255,255,0.18)' : 'var(--k-rescue-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isMaint ? '#fff' : 'var(--k-rescue)',
          flexShrink: 0,
        }}
      >
        {isMaint ? Icon.inhalerMaint(20) : Icon.inhalerRescue(20)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="k-display" style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.2 }}>
          {label}
        </div>
        <div
          style={{
            fontSize: 12,
            opacity: isMaint ? 0.85 : 0.7,
            marginTop: 2,
            color: isMaint ? '#fff' : 'var(--k-ink-3)',
          }}
        >
          {sub}
        </div>
      </div>
      <div style={{ opacity: 0.6 }}>{Icon.arrow(14, isMaint ? '#fff' : 'var(--k-rescue)')}</div>
    </button>
  );
}

// ── Schedule strip ──────────────────────────────────────────────────────────
function ScheduleStrip({ t, time, accent }) {
  const accentColor = accent || 'var(--k-maint)';
  const slots = [
    { label: t.morning, time: '8:00', state: 'done' },
    { label: t.noon, time: '12:15', state: 'done', tag: t.daycare },
    {
      label: t.evening,
      time: '20:00',
      state: time === 'overdue' ? 'overdue' : time === 'evening' ? 'pending' : 'done',
    },
  ];

  return (
    <div className="k-section">
      <SectionHeader label={t.schedule} muted />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
        }}
      >
        {slots.map((s, i) => {
          let dotBg, ring, ink, text;
          if (s.state === 'done') {
            dotBg = 'var(--k-ok)';
            ring = 'var(--k-ok-soft)';
            ink = 'oklch(35% 0.08 155)';
            text = t.done;
          } else if (s.state === 'pending') {
            dotBg = accentColor;
            ring = 'color-mix(in oklch, var(--k-maint) 12%, transparent)';
            ink = 'var(--k-maint-ink)';
            text = t.pending;
          } else if (s.state === 'overdue') {
            dotBg = 'var(--k-amber)';
            ring = 'var(--k-amber-soft)';
            ink = 'var(--k-amber-ink)';
            text = t.overdue;
          } else {
            dotBg = 'var(--k-miss)';
            ring = 'var(--k-miss-soft)';
            ink = 'var(--k-ink-3)';
            text = t.missed;
          }
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: '10px 10px',
                background: 'var(--k-surface-2)',
                borderRadius: 'var(--k-r-sm)',
                border: '0.5px solid var(--k-line)',
                minHeight: 78,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--k-ink-3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontWeight: 500,
                }}
              >
                {s.label}
              </div>
              <div
                className="k-mono"
                style={{
                  fontSize: 16,
                  fontWeight: 500,
                  color: 'var(--k-ink)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {s.time}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 'auto' }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 99,
                    background: dotBg,
                    boxShadow: `0 0 0 3px ${ring}`,
                  }}
                />
                <span style={{ fontSize: 11, color: ink, fontWeight: 500 }}>{text}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionHeader({ label, muted, action }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--k-ink-3)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {label}
      </div>
      {action}
    </div>
  );
}

// ── Activity feed ───────────────────────────────────────────────────────────
function Activity({ t, role }) {
  const items = [
    {
      kind: 'maint',
      who: t.coparent,
      time: '8:02',
      ago: fmt(t.hAgo, { n: 11 }),
      label: t.pillFond,
    },
    {
      kind: 'maint',
      who: t.daycare,
      time: '12:15',
      ago: fmt(t.hAgo, { n: 7 }),
      label: t.pillFond,
      syncNote: '12:18',
    },
    {
      kind: 'rescue',
      who: t.you,
      time: 'Lun · 14:40',
      ago: '3 j',
      label: t.pillSecours,
      cause: t.causeEffort,
    },
  ];

  if (role === 'restricted') return null;

  return (
    <div className="k-section">
      <SectionHeader
        label={t.activity}
        action={
          <a
            style={{
              fontSize: 12,
              color: 'var(--k-maint)',
              textDecoration: 'none',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {t.history} {Icon.arrow(11, 'var(--k-maint)')}
          </a>
        }
      />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((it, i) => {
          const isRescue = it.kind === 'rescue';
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 0',
                borderTop: i === 0 ? 'none' : '0.5px solid var(--k-line)',
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: isRescue ? 'var(--k-rescue-soft)' : 'var(--k-maint-soft)',
                  color: isRescue ? 'var(--k-rescue)' : 'var(--k-maint)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {isRescue ? Icon.inhalerRescue(15) : Icon.inhalerMaint(15)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13.5, color: 'var(--k-ink)', fontWeight: 500 }}>
                    {it.label}
                  </span>
                  {it.cause && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: '1px 6px',
                        background: 'var(--k-rescue-soft)',
                        color: 'var(--k-rescue-ink)',
                        borderRadius: 99,
                        fontWeight: 500,
                      }}
                    >
                      {it.cause}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--k-ink-3)', marginTop: 2 }}>
                  {fmt(t.by, { name: it.who })} · {it.ago}
                  {it.syncNote && (
                    <span style={{ color: 'var(--k-ink-4)' }}> · sync {it.syncNote}</span>
                  )}
                </div>
              </div>
              <div
                className="k-mono"
                style={{
                  fontSize: 12,
                  color: 'var(--k-ink-3)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {it.time}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Caregivers row ──────────────────────────────────────────────────────────
function Caregivers({ t, role }) {
  const people = [
    { name: t.you, role: t.role_admin, online: true, color: 'var(--k-maint)', initial: t.you[0] },
    {
      name: t.coparent,
      role: t.role_contributor,
      online: true,
      color: 'oklch(60% 0.08 290)',
      initial: 'C',
    },
    {
      name: t.daycare,
      role: t.role_restricted,
      online: false,
      color: 'oklch(60% 0.08 75)',
      initial: 'G',
      syncPending: true,
    },
    {
      name: t.grandparent,
      role: t.role_contributor,
      online: true,
      color: 'oklch(60% 0.07 155)',
      initial: 'P',
    },
  ];
  if (role === 'restricted') return null;

  return (
    <div className="k-section">
      <SectionHeader label={t.caregivers} />
      <div style={{ display: 'flex', gap: 16, overflowX: 'auto' }}>
        {people.map((p, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              minWidth: 56,
            }}
          >
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 99,
                  background: `color-mix(in oklch, ${p.color} 18%, var(--k-surface))`,
                  color: p.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  fontWeight: 600,
                  fontFamily: 'var(--k-display)',
                  border: '0.5px solid var(--k-line)',
                }}
              >
                {p.initial}
              </div>
              <div
                style={{
                  position: 'absolute',
                  bottom: -1,
                  right: -1,
                  width: 12,
                  height: 12,
                  borderRadius: 99,
                  background: p.online ? 'var(--k-ok)' : 'var(--k-ink-4)',
                  border: '2px solid var(--k-surface)',
                }}
              />
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--k-ink-2)',
                fontWeight: 500,
                textAlign: 'center',
                lineHeight: 1.2,
              }}
            >
              {p.name}
            </div>
            <div
              style={{
                fontSize: 10,
                color: 'var(--k-ink-4)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              {p.syncPending ? t.syncPending : p.role}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Inhaler inventory — stock + expiry ──────────────────────────────────────
function Inventory({ t, role, lang }) {
  if (role === 'restricted') return null;

  // Locale-aware short date
  const fmtDate = (iso) => {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(lang === 'fr' ? 'fr-CA' : 'en-CA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  };
  const today = new Date('2026-04-26');
  const daysUntil = (iso) => Math.round((new Date(iso) - today) / 86400000);

  const inhalers = [
    {
      name: 'Fluticasone 50µg',
      sub: lang === 'fr' ? 'Pompe de fond · matin & soir' : 'Maintenance · morning & evening',
      kind: 'maint',
      doses: 92,
      total: 120,
      expiry: '2026-09-14',
    },
    {
      name: 'Salbutamol 100µg',
      sub: lang === 'fr' ? 'Pompe de secours · maison' : 'Rescue · home',
      kind: 'rescue',
      doses: 18,
      total: 200,
      expiry: '2026-05-22',
      low: true,
    },
    {
      name: 'Salbutamol 100µg',
      sub: lang === 'fr' ? 'Pompe de secours · garderie' : 'Rescue · daycare',
      kind: 'rescue',
      doses: 144,
      total: 200,
      expiry: '2027-02-10',
    },
  ];

  return (
    <div className="k-section">
      <SectionHeader
        label={t.inventory}
        action={<span style={{ fontSize: 12, color: 'var(--k-maint)', fontWeight: 500 }}>+</span>}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {inhalers.map((inh, i) => {
          const dLeft = daysUntil(inh.expiry);
          const expiringSoon = dLeft <= 45 && dLeft > 0;
          const expired = dLeft <= 0;
          const showWarn = inh.low || expiringSoon || expired;
          const stockPct = (inh.doses / inh.total) * 100;
          const isMaint = inh.kind === 'maint';

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                paddingTop: i === 0 ? 0 : 14,
                borderTop: i === 0 ? 'none' : '0.5px solid var(--k-line)',
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: isMaint ? 'var(--k-maint-soft)' : 'var(--k-rescue-soft)',
                  color: isMaint ? 'var(--k-maint)' : 'var(--k-rescue)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {isMaint ? Icon.inhalerMaint(20) : Icon.inhalerRescue(20)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 14, color: 'var(--k-ink)', fontWeight: 500 }}>
                    {inh.name}
                  </span>
                  <span
                    className="k-mono"
                    style={{
                      fontSize: 12,
                      color: inh.low ? 'var(--k-amber-ink)' : 'var(--k-ink-2)',
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {fmt(t.dosesLeftLong, { n: inh.doses })}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--k-ink-3)', marginTop: 2 }}>
                  {inh.sub}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    height: 5,
                    background: 'var(--k-line)',
                    borderRadius: 99,
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      width: `${stockPct}%`,
                      height: '100%',
                      background: inh.low
                        ? 'var(--k-amber)'
                        : isMaint
                          ? 'var(--k-maint)'
                          : 'var(--k-rescue)',
                      borderRadius: 99,
                    }}
                  />
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 7,
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: expired
                        ? 'var(--k-rescue-ink)'
                        : expiringSoon
                          ? 'var(--k-amber-ink)'
                          : 'var(--k-ink-3)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    {Icon.clock(
                      11,
                      expired
                        ? 'var(--k-rescue-ink)'
                        : expiringSoon
                          ? 'var(--k-amber-ink)'
                          : 'var(--k-ink-3)',
                    )}
                    {expired
                      ? t.expired
                      : expiringSoon
                        ? fmt(t.expiresSoon, { n: dLeft })
                        : fmt(t.expires, { d: fmtDate(inh.expiry) })}
                  </span>
                  {showWarn && inh.low && (
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--k-amber-ink)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontWeight: 500,
                      }}
                    >
                      {Icon.alert(11, 'var(--k-amber-ink)')} {t.refillSoon}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Sticky bottom action bar — two big icon-forward buttons ─────────────────
function BottomActionBar({ t, accent, role, dark }) {
  if (role === 'restricted') return null;
  const accentColor = accent || 'var(--k-maint)';
  const Btn = ({ kind }) => {
    const isMaint = kind === 'maint';
    return (
      <button
        style={{
          flex: 1,
          appearance: 'none',
          border: isMaint ? 'none' : `1.5px solid var(--k-rescue)`,
          background: isMaint ? accentColor : 'var(--k-surface)',
          color: isMaint ? '#fff' : 'var(--k-rescue)',
          borderRadius: 'var(--k-r-lg)',
          padding: '14px 10px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          fontFamily: 'inherit',
          cursor: 'pointer',
          boxShadow: isMaint
            ? '0 6px 18px color-mix(in oklch, ' + accentColor + ' 35%, transparent)'
            : '0 1px 0 rgba(0,0,0,0.02)',
          minHeight: 76,
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: isMaint ? 'rgba(255,255,255,0.18)' : 'var(--k-rescue-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isMaint ? Icon.inhalerMaint(26, '#fff') : Icon.inhalerRescue(26, 'var(--k-rescue)')}
        </div>
        <span
          className="k-display"
          style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.01em' }}
        >
          {isMaint ? t.quickFond : t.quickSecours}
        </span>
      </button>
    );
  };
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        padding: '10px var(--k-pad) calc(var(--k-pad) + 4px)',
        background: dark
          ? 'linear-gradient(to top, var(--k-bg) 70%, color-mix(in oklch, var(--k-bg) 0%, transparent))'
          : 'linear-gradient(to top, var(--k-bg) 70%, color-mix(in oklch, var(--k-bg) 0%, transparent))',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderTop: '0.5px solid var(--k-line)',
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: 'var(--k-ink-3)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 600,
          textAlign: 'center',
          marginBottom: 8,
        }}
      >
        {t.quickAction}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Btn kind="maint" />
        <Btn kind="rescue" />
      </div>
    </div>
  );
}

// ── Daycare-restricted view ─────────────────────────────────────────────────
function DaycareRestrictedView({ t, accent }) {
  const [given, setGiven] = React.useState(false);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: 'var(--k-pad)',
        gap: 'var(--k-gap)',
        flex: 1,
      }}
    >
      <div
        style={{
          padding: 'var(--k-pad)',
          background: 'var(--k-surface)',
          borderRadius: 'var(--k-r-lg)',
          border: '0.5px solid var(--k-line)',
          textAlign: 'left',
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: 'var(--k-ink-3)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontWeight: 600,
          }}
        >
          {t.daycareView}
        </div>
        <div
          className="k-display"
          style={{
            fontSize: 24,
            lineHeight: 1.15,
            marginTop: 8,
            fontWeight: 500,
          }}
        >
          {t.childName}
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--k-ink-2)',
            marginTop: 4,
          }}
        >
          {given ? t.daycareDone : t.daycarePrompt}
        </div>
      </div>

      <button
        onClick={() => setGiven(true)}
        disabled={given}
        style={{
          appearance: 'none',
          border: 'none',
          background: given ? 'var(--k-ok-soft)' : accent || 'var(--k-maint)',
          color: given ? 'oklch(35% 0.08 155)' : '#fff',
          padding: '24px 16px',
          borderRadius: 'var(--k-r-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          fontFamily: 'inherit',
          minHeight: 96,
          cursor: given ? 'default' : 'pointer',
          transition: 'all 0.2s',
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: given ? 'var(--k-ok)' : 'rgba(255,255,255,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            flexShrink: 0,
          }}
        >
          {given ? Icon.check(22, '#fff') : Icon.inhalerMaint(24, '#fff')}
        </div>
        <div className="k-display" style={{ fontSize: 20, fontWeight: 500 }}>
          {given ? t.daycareDone : t.daycareBtn}
        </div>
      </button>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          fontSize: 12,
          color: 'var(--k-ink-3)',
        }}
      >
        {Icon.clock(12, 'var(--k-ink-3)')} {t.daycareSession}
      </div>

      <div style={{ flex: 1 }} />

      <div
        style={{
          fontSize: 11,
          color: 'var(--k-ink-4)',
          textAlign: 'center',
          fontStyle: 'italic',
        }}
      >
        {t.notMedicalDevice}
      </div>
    </div>
  );
}

// ── Main Home ───────────────────────────────────────────────────────────────
function KinhaleHome({
  lang = 'fr',
  density = 'regular',
  type = 'grotesk',
  role = 'admin',
  time = 'evening',
  layout = 'cards',
  dark = false,
  accent,
}) {
  const t = COPY[lang];

  if (role === 'restricted') {
    return (
      <div
        className="k-app"
        data-theme={dark ? 'dark' : 'light'}
        data-density={density}
        data-type={type}
        data-layout={layout}
        style={{ flex: 1, minHeight: 0 }}
      >
        <KinhaleHeader t={t} role={role} />
        <DaycareRestrictedView t={t} accent={accent} />
      </div>
    );
  }

  return (
    <div
      className="k-app"
      data-theme={dark ? 'dark' : 'light'}
      data-density={density}
      data-type={type}
      data-layout={layout}
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <KinhaleHeader t={t} role={role} />

        <div
          style={{
            padding: '0 var(--k-pad) calc(var(--k-pad) + 8px)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--k-gap)',
          }}
        >
          <StatusHero t={t} time={time} accent={accent} />

          <ScheduleStrip t={t} time={time} accent={accent} />
          <Inventory t={t} role={role} lang={lang} />
          <Activity t={t} role={role} />
          <Caregivers t={t} role={role} />

          <div
            style={{
              fontSize: 11,
              color: 'var(--k-ink-4)',
              textAlign: 'center',
              padding: '4px 0 8px',
              fontStyle: 'italic',
            }}
          >
            {t.notMedicalDevice}
          </div>
        </div>
      </div>

      <BottomActionBar t={t} accent={accent} role={role} dark={dark} />
    </div>
  );
}

function KinhaleHeader({ t, role }) {
  const dateStr = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date('2026-04-25'));
  return (
    <div
      style={{
        padding: 'calc(var(--k-pad) + 4px) var(--k-pad) calc(var(--k-pad) - 4px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            color: 'var(--k-ink-3)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontWeight: 600,
          }}
        >
          {dateStr}
        </div>
        <div
          className="k-display"
          style={{
            fontSize: 28,
            lineHeight: 1.1,
            marginTop: 4,
            fontWeight: 500,
          }}
        >
          {t.childName}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          color: 'var(--k-ink-3)',
          padding: '5px 10px',
          background: 'var(--k-surface-2)',
          borderRadius: 99,
          border: '0.5px solid var(--k-line)',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 99,
            background: 'var(--k-ok)',
            boxShadow: '0 0 0 3px var(--k-ok-soft)',
          }}
        />
        {role === 'admin'
          ? t.role_admin
          : role === 'restricted'
            ? t.role_restricted
            : t.role_contributor}
      </div>
    </div>
  );
}

Object.assign(window, { KinhaleHome });
