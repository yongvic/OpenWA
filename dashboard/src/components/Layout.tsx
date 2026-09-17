import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Smartphone,
  ClipboardList,
  LogOut,
  Sun,
  Moon,
  Monitor,
  X,
  ChevronLeft,
  ChevronRight,
  Languages,
  Megaphone,
  MoreHorizontal,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { type UserRole } from '../hooks/useRole';
import { languageOptions, resolveSupportedLanguage, rtlLanguages, type SupportedLanguage } from '../i18n';
import { healthApi } from '../services/api';
import { CAMPAIGN_FOCUSED_UI, CAMPAIGN_NAV_ORDER } from '../config/uiMode';
import './Layout.css';

interface LayoutProps {
  onLogout: () => void;
  userRole: UserRole | null;
}

const campaignNavItems = [
  { to: '/campaigns', icon: Megaphone, key: 'campaigns' as const, adminOnly: false },
  { to: '/sessions', icon: Smartphone, key: 'sessions' as const, adminOnly: false },
  { to: '/templates', icon: ClipboardList, key: 'templates' as const, adminOnly: false },
] as const;

const allNavItems = CAMPAIGN_FOCUSED_UI
  ? [...campaignNavItems]
  : [
      ...campaignNavItems,
      // Extend here if CAMPAIGN_FOCUSED_UI is disabled (upstream full nav lives on main fork).
    ];

const themeIcons = { light: Sun, dark: Moon, system: Monitor };

function pathToNavKey(pathname: string): (typeof campaignNavItems)[number]['key'] {
  if (pathname.startsWith('/sessions')) return 'sessions';
  if (pathname.startsWith('/templates')) return 'templates';
  return 'campaigns';
}

export function Layout({ onLogout, userRole }: LayoutProps) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const online = useOnlineStatus();
  const { theme, setTheme, palette, setPalette, paletteOptions } = useTheme();
  const ThemeIcon = themeIcons[theme];
  const themeLabel = t(`theme.${theme}`);
  const activePalette = paletteOptions.find(option => option.value === palette) ?? paletteOptions[0];
  const pageKey = pathToNavKey(location.pathname);
  const pageTitle = t(`nav.${pageKey}`);

  const navItems = allNavItems
    .filter(item => {
      if (item.adminOnly && userRole !== 'admin') return false;
      return true;
    })
    .sort((a, b) => {
      if (!CAMPAIGN_FOCUSED_UI) return 0;
      const ai = CAMPAIGN_NAV_ORDER.indexOf(a.key as (typeof CAMPAIGN_NAV_ORDER)[number]);
      const bi = CAMPAIGN_NAV_ORDER.indexOf(b.key as (typeof CAMPAIGN_NAV_ORDER)[number]);
      const ar = ai === -1 ? 99 : ai;
      const br = bi === -1 ? 99 : bi;
      return ar - br;
    });

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [version, setVersion] = useState(__APP_VERSION__);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [isAppearanceMenuOpen, setIsAppearanceMenuOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement>(null);
  const appearanceMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setIsAccountOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let active = true;
    healthApi
      .check()
      .then(info => {
        if (active && info?.version) setVersion(info.version);
      })
      .catch(() => {
        /* keep the build-time fallback */
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = isAccountOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isAccountOpen]);

  useEffect(() => {
    if (!isLanguageMenuOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!languageMenuRef.current?.contains(event.target as Node)) {
        setIsLanguageMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsLanguageMenuOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isLanguageMenuOpen]);

  useEffect(() => {
    if (!isAppearanceMenuOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!appearanceMenuRef.current?.contains(event.target as Node)) {
        setIsAppearanceMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsAppearanceMenuOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isAppearanceMenuOpen]);

  useEffect(() => {
    if (!isAccountOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsAccountOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isAccountOpen]);

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  const currentLang = resolveSupportedLanguage(i18n.resolvedLanguage || i18n.language);
  const languageLabel = languageOptions.find(option => option.value === currentLang)?.compactLabel ?? 'EN';
  const changeLanguage = (language: SupportedLanguage) => {
    setIsLanguageMenuOpen(false);
    void i18n.changeLanguage(language);
  };
  const isRtl = rtlLanguages.includes(currentLang);
  const roleLabel = userRole ? t(`role.${userRole}`) : null;
  const showPalettes = !CAMPAIGN_FOCUSED_UI;

  const accountControls = (
    <>
      {roleLabel && (
        <p className={`role-chip ${userRole === 'viewer' ? 'viewer' : ''}`} aria-live="polite">
          {roleLabel}
        </p>
      )}
      <div className="language-menu" ref={languageMenuRef}>
        <button
          className="theme-toggle-btn"
          onClick={() => setIsLanguageMenuOpen(open => !open)}
          title={t('common.language')}
          aria-label={t('common.language')}
          aria-haspopup="menu"
          aria-expanded={isLanguageMenuOpen}
        >
          <Languages size={18} />
          {(!isCollapsed || isMobile) && <span>{languageLabel}</span>}
        </button>
        {isLanguageMenuOpen && (
          <div className="language-menu-list" role="menu" aria-label={t('common.language')}>
            {languageOptions.map(option => (
              <button
                key={option.value}
                className={`language-menu-item ${option.value === currentLang ? 'active' : ''}`}
                onClick={() => changeLanguage(option.value)}
                role="menuitemradio"
                aria-checked={option.value === currentLang}
              >
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="appearance-menu" ref={appearanceMenuRef}>
        <button
          className="theme-toggle-btn"
          onClick={() => setIsAppearanceMenuOpen(open => !open)}
          title={t('theme.label', { value: themeLabel })}
          aria-label={t('theme.appearance')}
          aria-haspopup="menu"
          aria-expanded={isAppearanceMenuOpen}
        >
          <span
            className="appearance-button-cue"
            style={{ '--swatch-color': activePalette.color } as CSSProperties}
            aria-hidden="true"
          >
            <ThemeIcon size={14} />
          </span>
          {(!isCollapsed || isMobile) && <span>{themeLabel}</span>}
        </button>
        {isAppearanceMenuOpen && (
          <div className="appearance-menu-list" role="menu" aria-label={t('theme.appearance')}>
            <div className="appearance-menu-header">
              <div>
                <strong>{t('theme.appearance')}</strong>
                <span>{themeLabel}</span>
              </div>
            </div>
            <div className="appearance-section">
              <span className="appearance-section-label">{t('theme.mode')}</span>
              <div className="appearance-mode-grid">
                {(['light', 'dark', 'system'] as const).map(mode => {
                  const ModeIcon = themeIcons[mode];
                  return (
                    <button
                      key={mode}
                      className={`appearance-mode ${theme === mode ? 'active' : ''}`}
                      onClick={() => setTheme(mode)}
                      type="button"
                      role="menuitemradio"
                      aria-checked={theme === mode}
                    >
                      <ModeIcon size={16} />
                      <span>{t(`theme.${mode}`)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {showPalettes && (
              <div className="appearance-section">
                <span className="appearance-section-label">{t('theme.palette')}</span>
                <div className="palette-grid">
                  {paletteOptions.map(option => (
                    <button
                      key={option.value}
                      className={`palette-swatch ${palette === option.value ? 'active' : ''}`}
                      onClick={() => setPalette(option.value)}
                      type="button"
                      title={option.label}
                      role="menuitemradio"
                      aria-checked={palette === option.value}
                      style={{ '--swatch-color': option.color } as CSSProperties}
                    >
                      <span />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <button className="logout-btn" onClick={onLogout} title={isCollapsed && !isMobile ? t('common.logout') : undefined}>
        <LogOut size={20} />
        {(!isCollapsed || isMobile) && <span>{t('common.logout')}</span>}
      </button>
      {isMobile && (
        <p className="account-version">
          {t('common.appName')} v{version}
        </p>
      )}
    </>
  );

  const navLinks = (opts: { collapsed: boolean; onNavigate?: () => void; location: 'sidebar' | 'bottom' }) =>
    navItems.map(({ to, icon: Icon, key }) => {
      const label = t(`nav.${key}`);
      return (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `${opts.location === 'bottom' ? 'bottom-nav-item' : 'nav-item'} ${isActive ? 'active' : ''}`
          }
          end={to === '/campaigns'}
          onClick={opts.onNavigate}
          title={opts.collapsed ? label : undefined}
          aria-label={label}
        >
          <Icon size={20} aria-hidden="true" />
          {(!opts.collapsed || opts.location === 'bottom') && <span>{label}</span>}
        </NavLink>
      );
    });

  return (
    <div className={`layout${CAMPAIGN_FOCUSED_UI ? ' campaign-mode' : ''}${isMobile ? ' has-bottom-nav' : ''}`}>
      {isMobile && (
        <header className="mobile-header">
          <div className="mobile-brand">
            <img src="/openwa_logo.webp" alt="" className="sidebar-logo" />
            <p className="mobile-page-title">{pageTitle}</p>
          </div>
          <button
            className="mobile-menu-btn"
            onClick={() => setIsAccountOpen(open => !open)}
            aria-label={isAccountOpen ? t('common.close') : t('common.accountMenu')}
            aria-expanded={isAccountOpen}
            aria-controls="account-drawer"
          >
            {isAccountOpen ? <X size={24} /> : <MoreHorizontal size={24} />}
          </button>
        </header>
      )}

      {isMobile && isAccountOpen && <div className="sidebar-overlay" onClick={() => setIsAccountOpen(false)} />}

      <aside
        id={isMobile ? 'account-drawer' : undefined}
        className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobile ? 'mobile' : ''} ${isAccountOpen ? 'open' : ''}`}
      >
        <div className="sidebar-header">
          <img src="/openwa_logo.webp" alt="OpenWA" className="sidebar-logo" />
          {!isCollapsed && (
            <div className="sidebar-brand">
              <span className="brand-name">{t('common.appName')}</span>
              <span className="brand-subtitle">{t('common.appSubtitle')}</span>
            </div>
          )}
        </div>

        {!isMobile && (
          <button
            className="collapse-toggle"
            onClick={toggleCollapse}
            title={isCollapsed ? t('common.expand') : t('common.collapse')}
            aria-label={isCollapsed ? t('common.expand') : t('common.collapse')}
          >
            {isCollapsed ? (
              isRtl ? (
                <ChevronLeft size={16} />
              ) : (
                <ChevronRight size={16} />
              )
            ) : isRtl ? (
              <ChevronRight size={16} />
            ) : (
              <ChevronLeft size={16} />
            )}
          </button>
        )}

        {!isMobile && (
          <nav className="sidebar-nav" aria-label={t('common.appName')}>
            {navLinks({ collapsed: isCollapsed, location: 'sidebar' })}
          </nav>
        )}

        {isMobile && (
          <div className="account-drawer-header">
            <strong>{t('common.accountMenu')}</strong>
            <button type="button" className="btn-icon" onClick={() => setIsAccountOpen(false)} aria-label={t('common.close')}>
              <X size={18} />
            </button>
          </div>
        )}

        <div className="sidebar-footer">{accountControls}</div>
      </aside>

      <main className={`main-content ${isCollapsed ? 'expanded' : ''} ${isMobile ? 'mobile' : ''}`}>
        {!online && (
          <div className="offline-banner" role="status">
            {t('common.offlineBanner')}
          </div>
        )}
        <Outlet />
      </main>

      {isMobile && (
        <nav className="bottom-nav" aria-label={t('common.appName')}>
          {navLinks({ collapsed: false, location: 'bottom', onNavigate: () => setIsAccountOpen(false) })}
        </nav>
      )}
    </div>
  );
}
