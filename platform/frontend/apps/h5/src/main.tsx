import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { Dialog, Toast } from "antd-mobile";
import "./style.css";
import "./product-image.css";
import "./manage.css";
import "./auth.css";
import "./platform-tags.css";
type Tab = "home" | "category" | "cart" | "checkout" | "orders" | "mine";
type Row = Record<string, any>;
const structuredSpecs = (value: unknown): Row[] => {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value || "[]") : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};
function DragScroll({ className, children }: { className: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, moved: false, x: 0, left: 0 });
  return (
    <div
      ref={ref}
      className={`${className} drag-scroll`}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        drag.current = { active: true, moved: false, x: event.clientX, left: ref.current?.scrollLeft || 0 };
      }}
      onPointerMove={(event) => {
        if (!drag.current.active || !ref.current) return;
        const distance = event.clientX - drag.current.x;
        if (Math.abs(distance) > 4) {
          drag.current.moved = true;
          if (!event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.setPointerCapture(event.pointerId);
        }
        ref.current.scrollLeft = drag.current.left - distance;
      }}
      onPointerUp={(event) => {
        drag.current.active = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { drag.current.active = false; }}
      onClickCapture={(event) => {
        if (drag.current.moved) {
          event.preventDefault();
          event.stopPropagation();
          drag.current.moved = false;
        }
      }}
    >{children}</div>
  );
}
const money = (v: any) =>
  `¥${Number(v || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
const statuses = ["待付款", "待发货", "运输中", "已完成", "已取消", "部分发货"];
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.message || d.detail || `操作失败（${r.status}）`);
  }
  if (r.status === 204 || r.headers.get("content-length") === "0")
    return undefined as T;
  return r.json();
}

function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [products, setProducts] = useState<Row[]>([]);
  const [categories, setCategories] = useState<Row[]>([]);
  const [portal, setPortal] = useState<Row>({});
  const [cart, setCart] = useState<Row[]>([]);
  const [profile, setProfile] = useState<Row>({});
  const [detail, setDetail] = useState<Row>();
  const [solutionId, setSolutionId] = useState<number | undefined>(() => Number(new URLSearchParams(location.search).get("solutionId")) || undefined);
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const [current, setCurrent] = useState<Row>();
  const [authReady, setAuthReady] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const pendingAction = useRef<undefined | (() => void)>(undefined);
  const [siteConfig, setSiteConfig] = useState<Row>({});
  const siteName = siteConfig["platform.name"] || "政企采购供应链";
  const servicePhone = siteConfig["platform.servicePhone"] || "400-800-2026";
  const icpFiling = String(siteConfig["platform.icpFiling"] || "").trim();
  const policeFiling = String(siteConfig["platform.policeFiling"] || "").trim();
  const loadCart = async () => {
    try {
      setCart(await api<Row[]>("/api/client/cart"));
    } catch (e) {
      Toast.show((e as Error).message);
    }
  };
  const loadAccount = async () => {
    const session = await api<Row>("/api/auth/session");
    if (!session.authenticated) throw new Error("请先登录");
    setCurrent(session.user);
    setProfile(await api<Row>("/api/client/profile"));
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
  const addToCart = async (p: Row) => {
    try {
      await api("/api/client/cart", {
        method: "POST",
        body: JSON.stringify({ skuId: p.skuId, quantity: 1 }),
      });
      await loadCart();
      Toast.show({ icon: "success", content: "已加入购物车" });
    } catch (e) {
      Toast.show((e as Error).message);
    }
  };
  const add = async (p: Row) => {
    if (!current) {
      requireAuth(() => void addToCart(p));
      return;
    }
    await addToCart(p);
  };
  const buyNow = (product: Row) =>
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
      await addToCart(product);
      setDetail(undefined);
      setTab("checkout");
    });
  const openProtectedTab = (target: Tab) =>
    requireAuth(() => setTab(target));
  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    setCurrent(undefined);
    setProfile({});
    setCart([]);
    setTab("home");
  };
  if (!authReady) return <div className="m-auth-loading">正在加载…</div>;
  if (solutionId)
    return (
      <>
        <MobileSolutionDetail
          solutionId={solutionId}
          back={() => {
            setSolutionId(undefined);
            history.pushState({}, "", location.pathname);
          }}
          requireAuth={requireAuth}
          reloadCart={loadCart}
          checkout={() => setTab("checkout")}
        />
        {authOpen && !current && (
          <div className="m-auth-modal"><MobileAuth onSuccess={() => void authSuccess()} onCancel={() => setAuthOpen(false)} /></div>
        )}
      </>
    );
  if (solutionsOpen)
    return <MobileSolutionList solutions={portal.solution || []} back={() => setSolutionsOpen(false)} open={(id) => {
      setSolutionId(id);
      history.pushState({}, "", `${location.pathname}?solutionId=${id}`);
    }} />;
  if (detail)
    return (
      <>
        <ProductDetail
          product={detail}
          back={() => setDetail(undefined)}
          add={add}
          buyNow={buyNow}
        />
        {authOpen && !current && (
          <div className="m-auth-modal">
            <MobileAuth
              onSuccess={() => void authSuccess()}
              onCancel={() => {
                pendingAction.current = undefined;
                setAuthOpen(false);
              }}
            />
          </div>
        )}
      </>
    );
  return (
    <div className="mobile-app">
      <header className="mobile-header">
        <div>
          <i>政</i>
          <span>
            <strong>{siteName}</strong>
            <small>
              {current
                ? `${profile.enterpriseName || "企业采购账号"} · 协议生效中`
                : "游客浏览 · 登录后使用企业采购功能"}
            </small>
          </span>
        </div>
        <button onClick={() => !current && setAuthOpen(true)}>
          {current ? servicePhone : "登录"}
        </button>
      </header>
      <section className="mobile-content">
        {tab === "home" && (
          <Home
            products={products}
            solutions={portal.solution || []}
            open={setDetail}
            add={add}
            category={() => setTab("category")}
            openSolution={(id) => {
              setSolutionId(id);
              history.pushState({}, "", `${location.pathname}?solutionId=${id}`);
            }}
            allSolutions={() => setSolutionsOpen(true)}
          />
        )}
        {tab === "category" && (
          <Category
            products={products}
            categories={categories}
            open={setDetail}
          />
        )}
        {tab === "cart" && (
          <Cart rows={cart} reload={loadCart} checkout={() => setTab("checkout")} />
        )}
        {tab === "checkout" && (
          <Checkout
            rows={cart}
            reload={loadCart}
            back={() => setTab("cart")}
            orders={() => setTab("orders")}
          />
        )}
        {tab === "orders" && <Orders />}
        {tab === "mine" && (
          <Mine
            profile={profile}
            orders={() => setTab("orders")}
            logout={logout}
          />
        )}
        {(icpFiling || policeFiling) && (
          <footer className="m-filing">
            <span>备案号：</span>
            {policeFiling && <a className="police-filing" href="https://www.beian.gov.cn/portal/registerSystemInfo" target="_blank" rel="noreferrer"><PoliceFilingIcon />{policeFiling}</a>}
            {icpFiling && <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">{icpFiling}</a>}
          </footer>
        )}
      </section>
      <nav className="tabbar">
        {[
          ["home", "⌂", "首页"],
          ["category", "▦", "分类"],
          ["cart", "▱", "购物车"],
          ["orders", "单", "订单"],
          ["mine", "○", "我的"],
        ].map((x) => (
          <button
            key={x[0]}
            className={tab === x[0] ? "active" : ""}
            onClick={() => {
              const target = x[0] as Tab;
              if (["cart", "orders", "mine"].includes(target))
                openProtectedTab(target);
              else setTab(target);
            }}
          >
            <i>
              {x[1]}
              {x[0] === "cart" && cart.length > 0 && (
                <b>{cart.reduce((n, r) => n + Number(r.quantity), 0)}</b>
              )}
            </i>
            <span>{x[2]}</span>
          </button>
        ))}
      </nav>
      {authOpen && !current && (
        <div className="m-auth-modal">
          <MobileAuth
            onSuccess={() => void authSuccess()}
            onCancel={() => {
              pendingAction.current = undefined;
              setAuthOpen(false);
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

function MobileAuth({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel?: () => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState<Row>({ enterpriseName: "" });
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    const required =
      mode === "login"
        ? ["username", "password"]
        : ["enterpriseName", "username", "password", "realName", "phone"];
    if (required.some((k) => !String(form[k] || "").trim())) {
      Toast.show("请完整填写必填信息");
      return;
    }
    if (mode === "register" && !/^1\d{10}$/.test(String(form.phone))) {
      Toast.show("请输入11位手机号码");
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
      Toast.show((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="m-auth">
      {onCancel && (
        <button className="m-auth-close" onClick={onCancel} aria-label="关闭登录窗口">
          ×
        </button>
      )}
      <header>
        <i>政</i>
        <div>
          <strong>政企采购</strong>
          <span>企业专属采购平台</span>
        </div>
      </header>
      <main>
        <nav>
          <button
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            登录
          </button>
          <button
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
          >
            注册
          </button>
        </nav>
        <h1>{mode === "login" ? "欢迎登录" : "注册采购员账号"}</h1>
        <p>
          {mode === "login"
            ? "登录后查看企业协议、订单和购物车"
            : "请输入企业全称，注册后自动加入企业"}
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
            inputMode={mode === "login" ? "text" : undefined}
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
              />
            </label>
            <label>
              手机号码
              <input
                inputMode="tel"
                value={form.phone || ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
          </>
        )}
        <label>
          登录密码
          <input
            type="password"
            value={form.password || ""}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>
        <button
          className="submit"
          disabled={submitting}
          onClick={() => void submit()}
        >
          {submitting ? "提交中…" : mode === "login" ? "登录" : "注册并登录"}
        </button>
        {mode === "login" && <small>演示账号 demo / demo-password</small>}
      </main>
    </div>
  );
}

function MobileSolutionList({ solutions, back, open }: { solutions: Row[]; back: () => void; open: (id: number) => void }) {
  return (
    <div className="mobile-app m-solution-list">
      <header className="sub-header"><button onClick={back}>‹ 返回</button><h2>场景方案</h2><span>{solutions.length}个方案</span></header>
      <main>
        {solutions.map((row) => (
          <article key={row.id} onClick={() => open(Number(row.id))}>
            <div>{row.mobileImageUrl || row.imageUrl ? <img src={row.mobileImageUrl || row.imageUrl} alt={row.title} /> : <span>方案海报</span>}</div>
            <section><small>SCENE SOLUTION</small><h2>{row.title}</h2><p>{row.subtitle || "企业场景设备组合方案"}</p><button>查看方案配置 ›</button></section>
          </article>
        ))}
        {!solutions.length && <div className="m-empty">暂无已发布方案</div>}
      </main>
    </div>
  );
}

function MobileSolutionDetail({ solutionId, back, requireAuth, reloadCart, checkout }: {
  solutionId: number;
  back: () => void;
  requireAuth: (action: () => void) => void;
  reloadCart: () => Promise<void>;
  checkout: () => void;
}) {
  const [data, setData] = useState<Row>({ products: [] });
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [selectedItems, setSelectedItems] = useState<Record<number, boolean>>({});
  useEffect(() => {
    void api<Row>(`/api/public/portal/solutions/${solutionId}`).then((value) => {
      setData(value);
      setQuantities(Object.fromEntries((value.products || []).map((row: Row) => [row.skuId, Number(row.defaultQuantity) || 1])));
      setSelectedItems(Object.fromEntries((value.products || []).map((row: Row) => [row.skuId, Number(row.requiredItem) === 1])));
    }).catch((error) => Toast.show(error.message));
  }, [solutionId]);
  const chosen = (data.products || []).filter((row: Row) => Number(row.requiredItem) === 1 || selectedItems[row.skuId]);
  const total = chosen.reduce((sum: number, row: Row) => sum + Number(row.memberPrice || 0) * Number(quantities[row.skuId] || 1), 0);
  const submit = () => requireAuth(async () => {
    try {
      await Promise.all(chosen.map((row: Row) => api("/api/client/cart", { method: "POST", body: JSON.stringify({ skuId: row.skuId, solutionId, quantity: quantities[row.skuId] || 1 }) })));
      await reloadCart();
      checkout();
      back();
    } catch (error) { Toast.show((error as Error).message); }
  });
  return (
    <div className="mobile-app m-solution-detail">
      <header className="sub-header"><button onClick={back}>‹ 返回</button><h2>方案详情</h2><button onClick={() => navigator.clipboard?.writeText(location.href).then(() => Toast.show("分享链接已复制"))}>分享</button></header>
      <section className="m-solution-poster">
        {data.solution?.mobileImageUrl || data.solution?.imageUrl ? <img src={data.solution.mobileImageUrl || data.solution.imageUrl} alt={`${data.solution.title}宣传海报`} /> : <div>请上传9:16方案宣传海报</div>}
      </section>
      <section className="m-solution-hero">
        <span>SCENE SOLUTION</span><h1>{data.solution?.title}</h1><h3>{data.solution?.subtitle}</h3><p>{data.solution?.description}</p>
      </section>
      <section className="m-solution-items">
        <header><h2>设备组合</h2><p>确认每件商品的数量，可选配件可按需勾选。</p></header>
        {(data.products || []).map((row: Row) => {
          const required = Number(row.requiredItem) === 1;
          const checked = required || !!selectedItems[row.skuId];
          return <article key={row.relationId} className={!checked ? "off" : ""}>
            <label><input type="checkbox" checked={checked} disabled={required} onChange={(event) => setSelectedItems({ ...selectedItems, [row.skuId]: event.target.checked })} /><em>{required ? "必选" : "可选"}</em></label>
            <div className="m-solution-image">{row.mainImage ? <img src={row.mainImage} alt={row.title} loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}<span>{row.title?.slice(0, 1) || "商"}</span></div>
            <div className="m-solution-product"><strong>{row.title}</strong><small>{money(row.memberPrice)}</small><div><button disabled={!checked} onClick={() => setQuantities({ ...quantities, [row.skuId]: Math.max(1, (quantities[row.skuId] || 1) - 1) })}>−</button><b>{quantities[row.skuId] || 1}</b><button disabled={!checked} onClick={() => setQuantities({ ...quantities, [row.skuId]: Math.min(Number(row.availableStock), (quantities[row.skuId] || 1) + 1) })}>＋</button></div></div>
          </article>;
        })}
      </section>
      <footer className="m-solution-submit"><span>预估金额<strong>{money(total)}</strong></span><button disabled={!chosen.length} onClick={submit}>确认配置并下单</button></footer>
    </div>
  );
}

function Home({
  products,
  solutions,
  open,
  add,
  category,
  openSolution,
  allSolutions,
}: {
  products: Row[];
  solutions: Row[];
  open: (r: Row) => void;
  add: (r: Row) => void;
  category: () => void;
  openSolution: (id: number) => void;
  allSolutions: () => void;
}) {
  return (
    <div className="home">
      <label className="m-search">
        ⌕<input placeholder="搜索商品、品牌、型号…" />
        <button>搜索</button>
      </label>
      <section className="m-hero">
        <span>2026 政企集采季</span>
        <h1>
          办公采购
          <br />
          <b>一站配齐</b>
        </h1>
        <p>协议专属价格 · 自营正品保障</p>
        <button onClick={category}>立即选购　›</button>
        <i>💻</i>
        <em>🖨️</em>
      </section>
      <div className="shortcuts">
        {[
          ["耗", "办公耗材"],
          ["用", "办公用品"],
          ["电", "电脑设备"],
          ["会", "会议设备"],
          ["网", "网络设备"],
          ["家", "家用电器"],
          ["案", "场景方案"],
          ["全", "全部分类"],
        ].map((x, i) => (
          <button key={x[1]} onClick={category}>
            <i className={`t${i}`}>{x[0]}</i>
            <span>{x[1]}</span>
          </button>
        ))}
      </div>
      <section className="m-section">
        <header>
          <div>
            <span>AGREEMENT PICKS</span>
            <h2>协议精选</h2>
          </div>
          <button onClick={category}>全部 ›</button>
        </header>
        <DragScroll className="product-scroll">
          {products.map((p, i) => (
            <Product key={p.skuId} row={p} index={i} open={open} add={add} />
          ))}
        </DragScroll>
      </section>
      <section className="m-section">
        <header>
          <div>
            <span>SCENE SOLUTION</span>
            <h2>方案推荐</h2>
          </div>
          <button onClick={allSolutions}>全部 ›</button>
        </header>
        <DragScroll className="solution-scroll">
          {solutions.map((row) => (
            <article key={row.id} onClick={() => openSolution(Number(row.id))} style={row.imageUrl ? { backgroundImage: `linear-gradient(135deg,#15365de8,#1f6ac9d9),url(${row.imageUrl})`, backgroundSize: "cover" } : undefined}>
              <span>SCENE SOLUTION</span>
              <strong>{row.title}</strong>
              <small>{row.subtitle || "企业场景设备组合方案"}</small>
              <b>查看配置并下单 ›</b>
            </article>
          ))}
        </DragScroll>
      </section>
    </div>
  );
}
function Product({
  row,
  index,
  open,
  add,
}: {
  row: Row;
  index: number;
  open: (r: Row) => void;
  add: (r: Row) => void;
}) {
  return (
    <article className="m-product" onClick={() => open(row)}>
      <div className={`m-image c${index % 4}`}>
        {row.mainImage && (
          <img
            src={row.mainImage}
            alt={row.title}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        )}
        <span>协议价</span>
        <i>{["💻", "📄", "🖨️", "📦"][index % 4]}</i>
      </div>
      <h3>{row.title}</h3>
      <p>{row.summary}</p>
      <div className="m-platform-tags">
        {row.platformNames &&
          String(row.platformNames)
            .split("、")
            .map((name: string) => (
              <span key={name}>{name}</span>
            ))}
      </div>
      <small className="m-product-sales">已售 {row.soldCount || 0} 件</small>
      <div>
        <strong>{money(row.agreementPrice || row.memberPrice)}</strong>
        <del>{money(row.marketPrice)}</del>
        <button
          onClick={(e) => {
            e.stopPropagation();
            void add(row);
          }}
        >
          ＋
        </button>
      </div>
    </article>
  );
}
function Category({
  products,
  categories,
  open,
}: {
  products: Row[];
  categories: Row[];
  open: (r: Row) => void;
}) {
  const roots = categories.filter((x) => Number(x.level) === 1);
  const [active, setActive] = useState<number>();
  const children = active
    ? categories.filter((x) => Number(x.parentId) === active)
    : categories.filter((x) => Number(x.level) === 2);
  const ids = active
    ? [
        active,
        ...children.flatMap((x) => [
          x.id,
          ...categories
            .filter((y) => Number(y.parentId) === Number(x.id))
            .map((y) => y.id),
        ]),
      ]
    : [];
  const visible = products.filter(
    (p) => !active || ids.includes(Number(p.categoryId)),
  );
  return (
    <div className="subpage">
      <header>
        <h1>商品分类</h1>
        <span>{visible.length}款</span>
      </header>
      <div className="category-layout">
        <aside>
          <button
            className={!active ? "active" : ""}
            onClick={() => setActive(undefined)}
          >
            全部商品
          </button>
          {roots.map((x) => (
            <button
              className={active === Number(x.id) ? "active" : ""}
              onClick={() => setActive(Number(x.id))}
              key={x.id}
            >
              {x.name}
            </button>
          ))}
        </aside>
        <section>
          <div className="category-banner">
            <span>企业焕新季</span>
            <strong>
              {categories.find((x) => Number(x.id) === active)?.name ||
                "全部商品"}
            </strong>
            <small>协议商品专属优惠</small>
          </div>
          <h2>下级分类</h2>
          <div className="category-grid">
            {children.map((x) => (
              <button key={x.id}>
                <i>{x.name.slice(0, 1)}</i>
                <span>{x.name}</span>
              </button>
            ))}
          </div>
          <h2>协议商品</h2>
          {visible.map((p, i) => (
            <button
              className="category-product"
              onClick={() => open(p)}
              key={p.skuId}
            >
              <i>{["💻", "📄", "🖨️", "📦"][i % 4]}</i>
              <span>
                <strong>{p.title}</strong>
                <small>{money(p.agreementPrice || p.memberPrice)}</small>
              </span>
              <em>›</em>
            </button>
          ))}
          {!visible.length && (
            <div className="m-empty">
              <h2>暂无商品</h2>
              <p>请选择其他分类</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
function ProductDetail({
  product,
  back,
  add,
  buyNow,
}: {
  product: Row;
  back: () => void;
  add: (r: Row) => void;
  buyNow: (r: Row) => void;
}) {
  const favoriteKey = `favorite-${product.skuId}`;
  const [favorite, setFavorite] = useState(
    () => localStorage.getItem(favoriteKey) === "1",
  );
  const toggleFavorite = () => {
    const next = !favorite;
    setFavorite(next);
    if (next) localStorage.setItem(favoriteKey, "1");
    else localStorage.removeItem(favoriteKey);
    Toast.show(next ? "已收藏" : "已取消收藏");
  };
  const share = async () => {
    const data = {
      title: product.title,
      text: `${product.title} ${money(product.agreementPrice || product.memberPrice)}`,
      url: location.href,
    };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(`${data.text} ${data.url}`);
        Toast.show("商品链接已复制");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") Toast.show("暂时无法分享");
    }
  };
  const configuredSpecifications = structuredSpecs(product.structuredAttributes).map((item) => [
    item.name,
    `${item.value}${item.unit || ""}`,
  ]);
  const legacySpecifications = String(product.attributes || "")
    .split(/[；;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const separator = item.search(/[:：]/);
      return separator > 0
        ? [item.slice(0, separator), item.slice(separator + 1)]
        : ["规格", item];
    });
  const specifications = configuredSpecifications.length ? configuredSpecifications : legacySpecifications;
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
  return (
    <div className="mobile-app detail-page">
      <header className="sub-header">
        <button onClick={back}>‹</button>
        <h2>商品详情</h2>
        <button onClick={() => void share()}>分享</button>
      </header>
      <div className="detail-image">
        {activeImage ? (
          <img src={activeImage} alt={product.title} />
        ) : (
          <i>暂无商品图片</i>
        )}
        <span>
          {Math.max(1, galleryImages.indexOf(activeImage) + 1)} /{" "}
          {Math.max(1, galleryImages.length)}
        </span>
      </div>
      {galleryImages.length > 1 && (
        <nav className="mobile-gallery-thumbs">
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
      <article className="detail-info">
        <div>
          <strong>
            {money(product.agreementPrice || product.memberPrice)}
          </strong>
          <del>{money(product.marketPrice)}</del>
          <em>企业协议价</em>
        </div>
        <h1>{product.title}</h1>
        <p>{product.summary}</p>
        <small>已售 {product.soldCount || 0} 件</small>
        <section>
          <span>自营正品</span>
          <span>协议专价</span>
          <span>全国配送</span>
        </section>
      </article>
      <article className="info-row">
        <strong>配送</strong>
        <span>{product.deliveryDescription || "自营库存 · 全国配送"}</span>
      </article>
      <article className="detail-copy">
        <h2>商品详情</h2>
        {product.detailHtml ? (
          <div dangerouslySetInnerHTML={{ __html: product.detailHtml }} />
        ) : (
          <p>
            {product.summary ||
              "政企采购平台自营商品，支持企业协议价格、统一对账和多地址配送。"}
          </p>
        )}
        <h2>规格参数</h2>
        <dl className="mobile-specifications">
          <dt>商品编码</dt>
          <dd>{product.skuCode}</dd>
          {specifications.map(([name, value], index) => (
            <React.Fragment key={`${name}-${index}`}>
              <dt>{name}</dt>
              <dd>{value}</dd>
            </React.Fragment>
          ))}
        </dl>
        <h2>配送与售后</h2>
        <h3>配送说明</h3>
        <p>
          {product.deliveryDescription ||
            "自营库存，支持全国配送；具体时效以收货地址和物流信息为准。"}
        </p>
        <h3>售后政策</h3>
        {product.afterSalesHtml ? (
          <div dangerouslySetInnerHTML={{ __html: product.afterSalesHtml }} />
        ) : (
          <p>如有质量问题，请联系企业采购管理员提交售后申请。</p>
        )}
      </article>
      <footer className="buybar">
        <button onClick={toggleFavorite}>{favorite ? "已收藏" : "收藏"}</button>
        <button onClick={() => void add(product)}>加入购物车</button>
        <button onClick={() => void buyNow(product)}>立即采购</button>
      </footer>
    </div>
  );
}
function Cart({
  rows,
  reload,
  checkout,
}: {
  rows: Row[];
  reload: () => Promise<void>;
  checkout: () => void;
}) {
  const selected = rows.filter((r) => Number(r.selected) === 1);
  const total = selected.reduce(
    (n, r) => n + Number(r.salePrice) * r.quantity,
    0,
  );
  const update = async (r: Row, changes: Row) => {
    try {
      await api(`/api/client/cart/${r.id}`, {
        method: "PUT",
        body: JSON.stringify({
          quantity: changes.quantity ?? r.quantity,
          selected: changes.selected ?? r.selected,
        }),
      });
      await reload();
    } catch (e) {
      Toast.show((e as Error).message);
    }
  };
  const remove = async (r: Row) => {
    const ok = await Dialog.confirm({ content: `确认移除“${r.title}”？` });
    if (ok) {
      await api(`/api/client/cart/${r.id}`, { method: "DELETE" });
      await reload();
    }
  };
  return (
    <div className="subpage cart">
      <header>
        <h1>购物车</h1>
        <button>管理</button>
      </header>
      <div className="agreement-tip">✓ 当前商品均已匹配企业协议最优价格</div>
      {rows.map((r) => (
        <article key={r.id}>
          <input
            type="checkbox"
            checked={!!Number(r.selected)}
            onChange={(e) =>
              void update(r, { selected: e.target.checked ? 1 : 0 })
            }
          />
          <i>📦</i>
          <div>
            <strong>{r.title}</strong>
            <span>{r.skuCode}</span>
            <b>{money(r.salePrice)}</b>
            <small>
              <button
                onClick={() =>
                  void update(r, { quantity: Math.max(1, r.quantity - 1) })
                }
              >
                −
              </button>
              {r.quantity}
              <button
                onClick={() => void update(r, { quantity: r.quantity + 1 })}
              >
                ＋
              </button>
            </small>
            <button className="remove" onClick={() => void remove(r)}>
              删除
            </button>
          </div>
        </article>
      ))}
      {!rows.length && (
        <div className="m-empty">
          <i>🛒</i>
          <h2>购物车为空</h2>
          <p>选择协议商品后再来结算</p>
        </div>
      )}
      <footer className="checkout">
        <div>
          <span>合计</span>
          <strong>{money(total)}</strong>
          <small>已选择 {selected.length} 种商品</small>
        </div>
        <button
          disabled={!selected.length}
          onClick={checkout}
        >
          {`结算 (${selected.length})`}
        </button>
      </footer>
    </div>
  );
}

function Checkout({
  rows,
  reload,
  back,
  orders,
}: {
  rows: Row[];
  reload: () => Promise<void>;
  back: () => void;
  orders: () => void;
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
      .catch((error) => Toast.show((error as Error).message));
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
      const donorIndex = items.findIndex((item) => Number(item.quantity) > 1);
      if (!nextAddress || donorIndex < 0) return current;
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
      items[0] = {
        ...items[0],
        quantity: Number(items[0].quantity) + Number(removed.quantity),
      };
      return { ...current, [key]: items };
    });
  const submit = async () => {
    if (!currentAddress) {
      Toast.show("请先在用户中心添加收货地址");
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
      Toast.show(`${invalid.title}的配送数量必须等于购买数量，且地址不能重复`);
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
      await Dialog.alert({
        title: "订单提交成功",
        content: (
          <div className="success-dialog">
            <i>✓</i>
            <p>订单号：{result.orderNo}</p>
            <strong>应付 {money(result.payableAmount)}</strong>
            <small>请按照订单说明完成线下银行转账</small>
          </div>
        ),
        confirmText: "查看订单",
      });
      orders();
    } catch (error) {
      Toast.show((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };
  if (!selected.length)
    return (
      <div className="subpage">
        <header><button onClick={back}>‹</button><h1>确认订单</h1><span /></header>
        <div className="m-empty"><h2>没有待结算商品</h2><button onClick={back}>返回购物车</button></div>
      </div>
    );
  return (
    <div className="subpage mobile-checkout">
      <header><button onClick={back}>‹</button><h1>确认订单</h1><span /></header>
      <section className="mobile-checkout-card">
        <h2>收货信息</h2>
        {currentAddress ? (
          <div className="mobile-checkout-address">
            <strong>{currentAddress.contactName}　{currentAddress.contactPhone}</strong>
            <span>{currentAddress.province}{currentAddress.city}{currentAddress.district}{currentAddress.detail}</span>
          </div>
        ) : (
          <p>尚未设置收货地址，请在“我的—地址管理”中新增地址</p>
        )}
      </section>
      <section className="mobile-checkout-card">
        <h2>商品清单</h2>
        {selected.map((row) => (
          <div className="mobile-checkout-product-block" key={row.id}>
            <article className="mobile-checkout-product">
              {row.mainImage ? <img src={row.mainImage} alt={row.title} /> : <i>📦</i>}
              <span><strong>{row.title}</strong><small>{row.skuCode}　×{row.quantity}</small><b>{money(row.salePrice)}</b></span>
            </article>
            <div className="mobile-delivery-split">
              <header>
                <strong>配送地址分配</strong>
                <button
                  disabled={
                    addresses.length < 2 ||
                    (allocations[String(row.skuId)] || []).length >=
                      Math.min(addresses.length, Number(row.quantity))
                  }
                  onClick={() => addAllocation(row)}
                >
                  ＋ 添加地址
                </button>
              </header>
              {(allocations[String(row.skuId)] || []).map((item, index) => (
                <div className="mobile-delivery-line" key={`${row.skuId}-${index}`}>
                  <select
                    value={item.addressId}
                    onChange={(event) =>
                      changeAllocation(row.skuId, index, {
                        addressId: Number(event.target.value),
                      })
                    }
                  >
                    {addresses.map((addressRow) => (
                      <option key={addressRow.id} value={addressRow.id}>
                        {addressRow.contactName} · {addressRow.city}{addressRow.district}{addressRow.detail}
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
                    <button onClick={() => removeAllocation(row, index)}>删除</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
      <section className="mobile-checkout-card mobile-payment">
        <span><strong>支付方式</strong><small>订单提交后线下完成付款</small></span>
        <b>银行转账</b>
      </section>
      <footer className="mobile-checkout-submit">
        <span>应付 <strong>{money(total)}</strong></span>
        <button disabled={!currentAddress || submitting} onClick={() => void submit()}>
          {submitting ? "提交中…" : "提交订单"}
        </button>
      </footer>
    </div>
  );
}

function Orders() {
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState(-1);
  const [detail, setDetail] = useState<Row>();
  useEffect(() => {
    void api<Row[]>("/api/client/orders").then(setRows);
  }, []);
  const list =
    tab < 0 ? rows : rows.filter((r) => Number(r.orderStatus) === tab);
  const show = async (r: Row) =>
    setDetail(await api<Row>(`/api/client/orders/${r.id}`));
  if (detail)
    return (
      <div className="subpage h5-manage">
        <header>
          <button onClick={() => setDetail(undefined)}>‹</button>
          <h1>订单详情</h1>
          <span />
        </header>
        <section className="h5-order-summary">
          <span>订单号</span>
          <strong>{detail.order.orderNo}</strong>
          <p>
            应付金额 <b>{money(detail.order.payableAmount)}</b>
          </p>
          <p>
            订单状态 <em>{statuses[detail.order.orderStatus]}</em>
          </p>
          {Number(detail.order.refundStatus || 0) === 1 && (
            <p>
              退款状态 <em>已退款 {money(detail.order.refundAmount)}</em>
              <small>{detail.order.refundReason} · {dateTime(detail.order.refundedAt)}</small>
            </p>
          )}
        </section>
        <h3>商品明细</h3>
        {detail.items.map((x: Row) => (
          <article className="h5-manage-row" key={`${x.skuCode}-${x.subOrderNo}`}>
            {x.mainImage ? (
              <img className="h5-order-cover" src={x.mainImage} alt={x.title} />
            ) : (
              <i className="h5-order-placeholder">📦</i>
            )}
            <div>
              <strong>{x.title}</strong>
              <span>
                {x.skuCode} · {x.subOrderNo} · ×{x.quantity}
              </span>
              <address>{deliveryAddress(x.addressSnapshot)}</address>
              <span>
                {["待发货", "已发货", "运输中", "已签收", "已取消"][Number(x.fulfillmentStatus)] || "待发货"}
                {x.logisticsNo
                  ? ` · ${x.logisticsCompany} ${x.logisticsNo}${x.logisticsStatus ? ` · ${x.logisticsStatus}` : ""}`
                  : ""}
              </span>
            </div>
            <b>{money(x.totalPrice)}</b>
          </article>
        ))}
      </div>
    );
  return (
    <div className="subpage orders">
      <header>
        <h1>我的订单</h1>
        <button>⌕</button>
      </header>
      <nav>
        <button className={tab < 0 ? "active" : ""} onClick={() => setTab(-1)}>
          全部
        </button>
        {statuses.slice(0, 4).map((x, i) => (
          <button
            key={x}
            className={tab === i ? "active" : ""}
            onClick={() => setTab(i)}
          >
            {x}
          </button>
        ))}
      </nav>
      {list.map((r) => (
        <article key={r.id}>
          <header>
            <span>{dateTime(r.createdAt)}</span>
            <strong>{statuses[r.orderStatus]}</strong>
          </header>
          <small>订单号 {r.orderNo}</small>
          <div>
            {r.mainImage ? (
              <img className="h5-order-cover" src={r.mainImage} alt="订单商品" />
            ) : (
              <i>📦</i>
            )}
            <span>
              <strong>
                {r.itemKinds} 种商品，共 {r.itemCount} 件
              </strong>
              <small>企业协议采购 · 银行转账</small>
            </span>
            <b>{money(r.payableAmount)}</b>
          </div>
          <footer>
            <span>
              {r.orderStatus === 0 ? "请在48小时内完成转账" : "订单正在处理中"}
            </span>
            <button onClick={() => void show(r)}>查看详情</button>
          </footer>
        </article>
      ))}
    </div>
  );
}
function Mine({
  profile,
  orders,
  logout,
}: {
  profile: Row;
  orders: () => void;
  logout: () => Promise<void>;
}) {
  const [view, setView] = useState<"addresses" | "invoices" | "members">();
  if (view) return <H5Manage view={view} back={() => setView(undefined)} />;
  return (
    <div className="mine">
      <section className="mine-hero">
        <div>
          <i>鲁</i>
          <span>
            <strong>{profile.enterpriseName || "山东高速数字科技"}</strong>
            <small>
              {profile.realName || "张经理"} ·{" "}
              {profile.roleCode === "ENTERPRISE_ADMIN"
                ? "企业管理员"
                : "采购员"}
            </small>
          </span>
          <button onClick={() => setView("members")}>›</button>
        </div>
        <article>
          <span>
            <strong>{profile.username}</strong>
            <small>登录账号</small>
          </span>
          <span>
            <strong>{profile.phone}</strong>
            <small>手机号码</small>
          </span>
        </article>
      </section>
      <section className="mine-orders">
        <header>
          <strong>我的订单</strong>
          <button onClick={orders}>全部订单 ›</button>
        </header>
        <div>
          {[
            ["付", "待付款"],
            ["货", "待发货"],
            ["运", "运输中"],
            ["完", "已完成"],
          ].map((x) => (
            <button key={x[1]} onClick={orders}>
              <i>{x[0]}</i>
              <span>{x[1]}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="agreement-card">
        <span>● 协议生效中</span>
        <strong>{profile.agreementName || "暂无生效协议"}</strong>
        <small>
          {profile.agreementExpiry
            ? `有效期至 ${profile.agreementExpiry}`
            : "请联系企业管理员配置协议"}
        </small>
      </section>
      <section className="mine-menu">
        {[
          ["址", "地址管理", "维护多地址配送信息", "addresses"],
          ["票", "发票管理", "查看第三方开票记录", "invoices"],
          ["员", "企业成员", "查看成员和账号状态", "members"],
        ].map((x) => (
          <button
            key={x[1]}
            onClick={() =>
              setView(x[3] as "addresses" | "invoices" | "members")
            }
          >
            <i>{x[0]}</i>
            <span>
              <strong>{x[1]}</strong>
              <small>{x[2]}</small>
            </span>
            <em>›</em>
          </button>
        ))}
        <button className="logout-row" onClick={() => void logout()}>
          <i>退</i>
          <span>
            <strong>退出登录</strong>
            <small>安全退出当前采购账号</small>
          </span>
          <em>›</em>
        </button>
      </section>
    </div>
  );
}
function H5Manage({
  view,
  back,
}: {
  view: "addresses" | "invoices" | "members";
  back: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [editing, setEditing] = useState<Row>();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Row>({});
  const title =
    view === "addresses"
      ? "地址管理"
      : view === "invoices"
        ? "发票管理"
        : "企业成员";
  const load = () => api<Row[]>(`/api/client/${view}`).then(setRows);
  useEffect(() => {
    void load();
  }, [view]);
  const show = (r?: Row) => {
    setEditing(r);
    setForm(
      r
        ? { ...r }
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
      Toast.show("请完整填写必填信息");
      return;
    }
    if (!/^1\d{10}$/.test(String(form.contactPhone || form.phone))) {
      Toast.show("请输入11位手机号码");
      return;
    }
    try {
      await api(`/api/client/${view}${editing ? `/${editing.id}` : ""}`, {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      setOpen(false);
      await load();
      Toast.show({ icon: "success", content: "保存成功" });
    } catch (e) {
      Toast.show((e as Error).message);
    }
  };
  const remove = async (r: Row) => {
    if (await Dialog.confirm({ content: "确认删除这条记录？" })) {
      try {
        await api(`/api/client/${view}/${r.id}`, { method: "DELETE" });
        await load();
      } catch (e) {
        Toast.show((e as Error).message);
      }
    }
  };
  return (
    <div className="subpage h5-manage">
      <header>
        <button onClick={back}>‹</button>
        <h1>{title}</h1>
        {view !== "invoices" ? (
          <button onClick={() => show()}>添加</button>
        ) : (
          <span />
        )}
      </header>
      {rows.map((r) => (
        <article className="h5-manage-row" key={r.id}>
          <div>
            <strong>
              {view === "addresses"
                ? r.contactName
                : view === "invoices"
                  ? r.invoiceType
                  : r.realName}
            </strong>
            <span>
              {view === "addresses"
                ? `${r.contactPhone} · ${r.province}${r.city}${r.district}${r.detail}`
                : view === "invoices"
                  ? `${r.orderNo} · ${money(r.amount)} · ${["待处理", "处理中", "已开具", "失败"][r.status]}`
                  : `${r.phone} · ${r.roleCode === "ENTERPRISE_ADMIN" ? "企业管理员" : "采购员"} · ${Number(r.status) === 1 ? "启用" : "停用"}`}
            </span>
          </div>
          {view !== "invoices" && (
            <p>
              <button onClick={() => show(r)}>编辑</button>
              <button onClick={() => void remove(r)}>删除</button>
            </p>
          )}
        </article>
      ))}
      {open && (
        <div className="h5-form">
          <header>
            <button onClick={() => setOpen(false)}>取消</button>
            <strong>
              {editing ? "编辑" : "新增"}
              {view === "addresses" ? "地址" : "成员"}
            </strong>
            <button onClick={() => void save()}>保存</button>
          </header>
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
              <label>
                默认地址
                <select
                  value={Number(form.isDefault || 0)}
                  onChange={(e) =>
                    setForm({ ...form, isDefault: Number(e.target.value) })
                  }
                >
                  <option value={0}>否</option>
                  <option value={1}>是</option>
                </select>
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
                    disabled={!!editing && x[0] === "username"}
                    value={form[x[0]] || ""}
                    onChange={(e) =>
                      setForm({ ...form, [x[0]]: e.target.value })
                    }
                  />
                </label>
              ))}
              <label>
                企业角色
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
                账号状态
                <select
                  value={Number(form.status ?? 1)}
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
        </div>
      )}
    </div>
  );
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
