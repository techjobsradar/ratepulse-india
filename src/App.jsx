import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Bell, ChevronDown, Fuel, Gem, Globe2, Landmark, Menu, Newspaper, Search, ShieldCheck, TrendingUp, Wallet, X } from 'lucide-react';

const cities = ['New Delhi', 'Mumbai', 'Hyderabad', 'Bengaluru', 'Chennai', 'Kolkata', 'Vijayawada'];
const emptyFuel = {
  petrol: null,
  diesel: null,
  kerosene: 'Check official local source'
};
const metals = [
  { name: 'Gold 24K', unit: 'per 10 grams', price: 'Verify today’s rate', trend: 'Market-linked', icon: Gem },
  { name: 'Gold 22K', unit: 'per 10 grams', price: 'Verify today’s rate', trend: 'Market-linked', icon: Gem },
  { name: 'Silver', unit: 'per kilogram', price: 'Verify today’s rate', trend: 'Market-linked', icon: Activity },
  { name: 'Diamond', unit: 'price guidance', price: 'Depends on 4Cs', trend: 'Quality-dependent', icon: Gem }
];
const articles = [
  { category: 'PERSONAL FINANCE', title: 'How to build an emergency fund, one month at a time', time: '6 min read', color: 'mint', icon: Wallet },
  { category: 'MARKET BASICS', title: 'What moves gold prices in India? A beginner’s guide', time: '5 min read', color: 'gold', icon: TrendingUp },
  { category: 'ECONOMY', title: 'How fuel prices can affect household budgets', time: '4 min read', color: 'blue', icon: Fuel }
];
function SectionTitle({ eyebrow, title, link }) { return <div className="section-title"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>{link && <a href="#news" className="text-link">{link} <ArrowRight size={16}/></a>}</div>; }

function displayFuelPrice(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 'Not connected';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value) + ' / L';
}

export default function App() {
  const [city, setCity] = useState('Hyderabad');
  const [query, setQuery] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [marketRates, setMarketRates] = useState(null);
  const [ratesStatus, setRatesStatus] = useState('loading');
  const [fuelRates, setFuelRates] = useState(null);
  const [fuelStatus, setFuelStatus] = useState('loading');
  const [fuelError, setFuelError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/market-rates')
      .then(response => response.ok ? response.json() : Promise.reject(new Error('Rates API unavailable')))
      .then(data => {
        if (!cancelled) {
          setMarketRates(data);
          setRatesStatus(data.status || 'unavailable');
        }
      })
      .catch(() => { if (!cancelled) setRatesStatus('unavailable'); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setFuelStatus('loading');
    setFuelError('');
    setFuelRates(null);

    fetch(`/api/fuel-prices?city=${encodeURIComponent(city)}`)
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.message || `Fuel API returned HTTP ${response.status}`);
        }
        return data;
      })
      .then(data => {
        if (cancelled) return;
        setFuelRates(data);
        setFuelStatus(data.status || 'unavailable');
        if (data.status !== 'live') {
          setFuelError(data.message || 'Live fuel prices are not available for this city.');
        }
      })
      .catch(error => {
        if (cancelled) return;
        setFuelStatus('unavailable');
        setFuelError(error.message || 'Could not load fuel prices.');
      });

    return () => { cancelled = true; };
  }, [city]);

  const formatINR = value => typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)
    : 'Not connected';
  const filteredArticles = useMemo(() => articles.filter(a => `${a.category} ${a.title}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const fuel = {
    ...emptyFuel,
    petrol: fuelStatus === 'live' ? displayFuelPrice(fuelRates?.petrol) : (fuelStatus === 'loading' ? 'Loading…' : 'Not connected'),
    diesel: fuelStatus === 'live' ? displayFuelPrice(fuelRates?.diesel) : (fuelStatus === 'loading' ? 'Loading…' : 'Not connected')
  };
  const dateLabel = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());

  return <div className="app">
    <div className="topbar"><div className="wrap topbar-inner"><span><Globe2 size={14}/> India’s daily rates & money briefing</span><span className="top-date">{dateLabel} <i/> Information portal · verify before acting</span></div></div>
    <header className="header"><div className="wrap nav">
      <a href="#" className="brand"><span className="brand-mark"><Activity size={23}/></span><span>RatePulse <b>India</b><small>DAILY RATES. SMARTER DECISIONS.</small></span></a>
      <button className="mobile-toggle" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle navigation">{mobileMenu ? <X/> : <Menu/>}</button>
      <nav className={mobileMenu ? 'nav-links open' : 'nav-links'}><a href="#fuel" onClick={() => setMobileMenu(false)}>Fuel rates</a><a href="#metals" onClick={() => setMobileMenu(false)}>Gold & silver</a><a href="#markets" onClick={() => setMobileMenu(false)}>Markets</a><a href="#news" onClick={() => setMobileMenu(false)}>Financial news</a></nav>
      <a className="nav-cta" href="#newsletter">Get daily brief <ArrowRight size={16}/></a>
    </div></header>
    <main>
      <section className="hero"><div className="hero-grid"></div><div className="wrap hero-content">
        <div className="hero-copy"><div className="live-pill"><span className="pulse-dot"></span> YOUR EVERYDAY MONEY DASHBOARD</div><h1>Know the rates.<br/><em>Make your move.</em></h1><p>Fuel prices, precious-metal rates and financial stories that help you make more informed everyday decisions.</p><div className="hero-actions"><a href="#rates" className="btn btn-primary">Explore today’s rates <ArrowRight size={17}/></a><a href="#news" className="btn btn-ghost">Read latest insights</a></div><div className="hero-trust"><span><ShieldCheck size={16}/> Clear source labels</span><span><Activity size={16}/> Updated when verified</span></div></div>
        <div className="hero-panel"><div className="panel-top"><div><span className="panel-kicker">THE DAILY PULSE</span><h3>Your money snapshot</h3></div><span className="panel-icon"><BarChart3 size={20}/></span></div><div className="snapshot-row"><div className="snapshot-icon fuel-bg"><Fuel size={19}/></div><div className="snapshot-label"><b>Fuel prices</b><span>City-wise reference</span></div><div className="snapshot-value">7 cities <ArrowRight size={14}/></div></div><div className="snapshot-row"><div className="snapshot-icon gold-bg"><Gem size={19}/></div><div className="snapshot-label"><b>Gold & silver</b><span>Check verified rates</span></div><div className="snapshot-value">Daily <ArrowRight size={14}/></div></div><div className="snapshot-row"><div className="snapshot-icon blue-bg"><TrendingUp size={19}/></div><div className="snapshot-label"><b>Market watch</b><span>News and explainers</span></div><div className="snapshot-value">Read <ArrowRight size={14}/></div></div><div className="panel-foot"><ShieldCheck size={15}/> Prices are labelled as estimates or verified data.</div></div>
      </div><div className="wrap hero-bottom"><span>BUILT FOR EVERYDAY INDIA</span><div><span><Fuel size={16}/> Energy</span><span><Gem size={16}/> Metals</span><span><Landmark size={16}/> Economy</span><span><Newspaper size={16}/> Personal finance</span></div></div></section>

      <section className="wrap rate-section" id="rates"><SectionTitle eyebrow="THE NUMBERS THAT MATTER" title="Today’s rate centre" link="Browse all rates"/><div className="rate-grid" id="fuel">
        <div className="rate-card fuel-card"><div className="card-heading"><span className="card-icon fuel-bg"><Fuel size={20}/></span><div><h3>Fuel rates</h3><p>Choose a city for reference prices</p></div></div><label className="select-label" htmlFor="city-select">SELECT CITY</label><div className="select-wrap"><select id="city-select" value={city} onChange={e => setCity(e.target.value)}>{cities.map(c => <option key={c}>{c}</option>)}</select><ChevronDown size={17}/></div><div className="fuel-price"><span>Petrol</span><b className="small-price">{fuel.petrol}</b></div><div className="fuel-price"><span>Diesel</span><b className="small-price">{fuel.diesel}</b></div><div className="fuel-price"><span>Kerosene</span><b className="small-price">{fuel.kerosene}</b></div><div className="disclaimer">{fuelStatus === 'live' ? `Reference prices from ${fuelRates?.source || 'Indian API'}${fuelRates?.updatedAt ? ` · Updated ${new Date(fuelRates.updatedAt).toLocaleString('en-IN')}` : ''}. Prices can vary by outlet; confirm with the official oil company before acting.` : fuelStatus === 'loading' ? 'Loading fuel prices for the selected city…' : `Live city-wise fuel prices are unavailable. ${fuelError || 'Check the API configuration and provider response.'} No prices are invented; please verify with an official local source.`}</div></div>
        <div className="metals-wrap" id="metals"><div className="metals-heading"><div><span className="eyebrow">BULLION & GEMS</span><h3>Precious metals</h3></div><span className="mini-label">RATE GUIDE</span></div><div className="metal-grid">{metals.map(item => <div className="metal-card" key={item.name}><div className="metal-icon"><item.icon size={19}/></div><span className="metal-name">{item.name}</span><b className="metal-price">{item.name === 'Gold 24K' ? formatINR(marketRates?.metals?.gold24k?.per10g) : item.name === 'Gold 22K' ? formatINR(marketRates?.metals?.gold22k?.per10g) : item.name === 'Silver' ? formatINR(marketRates?.metals?.silverPerKg) : item.price}</b><span className="metal-unit">{item.unit}</span><span className="metal-trend">{item.name === 'Gold 24K' || item.name === 'Gold 22K' || item.name === 'Silver' ? (ratesStatus === 'live' ? 'Indicative spot rate' : ratesStatus === 'loading' ? 'Loading rate…' : 'API key required') : item.trend}</span></div>)}</div><p className="small-note">{ratesStatus === 'live' ? `Indicative spot-equivalent prices from GoldAPI.io. Last updated: ${marketRates?.updatedAt ? new Date(marketRates.updatedAt).toLocaleString('en-IN') : 'time unavailable'}.` : 'Gold and silver live rates are not connected yet. Add a GoldAPI.io key in Vercel to enable them.'} Jewellery taxes, making charges, purity, location and dealer pricing can affect final prices. These are not guaranteed retail jewellery quotes. Diamond prices vary by quality and certification.</p></div>
      </div></section>

      <section className="market-band" id="markets"><div className="wrap market-inner"><div className="market-intro"><span className="eyebrow light">MARKET WATCH</span><h2>Stay informed.<br/><em>Think long term.</em></h2><p>Follow the forces shaping India’s economy with explainers designed for everyday readers.</p><a href="#news" className="market-link">Explore financial insights <ArrowRight size={16}/></a></div><div className="market-feature"><div className="feature-top"><span className="feature-tag">MARKET BASICS</span><span className="feature-symbol"><TrendingUp size={20}/></span></div><h3>Understand the headlines, not just the numbers.</h3><p>Learn the basics of inflation, interest rates, market movements and household budgeting.</p><a href="#news">Explore learning centre <ArrowRight size={16}/></a><div className="chart-decoration"><svg viewBox="0 0 400 95" role="img" aria-label="Decorative rising market line"><path d="M0 78 L35 62 L65 68 L100 38 L132 52 L170 29 L205 44 L245 18 L275 31 L315 8 L350 23 L400 2" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><path d="M0 78 L35 62 L65 68 L100 38 L132 52 L170 29 L205 44 L245 18 L275 31 L315 8 L350 23 L400 2 L400 95 L0 95Z" fill="currentColor" opacity=".08"/></svg></div></div></div></section>

      <section className="wrap news-section" id="news"><SectionTitle eyebrow="THE MONEY DESK" title="Insights for your next decision" link="More articles"/><div className="news-tools"><div className="search-box"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search finance topics and articles"/></div><span><Newspaper size={16}/> Practical, plain-language reads</span></div><div className="article-grid">{filteredArticles.map((article, i) => <article className="article-card" key={article.title}><div className={`article-art ${article.color}`}><span className="article-number">0{i+1}</span><article.icon size={42}/><span className="art-lines"></span></div><div className="article-body"><span className="article-category">{article.category}</span><h3>{article.title}</h3><div className="article-meta"><span>{article.time}</span><a href="#newsletter" aria-label={`Get updates about ${article.title}`}><ArrowRight size={17}/></a></div></div></article>)}</div>{filteredArticles.length === 0 && <p className="empty-state">No matching articles. Try “gold”, “fuel” or “finance”.</p>}</section>

      <section className="newsletter-section" id="newsletter"><div className="wrap newsletter-inner"><div className="newsletter-icon"><Bell size={24}/></div><div className="newsletter-copy"><span className="eyebrow light">THE RATEPULSE BRIEF</span><h2>A little clarity in your inbox.</h2><p>Sign-up UI preview. Connect a compliant email service before collecting subscribers.</p></div><form className="newsletter-form" onSubmit={e => {e.preventDefault(); if (email.includes('@')) setSubscribed(true);}}><div className="email-input"><input type="email" value={email} onChange={e => {setEmail(e.target.value); setSubscribed(false);}} placeholder="Your email address" required/><button type="submit" aria-label="Submit email"><ArrowRight size={18}/></button></div><span className="form-note">{subscribed ? 'Demo only: no email was saved or sent.' : 'No spam. Unsubscribe whenever you like.'}</span></form></div></section>
    </main>
    <footer className="footer"><div className="wrap footer-main"><div className="footer-brand"><a href="#" className="brand"><span className="brand-mark"><Activity size={23}/></span><span>RatePulse <b>India</b><small>DAILY RATES. SMARTER DECISIONS.</small></span></a><p>Clear information for everyday money decisions.</p></div><div className="footer-links"><div><b>Explore</b><a href="#fuel">Fuel rates</a><a href="#metals">Gold & silver</a><a href="#markets">Market watch</a><a href="#news">Financial news</a></div><div><b>Information</b><a href="#disclaimer">About us</a><a href="#disclaimer">Privacy policy</a><a href="#disclaimer">Editorial policy</a><a href="#disclaimer">Contact</a></div></div></div><div className="wrap footer-bottom" id="disclaimer"><span>© {new Date().getFullYear()} RatePulse India. Starter website.</span><span>Important: Fuel prices are displayed only when returned by the configured provider. Confirm prices with official providers. Gold and silver are indicative spot-equivalent prices when available; market content is educational and not investment advice.</span></div></footer>
  </div>;
}
