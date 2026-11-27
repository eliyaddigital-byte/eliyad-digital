/**
 * UI behaviours: scroll reveal, sticky header state, mobile menu, mobile sticky CTA.
 */
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Reveal on scroll */
const revealEls = document.querySelectorAll<HTMLElement>('[data-reveal]');
if (reduce || !('IntersectionObserver' in window)) {
  revealEls.forEach((el) => el.classList.add('is-in'));
} else {
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }),
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  );
  revealEls.forEach((el) => io.observe(el));
}

/* Header shadow on scroll + mobile CTA visibility */
const header = document.querySelector<HTMLElement>('[data-header]');
const mobileCta = document.querySelector<HTMLElement>('[data-mobile-cta]');
const hero = document.querySelector<HTMLElement>('[data-hero]');
const leadSection = document.getElementById('contact');
let leadVisible = false;
if (leadSection && 'IntersectionObserver' in window) {
  new IntersectionObserver((en) => { leadVisible = en[0].isIntersecting; update(); }, { threshold: 0.05 }).observe(leadSection);
}
function update() {
  const y = scrollY;
  header?.classList.toggle('is-scrolled', y > 8);
  if (mobileCta) {
    const pastHero = hero ? y > hero.offsetHeight * 0.6 : y > 500;
    const show = pastHero && !leadVisible && !document.body.classList.contains('menu-open');
    mobileCta.classList.toggle('is-visible', show);
    mobileCta.setAttribute('aria-hidden', show ? 'false' : 'true');
    mobileCta.querySelectorAll('a').forEach((a) => (show ? a.removeAttribute('tabindex') : a.setAttribute('tabindex', '-1')));
  }
}
addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
update();

/* Mobile menu */
const toggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
const menu = document.getElementById('mobile-menu');
function setMenu(open: boolean) {
  if (!toggle || !menu) return;
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'סגירת תפריט' : 'פתיחת תפריט');
  menu.hidden = !open;
  document.body.classList.toggle('menu-open', open);
  if (open) menu.querySelector<HTMLElement>('a')?.focus();
  update();
}
toggle?.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
menu?.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('a')) setMenu(false); });
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') { setMenu(false); toggle.focus(); }
});
matchMedia('(min-width: 1024px)').addEventListener('change', (m) => { if (m.matches) setMenu(false); });

/* Active nav link */
const navLinks = [...document.querySelectorAll<HTMLAnchorElement>('[data-nav] a[href*="#"]')];
const sections = navLinks
  .map((a) => document.getElementById(a.hash.slice(1)))
  .filter((s): s is HTMLElement => Boolean(s));
if (sections.length && 'IntersectionObserver' in window) {
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      navLinks.forEach((a) => {
        const on = a.hash === `#${e.target.id}`;
        if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => spy.observe(s));
}
