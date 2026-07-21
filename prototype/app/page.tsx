"use client";

import { useMemo, useState } from "react";

type View = "home" | "catalog" | "orders" | "admin";

const products = [
  { id: 1, category: "办公设备", name: "联想 ThinkBook 16+ 2026", spec: "Ultra 7 / 32G / 1TB / 2.5K", market: 7299, agreement: 6480, stock: 86, tone: "blue", badge: "协议专属" },
  { id: 2, category: "办公耗材", name: "得力 A4 多功能复印纸", spec: "70g · 500张/包 · 8包/箱", market: 229, agreement: 186, stock: 328, tone: "cyan", badge: "常购" },
  { id: 3, category: "网络设备", name: "华为 eKitEngine 交换机", spec: "24口千兆 · 4口万兆光", market: 4599, agreement: 3980, stock: 42, tone: "violet", badge: "方案优选" },
  { id: 4, category: "会议设备", name: "MAXHUB 会议平板 65英寸", spec: "4K · 摄像头 · 移动支架", market: 13999, agreement: 11880, stock: 18, tone: "orange", badge: "协议专属" },
];

const navItems: { id: View; label: string; hint: string }[] = [
  { id: "home", label: "采购工作台", hint: "总览" },
  { id: "catalog", label: "商品中心", hint: "128" },
  { id: "orders", label: "订单中心", hint: "3" },
  { id: "admin", label: "管理后台", hint: "运营" },
];

const money = (value: number) => `¥${value.toLocaleString("zh-CN")}`;

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [cartCount, setCartCount] = useState(3);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部商品");
  const [drawer, setDrawer] = useState(false);
  const [notice, setNotice] = useState("");
  const [paid, setPaid] = useState(false);
  const [allocations, setAllocations] = useState({ qingdao: 2, jinan: 3, yantai: 1 });

  const filteredProducts = useMemo(() => products.filter((product) => {
    const categoryMatch = category === "全部商品" || product.category === category;
    const queryMatch = `${product.name}${product.spec}`.toLowerCase().includes(query.toLowerCase());
    return categoryMatch && queryMatch;
  }), [category, query]);

  const allocationTotal = Object.values(allocations).reduce((sum, value) => sum + value, 0);

  const toast = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2200);
  };

  const addToCart = () => {
    setCartCount((count) => count + 1);
    toast("已按企业协议价加入采购车");
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">链</div>
          <div><strong>政采供应链</strong><span>ENTERPRISE PROCUREMENT</span></div>
        </div>
        <div className="workspace-label">企业采购空间</div>
        <nav>
          {navItems.map((item) => (
            <button key={item.id} className={view === item.id ? "nav-item active" : "nav-item"} onClick={() => setView(item.id)}>
              <span className={`nav-icon icon-${item.id}`} aria-hidden="true" />
              <span>{item.label}</span><small>{item.hint}</small>
            </button>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <div className="workspace-label">快捷入口</div>
        <button className="nav-item muted"><span className="nav-icon icon-solution" />场景方案<small>8</small></button>
        <button className="nav-item muted"><span className="nav-icon icon-often" />常购清单<small>24</small></button>
        <div className="agreement-card">
          <div className="agreement-head"><span className="pulse" />协议正常</div>
          <strong>2026年度采购框架协议</strong>
          <p>有效期至 2027-06-30</p>
          <div><span style={{ width: "72%" }} /></div>
        </div>
        <div className="sidebar-user"><div className="avatar">鲁</div><div><strong>山东高速数字科技</strong><span>企业主账号</span></div><button>•••</button></div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="mobile-brand"><span>链</span>政采供应链</div>
          <label className="global-search">
            <span aria-hidden="true">⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索商品、SKU、方案或订单号" />
            <kbd>⌘ K</kbd>
          </label>
          <div className="top-actions">
            <button className="help">?</button><button className="bell">♢<i /></button>
            <button className="cart-button" onClick={() => setDrawer(true)}>采购车 <b>{cartCount}</b></button>
          </div>
        </header>

        <div className="content">
          {view === "home" && <HomeView setView={setView} addToCart={addToCart} />}
          {view === "catalog" && <CatalogView products={filteredProducts} category={category} setCategory={setCategory} addToCart={addToCart} />}
          {view === "orders" && <OrdersView paid={paid} />}
          {view === "admin" && <AdminView paid={paid} onConfirm={() => { setPaid(true); toast("银行到账已确认，订单进入待发货"); }} />}
        </div>
      </section>

      {drawer && (
        <div className="overlay" role="presentation" onMouseDown={() => setDrawer(false)}>
          <section className="cart-drawer" role="dialog" aria-modal="true" aria-label="采购车" onMouseDown={(event) => event.stopPropagation()}>
            <div className="drawer-head"><div><span>采购车</span><small>协议价格实时校验</small></div><button onClick={() => setDrawer(false)}>×</button></div>
            <div className="cart-product"><div className="mini-product blue">NB</div><div><strong>联想 ThinkBook 16+ 2026</strong><p>Ultra 7 / 32G / 1TB</p></div><b>{money(6480)}</b></div>
            <div className="allocation-title"><div><strong>分配至收货地址</strong><span>同一 SKU 共 6 台</span></div><em className={allocationTotal === 6 ? "valid" : "invalid"}>{allocationTotal} / 6</em></div>
            {[
              ["qingdao", "青岛总部", "崂山区深圳路101号"],
              ["jinan", "济南项目部", "历下区经十路9999号"],
              ["yantai", "烟台分公司", "芝罘区海港路25号"],
            ].map(([key, name, address]) => (
              <div className="address-row" key={key}>
                <div><strong>{name}</strong><span>{address}</span></div>
                <div className="stepper"><button onClick={() => setAllocations((a) => ({ ...a, [key]: Math.max(0, a[key as keyof typeof a] - 1) }))}>−</button><b>{allocations[key as keyof typeof allocations]}</b><button onClick={() => setAllocations((a) => ({ ...a, [key]: a[key as keyof typeof a] + 1 }))}>＋</button></div>
              </div>
            ))}
            <div className="drawer-summary"><span>协议已节省 <b>{money(4914)}</b></span><div><small>订单应付</small><strong>{money(38880)}</strong></div></div>
            <button className="primary full" disabled={allocationTotal !== 6} onClick={() => { setDrawer(false); setView("orders"); toast("结算预览已生成"); }}>确认分配并结算</button>
            <p className="drawer-note">线下银行转账 · 下单后 7 天内完成付款</p>
          </section>
        </div>
      )}
      {notice && <div className="toast">✓ {notice}</div>}
    </main>
  );
}

function HomeView({ setView, addToCart }: { setView: (view: View) => void; addToCart: () => void }) {
  return <>
    <div className="page-intro"><div><span className="eyebrow">2026年7月21日 · 星期二</span><h1>下午好，张经理</h1><p>协议运行正常，有 3 笔订单需要您关注。</p></div><button className="primary" onClick={() => setView("catalog")}>＋ 发起采购</button></div>
    <section className="hero-grid">
      <article className="hero-card">
        <div className="hero-copy"><span className="live-pill">企业专属协议已生效</span><h2>采购不再比价，<br /><em>每一单都是最优价。</em></h2><p>系统已为您匹配 128 款协议商品，当前平均价格优势 12.8%。</p><div><button className="light-button" onClick={() => setView("catalog")}>查看协议商品 →</button><span className="hero-saving">本月累计节省 <b>¥28,640</b></span></div></div>
        <div className="price-orbit"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="price-ticket"><small>平台参考价</small><del>¥7,299</del><span>您的协议价</span><strong>¥6,480</strong><em>省 ¥819</em></div></div>
      </article>
      <aside className="metric-stack">
        <div className="metric-card"><span className="metric-icon blue">¥</span><div><small>本月采购额</small><strong>¥186,420</strong><em className="up">↗ 12.4%</em></div></div>
        <div className="metric-card"><span className="metric-icon green">✓</span><div><small>协议节省</small><strong>¥28,640</strong><em>节省率 13.3%</em></div></div>
        <div className="metric-card"><span className="metric-icon amber">↗</span><div><small>在途订单</small><strong>3 <i>笔</i></strong><em>预计本周到达</em></div></div>
      </aside>
    </section>

    <section className="section-block">
      <div className="section-head"><div><span>QUICK ORDER</span><h3>常购商品，一键补货</h3></div><button onClick={() => setView("catalog")}>查看全部 24 项 →</button></div>
      <div className="product-grid">
        {products.slice(0, 3).map((product) => <ProductCard key={product.id} product={product} onAdd={addToCart} />)}
      </div>
    </section>

    <section className="bottom-grid">
      <article className="orders-card"><div className="section-head compact"><div><span>ORDER TRACKING</span><h3>订单动态</h3></div><button onClick={() => setView("orders")}>全部订单 →</button></div><div className="order-line"><div className="order-product cyan">纸</div><div><strong>PO202607180023</strong><span>办公耗材 · 12 项</span></div><div className="order-progress"><span><i className="done" />已确认</span><b /><span><i className="done" />已发货</span><b /><span><i />运输中</span></div><div><strong>明日送达</strong><span>顺丰 SF146829301</span></div></div></article>
      <article className="solution-card"><div><span>SMART SOLUTION</span><h3>智慧会议室升级方案</h3><p>显示、音视频与协作设备一站式组合，方案价格再省 8%。</p><button>查看方案 →</button></div><div className="solution-shape"><i /><i /><i /></div></article>
    </section>
  </>;
}

function CatalogView({ products: items, category, setCategory, addToCart }: { products: typeof products; category: string; setCategory: (value: string) => void; addToCart: () => void }) {
  const categories = ["全部商品", "办公设备", "办公耗材", "网络设备", "会议设备"];
  return <><div className="page-intro catalog-intro"><div><span className="eyebrow">CATALOG</span><h1>协议商品中心</h1><p>价格已经过企业协议校验，提交订单时将再次确认。</p></div><div className="catalog-stat"><span>可采购商品</span><strong>128</strong><small>平均节省 12.8%</small></div></div><div className="filter-bar">{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="product-grid catalog-grid">{items.map((product) => <ProductCard key={product.id} product={product} onAdd={addToCart} />)}</div>{items.length === 0 && <div className="empty-state"><strong>没有找到匹配商品</strong><span>尝试调整搜索关键词或商品分类</span></div>}</>;
}

function ProductCard({ product, onAdd }: { product: typeof products[number]; onAdd: () => void }) {
  return <article className="product-card"><div className={`product-visual ${product.tone}`}><span>{product.badge}</span><b>{product.category.slice(0, 2)}</b><em>自营</em></div><div className="product-body"><span className="category">{product.category}</span><h4>{product.name}</h4><p>{product.spec}</p><div className="stock"><i />库存 {product.stock} 件</div><div className="product-price"><div><small>协议价</small><strong>{money(product.agreement)}</strong><del>{money(product.market)}</del></div><button aria-label={`添加${product.name}到采购车`} onClick={onAdd}>＋</button></div></div></article>;
}

function OrdersView({ paid }: { paid: boolean }) {
  return <><div className="page-intro"><div><span className="eyebrow">ORDER CENTER</span><h1>订单中心</h1><p>银行转账、发货与物流状态一目了然。</p></div></div><div className="status-tabs"><button className="active">全部订单 <b>3</b></button><button>待付款 <b>{paid ? 0 : 1}</b></button><button>待发货 <b>{paid ? 1 : 0}</b></button><button>运输中 <b>2</b></button></div><article className="order-detail-card"><div className="order-detail-head"><div><span className={paid ? "status paid" : "status awaiting"}>{paid ? "待发货" : "待付款"}</span><strong>PO202607210018</strong><small>2026-07-21 14:32 创建</small></div><strong>{money(38880)}</strong></div><div className="order-detail-body"><div className="mini-product blue">NB</div><div><strong>联想 ThinkBook 16+ 2026</strong><span>共 6 台 · 分配至 3 个地址</span></div><div className="address-chips"><span>青岛 2</span><span>济南 3</span><span>烟台 1</span></div></div><div className="bank-panel"><div className="bank-icon">¥</div><div><strong>{paid ? "财务已确认到账" : "请通过企业银行账户完成转账"}</strong><span>{paid ? "银行流水：BANK-20260721-8862" : "收款户名：山东政采供应链有限公司 · 账号尾号 6688"}</span></div><button>{paid ? "查看凭证" : "查看转账说明"}</button></div></article></>;
}

function AdminView({ paid, onConfirm }: { paid: boolean; onConfirm: () => void }) {
  return <><div className="admin-banner"><div><span>运营管理视图</span><h1>今日有 1 笔银行转账待核对</h1><p>确认到账后，订单将自动进入待发货并完成库存实扣。</p></div><div className="admin-figure"><span>待核对</span><strong>{paid ? 0 : 1}</strong><small>笔</small></div></div><div className="admin-stats"><div><span>今日订单</span><strong>18</strong><small>¥126,840</small></div><div><span>待发货</span><strong>{paid ? 7 : 6}</strong><small>最早等待 2 小时</small></div><div><span>协议商品</span><strong>128</strong><small>2 项低库存</small></div><div><span>生效协议</span><strong>36</strong><small>本月到期 3 份</small></div></div><article className="admin-table-card"><div className="section-head compact"><div><span>BANK TRANSFER</span><h3>银行转账核对</h3></div><button>导出对账单</button></div><div className="table-wrap"><table><thead><tr><th>订单号</th><th>企业</th><th>应付金额</th><th>转账参考号</th><th>提交时间</th><th>状态</th><th>操作</th></tr></thead><tbody><tr><td><strong>PO202607210018</strong></td><td>山东高速数字科技</td><td><strong>{money(38880)}</strong></td><td>BANK-20260721-8862</td><td>07-21 15:08</td><td><span className={paid ? "table-status done" : "table-status"}>{paid ? "已确认" : "待核对"}</span></td><td><button className="confirm-button" disabled={paid} onClick={onConfirm}>{paid ? "已完成" : "确认到账"}</button></td></tr></tbody></table></div></article></>;
}
