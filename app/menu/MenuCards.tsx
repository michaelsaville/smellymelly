// Renders the v4 scent-menu aesthetic from DB-loaded groups.
// Used by both /menu (with site chrome) and /menu/print (bare paper).

type Scent = { id: string; name: string }
type Group = {
  id: string
  name: string
  displayLabel: string | null
  priceLabel: string | null
  theme: string
  scents: Scent[]
  /// When true, this card spans both columns of the 2-up grid. Used
  /// to be implicit on the first card; now explicit per group so any
  /// card can be wide.
  fullWidth?: boolean
}

// Theme palette mirrors v4 file. Keep keys in sync with admin THEMES list.
const THEMES: Record<
  string,
  { head: string; name: string; detail: string; body: string; pillBg: string; pillText: string }
> = {
  scrub: {
    head: '#3d1124',
    name: '#f2b8cc',
    detail: '#c8849a',
    body: '#2a0c18',
    pillBg: '#4a1530',
    pillText: '#f2b8cc',
  },
  butter: {
    head: '#251040',
    name: '#d8b8f5',
    detail: '#9d7cc0',
    body: '#1a0a2e',
    pillBg: '#351555',
    pillText: '#d8b8f5',
  },
  beard: {
    head: '#2e1f00',
    name: '#f5c87a',
    detail: '#b8912a',
    body: '#1e1400',
    pillBg: '#3d2800',
    pillText: '#f5c87a',
  },
  lip: {
    head: '#002e28',
    name: '#88e5cc',
    detail: '#3aaa88',
    body: '#001e1a',
    pillBg: '#004038',
    pillText: '#88e5cc',
  },
  scrub2: {
    head: '#2e0a18',
    name: '#f5a0b8',
    detail: '#b84065',
    body: '#1e0510',
    pillBg: '#400520',
    pillText: '#f5a0b8',
  },
}

function themeFor(key: string) {
  return THEMES[key] ?? THEMES.scrub
}

export function MenuCards({
  groups,
  storeName,
  phone,
  email,
  social,
}: {
  groups: Group[]
  storeName: string
  phone?: string | null
  email?: string | null
  social?: string | null
}) {
  return (
    <div className="sm-menu-wrap">
      <div className="sm-menu-header">
        <div className="sm-menu-logo">{storeName}</div>
        <div className="sm-menu-tagline">Handcrafted Bath &amp; Body</div>
        <div className="sm-menu-divider" />
        <div className="sm-menu-contact">
          {phone && <span className="sm-menu-contact-item">{phone}</span>}
          {phone && (email || social) && (
            <span className="sm-menu-contact-sep">·</span>
          )}
          {email && <span className="sm-menu-contact-item">{email}</span>}
          {email && social && <span className="sm-menu-contact-sep">·</span>}
          {social && <span className="sm-menu-contact-item">{social}</span>}
        </div>
      </div>

      <div className="sm-menu-grid">
        {groups.map((g) => (
          <Card key={g.id} group={g} wide={!!g.fullWidth} />
        ))}
      </div>

      <div className="sm-menu-footer">
        <span>All products handcrafted with love</span> &nbsp;·&nbsp; Custom
        scents available on request
      </div>
    </div>
  )
}

function Card({ group, wide }: { group: Group; wide?: boolean }) {
  const t = themeFor(group.theme)
  return (
    <div
      className={`sm-menu-card ${wide ? 'sm-menu-card-wide' : ''}`}
      style={
        {
          '--head': t.head,
          '--name': t.name,
          '--detail': t.detail,
          '--body': t.body,
          '--pill-bg': t.pillBg,
          '--pill-text': t.pillText,
        } as React.CSSProperties
      }
    >
      <div className="sm-menu-card-head">
        <span className="sm-menu-card-name">
          {group.displayLabel || group.name}
        </span>
        {group.priceLabel && (
          <span className="sm-menu-card-detail">{group.priceLabel}</span>
        )}
      </div>
      <div className="sm-menu-card-body">
        {group.scents.length === 0 ? (
          <p className="sm-menu-empty">More scents coming soon.</p>
        ) : (
          <div className="sm-menu-scent-list">
            {group.scents.map((s) => (
              <span key={s.id} className="sm-menu-scent">
                {s.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
