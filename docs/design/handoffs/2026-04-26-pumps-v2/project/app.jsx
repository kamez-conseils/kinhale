// Kinhale app shell — composes canvas + frames + Home + Tweaks
function __kStart() {
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "lang": "fr",
    "density": "regular",
    "type": "grotesk",
    "role": "admin",
    "time": "evening",
    "layout": "cards",
    "dark": false,
    "accent": "#5b8cc7"
  }/*EDITMODE-END*/;

  function App() {
    const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

    const homeProps = {
      lang: t.lang, density: t.density, type: t.type,
      role: t.role, time: t.time, layout: t.layout,
      dark: t.dark, accent: t.accent,
    };

    return (
      <React.Fragment>
        <DesignCanvas>
          <DCSection
            id="home"
            title="Kinhale · Home / today's status"
            subtitle="Clinical-calm coordination for an asthmatic child's caregivers. Use Tweaks to switch language, role, time of day, density, palette."
          >
            <DCArtboard id="ios" label="iOS · iPhone" width={402} height={874}>
              <IOSDevice width={402} height={874} dark={t.dark}>
                <div style={{
                  position: 'absolute', inset: 0,
                  paddingTop: 56, paddingBottom: 34,
                  display: 'flex', flexDirection: 'column',
                }}>
                  <KinhaleHome {...homeProps} />
                </div>
              </IOSDevice>
            </DCArtboard>

            <DCArtboard id="android" label="Android · Pixel" width={412} height={892}>
              <AndroidDevice width={412} height={892} dark={t.dark}>
                <KinhaleHome {...homeProps} />
              </AndroidDevice>
            </DCArtboard>
          </DCSection>

          <DCSection
            id="notes"
            title="System notes"
            subtitle="Color semantics, type, and the rule against medical-device language."
          >
            <DCArtboard id="palette" label="Palette" width={520} height={300}>
              <div data-theme={t.dark ? 'dark' : 'light'} style={{
                padding: 24, height: '100%', background: 'var(--k-bg)',
                fontFamily: '"Inter", system-ui',
                display: 'flex', flexDirection: 'column', gap: 16,
                borderRadius: 8,
              }}>
                <div className="k-display" style={{ fontSize: 18, fontWeight: 500, color: 'var(--k-ink)' }}>
                  Color semantics
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    ['Maintenance · routine', 'var(--k-maint)', 'var(--k-maint-soft)'],
                    ['Rescue · critical', 'var(--k-rescue)', 'var(--k-rescue-soft)'],
                    ['Alert · attention', 'var(--k-amber)', 'var(--k-amber-soft)'],
                    ['Confirmed · done', 'var(--k-ok)', 'var(--k-ok-soft)'],
                    ['Missed · passive', 'var(--k-miss)', 'var(--k-miss-soft)'],
                    ['Surface', 'var(--k-line-strong)', 'var(--k-surface)'],
                  ].map(([name, fg, bg], i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', background: bg, borderRadius: 8,
                      border: '0.5px solid var(--k-line)',
                    }}>
                      <div style={{ width: 14, height: 14, borderRadius: 4, background: fg }} />
                      <span style={{ fontSize: 12, color: 'var(--k-ink)' }}>{name}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--k-ink-3)', fontStyle: 'italic', marginTop: 'auto' }}>
                  All accents share oklch chroma 0.07–0.12. Hue is the only variable so the palette never shouts.
                </div>
              </div>
            </DCArtboard>
          </DCSection>
        </DesignCanvas>

        <TweaksPanel title="Kinhale tweaks">
          <TweakSection label="Context" />
          <TweakRadio label="Language" value={t.lang}
            options={[{value:'fr',label:'FR'},{value:'en',label:'EN'}]}
            onChange={(v) => setTweak('lang', v)} />
          <TweakRadio label="Role" value={t.role}
            options={[
              {value:'admin',label:'Admin'},
              {value:'contributor',label:'Co-pa'},
              {value:'restricted',label:'Daycare'},
            ]}
            onChange={(v) => setTweak('role', v)} />
          <TweakSelect label="Time of day" value={t.time}
            options={[
              {value:'morning',label:'Morning · all caught up'},
              {value:'evening',label:'Evening · dose due'},
              {value:'overdue',label:'Overdue · 24 min late'},
            ]}
            onChange={(v) => setTweak('time', v)} />

          <TweakSection label="Form" />
          <TweakRadio label="Density" value={t.density}
            options={[
              {value:'compact',label:'Compact'},
              {value:'regular',label:'Regular'},
              {value:'roomy',label:'Roomy'},
            ]}
            onChange={(v) => setTweak('density', v)} />
          <TweakSelect label="Type pairing" value={t.type}
            options={[
              {value:'grotesk',label:'Inter Tight + Inter (grotesk)'},
              {value:'serif',label:'Source Serif + Inter (editorial)'},
              {value:'humanist',label:'DM Sans (humanist)'},
            ]}
            onChange={(v) => setTweak('type', v)} />
          <TweakRadio label="Layout" value={t.layout}
            options={[
              {value:'cards',label:'Cards'},
              {value:'flat',label:'Flat'},
              {value:'bento',label:'Bento'},
            ]}
            onChange={(v) => setTweak('layout', v)} />

          <TweakSection label="Theme" />
          <TweakColor label="Accent" value={t.accent}
            onChange={(v) => setTweak('accent', v)} />
          <TweakToggle label="Dark mode" value={t.dark}
            onChange={(v) => setTweak('dark', v)} />
        </TweaksPanel>
      </React.Fragment>
    );
  }

  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
}

(function waitAndStart() {
  const need = ['useTweaks','TweaksPanel','TweakRadio','TweakSelect','TweakColor','TweakToggle','TweakSection',
    'KinhaleHome','IOSDevice','AndroidDevice','DesignCanvas','DCSection','DCArtboard'];
  if (need.every(n => window[n])) return __kStart();
  setTimeout(waitAndStart, 30);
})();
