import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  Clock3,
  Film,
  Heart,
  Info,
  Menu,
  Play,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  X,
} from 'lucide-react';

const apiCategories = [
  { label: 'Animation', endpoint: 'animation' },
  { label: 'Comedy', endpoint: 'comedy' },
  { label: 'Drama', endpoint: 'drama' },
  { label: 'Horror', endpoint: 'horror' },
  { label: 'Family', endpoint: 'family' },
  { label: 'Mystery', endpoint: 'mystery' },
  { label: 'Western', endpoint: 'western' },
];
const categories = ['All movies', ...apiCategories.map(({ label }) => label)];

function mapApiMovie(item, index, genre) {
  const title = item.title || item.name;
  if (!title) return null;
  const imdbScore = Number(item.imdbRating || item.rating);
  return {
    id: item.imdbId || `${genre}-${item.id || index}-${title}`,
    title,
    year: Number(String(item.year || item.releaseDate || '').slice(0, 4)) || null,
    rating: Number.isFinite(imdbScore) && imdbScore > 0 ? (imdbScore > 10 ? imdbScore / 10 : imdbScore) : null,
    genres: [genre],
    runtime: item.runtime || null,
    director: item.director || null,
    description: item.plot || item.description || null,
    imdbId: item.imdbId || null,
    poster: item.posterURL || item.poster || item.image || '',
    color: '#37434b',
  };
}

function Rating({ value }) {
  return <span className="rating" aria-label={value ? `Rating ${value.toFixed(1)}` : 'Rating not available'}>
    {value ? <><Star size={13} fill="currentColor" strokeWidth={0} /> {value.toFixed(1)}</> : 'N/A'}
  </span>;
}

function MovieArtwork({ movie, className, fallbackClassName = '' }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [movie.poster]);

  if (!movie.poster || imageFailed) {
    return <div className={`poster-fallback ${fallbackClassName}`}><Film size={34} /><span>{movie.title}</span></div>;
  }

  return <img className={className} src={movie.poster} alt={`${movie.title} poster`} loading="lazy" onError={() => setImageFailed(true)} />;
}

function MovieCard({ movie, saved, onOpen, onSave }) {
  return (
    <article className="movie-card" onClick={() => onOpen(movie)} tabIndex="0" onKeyDown={(event) => event.key === 'Enter' && onOpen(movie)}>
      <div className="poster-wrap" style={{ '--poster-color': movie.color }}>
        <MovieArtwork movie={movie} className="poster" />
        <div className="poster-shade" />
        <button className={`save-button ${saved ? 'saved' : ''}`} onClick={(event) => { event.stopPropagation(); onSave(movie.id); }} aria-label={saved ? 'Remove from watchlist' : 'Add to watchlist'}>
          <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />
        </button>
        <div className="poster-caption"><span>{movie.genres.join(', ')}</span><Rating value={movie.rating} /></div>
      </div>
      <div className="movie-meta"><h3>{movie.title}</h3><span>{movie.year || '—'}</span></div>
    </article>
  );
}

function MovieDetails({ movie, saved, onClose, onSave }) {
  useEffect(() => {
    const closeOnEscape = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="details-modal" role="dialog" aria-modal="true" aria-labelledby="details-title">
        <button className="modal-close" onClick={onClose} aria-label="Close details"><X size={20} /></button>
        <div className="details-backdrop" style={{ backgroundImage: `linear-gradient(90deg, #141414 4%, rgba(20,20,20,.88) 48%, rgba(20,20,20,.32)), url(${movie.backdrop || movie.poster})` }} />
        <div className="details-content">
          <span className="eyebrow"><Sparkles size={13} /> YOUR NEXT MOVIE NIGHT</span>
          <h2 id="details-title">{movie.title}</h2>
          <div className="details-facts"><Rating value={movie.rating} /><span>{movie.year || 'Year unavailable'}</span>{movie.runtime && <span>{movie.runtime}</span>}<span>{movie.genres.join(', ')}</span></div>
          <p>{movie.description || 'A description is not available in the movie catalog.'}</p>
          {movie.director && <div className="director-line"><span>DIRECTOR</span>{movie.director}</div>}
          <div className="details-actions">
            <button className="primary-button" onClick={() => onSave(movie.id)}>{saved ? <Check size={16} /> : <Bookmark size={16} />}{saved ? 'In your watchlist' : 'Add to watchlist'}</button>
            <button className="secondary-button" onClick={onClose}><Play size={15} fill="currentColor" /> Keep exploring</button>
            {movie.imdbId && <a className="secondary-button" href={`https://www.imdb.com/title/${movie.imdbId}/`} target="_blank" rel="noreferrer">View on IMDb</a>}
          </div>
        </div>
        <MovieArtwork movie={movie} className="details-poster" fallbackClassName="details-poster-fallback" />
      </section>
    </div>
  );
}

export default function App() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiMessage, setApiMessage] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('All movies');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('Catalog order');
  const [showWatchlist, setShowWatchlist] = useState(false);
  const [watchlist, setWatchlist] = useState(() => {
    try { return JSON.parse(localStorage.getItem('reelgood-watchlist') || '[]'); }
    catch { return []; }
  });
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);

  useEffect(() => {
    let active = true;
    const loadMovies = async () => {
      setLoading(true);
      setApiMessage('');
      const results = await Promise.allSettled(apiCategories.map(async ({ endpoint, label }) => {
        const response = await fetch(`https://api.sampleapis.com/movies/${endpoint}`);
        if (!response.ok) throw new Error(`Movie API returned ${response.status}`);
        const payload = await response.json();
        if (!Array.isArray(payload)) throw new Error(`Movie API returned invalid data for ${label}`);
        return payload.map((movie, index) => mapApiMovie(movie, index, label)).filter(Boolean);
      }));
      if (!active) return;
      const rejectedCount = results.filter((result) => result.status === 'rejected').length;
      const byId = new Map();
      for (const result of results) {
        if (result.status !== 'fulfilled') continue;
        for (const movie of result.value) {
          const existing = byId.get(movie.id);
          if (existing) {
            if (!existing.genres.includes(movie.genres[0])) existing.genres.push(movie.genres[0]);
          } else {
            byId.set(movie.id, movie);
          }
        }
      }
      const fetchedMovies = [...byId.values()];
      setMovies(fetchedMovies);
      if (fetchedMovies.length === 0) {
        setApiMessage('Could not load movies from the movie API. Check your connection and try again.');
      } else if (rejectedCount > 0) {
        setApiMessage(`Some movie categories could not load. Showing the ${fetchedMovies.length} movies received from the API.`);
      }
      setLoading(false);
    };
    loadMovies();
    return () => { active = false; };
  }, [retryCount]);

  useEffect(() => {
    localStorage.setItem('reelgood-watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  const filteredMovies = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    let result = movies.filter((movie) => {
      const matchesCategory = selectedCategory === 'All movies' || movie.genres.includes(selectedCategory);
      const matchesQuery = !normalizedQuery || `${movie.title} ${movie.genres.join(' ')} ${movie.year || ''} ${movie.director || ''}`.toLowerCase().includes(normalizedQuery);
      const matchesWatchlist = !showWatchlist || watchlist.includes(movie.id);
      return matchesCategory && matchesQuery && matchesWatchlist;
    });
    if (sortBy === 'A–Z') result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    return result;
  }, [movies, query, selectedCategory, showWatchlist, sortBy, watchlist]);

  const featuredMovie = movies[0];
  const toggleSave = (id) => setWatchlist((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const selectCategory = (category) => {
    setSelectedCategory(category);
    setShowWatchlist(false);
    setVisibleCount(12);
    setMenuOpen(false);
  };
  const setSearch = (value) => { setQuery(value); setVisibleCount(12); };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Reelgood home" onClick={() => { selectCategory('All movies'); setSearch(''); }}>
          <span className="brand-mark"><Clapperboard size={19} strokeWidth={2.3} /></span>
          <span>reelgood<span className="brand-period">.</span></span>
        </a>
        <nav className={`main-nav ${menuOpen ? 'nav-open' : ''}`} aria-label="Main navigation">
          <button className={!showWatchlist && selectedCategory === 'All movies' ? 'nav-link active' : 'nav-link'} onClick={() => selectCategory('All movies')}>Discover</button>
          <button className={showWatchlist ? 'nav-link active' : 'nav-link'} onClick={() => { setShowWatchlist(true); setMenuOpen(false); }}>My watchlist <span className="watchlist-count">{watchlist.length}</span></button>
          <a className="nav-link about-link" href="#collection">Collections</a>
        </nav>
        <div className="header-right">
          <label className="search-box">
            <Search size={17} />
            <input value={query} onChange={(event) => setSearch(event.target.value)} placeholder="Search films..." aria-label="Search films" />
            {query && <button className="clear-search" onClick={() => setSearch('')} aria-label="Clear search"><X size={14} /></button>}
            {!query && <kbd>⌘ K</kbd>}
          </label>
          <button className="avatar" aria-label="Your profile">R</button>
        </div>
        <button className="mobile-menu" onClick={() => setMenuOpen((open) => !open)} aria-label="Toggle navigation">{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
      </header>

      <main>
        <section className="hero" style={{ '--hero-image': featuredMovie?.poster ? `url(${featuredMovie.poster})` : 'none' }}>
          <div className="hero-text">
            <div className="hero-label"><span className="live-dot" /> LIVE MOVIE CATALOG <span className="label-divider">/</span> FROM THE API</div>
            <h1>Stories worth<br />staying in for<span className="hero-dot">.</span></h1>
            <p>Real movie titles and posters, loaded straight<br />from the SampleAPIs movie catalog.</p>
            <div className="hero-actions">
              <button className="primary-button" onClick={() => featuredMovie && setSelectedMovie(featuredMovie)} disabled={!featuredMovie}><Info size={16} /> Explore a movie</button>
              <button className="text-button" onClick={() => { document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth' }); }}><Play size={14} fill="currentColor" /> Browse collection</button>
            </div>
            {featuredMovie && <div className="hero-rating"><Rating value={featuredMovie.rating} /><span className="rating-divider" /> {featuredMovie.year || 'Year unavailable'} <span className="rating-divider" /> {featuredMovie.genres.join(', ')}</div>}
          </div>
          <div className="hero-visual">
            {featuredMovie && <MovieArtwork movie={featuredMovie} className="hero-poster" fallbackClassName="hero-poster-fallback" />}
            <div className="poster-stamp"><Sparkles size={13} /> API FEATURE</div>
          </div>
          <div className="hero-pagination"><span className="pagination-active" /> <span /> <span /> <span /> <span className="pagination-count">01 <i>/</i> 05</span></div>
          <div className="hero-scroll"><span /> SCROLL TO EXPLORE</div>
        </section>

        <section className="catalog" id="collection">
          <div className="catalog-heading">
            <div>
              <div className="section-kicker">{showWatchlist ? 'YOUR PERSONAL COLLECTION' : 'A LITTLE LESS SCROLLING, A LOT MORE WATCHING'}</div>
              <h2>{showWatchlist ? 'Your watchlist' : query ? 'Search results' : 'Find your kind of film'}<span className="heading-dot">.</span></h2>
            </div>
            <div className="catalog-controls">
              <button className="filter-button" onClick={() => { setSelectedCategory('All movies'); setSearch(''); setShowWatchlist(false); }}><SlidersHorizontal size={15} /> Reset filters</button>
              <label className="sort-select"><span>Sort by</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort movies"><option>Catalog order</option><option>A–Z</option></select><ChevronDown size={14} /></label>
            </div>
          </div>
          <div className="browse-row">
            <div className="category-list" role="tablist" aria-label="Filter by genre">
              {categories.map((category) => <button key={category} role="tab" aria-selected={selectedCategory === category && !showWatchlist} className={`category-chip ${selectedCategory === category && !showWatchlist ? 'selected' : ''}`} onClick={() => selectCategory(category)}>{category}</button>)}
            </div>
            <span className="results-count">{filteredMovies.length} FILMS</span>
          </div>
          {apiMessage && <div className="api-notice"><Info size={14} /> {apiMessage}<button onClick={() => setRetryCount((count) => count + 1)}>Try again</button></div>}
          {loading && <div className="loading-line"><span /> Updating the movie collection…</div>}
          {filteredMovies.length > 0 ? (
            <div className="movie-grid">
              {filteredMovies.slice(0, visibleCount).map((movie) => <MovieCard key={movie.id} movie={movie} saved={watchlist.includes(movie.id)} onOpen={setSelectedMovie} onSave={toggleSave} />)}
            </div>
          ) : (
            <div className="empty-state"><div className="empty-icon"><Film size={23} /></div><h3>{showWatchlist ? 'Your watchlist is waiting.' : 'No films found.'}</h3><p>{showWatchlist ? 'Save a movie you love and it’ll show up right here.' : 'Try a different title or clear your filters.'}</p><button className="text-button" onClick={() => { setSearch(''); setSelectedCategory('All movies'); setShowWatchlist(false); }}>Explore all movies <ChevronRight size={15} /></button></div>
          )}
          {filteredMovies.length > visibleCount && <button className="load-more" onClick={() => setVisibleCount((count) => count + 12)}>Show me more <ChevronDown size={15} /></button>}
          <div className="catalog-footer"><span><Clapperboard size={14} /> Movie titles and posters via <a href="https://sampleapis.com/api-list/movies" target="_blank" rel="noreferrer">SampleAPIs</a>.</span><span>Made for movie people <Heart size={12} fill="currentColor" /></span></div>
        </section>
      </main>

      <footer className="site-footer"><span>© 2025 REELGOOD</span><span>FIND YOUR NEXT FAVORITE.</span><span><Clock3 size={13} /> TAKE YOUR TIME. PICK A GOOD ONE.</span></footer>
      {selectedMovie && <MovieDetails movie={selectedMovie} saved={watchlist.includes(selectedMovie.id)} onSave={toggleSave} onClose={() => setSelectedMovie(null)} />}
    </div>
  );
}
