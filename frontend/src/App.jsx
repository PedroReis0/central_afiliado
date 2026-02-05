import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const PERIODS = [
  { id: '7d', label: 'Últimos 7 dias' },
  { id: 'month', label: 'Este mês' },
  { id: 'last_month', label: 'Último mês' },
  { id: 'custom', label: 'Personalizado' }
];

const METRICS = [
  { key: 'recebidas', label: 'Ofertas recebidas' },
  { key: 'enviadas', label: 'Ofertas enviadas' },
  { key: 'aproveitamento', label: 'Aproveitamento' },
  { key: 'pendentes_marketplace', label: 'Pend. marketplace' },
  { key: 'pendentes_principal', label: 'Pend. produto principal' },
  { key: 'cupons_pendentes', label: 'Cupons pendentes' },
  { key: 'tokens_total', label: 'Tokens IA' }
];

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function getRange(period, customFrom, customTo) {
  const today = new Date();
  const end = new Date(today);
  const start = new Date(today);

  if (period === '7d') {
    start.setDate(end.getDate() - 6);
    return { from: toIsoDate(start), to: toIsoDate(end), label: 'Últimos 7 dias' };
  }
  if (period === 'month') {
    const first = new Date(end.getFullYear(), end.getMonth(), 1);
    return { from: toIsoDate(first), to: toIsoDate(end), label: 'Este mês' };
  }
  if (period === 'last_month') {
    const first = new Date(end.getFullYear(), end.getMonth() - 1, 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 0);
    return { from: toIsoDate(first), to: toIsoDate(last), label: 'Último mês' };
  }
  if (period === 'custom' && customFrom && customTo) {
    return { from: customFrom, to: customTo, label: 'Personalizado' };
  }
  return { from: toIsoDate(start), to: toIsoDate(end), label: 'Últimos 7 dias' };
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Erro ao carregar dados');
  return res.json();
}

function formatDay(day) {
  if (!day) return '';
  return String(day).slice(5, 10);
}

function LineChart({ data, color, height = 140 }) {
  const width = 520;
  const padding = 16;
  const max = Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value), 0);
  const scaleX = (i) => padding + (i * (width - padding * 2)) / (data.length - 1 || 1);
  const scaleY = (v) => height - padding - ((v - min) * (height - padding * 2)) / (max - min || 1);

  const path = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(d.value)}`)
    .join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={path} fill="none" stroke={color} strokeWidth="3" />
      {data.map((d, i) => (
        <circle key={d.label} cx={scaleX(i)} cy={scaleY(d.value)} r="4" fill={color} />
      ))}
    </svg>
  );
}

function MetricCard({ label, value, accent, meta }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={{ color: accent }}>{value}</div>
      <div className="metric-meta">{meta}</div>
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState('light');
  const [session, setSession] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [period, setPeriod] = useState('7d');
  const [page, setPage] = useState('dashboard');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState({
    recebidas: 0,
    enviadas: 0,
    aproveitamento: '0%',
    pendentes_marketplace: 0,
    pendentes_principal: 0,
    cupons_pendentes: 0,
    tokens_total: 0
  });
  const [seriesOfertas, setSeriesOfertas] = useState([]);
  const [seriesTokens, setSeriesTokens] = useState([]);

  const range = useMemo(() => getRange(period, customFrom, customTo), [period, customFrom, customTo]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      try {
        const qs = `from=${range.from}&to=${range.to}`;
        const summary = await fetchJson(`${API_BASE}/dashboard/summary?${qs}`);
        const ofertas = await fetchJson(`${API_BASE}/dashboard/ofertas?${qs}`);
        const tokens = await fetchJson(`${API_BASE}/dashboard/tokens?${qs}`);

        setMetrics({
          recebidas: summary.recebidas || 0,
          enviadas: summary.enviadas || 0,
          aproveitamento: `${summary.aproveitamento || 0}%`,
          pendentes_marketplace: summary.pendentes_marketplace || 0,
          pendentes_principal: summary.pendentes_principal || 0,
          cupons_pendentes: summary.cupons_pendentes || 0,
          tokens_total: summary.tokens_total || 0
        });

        setSeriesOfertas(Array.isArray(ofertas.series) ? ofertas.series : []);
        setSeriesTokens(Array.isArray(tokens.series) ? tokens.series : []);
      } catch (err) {
        if (!controller.signal.aborted) {
          setMetrics((prev) => ({ ...prev }));
          setSeriesOfertas([]);
          setSeriesTokens([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [range.from, range.to]);

  useEffect(() => {
    if (!supabase) return;
    let ignore = false;
    async function loadSession() {
      const { data } = await supabase.auth.getSession();
      if (!ignore) setSession(data.session || null);
    }
    loadSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => {
      ignore = true;
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  const trendRecebidas = seriesOfertas.map((d) => ({ label: formatDay(d.day), value: d.recebidas }));
  const trendEnviadas = seriesOfertas.map((d) => ({ label: formatDay(d.day), value: d.enviadas }));
  const trendTokens = seriesTokens.map((d) => ({ label: formatDay(d.day), value: d.tokens }));

  const renderDashboard = () => (
    <>
      <header className="topbar">
        <div className="welcome">
          <div className="crumb">Início</div>
          <h1>Olá, Central Afiliado</h1>
        </div>
        <div className="topbar-actions">
          <button className="ghost" onClick={() => setPeriod((p) => p)}>Atualizar</button>
          <button
            className="mode-toggle"
            onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}
          >
            {mode === 'light' ? 'Modo escuro' : 'Modo claro'}
          </button>
        </div>
      </header>

      <section className="filters">
        <div className="filter-group">
          {PERIODS.map((item) => (
            <button
              key={item.id}
              className={`pill ${period === item.id ? 'active' : ''}`}
              onClick={() => setPeriod(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="custom-range">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <span>até</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </div>
        )}
      </section>

      <section className="metrics-grid">
        {METRICS.map((metric, idx) => (
          <MetricCard
            key={metric.key}
            label={metric.label}
            value={metrics[metric.key]}
            accent={idx % 2 === 0 ? 'var(--brand-strong)' : 'var(--brand-soft)'}
            meta={range.label}
          />
        ))}
      </section>

      <section className="charts">
        <div className="chart-card">
          <div className="chart-header">
            <h3>Ofertas recebidas</h3>
            <span className="chart-note">{loading ? 'Carregando...' : 'Linha por dia'}</span>
          </div>
          <LineChart data={trendRecebidas.length ? trendRecebidas : [{ label: '0', value: 0 }]} color="var(--brand-strong)" />
        </div>
        <div className="chart-card">
          <div className="chart-header">
            <h3>Ofertas enviadas</h3>
            <span className="chart-note">{loading ? 'Carregando...' : 'Linha por dia'}</span>
          </div>
          <LineChart data={trendEnviadas.length ? trendEnviadas : [{ label: '0', value: 0 }]} color="var(--brand-soft)" />
        </div>
        <div className="chart-card wide">
          <div className="chart-header">
            <h3>Consumo de tokens IA</h3>
            <span className="chart-note">{loading ? 'Carregando...' : 'Linha por dia'}</span>
          </div>
          <LineChart data={trendTokens.length ? trendTokens : [{ label: '0', value: 0 }]} color="var(--accent)" height={160} />
        </div>
      </section>
    </>
  );

  async function handleLogin(e) {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      if (!supabase) {
        setLoginError('Supabase não configurado.');
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword
      });
      if (error) setLoginError('E-mail ou senha inválidos.');
    } catch {
      setLoginError('Falha ao autenticar.');
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  const renderLogin = () => (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-icon">CA</div>
          <div>
            <h1>Central Afiliado</h1>
            <p>Acesso administrativo</p>
          </div>
        </div>
        <form onSubmit={handleLogin} className="login-form">
          <label>
            E-mail
            <input
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="seuemail@dominio.com"
              required
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>
          {loginError && <div className="login-error">{loginError}</div>}
          <button className="primary dark full" type="submit" disabled={loginLoading}>
            {loginLoading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
      <div className="login-side">
        <div className="login-side-card">
          <h2>Gestão inteligente de ofertas</h2>
          <p>
            Acompanhe o fluxo de mensagens, aproveitamento e produtos com uma visão completa do seu ecossistema de afiliados.
          </p>
          <ul>
            <li>Monitor em tempo real</li>
            <li>Controle de cupons e templates</li>
            <li>Catálogo e produtos marketplace</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const [monitorFlow, setMonitorFlow] = useState([]);
  const [monitorErrors, setMonitorErrors] = useState([]);
  const [produtosFila, setProdutosFila] = useState([]);
  const [produtosPrincipais, setProdutosPrincipais] = useState([]);
  const [produtosMarketplace, setProdutosMarketplace] = useState([]);
  const [produtosSearch, setProdutosSearch] = useState('');
  const [produtosFilter, setProdutosFilter] = useState('todos');
  const [produtosPrincipalView, setProdutosPrincipalView] = useState('catalogo');
  const [produtosMarketplaceView, setProdutosMarketplaceView] = useState('catalogo');
  const [produtosMenuOpen, setProdutosMenuOpen] = useState(false);
  const [categorias, setCategorias] = useState([]);
  const [subcategorias, setSubcategorias] = useState([]);
  const [marketplaces, setMarketplaces] = useState([]);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroSubcategoria, setFiltroSubcategoria] = useState('');
  const [filtroMarketplace, setFiltroMarketplace] = useState('');
  const [modalNovoProduto, setModalNovoProduto] = useState(false);
  const [novoProduto, setNovoProduto] = useState({ nome_oficial: '', nome_msg: '' });
  const [confirmacaoFila, setConfirmacaoFila] = useState(null);
  const [confirmForm, setConfirmForm] = useState({
    produto_id: '',
    link_afiliado: ''
  });
  const [editarProduto, setEditarProduto] = useState(null);
  const [editarForm, setEditarForm] = useState({
    foto_url: '',
    ativo: true,
    nome_msg: '',
    nome_oficial: '',
    categoria: '',
    subcategoria: ''
  });
  const [editarMarketplace, setEditarMarketplace] = useState(null);
  const [editarMarketplaceForm, setEditarMarketplaceForm] = useState({
    link_afiliado: '',
    ativo: true
  });

  useEffect(() => {
    if (page !== 'monitor') return;
    let ignore = false;
    async function loadMonitor() {
      try {
        const flow = await fetchJson(`${API_BASE}/monitor/flow?limit=50`);
        const errors = await fetchJson(`${API_BASE}/monitor/errors?limit=20`);
        if (!ignore) {
          setMonitorFlow(flow.items || []);
          setMonitorErrors(errors.items || []);
        }
      } catch {
        if (!ignore) {
          setMonitorFlow([]);
          setMonitorErrors([]);
        }
      }
    }
    loadMonitor();
    return () => {
      ignore = true;
    };
  }, [page]);

  useEffect(() => {
    if (page !== 'produtos-catalogo' && page !== 'produtos-marketplace') return;
    let ignore = false;
    async function loadProdutos() {
      try {
        const qs = new URLSearchParams();
        if (filtroCategoria) qs.set('categoria_id', filtroCategoria);
        if (filtroSubcategoria) qs.set('subcategoria_id', filtroSubcategoria);
        if (filtroMarketplace) qs.set('marketplace', filtroMarketplace);

        const fila = await fetchJson(`${API_BASE}/fila/produto?status=pendente&limit=50`);
        const principais = await fetchJson(`${API_BASE}/produtos?${qs.toString()}`);
        const marketplace = await fetchJson(`${API_BASE}/produtos/marketplace?${qs.toString()}`);
        const categoriasRes = await fetchJson(`${API_BASE}/categorias`);
        const subcategoriasRes = await fetchJson(`${API_BASE}/subcategorias${filtroCategoria ? `?categoria_id=${filtroCategoria}` : ''}`);
        const marketplacesRes = await fetchJson(`${API_BASE}/marketplaces`);
        if (!ignore) {
          setProdutosFila(fila.items || []);
          setProdutosPrincipais(principais.items || []);
          setProdutosMarketplace(marketplace.items || []);
          setCategorias(categoriasRes.items || []);
          setSubcategorias(subcategoriasRes.items || []);
          setMarketplaces(marketplacesRes.items || []);
        }
      } catch {
        if (!ignore) {
          setProdutosFila([]);
          setProdutosPrincipais([]);
          setProdutosMarketplace([]);
          setCategorias([]);
          setSubcategorias([]);
          setMarketplaces([]);
        }
      }
    }
    loadProdutos();
    return () => {
      ignore = true;
    };
  }, [page, filtroCategoria, filtroSubcategoria, filtroMarketplace]);

  async function refreshProdutos() {
    const qs = new URLSearchParams();
    if (filtroCategoria) qs.set('categoria_id', filtroCategoria);
    if (filtroSubcategoria) qs.set('subcategoria_id', filtroSubcategoria);
    if (filtroMarketplace) qs.set('marketplace', filtroMarketplace);

    const fila = await fetchJson(`${API_BASE}/fila/produto?status=pendente&limit=50`);
    const principais = await fetchJson(`${API_BASE}/produtos?${qs.toString()}`);
    const marketplace = await fetchJson(`${API_BASE}/produtos/marketplace?${qs.toString()}`);
    setProdutosFila(fila.items || []);
    setProdutosPrincipais(principais.items || []);
    setProdutosMarketplace(marketplace.items || []);
  }

  async function handleCriarProduto() {
    if (!novoProduto.nome_oficial) return;
    await fetch(`${API_BASE}/produtos/criar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(novoProduto)
    });
    setModalNovoProduto(false);
    setNovoProduto({ nome_oficial: '', nome_msg: '' });
    await refreshProdutos();
  }

  async function handleConfirmarFila() {
    if (!confirmacaoFila?.id || !confirmForm.produto_id || !confirmForm.link_afiliado) return;
    await fetch(`${API_BASE}/fila/produto/confirmar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fila_id: confirmacaoFila.id,
        produto_id: confirmForm.produto_id,
        marketplace: confirmacaoFila.marketplace,
        marketplace_product_id: confirmacaoFila.marketplace_product_id,
        link_limpo: confirmacaoFila.link_limpo || '',
        link_afiliado: confirmForm.link_afiliado
      })
    });
    setConfirmacaoFila(null);
    setConfirmForm({ produto_id: '', link_afiliado: '' });
    await refreshProdutos();
  }

  async function handleSalvarProduto() {
    if (!editarProduto) return;
    await fetch(`${API_BASE}/produtos/${editarProduto.produto_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome_msg: editarForm.nome_msg,
        nome_oficial: editarForm.nome_oficial,
        ativo: editarForm.ativo,
        foto_url: editarForm.foto_url
      })
    });
    setEditarProduto(null);
    await refreshProdutos();
  }

  async function handleSalvarMarketplace() {
    if (!editarMarketplace) return;
    await fetch(`${API_BASE}/produtos/marketplace/${editarMarketplace.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        link_afiliado: editarMarketplaceForm.link_afiliado,
        ativo: editarMarketplaceForm.ativo
      })
    });
    setEditarMarketplace(null);
    await refreshProdutos();
  }

  const renderStubPage = (title, subtitle) => (
    <>
      <div className="page-header">
        <h2 className="page-title">{title}</h2>
        <span className="page-subtitle">{subtitle}</span>
      </div>
      <div className="panel">
        Em construção. Esta tela receberá os dados reais na próxima etapa.
      </div>
      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Coluna</th>
              <th>Exemplo</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Item 1</td>
              <td>Exemplo</td>
              <td>Pendente</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );

  const renderPage = () => {
    if (page === 'dashboard') return renderDashboard();
    if (page === 'monitor') {
      return (
        <div className="products-page">
          <div className="page-header">
            <h2 className="page-title">Monitor</h2>
            <span className="page-subtitle">Fluxo em tempo real</span>
          </div>
          <div className="panel">
            <h3>Últimas mensagens</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Recebido</th>
                  <th>Instância</th>
                  <th>Grupo</th>
                  <th>Status</th>
                  <th>Envio</th>
                  <th>Latência (s)</th>
                  <th>Último evento</th>
                </tr>
              </thead>
              <tbody>
                {monitorFlow.map((item) => (
                  <tr key={item.mensagem_id}>
                    <td>{item.received_at?.slice(0, 19).replace('T', ' ')}</td>
                    <td>{item.instance_id}</td>
                    <td>{item.group_id}</td>
                    <td>{item.oferta_status || item.mensagem_status}</td>
                    <td>{item.envio_status || '-'}</td>
                    <td>{item.latency_s ?? '-'}</td>
                    <td>{item.ultimo_evento || '-'}</td>
                  </tr>
                ))}
                {monitorFlow.length === 0 && (
                  <tr>
                    <td colSpan="7">Sem dados recentes</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="panel">
            <h3>Erros recentes</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Evento</th>
                  <th>Mensagem</th>
                </tr>
              </thead>
              <tbody>
                {monitorErrors.map((item) => (
                  <tr key={item.id}>
                    <td>{item.criado_em?.slice(0, 19).replace('T', ' ')}</td>
                    <td>{item.evento}</td>
                    <td>{item.mensagem}</td>
                  </tr>
                ))}
                {monitorErrors.length === 0 && (
                  <tr>
                    <td colSpan="3">Sem erros recentes</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    if (page === 'produtos-catalogo') {
      const produtosFiltrados = produtosPrincipais.filter((item) => {
        const search = produtosSearch.toLowerCase();
        const matchSearch =
          !search ||
          item.nome_oficial?.toLowerCase().includes(search) ||
          item.nome?.toLowerCase().includes(search) ||
          item.produto_id?.toLowerCase().includes(search);
        return matchSearch;
      });
      const filaPrincipal = produtosPrincipais.filter((p) => !p.ativo);
      const cadastrados = produtosFiltrados.filter((p) => p.ativo);
      const aguardando = produtosFiltrados.filter((p) => !p.ativo);
      return (
        <div className="products-page">
          <div className="page-header">
            <div className="title-block">
              <div className="title-icon">▦</div>
              <div>
                <h2 className="page-title">Gestor de Produtos</h2>
                <span className="page-subtitle">Painel administrativo</span>
              </div>
            </div>
            <div className="header-actions">
              <div className="search-inline">
                <span className="search-icon">🔍</span>
                <input
                  className="search-input"
                  placeholder="Buscar produtos..."
                  value={produtosSearch}
                  onChange={(e) => setProdutosSearch(e.target.value)}
                />
              </div>
              <button className="primary dark" onClick={() => setModalNovoProduto(true)}>+ Novo Produto</button>
            </div>
          </div>

          <div className="tabs-bar">
            <button
              className={`tab-pill ${produtosPrincipalView === 'catalogo' ? 'active' : ''}`}
              onClick={() => setProdutosPrincipalView('catalogo')}
            >
              Produtos Ativos <span className="tab-count">{cadastrados.length}</span>
            </button>
            <button
              className={`tab-pill ${produtosPrincipalView === 'fila' ? 'active' : ''}`}
              onClick={() => setProdutosPrincipalView('fila')}
            >
              Aguardando Cadastro <span className="tab-count warn">{aguardando.length}</span>
            </button>
          </div>

          <div className="filters-row">
            <label>
              Categoria
              <select value={filtroCategoria} onChange={(e) => {
                setFiltroCategoria(e.target.value);
                setFiltroSubcategoria('');
              }}>
                <option value="">Todas</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </label>
            <label>
              Subcategoria
              <select value={filtroSubcategoria} onChange={(e) => setFiltroSubcategoria(e.target.value)}>
                <option value="">Todas</option>
                {subcategorias.map((s) => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
            </label>
            <label>
              Marketplace
              <select value={filtroMarketplace} onChange={(e) => setFiltroMarketplace(e.target.value)}>
                <option value="">Todos</option>
                {marketplaces.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="cards-grid">
            {(produtosPrincipalView === 'catalogo' ? cadastrados : aguardando).map((item) => (
              <div className="product-card" key={item.produto_id}>
                  <div className="product-image" style={{ backgroundImage: `url(${item.foto_url || 'https://via.placeholder.com/600x400.png'})` }}>
                    <span className={`badge ${item.ativo ? 'badge-active' : 'badge-pending'}`}>
                      {item.ativo ? 'Ativo' : 'Pendente'}
                    </span>
                  </div>
                  <div className="product-body">
                    <span className="product-tag">PRODUTO PRINCIPAL</span>
                    <h4>{item.nome_oficial || item.nome}</h4>
                    <p>{item.nome_msg || 'Sem nome alternativo'}</p>
                  </div>
                  <div className="product-actions">
                    <button className="ghost small">Ofertas</button>
                    <button
                      className="ghost small"
                      onClick={() => {
                        setEditarProduto(item);
                        setEditarForm({
                          foto_url: item.foto_url || '',
                          ativo: item.ativo,
                          nome_msg: item.nome_msg || '',
                          nome_oficial: item.nome_oficial || item.nome || '',
                          categoria: '',
                          subcategoria: ''
                        });
                      }}
                    >
                      Editar
                    </button>
                  </div>
                </div>
            ))}
            {(produtosPrincipalView === 'catalogo' ? cadastrados : aguardando).length === 0 && (
              <div className="empty-state">Nenhum produto encontrado nesta aba.</div>
            )}
          </div>

          {modalNovoProduto && (
            <div className="modal-backdrop">
              <div className="modal">
                <h3>Novo produto principal</h3>
                <label>
                  Nome oficial
                  <input
                    value={novoProduto.nome_oficial}
                    onChange={(e) => setNovoProduto((prev) => ({ ...prev, nome_oficial: e.target.value }))}
                  />
                </label>
                <label>
                  Nome mensagem (opcional)
                  <input
                    value={novoProduto.nome_msg}
                    onChange={(e) => setNovoProduto((prev) => ({ ...prev, nome_msg: e.target.value }))}
                  />
                </label>
                <div className="modal-actions">
                  <button className="ghost" onClick={() => setModalNovoProduto(false)}>Cancelar</button>
                  <button className="primary" onClick={handleCriarProduto}>Salvar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }
    if (page === 'produtos-marketplace') {
      const produtosFiltrados = produtosMarketplace.filter((item) => {
        const search = produtosSearch.toLowerCase();
        const matchSearch =
          !search ||
          item.nome_oficial?.toLowerCase().includes(search) ||
          item.marketplace_product_id?.toLowerCase().includes(search) ||
          item.marketplace?.toLowerCase().includes(search);
        const matchFilter = produtosFilter === 'todos' || item.marketplace === produtosFilter;
        return matchSearch && matchFilter;
      });
      const marketplaceOptions = Array.from(new Set(produtosMarketplace.map((p) => p.marketplace).filter(Boolean)));
      return (
        <>
          <div className="page-header">
            <h2 className="page-title">Produtos Marketplace</h2>
            <span className="page-subtitle">Cadastros por marketplace</span>
          </div>
          <div className="products-toolbar panel">
            <div className="tabs">
              <span className="tab active">Produtos</span>
            </div>
            <div className="toolbar-actions">
              <button className="ghost" onClick={() => setProdutosMarketplaceView(produtosMarketplaceView === 'catalogo' ? 'fila' : 'catalogo')}>
                {produtosMarketplaceView === 'catalogo' ? `Fila de cadastro (${produtosFila.length})` : 'Voltar ao catálogo'}
              </button>
              <button className="primary" onClick={() => setModalNovoProduto(true)}>+ Novo Produto</button>
            </div>
          </div>

          <div className="panel">
            {produtosMarketplaceView === 'catalogo' && (
              <>
                <div className="search-row">
                  <input
                    className="search-input"
                    placeholder="Buscar por título, ID ou marketplace..."
                    value={produtosSearch}
                    onChange={(e) => setProdutosSearch(e.target.value)}
                  />
                  <div className="filters-inline">
                    <span>Filtros:</span>
                    <select value={produtosFilter} onChange={(e) => setProdutosFilter(e.target.value)}>
                      <option value="todos">Todas as lojas</option>
                      {marketplaceOptions.map((mk) => (
                        <option key={mk} value={mk}>{mk}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <table className="table">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>ID</th>
                      <th>Status</th>
                      <th>Afiliado</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {produtosFiltrados.map((item) => (
                      <tr key={item.id}>
                        <td>{item.nome_oficial}</td>
                        <td>{item.marketplace_product_id}</td>
                        <td>{item.ativo ? 'ativo' : 'inativo'}</td>
                        <td>{item.link_afiliado ? 'sim' : 'não'}</td>
                        <td>
                          <button
                            className="ghost small"
                            onClick={() => {
                              setEditarMarketplace(item);
                              setEditarMarketplaceForm({
                                link_afiliado: item.link_afiliado || '',
                                ativo: item.ativo
                              });
                            }}
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                    {produtosFiltrados.length === 0 && (
                      <tr>
                        <td colSpan="5">Nenhum produto encontrado nesta aba.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </>
            )}

            {produtosMarketplaceView === 'fila' && (
              <table className="table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>ID</th>
                    <th>Status</th>
                    <th>Marketplace</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {produtosFila.map((item) => (
                    <tr key={item.id}>
                      <td>{item.nome_sugerido || '-'}</td>
                      <td>{item.marketplace_product_id || '-'}</td>
                      <td>{item.status}</td>
                      <td>{item.marketplace}</td>
                      <td>
                        <button className="ghost small" onClick={() => {
                          setConfirmacaoFila(item);
                          setConfirmForm({ produto_id: item.produto_id || '', link_afiliado: '' });
                        }}>Confirmar</button>
                      </td>
                    </tr>
                  ))}
                  {produtosFila.length === 0 && (
                    <tr>
                      <td colSpan="5">Nenhuma pendência encontrada.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {modalNovoProduto && (
            <div className="modal-backdrop">
              <div className="modal">
                <h3>Novo produto principal</h3>
                <label>
                  Nome oficial
                  <input
                    value={novoProduto.nome_oficial}
                    onChange={(e) => setNovoProduto((prev) => ({ ...prev, nome_oficial: e.target.value }))}
                  />
                </label>
                <label>
                  Nome mensagem (opcional)
                  <input
                    value={novoProduto.nome_msg}
                    onChange={(e) => setNovoProduto((prev) => ({ ...prev, nome_msg: e.target.value }))}
                  />
                </label>
                <div className="modal-actions">
                  <button className="ghost" onClick={() => setModalNovoProduto(false)}>Cancelar</button>
                  <button className="primary" onClick={handleCriarProduto}>Salvar</button>
                </div>
              </div>
            </div>
          )}

          {editarProduto && (
            <div className="modal-backdrop">
              <div className="modal modal-wide">
                <div className="modal-header">
                  <h3>Editar Produto</h3>
                  <button className="ghost" onClick={() => setEditarProduto(null)}>✕</button>
                </div>
                <div className="edit-layout">
                  <div className="edit-photo" style={{ backgroundImage: `url(${editarForm.foto_url || 'https://via.placeholder.com/300x300.png'})` }} />
                  <div className="edit-fields">
                    <label>
                      URL da foto
                      <input
                        value={editarForm.foto_url}
                        onChange={(e) => setEditarForm((prev) => ({ ...prev, foto_url: e.target.value }))}
                      />
                    </label>
                    <label>
                      Status do cadastro
                      <select
                        value={editarForm.ativo ? 'ativo' : 'pendente'}
                        onChange={(e) => setEditarForm((prev) => ({ ...prev, ativo: e.target.value === 'ativo' }))}
                      >
                        <option value="ativo">Cadastrado (Ativo)</option>
                        <option value="pendente">Pendente</option>
                      </select>
                    </label>
                    <div className="edit-row">
                      <label>
                        Nome Curto (Interno)
                        <input
                          value={editarForm.nome_msg}
                          onChange={(e) => setEditarForm((prev) => ({ ...prev, nome_msg: e.target.value }))}
                        />
                      </label>
                      <label>
                        Categoria
                        <select
                          value={editarForm.categoria}
                          onChange={(e) => setEditarForm((prev) => ({ ...prev, categoria: e.target.value }))}
                        >
                          <option value="">Selecione</option>
                          <option value="eletronicos">Eletrônicos</option>
                          <option value="moda">Moda</option>
                        </select>
                      </label>
                    </div>
                    <label>
                      Nome Oficial (Título Completo)
                      <input
                        value={editarForm.nome_oficial}
                        onChange={(e) => setEditarForm((prev) => ({ ...prev, nome_oficial: e.target.value }))}
                      />
                    </label>
                    <label>
                      Mensagem Promocional (Opcional)
                      <textarea rows="3" placeholder="Texto opcional para campanhas futuras" />
                    </label>
                  </div>
                </div>
                <div className="modal-actions">
                  <button className="ghost" onClick={() => setEditarProduto(null)}>Cancelar</button>
                  <button className="primary" onClick={handleSalvarProduto}>Salvar Produto</button>
                </div>
              </div>
            </div>
          )}

          {editarMarketplace && (
            <div className="modal-backdrop">
              <div className="modal modal-wide">
                <div className="modal-header">
                  <h3>Editar Produto Marketplace</h3>
                  <button className="ghost" onClick={() => setEditarMarketplace(null)}>✕</button>
                </div>
                <div className="edit-fields">
                  <label>
                    Status do cadastro
                    <select
                      value={editarMarketplaceForm.ativo ? 'ativo' : 'inativo'}
                      onChange={(e) => setEditarMarketplaceForm((prev) => ({ ...prev, ativo: e.target.value === 'ativo' }))}
                    >
                      <option value="ativo">Cadastrado (Ativo)</option>
                      <option value="inativo">Inativo</option>
                    </select>
                  </label>
                  <label>
                    Link de Afiliado
                    <input
                      value={editarMarketplaceForm.link_afiliado}
                      onChange={(e) => setEditarMarketplaceForm((prev) => ({ ...prev, link_afiliado: e.target.value }))}
                    />
                  </label>
                </div>
                <div className="modal-actions">
                  <button className="ghost" onClick={() => setEditarMarketplace(null)}>Cancelar</button>
                  <button className="primary" onClick={handleSalvarMarketplace}>Salvar Produto</button>
                </div>
              </div>
            </div>
          )}

        </>
      );
    }
    if (page === 'cupons') return renderStubPage('Cupons', 'Pendentes, aprovados, bloqueados');
    if (page === 'templates') return renderStubPage('Templates', 'Modelos de mensagem');
    if (page === 'instancias') return renderStubPage('Instâncias', 'Sincronização com Evolution');
    return renderStubPage('Grupos', 'Ativação de grupos de envio');
  };

  if (!session) {
    return <div className={`app ${mode}`}>{renderLogin()}</div>;
  }

  return (
    <div className={`app ${mode}`}>
      <aside className="sidebar">
        <div className="brand">Central Afiliado</div>
        <nav className="nav">
          <button className={`nav-item ${page === 'dashboard' ? 'active' : ''}`} onClick={() => setPage('dashboard')}>Dashboard</button>
          <button className={`nav-item ${page === 'monitor' ? 'active' : ''}`} onClick={() => setPage('monitor')}>Monitor</button>
          <div className={`nav-item-group ${page.startsWith('produtos') ? 'active' : ''}`}>
            <button
              className="nav-item"
              onClick={() => {
                setProdutosMenuOpen((prev) => !prev);
                if (!page.startsWith('produtos')) setPage('produtos-catalogo');
              }}
            >
              Produtos
            </button>
            {produtosMenuOpen && (
              <div className="nav-sub">
                <button className={`nav-sub-item ${page === 'produtos-catalogo' ? 'active' : ''}`} onClick={() => setPage('produtos-catalogo')}>
                  Catálogo
                </button>
                <button className={`nav-sub-item ${page === 'produtos-marketplace' ? 'active' : ''}`} onClick={() => setPage('produtos-marketplace')}>
                  Produtos
                </button>
              </div>
            )}
          </div>
          <button className={`nav-item ${page === 'cupons' ? 'active' : ''}`} onClick={() => setPage('cupons')}>Cupons</button>
          <button className={`nav-item ${page === 'templates' ? 'active' : ''}`} onClick={() => setPage('templates')}>Templates</button>
          <button className={`nav-item ${page === 'instancias' ? 'active' : ''}`} onClick={() => setPage('instancias')}>Instâncias</button>
          <button className={`nav-item ${page === 'grupos' ? 'active' : ''}`} onClick={() => setPage('grupos')}>Grupos</button>
          <button className="nav-item" onClick={handleLogout}>Sair</button>
        </nav>
      </aside>

      <main className="content">
        {renderPage()}
      </main>
    </div>
  );
}
