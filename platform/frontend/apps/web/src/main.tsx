import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import "./style.css";
import "./manage.css";
import "./auth.css";
import "./categories.css";

type View =
  | "home"
  | "products"
  | "solutions"
  | "solution-detail"
  | "platforms"
  | "platform-products"
  | "content"
  | "detail"
  | "cart"
  | "checkout"
  | "orders"
  | "profile"
  | "addresses"
  | "invoices"
  | "members";
type Row = Record<string, any>;
const money = (value: any) =>
  `¥${Number(value || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateTime = (value: string) =>
  value
    ? new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(value.replace(" ", "T")))
    : "—";
const createIdempotencyKey = () => {
  if (typeof globalThis.crypto?.randomUUID === "function")
    return globalThis.crypto.randomUUID();
  const random = new Uint32Array(4);
  globalThis.crypto?.getRandomValues?.(random);
  return `order-${Date.now()}-${Array.from(random).join("-") || Math.random().toString(36).slice(2)}`;
};
const deliveryAddress = (value: any) => {
  let address = value;
  if (typeof address === "string") {
    try {
      address = JSON.parse(address);
    } catch {
      return address;
    }
  }
  return address
    ? [address.contactName, address.phone, address.address]
        .filter(Boolean)
        .join(" · ")
    : "配送地址待确认";
};
const orderStatus = ["待付款", "待发货", "运输中", "已完成", "已取消", "部分发货"];
const routeViews: View[] = [
  "home",
  "products",
  "solutions",
  "solution-detail",
  "platforms",
  "platform-products",
  "content",
  "cart",
  "checkout",
  "orders",
  "profile",
  "addresses",
  "invoices",
  "members",
];
const protectedViews = new Set<View>([
  "cart",
  "checkout",
  "orders",
  "profile",
  "addresses",
  "invoices",
  "members",
]);
const routeFromLocation = () => {
  const value = new URLSearchParams(location.search).get("view") as View | null;
  return value && routeViews.includes(value) ? value : "home";
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      data.message || data.detail || `操作失败（${response.status}）`,
    );
  }
  if (response.status === 204 || response.headers.get("content-length") === "0")
    return undefined as T;
  return response.json();
}

function App() {
  const [view, setView] = useState<View>(routeFromLocation);
  const [products, setProducts] = useState<Row[]>([]);
  const [categories, setCategories] = useState<Row[]>([]);
  const [portal, setPortal] = useState<Row>({});
  const [categoryId, setCategoryId] = useState<number | undefined>(() => {
    const value = Number(
      new URLSearchParams(location.search).get("categoryId"),
    );
    return value || undefined;
  });
  const [platformId, setPlatformId] = useState<number | undefined>(() => {
    const value = Number(
      new URLSearchParams(location.search).get("platformId"),
    );
    return value || undefined;
  });
  const [solutionId, setSolutionId] = useState<number | undefined>(() => {
    const value = Number(new URLSearchParams(location.search).get("solutionId"));
    return value || undefined;
  });
  const [profile, setProfile] = useState<Row>({});
  const [summary, setSummary] = useState<Row>({});
  const [cart, setCart] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row>();
  const [toast, setToast] = useState("");
  const [current, setCurrent] = useState<Row>();
  const [authReady, setAuthReady] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const pendingAction = useRef<undefined | (() => void)>(undefined);
  const [siteConfig, setSiteConfig] = useState<Row>({});
  const siteName = siteConfig["platform.name"] || "政企采购供应链";
  const servicePhone = siteConfig["platform.servicePhone"] || "400-800-2026";
  const icpFiling = String(siteConfig["platform.icpFiling"] || "").trim();
  const policeFiling = String(siteConfig["platform.policeFiling"] || "").trim();
  const notify = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(""), 2200);
  };
  const loadCart = () =>
    api<Row[]>("/api/client/cart")
      .then(setCart)
      .catch((e) => notify(e.message));
  const loadAccount = async () => {
    const session = await api<Row>("/api/auth/session");
    if (!session.authenticated) throw new Error("请先登录");
    setCurrent(session.user);
    const [p, s] = await Promise.all([
      api<Row>("/api/client/profile"),
      api<Row>("/api/client/summary"),
    ]);
    setProfile(p);
    setSummary(s);
    await loadCart();
  };
  const requireAuth = (action: () => void) => {
    if (current) {
      action();
      return;
    }
    pendingAction.current = action;
    setAuthOpen(true);
  };
  const authSuccess = async () => {
    await loadAccount();
    setAuthOpen(false);
    const action = pendingAction.current;
    pendingAction.current = undefined;
    action?.();
  };
  useEffect(() => {
    void api<Row>("/api/public/config")
      .then(setSiteConfig)
      .catch(() => {});
    void api<Row>("/api/public/portal")
      .then(setPortal)
      .catch(() => {});
    void api<Row[]>("/api/public/catalog/categories").then(setCategories);
    void api<Row[]>("/api/public/catalog/products?enterpriseId=1").then(
      setProducts,
    );
    void loadAccount()
      .catch(() => {})
      .finally(() => setAuthReady(true));
  }, []);
  useEffect(() => {
    if (authReady && !current && protectedViews.has(view)) setAuthOpen(true);
  }, [authReady, current, view]);
  useEffect(() => {
    const pop = () => {
      const params = new URLSearchParams(location.search);
      setView(routeFromLocation());
      setCategoryId(Number(params.get("categoryId")) || undefined);
      setPlatformId(Number(params.get("platformId")) || undefined);
      setSolutionId(Number(params.get("solutionId")) || undefined);
    };
    addEventListener("popstate", pop);
    return () => removeEventListener("popstate", pop);
  }, []);
  const applyNavigation = (
    target: View,
    nextCategory?: number,
    nextPlatform?: number,
    nextSolution?: number,
  ) => {
    setView(target);
    setCategoryId(nextCategory);
    setPlatformId(nextPlatform);
    setSolutionId(nextSolution);
    const url = new URL(location.href);
    if (target === "home") url.searchParams.delete("view");
    else url.searchParams.set("view", target);
    if (nextCategory) url.searchParams.set("categoryId", String(nextCategory));
    else url.searchParams.delete("categoryId");
    if (nextPlatform) url.searchParams.set("platformId", String(nextPlatform));
    else url.searchParams.delete("platformId");
    if (nextSolution) url.searchParams.set("solutionId", String(nextSolution));
    else url.searchParams.delete("solutionId");
    history.pushState({ view: target }, "", url);
  };
  const navigate = (
    target: View,
    nextCategory?: number,
    nextPlatform?: number,
    nextSolution?: number,
  ) => {
    if (protectedViews.has(target) && !current) {
      requireAuth(() => applyNavigation(target, nextCategory, nextPlatform, nextSolution));
      return;
    }
    applyNavigation(target, nextCategory, nextPlatform, nextSolution);
  };
  const openNavigation = (item: Row, index: number) => {
    const fallback: View =
      index === 0
        ? "home"
        : item.title.includes("方案")
          ? "solutions"
          : item.title.includes("平台")
            ? "platforms"
            : "products";
    if (/^https?:\/\//.test(item.linkUrl || "")) {
      location.href = item.linkUrl;
      return;
    }
    const configured = item.linkUrl
      ? new URL(item.linkUrl, location.origin)
      : null;
    const configuredView = configured?.searchParams.get("view") as View | null;
    navigate(
      configuredView && routeViews.includes(configuredView)
        ? configuredView
        : fallback,
      undefined,
      Number(configured?.searchParams.get("platformId")) || undefined,
    );
  };
  const addToCart = async (product: Row, quantity = 1) => {
    try {
      await api("/api/client/cart", {
        method: "POST",
        body: JSON.stringify({ skuId: product.skuId, quantity }),
      });
      await loadCart();
      notify("已加入购物车");
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const add = async (product: Row, quantity = 1) => {
    if (!current) {
      requireAuth(() => void addToCart(product, quantity));
      return;
    }
    await addToCart(product, quantity);
  };
  const buyNow = (product: Row, quantity = 1) =>
    requireAuth(async () => {
      await Promise.all(
        cart
          .filter(
            (row) =>
              Number(row.selected) === 1 &&
              Number(row.skuId) !== Number(product.skuId),
          )
          .map((row) =>
            api(`/api/client/cart/${row.id}`, {
              method: "PUT",
              body: JSON.stringify({ quantity: row.quantity, selected: 0 }),
            }),
          ),
      );
      await addToCart(product, quantity);
      applyNavigation("checkout");
    });
  const goProduct = (product: Row) => {
    setSelected(product);
    setView("detail");
    scrollTo(0, 0);
  };
  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    setCurrent(undefined);
    setProfile({});
    setCart([]);
    navigate("home");
  };
  if (!authReady)
    return <div className="auth-loading">正在加载企业采购平台…</div>;
  const displayView = !current && protectedViews.has(view) ? "home" : view;
  return (
    <div className="shop">
      <div className="topbar">
        <span>{siteName} · 自营正品 · 协议价格</span>
        <div>
          {current ? (
            <>
              <button onClick={() => navigate("orders")}>我的订单</button>
              <button onClick={() => navigate("profile")}>
                {current.realName} · 企业中心
              </button>
              <button onClick={() => void logout()}>退出登录</button>
            </>
          ) : (
            <button onClick={() => setAuthOpen(true)}>登录 / 注册</button>
          )}
        </div>
      </div>
      <header className="header">
        <button className="logo" onClick={() => setView("home")}>
          <i>政</i>
          <span>
            <strong>{siteName}</strong>
            <small>SUPPLY CHAIN</small>
          </span>
        </button>
        <label className="search">
          ⌕<input placeholder="搜索商品、品牌、型号或方案" />
          <button onClick={() => setView("products")}>搜索</button>
        </label>
        <button className="cart-button" onClick={() => navigate("cart")}>
          购物车 <b>{cart.reduce((n, r) => n + Number(r.quantity), 0)}</b>
        </button>
      </header>
      <nav className="nav">
        {(
          portal.navigation || [
            { title: "首页" },
            { title: "办公集采" },
            { title: "场景方案" },
            { title: "平台比价" },
          ]
        ).map((item: Row, index: number) => {
          const fallback: View =
            index === 0
              ? "home"
              : item.title.includes("方案")
                ? "solutions"
                : item.title.includes("平台")
                  ? "platforms"
                  : "products";
          const configured = item.linkUrl
            ? (new URL(item.linkUrl, location.origin).searchParams.get(
                "view",
              ) as View)
            : null;
          const target =
            configured && routeViews.includes(configured)
              ? configured
              : fallback;
          return (
            <button
              key={item.id || item.title}
              className={displayView === target ? "active" : ""}
              onClick={() => openNavigation(item, index)}
            >
              {item.title}
            </button>
          );
        })}
        <span>{current ? "企业协议已生效" : "游客浏览"}</span>
      </nav>
      {displayView === "home" && (
        <Home
          products={products}
          categories={categories}
          portal={portal}
          open={goProduct}
          add={add}
          all={(id?: number) => navigate("products", id)}
        />
      )}
      {displayView === "products" && (
        <Products
          products={products}
          categories={categories}
          initialCategory={categoryId}
          open={goProduct}
          add={add}
        />
      )}
      {(["solutions", "platforms", "content"] as View[]).includes(displayView) && (
        <PortalList
          type={displayView as "solutions" | "platforms" | "content"}
          rows={
            portal[
              displayView === "solutions"
                ? "solution"
                : displayView === "platforms"
                  ? "platform"
                  : "content"
            ] || []
          }
          back={() => setView("home")}
          openSolution={(id) => navigate("solution-detail", undefined, undefined, id)}
        />
      )}
      {displayView === "solution-detail" && solutionId && (
        <SolutionDetail
          solutionId={solutionId}
          back={() => navigate("solutions")}
          requireAuth={requireAuth}
          reloadCart={loadCart}
          checkout={() => navigate("checkout")}
          notify={notify}
        />
      )}
      {displayView === "platform-products" && platformId && (
        <PlatformProducts platformId={platformId} open={goProduct} />
      )}
      {displayView === "detail" && selected && (
        <Detail
          product={selected}
          back={() => setView("products")}
          add={add}
          buyNow={buyNow}
        />
      )}
      {displayView === "cart" && (
        <Cart
          rows={cart}
          reload={loadCart}
          checkout={() => navigate("checkout")}
          notify={notify}
        />
      )}
      {displayView === "checkout" && (
        <Checkout
          rows={cart}
          reload={loadCart}
          back={() => navigate("cart")}
          address={() => navigate("addresses")}
          orders={() => navigate("orders")}
          notify={notify}
        />
      )}
      {displayView === "orders" && <Orders go={(target) => navigate(target)} />}
      {displayView === "profile" && (
        <Profile profile={profile} summary={summary} go={setView} />
      )}
      {(["addresses", "invoices", "members"] as View[]).includes(displayView) && (
        <AccountData
          view={view as "addresses" | "invoices" | "members"}
          roleCode={profile.roleCode}
          go={setView}
        />
      )}
      <footer className="footer">
        <div>
          <strong>{siteName}</strong>
          <span>企业协议价 · 自营库存 · 银行转账 · 全国配送</span>
        </div>
        <div className="footer-meta">
          <p>服务电话 {servicePhone}　工作日 09:00–18:00</p>
          {(icpFiling || policeFiling) && (
            <nav>
              <span className="filing-prefix">备案号：</span>
              {policeFiling && <a className="police-filing" href="https://www.beian.gov.cn/portal/registerSystemInfo" target="_blank" rel="noreferrer"><PoliceFilingIcon />{policeFiling}</a>}
              {icpFiling && <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">{icpFiling}</a>}
            </nav>
          )}
        </div>
      </footer>
      {toast && <div className="toast">✓ {toast}</div>}
      {authOpen && !current && (
        <div className="auth-modal-backdrop">
          <AuthPage
            siteName={siteName}
            onSuccess={() => void authSuccess()}
            onCancel={() => {
              pendingAction.current = undefined;
              setAuthOpen(false);
              if (protectedViews.has(view)) navigate("home");
            }}
          />
        </div>
      )}
    </div>
  );
}

function PoliceFilingIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path fill="#2b65ad" d="M10 1.2c2.1 1.5 4.2 2.1 6.7 2.3v5.4c0 4.4-2.8 7.7-6.7 9.9-3.9-2.2-6.7-5.5-6.7-9.9V3.5C5.8 3.3 7.9 2.7 10 1.2Z"/><circle cx="10" cy="8.8" r="4.6" fill="#d63832"/><path fill="#ffd34f" d="m10 5 1 2.1 2.3.3-1.7 1.7.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.7L9 7.1Z"/><path fill="none" stroke="#f5c34b" strokeWidth=".8" d="M6.2 12.7c1.2 1 2.4 1.5 3.8 2.3 1.4-.8 2.6-1.3 3.8-2.3"/></svg>;
}

function AuthPage({
  siteName,
  onSuccess,
  onCancel,
}: {
  siteName: string;
  onSuccess: () => void;
  onCancel?: () => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState<Row>({ enterpriseName: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    setError("");
    const required =
      mode === "login"
        ? ["username", "password"]
        : ["enterpriseName", "username", "password", "realName", "phone"];
    if (required.some((key) => !String(form[key] || "").trim())) {
      setError("请完整填写必填信息");
      return;
    }
    if (mode === "register" && !/^1\d{10}$/.test(String(form.phone))) {
      setError("请输入11位手机号码");
      return;
    }
    setSubmitting(true);
    try {
      await api(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(form),
      });
      onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <main className="auth-page">
      {onCancel && (
        <button className="auth-close" onClick={onCancel} aria-label="关闭登录窗口">
          ×
        </button>
      )}
      <section className="auth-brand">
        <i>政</i>
        <span>政企采购供应链</span>
        <h1>企业采购，从登录开始</h1>
        <p>协议专价、自营库存、多地址配送和统一订单管理。</p>
        <div>
          <b>✓</b> 企业协议自动匹配
        </div>
        <div>
          <b>✓</b> 线下银行转账
        </div>
        <div>
          <b>✓</b> Web 与 H5 数据同步
        </div>
      </section>
      <section className="auth-card">
        <header>
          <button
            className={mode === "login" ? "active" : ""}
            onClick={() => {
              setMode("login");
              setError("");
            }}
          >
            登录
          </button>
          <button
            className={mode === "register" ? "active" : ""}
            onClick={() => {
              setMode("register");
              setError("");
            }}
          >
            注册
          </button>
        </header>
        <h2>{mode === "login" ? "欢迎登录" : "创建采购员账号"}</h2>
        <p>
          {mode === "login"
            ? "登录后进入企业采购中心"
            : "请输入企业全称，注册后默认角色为采购员"}
        </p>
        {mode === "register" && (
          <label>
            所属企业
            <input
              value={form.enterpriseName || ""}
              onChange={(e) =>
                setForm({ ...form, enterpriseName: e.target.value })
              }
              placeholder="请输入所属企业全称"
            />
          </label>
        )}
        <label>
          {mode === "login" ? "账号或手机号" : "登录账号"}
          <input
            autoComplete="username"
            value={form.username || ""}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            placeholder={
              mode === "login" ? "请输入账号或手机号" : "请输入登录账号"
            }
          />
        </label>
        {mode === "register" && (
          <>
            <label>
              姓名
              <input
                value={form.realName || ""}
                onChange={(e) => setForm({ ...form, realName: e.target.value })}
                placeholder="请输入姓名"
              />
            </label>
            <label>
              手机号码
              <input
                value={form.phone || ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="请输入11位手机号码"
              />
            </label>
          </>
        )}
        <label>
          登录密码
          <input
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            value={form.password || ""}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder={mode === "register" ? "至少8位" : "请输入登录密码"}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
          />
        </label>
        {error && <div className="auth-error">{error}</div>}
        <button
          className="auth-submit"
          disabled={submitting}
          onClick={() => void submit()}
        >
          {submitting
            ? "正在提交…"
            : mode === "login"
              ? "登录企业采购平台"
              : "注册并登录"}
        </button>
        {mode === "login" && <small>演示账号：demo　密码：demo-password</small>}
      </section>
    </main>
  );
}

function Home({
  products,
  categories,
  portal,
  open,
  add,
  all,
}: {
  products: Row[];
  categories: Row[];
  portal: Row;
  open: (r: Row) => void;
  add: (r: Row) => void;
  all: (id?: number) => void;
}) {
  const roots = categories.filter((x) => Number(x.level) === 1).slice(0, 7);
  const banner = portal.banner?.[0];
  return (
    <main>
      <section className="hero">
        <div>
          <span>{banner?.title || "2026 政企集采季"}</span>
          <h1>
            办公采购
            <br />
            <b>一站配齐</b>
          </h1>
          <p>
            {banner?.subtitle || "企业协议专属价格 · 自营库存 · 多地址配送"}
          </p>
          <button onClick={() => all()}>立即选购　›</button>
        </div>
        <div className="hero-art">
          <i>💻</i>
          <i>🖨️</i>
          <i>📄</i>
        </div>
        <aside>
          <strong>
            {products.length || 2}
            <small>款</small>
          </strong>
          <span>协议精选商品</span>
          <em>低于会员价，协议期内可随时调整</em>
        </aside>
      </section>
      <section className="category-strip">
        {[...roots, { id: undefined, name: "全部分类" }].map((item, index) => (
          <button key={item.id || item.name} onClick={() => all(item.id)}>
            <i className={`tone${index}`}>{item.name.slice(0, 1)}</i>
            <span>{item.name}</span>
            <small>查看商品 ›</small>
          </button>
        ))}
      </section>
      <section className="section">
        <div className="section-head">
          <div>
            <span>AGREEMENT PICKS</span>
            <h2>协议精选</h2>
            <p>已自动匹配当前企业有效协议价格</p>
          </div>
          <button onClick={() => all()}>查看全部商品 →</button>
        </div>
        <div className="product-grid">
          {products.slice(0, 4).map((p, i) => (
            <ProductCard
              key={p.skuId}
              product={p}
              index={i}
              open={open}
              add={add}
            />
          ))}
        </div>
      </section>
      <section className="solutions">
        <div>
          <span>SCENE SOLUTION</span>
          <h2>
            采购不只是选商品
            <br />
            更是解决实际场景
          </h2>
          <p>从设备选型、协议采购到配送验收，一站式完成。</p>
        </div>
        {(portal.solution || []).slice(0, 3).map((x: Row) => (
          <article key={x.id}>
            <i>{x.title.slice(0, 1)}</i>
            <span>整体解决方案</span>
            <strong>{x.title}</strong>
            <small>{x.subtitle}</small>
            <button
              onClick={() =>
                (location.href = x.linkUrl || "/web/?view=solutions")
              }
            >
              查看方案 ›
            </button>
          </article>
        ))}
      </section>
    </main>
  );
}

function Products({
  products,
  categories,
  initialCategory,
  open,
  add,
}: {
  products: Row[];
  categories: Row[];
  initialCategory?: number;
  open: (r: Row) => void;
  add: (r: Row) => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [active, setActive] = useState<number | undefined>(initialCategory);
  const [hovered, setHovered] = useState<number>();
  const [sort, setSort] = useState<"default" | "price">("default");
  const ids = active
    ? [
        active,
        ...categories
          .filter((x) => Number(x.parentId) === active)
          .flatMap((x) => [
            x.id,
            ...categories
              .filter((y) => Number(y.parentId) === Number(x.id))
              .map((y) => y.id),
          ]),
      ]
    : [];
  const filtered = products
    .filter(
      (p) =>
        (!active || ids.includes(Number(p.categoryId))) &&
        (p.title.includes(keyword) || p.summary?.includes(keyword)),
    )
    .sort((a, b) =>
      sort === "price"
        ? Number(a.agreementPrice || a.memberPrice) -
          Number(b.agreementPrice || b.memberPrice)
        : 0,
    );
  const roots = categories.filter((x) => Number(x.level) === 1);
  return (
    <main className="page">
      <div className="breadcrumb">首页　/　办公集采</div>
      <div className="listing-layout">
        <aside className="filters category-filters">
          <h3>商品分类</h3>
          <button
            className={!active ? "active" : ""}
            onClick={() => setActive(undefined)}
          >
            全部商品<span>›</span>
          </button>
          {roots.map((root) => {
            const second = categories.filter(
              (x) => Number(x.parentId) === Number(root.id),
            );
            return (
              <div
                className="category-node"
                key={root.id}
                onMouseEnter={() => setHovered(Number(root.id))}
                onMouseLeave={() => setHovered(undefined)}
              >
                <button
                  className={active === Number(root.id) ? "active" : ""}
                  onClick={() => setActive(Number(root.id))}
                >
                  {root.name}
                  <span>›</span>
                </button>
                {hovered === Number(root.id) && second.length > 0 && (
                  <div className="category-flyout">
                    <header>
                      <strong>{root.name}</strong>
                      <button onClick={() => setActive(Number(root.id))}>
                        查看全部
                      </button>
                    </header>
                    {second.map((level2) => {
                      const level3 = categories.filter(
                        (x) => Number(x.parentId) === Number(level2.id),
                      );
                      return (
                        <section key={level2.id}>
                          <button
                            className={
                              active === Number(level2.id) ? "active" : ""
                            }
                            onClick={() => setActive(Number(level2.id))}
                          >
                            {level2.name}
                          </button>
                          <div>
                            {level3.map((item) => (
                              <button
                                className={
                                  active === Number(item.id) ? "active" : ""
                                }
                                key={item.id}
                                onClick={() => setActive(Number(item.id))}
                              >
                                {item.name}
                              </button>
                            ))}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          <h3>商品状态</h3>
          <p>☑ 仅看有货</p>
          <p>☑ 企业协议商品</p>
        </aside>
        <section className="listing">
          <div className="listing-head">
            <div>
              <h1>
                {categories.find((x) => Number(x.id) === active)?.name ||
                  "办公集采"}
              </h1>
              <p>共 {filtered.length} 款自营商品</p>
            </div>
            <label>
              ⌕{" "}
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="在结果中搜索"
              />
            </label>
          </div>
          <div className="sort">
            <button
              className={sort === "default" ? "active" : ""}
              onClick={() => setSort("default")}
            >
              综合排序
            </button>
            <button
              className={sort === "price" ? "active" : ""}
              onClick={() => setSort("price")}
            >
              价格 ↑
            </button>
            <span>协议价优先展示</span>
          </div>
          <div className="product-grid">
            {filtered.map((p, i) => (
              <ProductCard
                key={p.skuId}
                product={p}
                index={i}
                open={open}
                add={add}
              />
            ))}
          </div>
          {!filtered.length && (
            <div className="empty">
              <h2>该分类暂无在售商品</h2>
              <p>请选择其他分类查看</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function PortalList({
  type,
  rows,
  back,
  openSolution,
}: {
  type: "solutions" | "platforms" | "content";
  rows: Row[];
  back: () => void;
  openSolution: (id: number) => void;
}) {
  const title =
    type === "solutions"
      ? "场景方案"
      : type === "platforms"
        ? "平台比价"
        : "内容中心";
  return (
    <main className="page">
      <div className="breadcrumb">
        <button onClick={back}>首页</button>　/　{title}
      </div>
      <section className="section">
        <div className="section-head">
          <div>
            <span>ENTERPRISE SERVICE</span>
            <h2>{title}</h2>
            <p>内容由管理后台统一维护并实时发布</p>
          </div>
        </div>
        <div className="product-grid">
          {rows.map((row, index) => (
            <article
              className="product-card"
              key={row.id}
              onClick={() => type === "solutions" && openSolution(Number(row.id))}
            >
              <div className={`product-image p${index % 5}`}>
                {row.imageUrl ? <img src={row.imageUrl} alt={row.title} /> : <i>{row.title.slice(0, 1)}</i>}
              </div>
              <div className="product-info">
                <small>{title}</small>
                <h3>{row.title}</h3>
                <p>{row.subtitle || "暂无说明"}</p>
                {type === "solutions" ? (
                  <button className="solution-detail-link">查看方案并选购 ›</button>
                ) : row.linkUrl ? <a href={row.linkUrl}>查看详情 ›</a> : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function SolutionDetail({
  solutionId,
  back,
  requireAuth,
  reloadCart,
  checkout,
  notify,
}: {
  solutionId: number;
  back: () => void;
  requireAuth: (action: () => void) => void;
  reloadCart: () => Promise<void> | void;
  checkout: () => void;
  notify: (text: string) => void;
}) {
  const [data, setData] = useState<Row>({ products: [] });
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [selectedItems, setSelectedItems] = useState<Record<number, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    void api<Row>(`/api/public/portal/solutions/${solutionId}`).then((value) => {
      setData(value);
      setQuantities(Object.fromEntries((value.products || []).map((row: Row) => [row.skuId, Number(row.defaultQuantity) || 1])));
      setSelectedItems(Object.fromEntries((value.products || []).map((row: Row) => [row.skuId, Number(row.requiredItem) === 1])));
    }).catch((error) => notify(error.message));
  }, [solutionId]);
  const chosen = (data.products || []).filter((row: Row) => Number(row.requiredItem) === 1 || selectedItems[row.skuId]);
  const total = chosen.reduce((sum: number, row: Row) => sum + Number(row.memberPrice || 0) * Number(quantities[row.skuId] || 1), 0);
  const submit = () => requireAuth(async () => {
    if (!chosen.length) return notify("请至少选择一件方案商品");
    setSubmitting(true);
    try {
      await Promise.all(chosen.map((row: Row) => api("/api/client/cart", {
        method: "POST",
        body: JSON.stringify({ skuId: row.skuId, solutionId, quantity: quantities[row.skuId] || 1 }),
      })));
      await reloadCart();
      checkout();
    } catch (error) {
      notify((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  });
  return (
    <main className="page solution-detail-page">
      <div className="breadcrumb"><button onClick={back}>场景方案</button>　/　{data.solution?.title || "方案详情"}</div>
      <section className="solution-poster">
        {data.solution?.imageUrl ? <img src={data.solution.imageUrl} alt={`${data.solution.title}宣传海报`} /> : <div>请在管理后台上传16:9方案宣传海报</div>}
      </section>
      <section className="solution-summary">
        <div>
          <span>SCENE SOLUTION</span>
          <h1>{data.solution?.title}</h1>
          <h3>{data.solution?.subtitle}</h3>
          <p>{data.solution?.description || "根据场景需求搭配设备组合，可按实际需要调整数量后直接下单。"}</p>
        </div>
      </section>
      <section className="solution-products">
        <header><div><h2>设备组合</h2><p>必选商品不可取消；可选配件按实际需求勾选，数量可在下单前确认。</p></div><b>已选 {chosen.length} 项</b></header>
        {(data.products || []).map((row: Row) => {
          const required = Number(row.requiredItem) === 1;
          const checked = required || !!selectedItems[row.skuId];
          return (
            <article key={row.relationId} className={!checked ? "optional-off" : ""}>
              <label>
                <input type="checkbox" checked={checked} disabled={required} onChange={(event) => setSelectedItems({ ...selectedItems, [row.skuId]: event.target.checked })} />
                <em>{required ? "必选" : "可选"}</em>
              </label>
              <div className="solution-product-image">{row.mainImage ? <img src={row.mainImage} alt={row.title} loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}<span>{row.title?.slice(0, 1) || "商"}<small>{row.mainImage ? "图片加载失败" : "暂无主图"}</small></span></div>
              <div><strong>{row.title}</strong><small>{row.skuCode}</small><p>{row.summary}</p></div>
              <b>{money(row.memberPrice)}</b>
              <div className="solution-counter">
                <button disabled={!checked} onClick={() => setQuantities({ ...quantities, [row.skuId]: Math.max(1, (quantities[row.skuId] || 1) - 1) })}>−</button>
                <input disabled={!checked} type="number" min="1" max={row.availableStock} value={quantities[row.skuId] || 1} onChange={(event) => setQuantities({ ...quantities, [row.skuId]: Math.max(1, Number(event.target.value) || 1) })} />
                <button disabled={!checked} onClick={() => setQuantities({ ...quantities, [row.skuId]: Math.min(Number(row.availableStock), (quantities[row.skuId] || 1) + 1) })}>＋</button>
              </div>
            </article>
          );
        })}
        {!data.products?.length && <div className="empty small">该方案尚未配置商品</div>}
      </section>
      <section className="solution-submit"><span>方案预估金额 <strong>{money(total)}</strong><small>最终金额以确认订单页为准</small></span><button disabled={submitting || !chosen.length} onClick={submit}>{submitting ? "正在处理…" : "确认配置并立即下单"}</button></section>
    </main>
  );
}

function PlatformProducts({
  platformId,
  open,
}: {
  platformId: number;
  open: (r: Row) => void;
}) {
  const [data, setData] = useState<Row>({ products: [] });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    void api<Row>(`/api/public/portal/platforms/${platformId}/products`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [platformId]);
  const openProduct = async (product: Row) => {
    setData((current) => ({
      ...current,
      products: (current.products || []).map((row: Row) =>
        Number(row.relationId) === Number(product.relationId)
          ? { ...row, clickCount: Number(row.clickCount || 0) + 1 }
          : row,
      ),
    }));
    try {
      await api(`/api/public/portal/platforms/${platformId}/products/${product.relationId}/click`, { method: "POST" });
    } catch {
      // 浏览统计失败不阻止用户查看商品详情。
    }
    open({ ...product, clickCount: Number(product.clickCount || 0) + 1 });
  };
  return (
    <main className="page">
      <div className="breadcrumb">
        首页　/　采购平台　/　{data.platform?.title || "商品列表"}
      </div>
      <section className="listing">
        <div className="listing-head">
          <div>
            <h1>{data.platform?.title || "平台商品"}</h1>
            <p>
              {data.platform?.subtitle || "平台关联商品"} · 共{" "}
              {(data.products || []).length} 款
            </p>
          </div>
        </div>
        {loading ? (
          <div className="empty small">正在加载平台商品…</div>
        ) : (
          <div className="product-grid">
            {(data.products || []).map((product: Row, index: number) => (
              <ProductCard
                key={product.relationId}
                product={product}
                index={index}
                open={(product) => void openProduct(product)}
                platformTitle={data.platform?.title}
              />
            ))}
          </div>
        )}
        {!loading && !(data.products || []).length && (
          <div className="empty">
            <h2>该平台暂未关联上架商品</h2>
            <p>请在管理后台的平台商品管理中添加商品</p>
          </div>
        )}
      </section>
    </main>
  );
}

function ProductCard({
  product,
  index,
  open,
  add,
  platformTitle,
}: {
  product: Row;
  index: number;
  open: (r: Row) => void;
  add?: (r: Row) => void;
  platformTitle?: string;
}) {
  return (
    <article className="product-card" onClick={() => open(product)}>
      <div className={`product-image p${index % 5}`}>
        <span>{platformTitle ? "平台商品" : "自营"}</span>
        {product.mainImage ? (
          <img src={product.mainImage} alt={product.title} />
        ) : (
          <i>{["💻", "📄", "🖨️", "🖥️", "📦"][index % 5]}</i>
        )}
        <em>{platformTitle || "协议专享"}</em>
      </div>
      <div className="product-info">
        <small>{platformTitle || "企业协议商品"}</small>
        {!platformTitle && product.platformNames && (
          <div className="platform-tags">
            {String(product.platformNames)
              .split("、")
              .map((name: string) => (
                <span key={name}>{name}</span>
              ))}
          </div>
        )}
        <h3>{product.title}</h3>
        <p>{product.summary || "政企采购自营商品，全国配送"}</p>
        <div className="price">
          <strong>
            {money(platformTitle ? product.platformPrice : product.agreementPrice || product.memberPrice)}
          </strong>
          <del>{money(product.marketPrice)}</del>
        </div>
        <div className="stock">
          <span>库存 {product.availableStock}{platformTitle ? ` · 浏览 ${product.clickCount || 0}` : ""}</span>
          {platformTitle ? (
            product.productUrl && <a className="platform-card-link" href={product.productUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>平台链接</a>
          ) : (
            <button onClick={(event) => { event.stopPropagation(); void add?.(product); }}>加入购物车</button>
          )}
        </div>
      </div>
    </article>
  );
}

function Detail({
  product,
  back,
  add,
  buyNow,
}: {
  product: Row;
  back: () => void;
  add: (r: Row, n: number) => void;
  buyNow: (r: Row, n: number) => void;
}) {
  const [qty, setQty] = useState(1);
  const [detailTab, setDetailTab] = useState<
    "detail" | "specification" | "service"
  >("detail");
  const galleryImages = Array.from(
    new Set(
      [product.mainImage, ...String(product.gallery || "").split("\n")]
        .map((url) => String(url || "").trim())
        .filter(Boolean),
    ),
  );
  const [activeImage, setActiveImage] = useState(galleryImages[0] || "");
  useEffect(() => {
    setActiveImage(galleryImages[0] || "");
  }, [product.skuId, product.mainImage, product.gallery]);
  const specifications = String(product.attributes || "")
    .split(/[；;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const separator = item.search(/[:：]/);
      return separator > 0
        ? [item.slice(0, separator), item.slice(separator + 1)]
        : ["规格", item];
    });
  return (
    <main className="page">
      <div className="breadcrumb">
        首页　/　办公集采　/　<button onClick={back}>返回列表</button>
      </div>
      <section className="detail">
        <div className="detail-gallery">
          <div>
            {activeImage ? (
              <img src={activeImage} alt={product.title} />
            ) : (
              <i>暂无商品图片</i>
            )}
            <span>协议价商品</span>
          </div>
          {galleryImages.length > 0 && (
            <nav>
              {galleryImages.map((url, index) => (
                <button
                  key={url}
                  className={activeImage === url ? "active" : ""}
                  onClick={() => setActiveImage(url)}
                  aria-label={`查看商品图片${index + 1}`}
                >
                  <img src={url} alt={`${product.title} 图片${index + 1}`} />
                </button>
              ))}
            </nav>
          )}
        </div>
        <div className="detail-main">
          <span className="self">自营商品</span>
          <h1>{product.title}</h1>
          <p>{product.summary}</p>
          <div className="agreement-price">
            <label>企业协议价</label>
            <strong>
              {money(product.agreementPrice || product.memberPrice)}
            </strong>
            <del>市场价 {money(product.marketPrice)}</del>
            <em>已为山东高速数字科技匹配有效协议</em>
          </div>
          <dl>
            <dt>商品编码</dt>
            <dd>{product.skuCode}</dd>
            <dt>配送</dt>
            <dd>
              {product.deliveryDescription ||
                "自营库存，支持全国配送，实际时效以收货地址为准"}
            </dd>
            <dt>服务</dt>
            <dd>
              <span>自营正品</span>
              <span>全国配送</span>
              <span>统一对账</span>
            </dd>
            <dt>数量</dt>
            <dd className="counter">
              <button onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
              <b>{qty}</b>
              <button
                onClick={() =>
                  setQty(Math.min(product.availableStock, qty + 1))
                }
              >
                ＋
              </button>
              <small>库存 {product.availableStock} 件</small>
            </dd>
          </dl>
          <div className="buy">
            <button onClick={() => void add(product, qty)}>加入购物车</button>
            <button onClick={() => void buyNow(product, qty)}>立即采购</button>
          </div>
        </div>
      </section>
      <section className="detail-body">
        <nav>
          <button
            className={detailTab === "detail" ? "active" : ""}
            onClick={() => setDetailTab("detail")}
          >
            商品详情
          </button>
          <button
            className={detailTab === "specification" ? "active" : ""}
            onClick={() => setDetailTab("specification")}
          >
            规格参数
          </button>
          <button
            className={detailTab === "service" ? "active" : ""}
            onClick={() => setDetailTab("service")}
          >
            配送与售后
          </button>
        </nav>
        {detailTab === "detail" && (
          <div className="product-rich-content">
            {product.detailHtml ? (
              <div dangerouslySetInnerHTML={{ __html: product.detailHtml }} />
            ) : (
              <>
                <h2>政企采购自营商品</h2>
                <p>
                  {product.summary ||
                    "商品由平台统一采购、统一库存和统一配送，支持企业协议专属价格。"}
                </p>
              </>
            )}
          <div className="feature-grid">
            {[
              ["正", "自营正品", "严格供应链审核"],
              ["价", "协议专价", "按企业有效协议计价"],
              ["配", "多地配送", "同一 SKU 可拆分到多个地址"],
              ["票", "发票记录", "第三方开具，平台留档"],
            ].map((x) => (
              <article key={x[1]}>
                <i>{x[0]}</i>
                <strong>{x[1]}</strong>
                <small>{x[2]}</small>
              </article>
            ))}
          </div>
          </div>
        )}
        {detailTab === "specification" && (
          <div className="product-specifications">
            <h2>规格参数</h2>
            <dl>
              <dt>商品编码</dt>
              <dd>{product.skuCode}</dd>
              {specifications.length ? (
                specifications.map(([name, value], index) => (
                  <React.Fragment key={`${name}-${index}`}>
                    <dt>{name}</dt>
                    <dd>{value}</dd>
                  </React.Fragment>
                ))
              ) : (
                <>
                  <dt>规格</dt>
                  <dd>以实际商品及采购确认信息为准</dd>
                </>
              )}
            </dl>
          </div>
        )}
        {detailTab === "service" && (
          <div className="product-service">
            <section>
              <h2>配送说明</h2>
              <p>
                {product.deliveryDescription ||
                  "自营库存，支持全国配送；现货商品预计1至3个工作日送达，实际时效以收货地址和物流信息为准。"}
              </p>
            </section>
            <section>
              <h2>售后政策</h2>
              {product.afterSalesHtml ? (
                <div
                  dangerouslySetInnerHTML={{ __html: product.afterSalesHtml }}
                />
              ) : (
                <p>
                  商品签收后如发现质量问题，请在7日内联系企业采购管理员提交售后申请。
                </p>
              )}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

function Cart({
  rows,
  reload,
  checkout,
  notify,
}: {
  rows: Row[];
  reload: () => Promise<void>;
  checkout: () => void;
  notify: (s: string) => void;
}) {
  const selected = rows.filter((x) => Number(x.selected) === 1);
  const total = selected.reduce(
    (n, r) => n + Number(r.salePrice) * Number(r.quantity),
    0,
  );
  const update = async (row: Row, changes: Row) => {
    try {
      await api(`/api/client/cart/${row.id}`, {
        method: "PUT",
        body: JSON.stringify({
          quantity: changes.quantity ?? row.quantity,
          selected: changes.selected ?? row.selected,
        }),
      });
      await reload();
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const remove = async (row: Row) => {
    try {
      await api(`/api/client/cart/${row.id}`, { method: "DELETE" });
      await reload();
      notify("商品已移出购物车");
    } catch (e) {
      notify((e as Error).message);
    }
  };
  return (
    <main className="page cart-page">
      <div className="step">
        <b>1</b>
        <strong>确认购物车</strong>
        <i />
        <b>2</b>
        <span>填写订单</span>
        <i />
        <b>3</b>
        <span>银行转账</span>
      </div>
      <div className="cart-title">
        <h1>购物车</h1>
        <p>所选商品已匹配企业协议最优价格</p>
      </div>
      {!rows.length ? (
        <div className="empty">
          <i>🛒</i>
          <h2>购物车还是空的</h2>
          <p>去选择需要采购的商品吧</p>
          <button onClick={() => (location.href = "/web/")}>继续采购</button>
        </div>
      ) : (
        <>
          <div className="cart-table">
            <header>
              <span>选择</span>
              <span>商品信息</span>
              <span>协议单价</span>
              <span>数量</span>
              <span>小计</span>
              <span>操作</span>
            </header>
            {rows.map((row) => (
              <article key={row.id}>
                <input
                  type="checkbox"
                  checked={!!Number(row.selected)}
                  onChange={(e) =>
                    void update(row, { selected: e.target.checked ? 1 : 0 })
                  }
                />
                <div className="cart-product">
                  <i>📦</i>
                  <span>
                    <strong>{row.title}</strong>
                    <small>{row.skuCode}</small>
                    <em>企业协议商品</em>
                  </span>
                </div>
                <strong>
                  {money(row.salePrice)}
                  <del>{money(row.marketPrice)}</del>
                </strong>
                <div className="counter">
                  <button
                    onClick={() =>
                      void update(row, {
                        quantity: Math.max(1, row.quantity - 1),
                      })
                    }
                  >
                    −
                  </button>
                  <b>{row.quantity}</b>
                  <button
                    onClick={() =>
                      void update(row, { quantity: row.quantity + 1 })
                    }
                  >
                    ＋
                  </button>
                </div>
                <b>{money(Number(row.salePrice) * row.quantity)}</b>
                <button className="delete" onClick={() => void remove(row)}>
                  删除
                </button>
              </article>
            ))}
          </div>
          <div className="settlement">
            <div>
              <span>
                已选择 <b>{selected.length}</b> 种商品
              </span>
              <small>协议价格不可与优惠券叠加</small>
            </div>
            <div>
              <span>合计（不含运费）</span>
              <strong>{money(total)}</strong>
              <small>
                已节省{" "}
                {money(
                  selected.reduce(
                    (n, r) =>
                      n +
                      (Number(r.marketPrice) - Number(r.salePrice)) *
                        r.quantity,
                    0,
                  ),
                )}
              </small>
            </div>
            <button
              disabled={!selected.length}
              onClick={checkout}
            >
              提交订单
            </button>
          </div>
        </>
      )}
    </main>
  );
}

function Checkout({
  rows,
  reload,
  back,
  address,
  orders,
  notify,
}: {
  rows: Row[];
  reload: () => Promise<void>;
  back: () => void;
  address: () => void;
  orders: () => void;
  notify: (s: string) => void;
}) {
  const selected = rows.filter((row) => Number(row.selected) === 1);
  const total = selected.reduce(
    (sum, row) => sum + Number(row.salePrice) * Number(row.quantity),
    0,
  );
  const [addresses, setAddresses] = useState<Row[]>([]);
  const [allocations, setAllocations] = useState<Record<string, Row[]>>({});
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    void api<Row[]>("/api/client/addresses")
      .then(setAddresses)
      .catch((error) => notify(error.message));
  }, []);
  const currentAddress = addresses[0];
  useEffect(() => {
    if (!addresses.length) return;
    setAllocations((current) => {
      const next = { ...current };
      selected.forEach((row) => {
        const key = String(row.skuId);
        if (!next[key]?.length)
          next[key] = [
            { addressId: addresses[0].id, quantity: Number(row.quantity) },
          ];
      });
      return next;
    });
  }, [addresses, rows]);
  const changeAllocation = (skuId: number, index: number, changes: Row) =>
    setAllocations((current) => ({
      ...current,
      [skuId]: current[String(skuId)].map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...changes } : item,
      ),
    }));
  const addAllocation = (row: Row) =>
    setAllocations((current) => {
      const key = String(row.skuId);
      const items = [...(current[key] || [])];
      const used = new Set(items.map((item) => Number(item.addressId)));
      const nextAddress = addresses.find(
        (item) => !used.has(Number(item.id)),
      );
      if (!nextAddress || items.length >= Number(row.quantity)) return current;
      const donorIndex = items.findIndex((item) => Number(item.quantity) > 1);
      if (donorIndex < 0) return current;
      items[donorIndex] = {
        ...items[donorIndex],
        quantity: Number(items[donorIndex].quantity) - 1,
      };
      items.push({ addressId: nextAddress.id, quantity: 1 });
      return { ...current, [key]: items };
    });
  const removeAllocation = (row: Row, index: number) =>
    setAllocations((current) => {
      const key = String(row.skuId);
      const items = [...current[key]];
      const [removed] = items.splice(index, 1);
      if (items.length)
        items[0] = {
          ...items[0],
          quantity: Number(items[0].quantity) + Number(removed.quantity),
        };
      return { ...current, [key]: items };
    });
  const submit = async () => {
    if (!currentAddress) {
      notify("请先添加收货地址");
      return;
    }
    const invalid = selected.find((row) => {
      const items = allocations[String(row.skuId)] || [];
      return (
        !items.length ||
        new Set(items.map((item) => Number(item.addressId))).size !==
          items.length ||
        items.some((item) => Number(item.quantity) < 1) ||
        items.reduce((sum, item) => sum + Number(item.quantity), 0) !==
          Number(row.quantity)
      );
    });
    if (invalid) {
      notify(`${invalid.title}的配送数量必须等于购买数量，且地址不能重复`);
      return;
    }
    setSubmitting(true);
    try {
      const result = await api<Row>("/api/client/orders", {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey: createIdempotencyKey(),
          allocations: selected.flatMap((row) =>
            (allocations[String(row.skuId)] || []).map((item) => ({
              skuId: row.skuId,
              addressId: Number(item.addressId),
              quantity: Number(item.quantity),
            })),
          ),
        }),
      });
      await reload();
      notify(`订单 ${result.orderNo} 提交成功`);
      setTimeout(orders, 700);
    } catch (error) {
      notify((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };
  if (!selected.length)
    return (
      <main className="page">
        <div className="empty">
          <h2>没有待结算商品</h2>
          <button onClick={back}>返回购物车</button>
        </div>
      </main>
    );
  return (
    <main className="page checkout-page">
      <div className="step">
        <b>1</b><span>确认购物车</span><i />
        <b>2</b><strong>填写订单</strong><i />
        <b>3</b><span>银行转账</span>
      </div>
      <div className="checkout-heading">
        <button onClick={back}>‹ 返回购物车</button>
        <h1>确认订单</h1>
      </div>
      <section className="checkout-card">
        <header>
          <h2>收货信息</h2>
          <button onClick={address}>{currentAddress ? "管理地址" : "新增地址"}</button>
        </header>
        {currentAddress ? (
          <div className="checkout-address">
            <strong>{currentAddress.contactName}　{currentAddress.contactPhone}</strong>
            <span>{currentAddress.province}{currentAddress.city}{currentAddress.district}{currentAddress.detail}</span>
            {!!Number(currentAddress.isDefault) && <em>默认地址</em>}
          </div>
        ) : (
          <div className="checkout-empty">尚未设置收货地址，请先新增地址</div>
        )}
      </section>
      <section className="checkout-card">
        <header><h2>商品清单</h2><span>共 {selected.length} 种商品</span></header>
        {selected.map((row) => (
          <div className="checkout-product-block" key={row.id}>
            <article className="checkout-product">
              {row.mainImage ? <img src={row.mainImage} alt={row.title} /> : <i>📦</i>}
              <span><strong>{row.title}</strong><small>{row.skuCode}</small></span>
              <b>{money(row.salePrice)} × {row.quantity}</b>
              <em>{money(Number(row.salePrice) * Number(row.quantity))}</em>
            </article>
            <div className="delivery-split">
              <header>
                <strong>配送地址分配</strong>
                <span>已分配 {(allocations[String(row.skuId)] || []).reduce((sum, item) => sum + Number(item.quantity), 0)} / {row.quantity} 件</span>
                <button
                  disabled={
                    addresses.length < 2 ||
                    (allocations[String(row.skuId)] || []).length >=
                      Math.min(addresses.length, Number(row.quantity))
                  }
                  onClick={() => addAllocation(row)}
                >
                  ＋ 添加配送地址
                </button>
              </header>
              {(allocations[String(row.skuId)] || []).map((item, index) => {
                const used = new Set(
                  (allocations[String(row.skuId)] || [])
                    .filter((_, itemIndex) => itemIndex !== index)
                    .map((entry) => Number(entry.addressId)),
                );
                return (
                  <div className="delivery-line" key={`${row.skuId}-${index}`}>
                    <select
                      value={item.addressId}
                      onChange={(event) =>
                        changeAllocation(row.skuId, index, {
                          addressId: Number(event.target.value),
                        })
                      }
                    >
                      {addresses.map((addressRow) => (
                        <option
                          key={addressRow.id}
                          value={addressRow.id}
                          disabled={used.has(Number(addressRow.id))}
                        >
                          {addressRow.contactName} · {addressRow.province}{addressRow.city}{addressRow.district}{addressRow.detail}
                        </option>
                      ))}
                    </select>
                    <label>
                      数量
                      <input
                        type="number"
                        min="1"
                        max={row.quantity}
                        value={item.quantity}
                        onChange={(event) =>
                          changeAllocation(row.skuId, index, {
                            quantity: Math.max(1, Number(event.target.value)),
                          })
                        }
                      />
                    </label>
                    {(allocations[String(row.skuId)] || []).length > 1 && (
                      <button className="remove-delivery" onClick={() => removeAllocation(row, index)}>
                        移除
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>
      <section className="checkout-card checkout-payment">
        <div><h2>支付方式</h2><p>线下银行转账，提交后请按照订单说明完成付款</p></div>
        <strong>银行转账</strong>
      </section>
      <section className="checkout-submit">
        <span>应付总额 <strong>{money(total)}</strong></span>
        <button disabled={!currentAddress || submitting} onClick={() => void submit()}>
          {submitting ? "正在提交…" : "提交订单"}
        </button>
      </section>
    </main>
  );
}

function Orders({ go }: { go: (v: View) => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState(-1);
  const [detail, setDetail] = useState<Row>();
  useEffect(() => {
    void api<Row[]>("/api/client/orders").then(setRows);
  }, []);
  const filtered =
    tab < 0 ? rows : rows.filter((r) => Number(r.orderStatus) === tab);
  const show = async (row: Row) =>
    setDetail(await api<Row>(`/api/client/orders/${row.id}`));
  return (
    <main className="page account-page">
      <aside>
        <div className="account-brand">
          <i>鲁</i>
          <strong>企业采购中心</strong>
        </div>
        {[
          ["profile", "账户概览"],
          ["orders", "我的订单"],
          ["addresses", "地址管理"],
          ["invoices", "发票管理"],
          ["members", "企业成员"],
        ].map((item) => (
            <button
              className={item[0] === "orders" ? "active" : ""}
              key={item[0]}
              onClick={() => go(item[0] as View)}
            >
              {item[1]}
              <span>›</span>
            </button>
          ))}
      </aside>
      <section>
        <div className="account-heading">
          <h1>我的订单</h1>
          <p>查看企业采购订单和履约进度</p>
        </div>
        <div className="order-tabs">
          <button
            className={tab === -1 ? "active" : ""}
            onClick={() => setTab(-1)}
          >
            全部订单
          </button>
          {orderStatus.slice(0, 4).map((x, i) => (
            <button
              key={x}
              className={tab === i ? "active" : ""}
              onClick={() => setTab(i)}
            >
              {x}
            </button>
          ))}
        </div>
        {filtered.map((row) => (
          <article className="order-card" key={row.id}>
            <header>
              <strong>{dateTime(row.createdAt)}</strong>
              <span>订单号：{row.orderNo}</span>
              <em>{orderStatus[row.orderStatus] || "处理中"}</em>
            </header>
            <div>
              {row.mainImage ? (
                <img className="order-cover" src={row.mainImage} alt="订单商品" />
              ) : (
                <i>📦</i>
              )}
              <span>
                <strong>
                  {row.itemKinds} 种商品，共 {row.itemCount} 件
                </strong>
                <small>企业协议采购 · 银行转账</small>
              </span>
              <p>
                <small>订单金额</small>
                <b>{money(row.payableAmount)}</b>
              </p>
              <p>
                <small>订单状态</small>
                <strong>{orderStatus[row.orderStatus]}</strong>
              </p>
              <button onClick={() => void show(row)}>查看详情</button>
            </div>
          </article>
        ))}
        {!filtered.length && (
          <div className="empty small">
            <i>▱</i>
            <h2>暂无相关订单</h2>
          </div>
        )}
        {detail && (
          <div className="dialog-mask">
            <div className="client-dialog">
              <button
                className="dialog-close"
                onClick={() => setDetail(undefined)}
              >
                ×
              </button>
              <h2>订单详情</h2>
              <p>订单号：{detail.order.orderNo}</p>
              <div className="dialog-summary">
                <span>
                  应付金额<strong>{money(detail.order.payableAmount)}</strong>
                </span>
                <span>
                  付款状态
                  <strong>
                    {["待付款", "待确认", "已确认"][detail.order.paymentStatus]}
                  </strong>
                </span>
                <span>
                  订单状态
                  <strong>{orderStatus[detail.order.orderStatus]}</strong>
                </span>
                {Number(detail.order.refundStatus || 0) === 1 && (
                  <span>
                    退款状态
                    <strong className="refund-status">已退款 {money(detail.order.refundAmount)}</strong>
                    <small>{detail.order.refundReason} · {dateTime(detail.order.refundedAt)}</small>
                  </span>
                )}
              </div>
              <h3>商品明细</h3>
              {detail.items.map((x: Row) => (
                <article className="dialog-line" key={`${x.skuCode}-${x.subOrderNo}`}>
                  {x.mainImage ? (
                    <img className="dialog-product-cover" src={x.mainImage} alt={x.title} />
                  ) : (
                    <i>📦</i>
                  )}
                  <span>
                    <strong>{x.title}</strong>
                    <small>{x.skuCode} · 配送单 {x.subOrderNo}</small>
                    <address>{deliveryAddress(x.addressSnapshot)}</address>
                    <small>
                      发货状态：{["待发货", "已发货", "运输中", "已签收", "已取消"][Number(x.fulfillmentStatus)] || "待发货"}
                      {x.logisticsNo
                        ? ` · ${x.logisticsCompany} ${x.logisticsNo}${x.logisticsStatus ? ` · ${x.logisticsStatus}` : ""}`
                        : ""}
                    </small>
                  </span>
                  <b>× {x.quantity}</b>
                  <em>{money(x.totalPrice)}</em>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function Profile({
  profile,
  summary,
  go,
}: {
  profile: Row;
  summary: Row;
  go: (v: View) => void;
}) {
  return (
    <main className="page account-page">
      <aside>
        <div className="account-brand">
          <i>鲁</i>
          <strong>企业采购中心</strong>
        </div>
        {[
          ["profile", "账户概览"],
          ["orders", "我的订单"],
          ["addresses", "地址管理"],
          ["invoices", "发票管理"],
          ["members", "企业成员"],
        ].map((x, i) => (
          <button
            className={i === 0 ? "active" : ""}
            key={x[0]}
            onClick={() => go(x[0] as View)}
          >
            {x[1]}
            <span>›</span>
          </button>
        ))}
      </aside>
      <section>
        <div className="profile-hero">
          <i>鲁</i>
          <div>
            <span>企业已认证</span>
            <h1>{profile.enterpriseName}</h1>
            <p>
              {profile.realName} ·{" "}
              {profile.roleCode === "ENTERPRISE_ADMIN"
                ? "企业管理员"
                : "采购员"}
              　{profile.phone}
            </p>
          </div>
          <button onClick={() => go("members")}>
            {profile.roleCode === "ENTERPRISE_ADMIN"
              ? "管理企业成员"
              : "查看企业成员"}
          </button>
          <article>
            <span>
              <strong>{money(summary.monthlyPurchase)}</strong>
              <small>本月采购</small>
            </span>
            <span>
              <strong>{money(summary.totalSavings)}</strong>
              <small>累计协议节省</small>
            </span>
            <span>
              <strong>{summary.activeOrders || 0}</strong>
              <small>进行中订单</small>
            </span>
          </article>
        </div>
        <div className="profile-grid">
          <section>
            <header>
              <h2>当前采购协议</h2>
              <span>{profile.agreementName ? "生效中" : "未配置"}</span>
            </header>
            <strong>{profile.agreementName || "暂无生效采购协议"}</strong>
            <p>
              {profile.agreementExpiry
                ? `协议有效期至 ${profile.agreementExpiry}`
                : "请联系企业管理员或平台运营人员"}
            </p>
            <div>
              <span>
                协议商品 <b>{summary.agreementItemCount || 0}</b> 款
              </span>
              <span>
                企业成员 <b>{summary.memberCount || 0}</b> 人
              </span>
            </div>
          </section>
          <section>
            <header>
              <h2>待办事项</h2>
            </header>
            <button onClick={() => go("orders")}>
              <i>付</i>
              <span>
                <strong>{summary.pendingPayment || 0} 笔订单待付款</strong>
                <small>请在付款时限内完成银行转账</small>
              </span>
              <em>›</em>
            </button>
            <button onClick={() => go("addresses")}>
              <i>址</i>
              <span>
                <strong>{summary.addressCount || 0} 个收货地址</strong>
                <small>维护配送地址和默认地址</small>
              </span>
              <em>›</em>
            </button>
          </section>
        </div>
        <div className="profile-actions">
          {[
            [
              "址",
              "地址管理",
              `${summary.addressCount || 0} 个收货地址`,
              "addresses",
            ],
            [
              "票",
              "发票管理",
              `${summary.invoiceCount || 0} 条开票记录`,
              "invoices",
            ],
            [
              "员",
              "企业成员",
              `${summary.memberCount || 0} 位企业成员`,
              "members",
            ],
          ].map((x) => (
            <button key={x[1]} onClick={() => go(x[3] as View)}>
              <i>{x[0]}</i>
              <span>
                <strong>{x[1]}</strong>
                <small>{x[2]}</small>
              </span>
              <em>›</em>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

function AccountData({
  view,
  roleCode,
  go,
}: {
  view: "addresses" | "invoices" | "members";
  roleCode: string;
  go: (v: View) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [editing, setEditing] = useState<Row>();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Row>({});
  const [error, setError] = useState("");
  const path =
    view === "addresses"
      ? "addresses"
      : view === "invoices"
        ? "invoices"
        : "members";
  const title =
    view === "addresses"
      ? "地址管理"
      : view === "invoices"
        ? "发票管理"
        : "企业成员";
  const load = () => api<Row[]>(`/api/client/${path}`).then(setRows);
  useEffect(() => {
    void load();
  }, [view]);
  const show = (row?: Row) => {
    if (view === "members" && roleCode !== "ENTERPRISE_ADMIN") {
      window.alert("仅企业管理员可维护企业成员");
      return;
    }
    setEditing(row);
    setError("");
    setForm(
      row
        ? { ...row }
        : view === "addresses"
          ? {
              province: "山东省",
              city: "济南市",
              district: "历下区",
              isDefault: 0,
            }
          : { roleCode: "BUYER", status: 1 },
    );
    setOpen(true);
  };
  const save = async () => {
    const required =
      view === "addresses"
        ? [
            "contactName",
            "contactPhone",
            "province",
            "city",
            "district",
            "detail",
          ]
        : ["username", "realName", "phone"];
    if (required.some((key) => !String(form[key] || "").trim())) {
      setError("请完整填写必填信息");
      window.alert("请完整填写必填信息");
      return;
    }
    if (!/^1\d{10}$/.test(String(form.contactPhone || form.phone))) {
      setError("请输入11位手机号码");
      window.alert("请输入11位手机号码");
      return;
    }
    try {
      await api(`/api/client/${path}${editing ? `/${editing.id}` : ""}`, {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      setOpen(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
      window.alert((e as Error).message);
    }
  };
  const remove = async (row: Row) => {
    if (confirm(`确认删除“${row.contactName || row.realName}”？`)) {
      try {
        await api(`/api/client/${path}/${row.id}`, { method: "DELETE" });
        await load();
      } catch (e) {
        setError((e as Error).message);
      }
    }
  };
  return (
    <main className="page account-page">
      <aside>
        <div className="account-brand">
          <i>鲁</i>
          <strong>企业采购中心</strong>
        </div>
        {[
          ["profile", "账户概览"],
          ["orders", "我的订单"],
          ["addresses", "地址管理"],
          ["invoices", "发票管理"],
          ["members", "企业成员"],
        ].map((x) => (
          <button
            className={view === x[0] ? "active" : ""}
            key={x[0]}
            onClick={() => go(x[0] as View)}
          >
            {x[1]}
            <span>›</span>
          </button>
        ))}
      </aside>
      <section>
        <div className="account-heading action-heading">
          <div>
            <h1>{title}</h1>
            <p>
              {view === "addresses"
                ? "支持同一商品拆分配送至多个地址"
                : view === "invoices"
                  ? "第三方开具发票，平台记录开票结果"
                  : "维护企业采购成员和账号状态"}
            </p>
          </div>
          {view !== "invoices" && (
            <button onClick={() => show()}>
              ＋ 新增{view === "addresses" ? "地址" : "成员"}
            </button>
          )}
        </div>
        <div className="manage-list">
          {rows.map((row) => (
            <article key={row.id}>
              <div>
                <strong>
                  {view === "addresses"
                    ? `${row.contactName}　${row.contactPhone}`
                    : view === "invoices"
                      ? `${row.invoiceType}　${money(row.amount)}`
                      : `${row.realName}　@${row.username}`}
                </strong>
                <span>
                  {view === "addresses"
                    ? `${row.province}${row.city}${row.district}${row.detail}`
                    : view === "invoices"
                      ? `订单 ${row.orderNo} · ${["待处理", "处理中", "已开具", "失败"][row.status]}`
                      : `${row.roleCode === "ENTERPRISE_ADMIN" ? "企业管理员" : "采购员"} · ${row.phone}`}
                </span>
              </div>
              {view === "addresses" && Number(row.isDefault) === 1 && (
                <em>默认地址</em>
              )}
              {view !== "invoices" && (
                <p>
                  <button onClick={() => show(row)}>编辑</button>
                  <button onClick={() => void remove(row)}>删除</button>
                </p>
              )}
            </article>
          ))}
        </div>
        {open && (
          <div className="dialog-mask">
            <div className="client-dialog form-dialog">
              <button className="dialog-close" onClick={() => setOpen(false)}>
                ×
              </button>
              <h2>
                {editing ? "编辑" : "新增"}
                {view === "addresses" ? "地址" : "成员"}
              </h2>
              {view === "addresses" ? (
                <>
                  {[
                    ["contactName", "收货人"],
                    ["contactPhone", "手机号码"],
                    ["province", "省"],
                    ["city", "市"],
                    ["district", "区县"],
                    ["detail", "详细地址"],
                  ].map((x) => (
                    <label key={x[0]}>
                      {x[1]}
                      <input
                        value={form[x[0]] || ""}
                        onChange={(e) =>
                          setForm({ ...form, [x[0]]: e.target.value })
                        }
                      />
                    </label>
                  ))}
                  <label className="check-line">
                    <input
                      type="checkbox"
                      checked={!!Number(form.isDefault)}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          isDefault: e.target.checked ? 1 : 0,
                        })
                      }
                    />
                    设为默认地址
                  </label>
                </>
              ) : (
                <>
                  {[
                    ["username", "登录账号"],
                    ["realName", "姓名"],
                    ["phone", "手机号码"],
                  ].map((x) => (
                    <label key={x[0]}>
                      {x[1]}
                      <input
                        value={form[x[0]] || ""}
                        onChange={(e) =>
                          setForm({ ...form, [x[0]]: e.target.value })
                        }
                      />
                    </label>
                  ))}
                  <label>
                    角色
                    <select
                      value={form.roleCode || "BUYER"}
                      onChange={(e) =>
                        setForm({ ...form, roleCode: e.target.value })
                      }
                    >
                      <option value="BUYER">采购员</option>
                      <option value="ENTERPRISE_ADMIN">企业管理员</option>
                    </select>
                  </label>
                  <label>
                    状态
                    <select
                      value={form.status ?? 1}
                      onChange={(e) =>
                        setForm({ ...form, status: Number(e.target.value) })
                      }
                    >
                      <option value={1}>启用</option>
                      <option value={0}>停用</option>
                    </select>
                  </label>
                </>
              )}
              <button className="save-button" onClick={() => void save()}>
                保存
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
