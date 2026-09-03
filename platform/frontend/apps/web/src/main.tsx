import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import "./style.css";
import "./manage.css";
import "./auth.css";
import "./categories.css";
import "./service.css";
import "./notification.css";
import "./frequent.css";
import "./purchase-workbench.css";
import { OrganizationPage } from "./Organization";
import { FinancePage } from "./Finance";
import { AfterSalesPage } from "./AfterSales";
import { NotificationsPage } from "./Notifications";
import { FrequentPurchasePage } from "./FrequentPurchase";
import { PurchaseWorkbench } from "./PurchaseWorkbench";

type View =
  | "home"
  | "products"
  | "agreement-products"
  | "solutions"
  | "solution-detail"
  | "platforms"
  | "platform-products"
  | "content"
  | "article-detail"
  | "detail"
  | "cart"
  | "checkout"
  | "orders"
  | "profile"
  | "addresses"
  | "invoices"
  | "members"
  | "finance"
  | "after-sales"
  | "notifications"
  | "frequent"
  | "purchase-workbench"
  | "organization";
export type Row = Record<string, any>;
const structuredSpecs = (value: unknown): Row[] => {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value || "[]") : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};
const productServices=(value:unknown):string[]=>{try{const parsed=typeof value==="string"?JSON.parse(value||"[]"):value;return Array.isArray(parsed)?parsed.map(String):[];}catch{return [];}};
const isAgreementProduct = (product: Row) => {
  if (product.agreementPrice != null) return true;
  try {
    const variants=typeof product.variants==="string"?JSON.parse(product.variants||"[]"):product.variants;
    return Array.isArray(variants)&&variants.some((variant:Row)=>variant.agreementPrice!=null);
  } catch { return false; }
};
const productBadgeLabel = (product: Row) => {
  const badgeType=String(product.badgeType||"").toUpperCase();
  if (badgeType === "CUSTOM") return String(product.customBadge||"").trim();
  if (badgeType === "PLATFORM") {
    const prefix=String(product.badgePlatformPrefix||"").trim();
    return prefix ? (prefix.endsWith("平台") ? prefix : `${prefix}平台`) : "";
  }
  if ((badgeType === "AGREEMENT" || badgeType === "NONE" || !badgeType) && isAgreementProduct(product)) return "协议专属";
  return "";
};
const money = (value: any) =>
  `¥${Number(value || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const productPrice = (row: Row) => row.agreementPrice != null ? row.agreementPrice : row.marketPrice;
const customerPrice = (row: Row, loggedIn: boolean) => !loggedIn ? row.marketPrice : row.agreementPrice != null ? row.agreementPrice : row.memberPrice ?? row.marketPrice;
const productPlatformPrices = (value: unknown): Row[] => {
  try {
    const rows = Array.isArray(value) ? value : JSON.parse(String(value || "[]"));
    const byPlatform = new Map<number, Row>();
    (Array.isArray(rows) ? rows : []).forEach((row: Row) => {
      const id = Number(row.platformId); const current = byPlatform.get(id);
      if (!current || Number(row.platformPrice) < Number(current.platformPrice)) byPlatform.set(id, row);
    });
    return [...byPlatform.values()].sort((a,b)=>Number(a.sortOrder||0)-Number(b.sortOrder||0)||Number(a.platformId)-Number(b.platformId));
  } catch { return []; }
};
const productStockLabel = (value: unknown) => {
  const stock=Math.max(0,Number(value||0));
  return stock>100 ? "库存充足" : stock>0 ? `仅剩 ${stock} 件` : "暂时缺货";
};
const copyText = async (text: string) => {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const area=document.createElement("textarea"); area.value=text; area.style.position="fixed"; area.style.opacity="0";
  document.body.appendChild(area); area.select(); document.execCommand("copy"); area.remove();
};
const sharePage = async (title: string, text: string, notify: (value:string)=>void) => {
  try { if (navigator.share) await navigator.share({title,text,url:location.href}); else { await copyText(`${text} ${location.href}`); notify("分享链接已复制"); } }
  catch(error){ if((error as Error).name!=="AbortError") notify("分享失败，请稍后重试"); }
};
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
  "agreement-products",
  "detail",
  "solutions",
  "solution-detail",
  "platforms",
  "platform-products",
  "content",
  "article-detail",
  "cart",
  "checkout",
  "orders",
  "profile",
  "addresses",
  "invoices",
  "members",
  "finance",
  "after-sales",
  "notifications",
  "frequent",
  "purchase-workbench",
  "organization",
];
const protectedViews = new Set<View>([
  "agreement-products",
  "cart",
  "checkout",
  "orders",
  "profile",
  "addresses",
  "invoices",
  "members",
  "finance",
  "after-sales",
  "notifications",
  "frequent",
  "purchase-workbench",
  "organization",
]);
const parseRoute = (url = new URL(location.href)) => {
  const path = url.pathname.replace(/\/$/, "") || "/web";
  const product = path.match(/^\/web\/products\/(\d+)$/);
  const solution = path.match(/^\/web\/solutions\/(\d+)$/);
  const platform = path.match(/^\/web\/platforms\/(\d+)\/products$/);
  const article = path.match(/^\/web\/articles\/(\d+)$/);
  const route: Record<string, View> = {
    "/web": "home", "/web/products": "products", "/web/agreement-products": "agreement-products", "/web/solutions": "solutions",
    "/web/platforms": "platforms", "/web/content": "content", "/web/cart": "cart",
    "/web/checkout": "checkout", "/web/orders": "orders", "/web/account": "profile",
    "/web/account/addresses": "addresses", "/web/account/invoices": "invoices",
    "/web/account/members": "members",
    "/web/account/finance": "finance",
    "/web/account/after-sales": "after-sales",
    "/web/account/notifications": "notifications",
    "/web/account/frequent": "frequent",
    "/web/purchase-workbench": "purchase-workbench",
    "/web/account/organization": "organization",
  };
  const legacy = url.searchParams.get("view") as View | null;
  return {
    view: product ? "detail" as View : solution ? "solution-detail" as View
      : platform ? "platform-products" as View
        : article ? "article-detail" as View
        : legacy && routeViews.includes(legacy) ? legacy
          : route[path] || "home",
    categoryId: Number(url.searchParams.get("categoryId")) || undefined,
    platformId: platform ? Number(platform[1]) : Number(url.searchParams.get("platformId")) || undefined,
    solutionId: solution ? Number(solution[1]) : Number(url.searchParams.get("solutionId")) || undefined,
    productId: product ? Number(product[1]) : Number(url.searchParams.get("productId")) || undefined,
    articleId: article ? Number(article[1]) : undefined,
  };
};
const routeFromLocation = () => parseRoute().view;
const pathFor = (view: View, platformId?: number, solutionId?: number, productId?: number, articleId?: number) => {
  if (view === "detail" && productId) return `/web/products/${productId}`;
  if (view === "solution-detail" && solutionId) return `/web/solutions/${solutionId}`;
  if (view === "platform-products" && platformId) return `/web/platforms/${platformId}/products`;
  if (view === "article-detail" && articleId) return `/web/articles/${articleId}`;
  return ({ home: "/web/", products: "/web/products", "agreement-products": "/web/agreement-products", solutions: "/web/solutions",
    platforms: "/web/platforms", content: "/web/content", cart: "/web/cart",
    checkout: "/web/checkout", orders: "/web/orders", profile: "/web/account",
    addresses: "/web/account/addresses", invoices: "/web/account/invoices",
    members: "/web/account/members", finance: "/web/account/finance", "after-sales": "/web/account/after-sales", notifications: "/web/account/notifications", frequent: "/web/account/frequent", "purchase-workbench":"/web/purchase-workbench", organization: "/web/account/organization" } as Partial<Record<View, string>>)[view] || "/web/";
};

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const requestUrl = new URL(path, window.location.origin).toString();
  const response = await fetch(requestUrl, {
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
    return parseRoute().categoryId;
  });
  const [platformId, setPlatformId] = useState<number | undefined>(() => {
    return parseRoute().platformId;
  });
  const [solutionId, setSolutionId] = useState<number | undefined>(() => {
    return parseRoute().solutionId;
  });
  const [articleId, setArticleId] = useState<number | undefined>(() => parseRoute().articleId);
  const [profile, setProfile] = useState<Row>({});
  const [summary, setSummary] = useState<Row>({});
  const [cart, setCart] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row>();
  const [searchKeyword, setSearchKeyword] = useState(
    () => new URLSearchParams(location.search).get("q") || "",
  );
  const [toast, setToast] = useState("");
  const [current, setCurrent] = useState<Row>();
  const [authReady, setAuthReady] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const pendingAction = useRef<undefined | (() => void)>(undefined);
  const [siteConfig, setSiteConfig] = useState<Row>({});
  const siteName = siteConfig["platform.name"] || "政企采购供应链";
  const siteLogo = String(siteConfig["platform.logo"] || "").trim();
  const englishName = String(siteConfig["platform.englishName"] || "SUPPLY CHAIN").trim();
  const siteSlogan = String(siteConfig["platform.slogan"] || "自营正品 · 全国配送").trim();
  const contactLandline = String(siteConfig["contact.landline"] || "").trim();
  const icpFiling = String(siteConfig["platform.icpFiling"] || "").trim();
  const policeFiling = String(siteConfig["platform.policeFiling"] || "").trim();
  const telecomLicense = String(siteConfig["platform.telecomLicense"] || "鲁B2-20210548").trim();
  const footerAbout = String(siteConfig["footer.about"] || "").trim();
  const footerAddress = String(siteConfig["footer.address"] || "").trim();
  const footerAboutTitle = String(siteConfig["footer.aboutTitle"] || "关于壹采").trim();
  const footerOfficialTitle = String(siteConfig["footer.officialTitle"] || "官方平台").trim();
  const footerServiceTitle = String(siteConfig["footer.serviceTitle"] || "我们的服务").trim();
  const footerContactTitle = String(siteConfig["footer.contactTitle"] || "联系我们").trim();
  const copyrightYears = String(siteConfig["footer.copyrightYears"] || "2023-2025").trim();
  const companyName = String(siteConfig["footer.companyName"] || "山东壹知产数字科技有限公司").trim();
  useEffect(()=>{
    const title=String(siteConfig["seo.title"]||siteName),description=String(siteConfig["seo.description"]||""),keywords=[siteConfig["seo.keywords"],siteConfig["seo.geoKeywords"]].filter(Boolean).join(",");
    document.title=title;
    const meta=(name:string,value:string)=>{let node=document.head.querySelector(`meta[name="${name}"]`) as HTMLMetaElement|null;if(!node){node=document.createElement("meta");node.name=name;document.head.appendChild(node)}node.content=value};
    meta("description",description);meta("keywords",keywords);meta("robots","index,follow,max-image-preview:large");
    let schema=document.getElementById("seo-schema");if(!schema){schema=document.createElement("script");schema.id="seo-schema";(schema as HTMLScriptElement).type="application/ld+json";document.head.appendChild(schema)}schema.textContent=JSON.stringify({"@context":"https://schema.org","@type":"Organization",name:siteConfig["seo.organizationName"]||companyName,url:location.origin+"/web/",description,areaServed:"中国山东省"});
  },[siteConfig,siteName,companyName]);
  const notify = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(""), 2200);
  };
  const loadProducts = () => api<Row[]>("/api/public/catalog/products").then(setProducts);
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
    await loadProducts();
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
    void loadProducts();
    void loadAccount()
      .catch(() => {})
      .finally(() => setAuthReady(true));
  }, []);
  useEffect(() => {
    if (authReady && !current && protectedViews.has(view)) setAuthOpen(true);
  }, [authReady, current, view]);
  useEffect(() => {
    const pop = () => {
      const route = parseRoute();
      setView(route.view);
      setCategoryId(route.categoryId);
      setPlatformId(route.platformId);
      setSolutionId(route.solutionId);
      setArticleId(route.articleId);
      setSearchKeyword(new URLSearchParams(location.search).get("q") || "");
      setSelected(undefined);
    };
    addEventListener("popstate", pop);
    return () => removeEventListener("popstate", pop);
  }, []);
  const applyNavigation = (
    target: View,
    nextCategory?: number,
    nextPlatform?: number,
    nextSolution?: number,
    nextProduct?: number,
    nextArticle?: number,
  ) => {
    setView(target);
    setCategoryId(nextCategory);
    setPlatformId(nextPlatform);
    setSolutionId(nextSolution);
    setArticleId(nextArticle);
    if (target === "detail" && nextProduct) {
      setSelected(products.find((row) => Number(row.id) === nextProduct));
    }
    const url = new URL(location.href);
    url.pathname = pathFor(target, nextPlatform, nextSolution, nextProduct, nextArticle);
    url.searchParams.delete("view");
    if (nextCategory) url.searchParams.set("categoryId", String(nextCategory));
    else url.searchParams.delete("categoryId");
    if (target !== "products") url.searchParams.delete("q");
    url.searchParams.delete("platformId");
    url.searchParams.delete("solutionId");
    url.searchParams.delete("productId");
    history.pushState({ view: target }, "", url);
  };
  const navigate = (
    target: View,
    nextCategory?: number,
    nextPlatform?: number,
    nextSolution?: number,
    nextProduct?: number,
    nextArticle?: number,
  ) => {
    if (protectedViews.has(target) && !current) {
      requireAuth(() => applyNavigation(target, nextCategory, nextPlatform, nextSolution, nextProduct, nextArticle));
      return;
    }
    applyNavigation(target, nextCategory, nextPlatform, nextSolution, nextProduct, nextArticle);
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
    const configured = item.linkUrl
      ? new URL(item.linkUrl, location.origin)
      : null;
    if (configured && configured.origin !== location.origin) {
      location.href = configured.href;
      return;
    }
    const configuredRoute = configured ? parseRoute(configured) : null;
    navigate(
      configuredRoute ? configuredRoute.view : fallback,
      configuredRoute?.categoryId,
      configuredRoute?.platformId,
      configuredRoute?.solutionId,
      configuredRoute?.productId,
      configuredRoute?.articleId,
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
    applyNavigation("detail", undefined, undefined, undefined, Number(product.id));
    setSelected(product);
    scrollTo(0, 0);
  };
  useEffect(() => {
    if (view !== "detail" || selected) return;
    const id = parseRoute().productId;
    const product = products.find((row) => Number(row.id) === id);
    if (product) setSelected(product);
  }, [products, selected, view]);
  const search = () => {
    const keyword = searchKeyword.trim();
    const url = new URL(location.href);
    url.pathname = "/web/products";
    url.searchParams.delete("view");
    if (keyword) url.searchParams.set("q", keyword);
    else url.searchParams.delete("q");
    url.searchParams.delete("categoryId");
    history.pushState({ view: "products" }, "", url);
    setCategoryId(undefined);
    setView("products");
  };
  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    setCurrent(undefined);
    setProfile({});
    setCart([]);
    void loadProducts();
    navigate("home");
  };
  const hasAgreement = Boolean(current && profile.agreementName);
  const displayView = !current && protectedViews.has(view) ? "home" : view;
  useEffect(() => {
    if (!authReady || view !== "agreement-products" || !current || hasAgreement) return;
    applyNavigation("products");
    notify("当前账号暂无生效协议，已为您展示全部商品");
  }, [authReady, view, current, hasAgreement]);
  const visibleNavigation = (portal.navigation || [
    { title: "首页" },
    { title: "办公集采" },
    { title: "场景方案" },
    { title: "平台比价" },
  ]).filter((item: Row) => {
    if (!item.linkUrl) return true;
    const configured = new URL(item.linkUrl, location.origin);
    return configured.pathname.replace(/\/$/, "") !== "/web/agreement-products" || hasAgreement;
  });
  if (!authReady)
    return <div className="auth-loading">正在加载企业采购平台…</div>;
  return (
    <div className="shop">
      <div className="topbar">
        <span>{siteName} · {siteSlogan}</span>
        <div>
          {current ? (
            <>
              <button onClick={() => navigate("orders")}>我的订单</button>
              <button onClick={() => navigate("purchase-workbench")}>批量采购</button>
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
        <button className="logo" onClick={() => navigate("home")}>
          {siteLogo?<img src={siteLogo} alt={`${siteName} Logo`}/>:<i>政</i>}
          <span>
            <strong>{siteName}</strong>
            <small>{englishName}</small>
          </span>
        </button>
        <label className="search">
          ⌕<input value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") search(); }}
            placeholder="搜索商品、品牌、型号或方案" />
          <button onClick={search}>搜索</button>
        </label>
        <button className="cart-button" onClick={() => navigate("cart")}>
          购物车 <b>{cart.reduce((n, r) => n + Number(r.quantity), 0)}</b>
        </button>
      </header>
      <nav className="nav">
        {visibleNavigation.map((item: Row, index: number) => {
          const fallback: View =
            index === 0
              ? "home"
              : item.title.includes("方案")
                ? "solutions"
                : item.title.includes("平台")
                  ? "platforms"
                  : "products";
          const configuredUrl = item.linkUrl
            ? new URL(item.linkUrl, location.origin)
            : null;
          const configuredRoute = configuredUrl
            ? parseRoute(configuredUrl)
            : null;
          const target =
            configuredRoute && routeViews.includes(configuredRoute.view)
              ? configuredRoute.view
              : fallback;
          const matchesCurrentRoute = (candidate: ReturnType<typeof parseRoute>) =>
            displayView === candidate.view &&
            (candidate.view !== "products" ||
              (candidate.categoryId ?? null) === (categoryId ?? null)) &&
            (candidate.view !== "platform-products" ||
              (candidate.platformId ?? null) === (platformId ?? null)) &&
            (candidate.view !== "solution-detail" ||
              (candidate.solutionId ?? null) === (solutionId ?? null)) &&
            (candidate.view !== "detail" ||
              (candidate.productId ?? null) === (selected?.id ?? null));
          const hasConfiguredMatch = (portal.navigation || []).some((row: Row) => {
            if (!row.linkUrl) return false;
            const candidateUrl = new URL(row.linkUrl, location.origin);
            return candidateUrl.origin === location.origin &&
              matchesCurrentRoute(parseRoute(candidateUrl));
          });
          const active = configuredRoute
            ? configuredUrl?.origin === location.origin &&
              matchesCurrentRoute(configuredRoute)
            : displayView === fallback && !hasConfiguredMatch;
          return (
            <button
              key={item.id || item.title}
              className={active ? "active" : ""}
              onClick={() => openNavigation(item, index)}
            >
              {item.title}
            </button>
          );
        })}
        <span>{hasAgreement ? "企业协议已生效" : current ? "企业采购账号" : "游客浏览"}</span>
      </nav>
      {displayView === "home" && (
        <Home
          products={products}
          categories={categories}
          portal={portal}
          open={goProduct}
          add={add}
          all={(id?: number) => navigate("products", id)}
          hasAgreement={hasAgreement}
          loggedIn={Boolean(current)}
        />
      )}
      {(displayView === "products" || displayView === "agreement-products") && (
        <Products
          products={products}
          categories={categories}
          solutions={portal.solution || []}
          initialCategory={categoryId}
          initialKeyword={searchKeyword}
          routeChanged={(nextCategory,keyword) => {
            setCategoryId(nextCategory);
            setSearchKeyword(keyword);
            const url=new URL(location.href);
            if(nextCategory) url.searchParams.set("categoryId",String(nextCategory));
            else url.searchParams.delete("categoryId");
            if(keyword) url.searchParams.set("q",keyword); else url.searchParams.delete("q");
            history.replaceState({view:"products"},"",url);
          }}
          open={goProduct}
          add={add}
          hasAgreement={hasAgreement}
          loggedIn={Boolean(current)}
          forceAgreement={displayView === "agreement-products"}
          openSolution={(id) => applyNavigation("solution-detail", undefined, undefined, id)}
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
      {displayView === "article-detail" && articleId && (
        <ArticleDetail
          article={(portal.content || []).find((row: Row) => Number(row.id) === articleId)}
          back={() => navigate("content")}
        />
      )}
      {displayView === "platform-products" && platformId && (
        <PlatformProducts platformId={platformId} open={goProduct} add={add} loggedIn={Boolean(current)} />
      )}
      {displayView === "detail" && selected && (
        <Detail
          product={selected}
          back={() => setView("products")}
          add={add}
          buyNow={buyNow}
          loggedIn={Boolean(current)}
          notify={notify}
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
      {displayView === "organization" && <OrganizationPage go={(target)=>setView(target as View)} />}
      {displayView === "finance" && <FinancePage go={(target)=>setView(target as View)} />}
      {displayView === "after-sales" && <AfterSalesPage go={(target)=>setView(target as View)} />}
      {displayView === "notifications" && <NotificationsPage go={(target)=>setView(target as View)} />}
      {displayView === "frequent" && <FrequentPurchasePage go={(target)=>setView(target as View)} cart={loadCart} />}
      {displayView === "purchase-workbench" && <PurchaseWorkbench go={(target)=>navigate(target as View)} reloadCart={loadCart} />}
      <footer className="footer">
        <section className="footer-services">
          {(portal.serviceFeatures || []).map((row: Row, index: number) => <article key={row.id || row.title}>
            {row.imageUrl ? <img src={row.imageUrl} alt=""/> : <FooterServiceIcon index={index}/>}<div><strong>{row.title}</strong><span>{row.subtitle}</span></div>
          </article>)}
        </section>
        <section className="footer-main">
          <div className="footer-brand">
            <h3>{footerAboutTitle}</h3>
            <p>{footerAbout}</p>
          </div>
          <nav className="footer-column-links">
            <h3>{footerOfficialTitle}</h3>
            {(portal.footerLinks || []).filter((row:Row)=>row.linkGroup==="OFFICIAL").map((row:Row)=><a key={row.id} href={row.linkUrl} target={row.openTarget==="BLANK"?"_blank":undefined} rel={row.openTarget==="BLANK"?"noreferrer":undefined}>{row.title}</a>)}
          </nav>
          <nav className="footer-column-links">
            <h3>{footerServiceTitle}</h3>
            {(portal.footerLinks || []).filter((row:Row)=>row.linkGroup==="SERVICE").map((row:Row)=><a key={row.id} href={row.linkUrl} target={row.openTarget==="BLANK"?"_blank":undefined} rel={row.openTarget==="BLANK"?"noreferrer":undefined}>{row.title}</a>)}
          </nav>
          <div className="footer-contact">
            <h3>{footerContactTitle}</h3>
            <p>电话：{contactLandline}</p>
            <p>邮箱：<a href={`mailto:${String(siteConfig["contact.email"] || "")}`}>{String(siteConfig["contact.email"] || "")}</a></p>
            <p>地址：{footerAddress}</p>
          </div>
          <div className="footer-copyright">© {copyrightYears} {companyName} 版权所有 | <a href="https://beian.miit.gov.cn/#/Integrated/recordQuery" target="_blank" rel="noreferrer">{icpFiling}</a> | 电信增值业务许可证：{telecomLicense} | <a href="https://beian.mps.gov.cn/#/query/webSearch" target="_blank" rel="noreferrer">{policeFiling}</a></div>
        </section>
      </footer>
      <FloatingContact config={siteConfig}/>
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

function FloatingContact({ config }: { config: Row }) {
  const [expanded, setExpanded] = useState(true);
  const landline = String(config["contact.landline"] || "0531-86099058").trim();
  const mobile = String(config["contact.mobile"] || "13105315957").trim();
  const wechatQr = String(config["contact.wechatQr"] || "https://qlyc.co/image/wx.png").trim();
  const email = String(config["contact.email"] || "Wangyunlei@yizhichan.co").trim();
  if (!expanded) return <button className="floating-contact-expand" onClick={() => setExpanded(true)} aria-label="展开联系方式">‹</button>;
  return (
    <aside className="floating-contact" aria-label="联系方式">
      <button className="floating-contact-collapse" onClick={() => setExpanded(false)} aria-label="收起联系方式">›</button>
      <a href={`tel:${landline.replace(/[^\d+-]/g, "")}`}><ContactIcon type="phone"/><strong>{landline}</strong><small>咨询热线</small></a>
      <a href={`tel:${mobile.replace(/[^\d+]/g, "")}`}><ContactIcon type="mobile"/><strong>{mobile}</strong><small>手机</small></a>
      <div className="floating-contact-wechat" tabIndex={0}><ContactIcon type="wechat"/><strong>微信咨询</strong><small>扫码添加</small>
        <div className="floating-contact-qr"><img src={wechatQr} alt="微信二维码"/><span>扫码添加微信<br/>获取更多信息</span></div>
      </div>
      <a href={`mailto:${email}`}><ContactIcon type="email"/><strong>邮箱</strong><small>联系我们</small></a>
    </aside>
  );
}

function ContactIcon({ type }: { type: "phone" | "mobile" | "wechat" | "email" }) {
  const paths = {
    phone: <path d="M7 3 4.8 5.2c-.5.5-.5 1.3-.2 2 2.5 5.5 6.7 9.7 12.2 12.2.7.3 1.5.3 2-.2L21 17l-4.3-3-2 2c-2.8-1.5-5.2-3.9-6.7-6.7l2-2L7 3Z"/>,
    mobile: <><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M10 18h4"/></>,
    wechat: <><ellipse cx="9" cy="10" rx="6" ry="5"/><ellipse cx="16" cy="15" rx="5" ry="4"/><path d="m5 14-1 3 3-2m12 3 1 2-3-1"/></>,
    email: <><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="m3 7 9 7 9-7"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[type]}</svg>;
}

function PoliceFilingIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path fill="#2b65ad" d="M10 1.2c2.1 1.5 4.2 2.1 6.7 2.3v5.4c0 4.4-2.8 7.7-6.7 9.9-3.9-2.2-6.7-5.5-6.7-9.9V3.5C5.8 3.3 7.9 2.7 10 1.2Z"/><circle cx="10" cy="8.8" r="4.6" fill="#d63832"/><path fill="#ffd34f" d="m10 5 1 2.1 2.3.3-1.7 1.7.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.7L9 7.1Z"/><path fill="none" stroke="#f5c34b" strokeWidth=".8" d="M6.2 12.7c1.2 1 2.4 1.5 3.8 2.3 1.4-.8 2.6-1.3 3.8-2.3"/></svg>;
}

function FooterServiceIcon({ index }: { index: number }) {
  const paths = [
    <><path d="M12 3 5 6v5c0 4.8 2.7 8.1 7 10 4.3-1.9 7-5.2 7-10V6l-7-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></>,
    <><circle cx="12" cy="8" r="4"/><path d="M5 21c.7-4.2 3-6.3 7-6.3s6.3 2.1 7 6.3M18 8h3v7h-3"/></>,
    <><path d="M4 13a8 8 0 0 1 16 0M4 13v5h3v-6H4m16 1v5h-3v-6h3M9 20h6"/></>,
    <><path d="m3 12 4-3 4 3 3-2 7 4-5 6-5-3-3 2-5-4Z"/><path d="m8 11 3 2 3-2m-6 4 3 2"/></>,
  ];
  return <svg className="footer-service-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[index % paths.length]}</svg>;
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
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    setError("");
    setNotice("");
    const required =
      mode === "login"
        ? ["username", "password"]
        : ["enterpriseName", "creditCode", "username", "password", "realName", "phone"];
    if (required.some((key) => !String(form[key] || "").trim())) {
      setError("请完整填写必填信息");
      return;
    }
    if (mode === "register" && !/^1\d{10}$/.test(String(form.phone))) {
      setError("请输入11位手机号码");
      return;
    }
    if (mode === "register" && !/^[0-9A-Z]{18}$/.test(String(form.creditCode || "").trim().toUpperCase())) {
      setError("请输入正确的18位统一社会信用代码");
      return;
    }
    setSubmitting(true);
    try {
      const result = (await api(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(form),
      })) as Row;
      if (mode === "register" && result.pendingApproval) {
        setNotice(String(result.message || "注册申请已提交，请等待管理员启用"));
        setMode("login");
        setForm({ enterpriseName: "", username: form.username || "" });
        return;
      }
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
        <p>自营库存、多地址配送和统一订单管理。</p>
        <div>
          <b>✓</b> 商品价格清晰透明
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
        <h2>{mode === "login" ? "欢迎登录" : "创建企业账号"}</h2>
        <p>
          {mode === "login"
            ? "登录后进入企业采购中心"
            : "企业不存在时将自动创建，首个账号为企业主账号"}
        </p>
        {mode === "register" && (
          <>
            <label>
              所属企业
              <input value={form.enterpriseName || ""} onChange={(e) => setForm({ ...form, enterpriseName: e.target.value })} placeholder="请输入所属企业全称" />
            </label>
            <label>
              统一社会信用代码
              <input value={form.creditCode || ""} maxLength={18} autoCapitalize="characters"
                onChange={(e) => setForm({ ...form, creditCode: e.target.value.toUpperCase() })}
                placeholder="请输入18位统一社会信用代码" />
            </label>
          </>
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
        {notice && <div className="auth-notice">{notice}</div>}
        <button
          className="auth-submit"
          disabled={submitting}
          onClick={() => void submit()}
        >
          {submitting
            ? "正在提交…"
            : mode === "login"
              ? "登录企业采购平台"
              : "提交注册申请"}
        </button>
      </section>
    </main>
  );
}

function categoryTreeIds(categories: Row[], rootId: number) {
  const ids = new Set<number>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    categories.forEach((row) => {
      if (ids.has(Number(row.parentId)) && !ids.has(Number(row.id))) { ids.add(Number(row.id)); changed = true; }
    });
  }
  return ids;
}
function floorProducts(floor: Row, products: Row[], categories: Row[], portal: Row, hasAgreement: boolean) {
  let rows = [...products];
  const rule = String(floor.selectionRule || "LATEST");
  const ids = String(floor.contentIds || "").split(",").map(Number).filter(Boolean);
  if (rule === "MANUAL") rows = ids.map((id) => rows.find((row) => Number(row.skuId) === id)).filter(Boolean) as Row[];
  if (rule === "AGREEMENT") rows = hasAgreement ? rows.filter((row) => row.agreementPrice != null) : [];
  if (rule === "CATEGORY") {
    const categoryIds = categoryTreeIds(categories, Number(floor.referenceId));
    rows = rows.filter((row) => categoryIds.has(Number(row.categoryId)));
  }
  if (rule === "BRAND") rows = rows.filter((row) => Number(row.brandId) === Number(floor.referenceId));
  if (rule === "PLATFORM") {
    const platform = (portal.platform || []).find((row: Row) => Number(row.id) === Number(floor.referenceId));
    rows = rows.filter((row) => platform && String(row.platformNames || "").split("、").includes(platform.title));
  }
  if (rule === "SALES") rows.sort((a,b) => Number(b.soldCount||0)-Number(a.soldCount||0));
  if (rule === "VIEWS") rows.sort((a,b) => Number(b.clickCount||0)-Number(a.clickCount||0));
  if (rule === "LATEST") rows.sort((a,b) => Number(b.id)-Number(a.id));
  return rows.slice(0, Number(floor.displayCount || 4));
}

const adGroupItems=(value:unknown):Row[]=>{try{return Array.isArray(value)?value:JSON.parse(String(value||"[]"));}catch{return [];}};
function HomeAdGroup({group}:{group:Row}){const items=adGroupItems(group.items).sort((a,b)=>Number(a.sortOrder||0)-Number(b.sortOrder||0));if(!items.length)return null;return <section className={`home-ad-group ad-layout-${String(group.layoutType||"FULL").toLowerCase()}`} style={{width:"100%",marginLeft:0,marginRight:0}}>{items.map((item)=><a key={item.id} href={item.linkUrl||undefined} target={item.openTarget==="BLANK"?"_blank":undefined} rel={item.openTarget==="BLANK"?"noreferrer":undefined}>{item.webImageUrl&&<img src={item.webImageUrl} alt={item.title||group.name}/>} {item.title&&<span>{item.title}</span>}</a>)}</section>}
function HomeFloor({ floor, products, categories, portal, hasAgreement, loggedIn, open, add, all }: { floor: Row; products: Row[]; categories: Row[]; portal: Row; hasAgreement: boolean; loggedIn:boolean; open: (row: Row) => void; add: (row: Row) => void; all: (id?:number) => void }) {
  if (floor.contentType === "PRODUCT") {
    const rows = floorProducts(floor, products, categories, portal, hasAgreement);
    if (!rows.length) return null;
    return <section className="section home-floor">
      <div className="section-head"><div><span>{floor.selectionRule === "LATEST" ? "NEW ARRIVALS" : "CURATED PICKS"}</span><h2>{floor.title}</h2><p>{floor.subtitle}</p></div><button onClick={() => floor.linkUrl ? location.href=floor.linkUrl : all()}>查看全部 →</button></div>
      <div className="product-grid">{rows.map((row,index)=><ProductCard key={row.skuId} product={row} index={index} open={open} add={add} loggedIn={loggedIn} />)}</div>
    </section>;
  }
  const source = floor.contentType === "SOLUTION" ? portal.solution || [] : floor.contentType === "CONTENT" ? portal.content || [] : floor.contentType === "CATEGORY" ? categories : [];
  const ids = String(floor.contentIds || "").split(",").map(Number).filter(Boolean);
  const rows = (floor.selectionRule === "MANUAL" ? ids.map((id)=>source.find((row:Row)=>Number(row.id)===id)).filter(Boolean) : source).slice(0,Number(floor.displayCount||3));
  if (!rows.length) return null;
  return <section className="solutions home-floor"><div><span>{floor.contentType === "SOLUTION" ? "SCENE SOLUTION" : floor.contentType === "CATEGORY" ? "PRODUCT CATEGORY" : "PORTAL CONTENT"}</span><h2>{floor.title}</h2><p>{floor.subtitle}</p></div>{rows.map((row:Row)=><article key={row.id} style={row.imageUrl?{backgroundImage:`linear-gradient(135deg,#15365de8,#1f6ac9d9),url(${row.imageUrl})`,backgroundSize:"cover"}:undefined}><i>{String(row.title||row.name).slice(0,1)}</i><strong>{row.title||row.name}</strong><small>{row.subtitle||"查看分类商品"}</small><button onClick={()=>floor.contentType==="CATEGORY"?all(Number(row.id)):location.href=row.linkUrl||(floor.contentType==="SOLUTION"?`/web/solutions/${row.id}`:`/web/articles/${row.id}`)}>查看详情 →</button></article>)}</section>;
}

function Home({
  products,
  categories,
  portal,
  open,
  add,
  all,
  hasAgreement,
  loggedIn,
}: {
  products: Row[];
  categories: Row[];
  portal: Row;
  open: (r: Row) => void;
  add: (r: Row) => void;
  all: (id?: number) => void;
  hasAgreement: boolean;
  loggedIn: boolean;
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
            {hasAgreement ? (banner?.subtitle || "企业协议专属价格 · 自营库存 · 多地址配送") : "自营库存 · 多地址配送 · 统一对账"}
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
          <span>{hasAgreement ? "协议精选商品" : "品质精选商品"}</span>
          <em>{hasAgreement ? "当前企业协议专属价格" : "自营库存，支持全国配送"}</em>
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
      {!(portal.floors || []).length && <section className="section">
        <div className="section-head">
          <div>
            <span>{hasAgreement ? "AGREEMENT PICKS" : "FEATURED PRODUCTS"}</span>
            <h2>{hasAgreement ? "协议精选" : "精选商品"}</h2>
            <p>{hasAgreement ? "已自动匹配当前企业有效协议价格" : "精选自营商品，按商品原价展示"}</p>
          </div>
          <button onClick={() => all()}>查看全部商品 →</button>
        </div>
        <div className="product-grid">
          {(hasAgreement ? products.filter((p)=>p.agreementPrice != null) : products).slice(0, 4).map((p, i) => (
            <ProductCard
              key={p.skuId}
              product={p}
              index={i}
              open={open}
              add={add}
              loggedIn={loggedIn}
            />
          ))}
        </div>
      </section>}
      {!(portal.floors || []).length && <section className="solutions">
        <div>
          <span>SCENE SOLUTION</span>
          <h2>
            采购不只是选商品
            <br />
            更是解决实际场景
          </h2>
          <p>从设备选型、采购下单到配送验收，一站式完成。</p>
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
      </section>}
      {(portal.adGroups||[]).filter((g:Row)=>["ALL","WEB"].includes(g.targetScope)&&g.placement==="TOP").map((g:Row)=><HomeAdGroup key={`ad-${g.id}`} group={g}/>)}
      {(portal.floors || []).filter((floor:Row)=>["ALL","WEB"].includes(floor.targetScope)).flatMap((floor:Row)=>[
        ...(portal.adGroups||[]).filter((g:Row)=>["ALL","WEB"].includes(g.targetScope)&&g.placement==="BEFORE_FLOOR"&&Number(g.anchorFloorId)===Number(floor.id)).map((g:Row)=><HomeAdGroup key={`ad-${g.id}`} group={g}/>),
        <HomeFloor key={`floor-${floor.id}`} floor={floor} products={products} categories={categories} portal={portal} hasAgreement={hasAgreement} loggedIn={loggedIn} open={open} add={add} all={all} />,
        ...(portal.adGroups||[]).filter((g:Row)=>["ALL","WEB"].includes(g.targetScope)&&g.placement==="AFTER_FLOOR"&&Number(g.anchorFloorId)===Number(floor.id)).map((g:Row)=><HomeAdGroup key={`ad-${g.id}`} group={g}/>),
      ])}
      {(portal.adGroups||[]).filter((g:Row)=>["ALL","WEB"].includes(g.targetScope)&&g.placement==="BOTTOM").map((g:Row)=><HomeAdGroup key={`ad-${g.id}`} group={g}/>)}
    </main>
  );
}

function Products({
  products,
  categories,
  solutions,
  initialCategory,
  initialKeyword,
  routeChanged,
  open,
  add,
  hasAgreement,
  loggedIn,
  forceAgreement = false,
  openSolution,
}: {
  products: Row[];
  categories: Row[];
  solutions: Row[];
  initialCategory?: number;
  initialKeyword?: string;
  routeChanged: (categoryId: number | undefined, keyword: string) => void;
  open: (r: Row) => void;
  add: (r: Row) => void;
  hasAgreement: boolean;
  loggedIn: boolean;
  forceAgreement?: boolean;
  openSolution: (id: number) => void;
}) {
  const [keyword, setKeyword] = useState(initialKeyword || "");
  const [active, setActive] = useState<number | undefined>(initialCategory);
  const [onlyStock,setOnlyStock]=useState(false);
  const [onlyAgreement,setOnlyAgreement]=useState(false);
  const [brand,setBrand]=useState("");
  const [attributeFilters,setAttributeFilters]=useState<Record<string,string[]>>({});
  const [hovered, setHovered] = useState<number>();
  const [sort, setSort] = useState<"default" | "price">("default");
  const [page,setPage]=useState(1);const pageSize=12;
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
  const categoryProducts=products.filter((p)=>!active||ids.includes(Number(p.categoryId)));
  const filterDefinitions=active ? Array.from(new Map(categoryProducts.flatMap((p)=>structuredSpecs(p.structuredAttributes))
    .filter((item)=>Number(item.filterable)===1&&item.value)
    .map((item)=>[String(item.code),item])).values()) : [];
  const filterOptions=(code:string)=>Array.from(new Set(categoryProducts.flatMap((p)=>structuredSpecs(p.structuredAttributes))
    .filter((item)=>String(item.code)===code).map((item)=>String(item.value))));
  const brands=Array.from(new Set(categoryProducts.map((p)=>String(p.brandName||"")).filter(Boolean))).sort();
  const chooseCategory=(next:number|undefined)=>{
    setActive(next);
    setBrand("");
    setAttributeFilters({});
    routeChanged(next,keyword);
  };
  const filtered = products
    .filter(
      (p) =>
        (!active || ids.includes(Number(p.categoryId))) &&
        (!onlyStock || Number(p.availableStock)>0) &&
        (!(forceAgreement || onlyAgreement) || p.agreementPrice != null) &&
        (!brand || String(p.brandName||"")===brand) &&
        (!active || Object.entries(attributeFilters).every(([code,values])=>!values.length||structuredSpecs(p.structuredAttributes)
          .some((item)=>String(item.code)===code&&values.includes(String(item.value))))) &&
        (`${p.title || ""} ${p.summary || ""} ${p.brandName || ""} ${p.model || ""} ${p.spuCode || ""} ${p.skuCode || ""}`
          .toLowerCase().includes(keyword.toLowerCase())),
    )
    .sort((a, b) =>
      sort === "price"
        ? Number(productPrice(a)) - Number(productPrice(b))
        : 0,
    );
  const normalizedKeyword=keyword.trim().toLowerCase();
  const matchedSolutions=normalizedKeyword&&!active&&!forceAgreement
    ? solutions.filter((row)=>`${row.title||""} ${row.subtitle||""} ${row.description||""}`.toLowerCase().includes(normalizedKeyword))
    : [];
  const roots = categories.filter((x) => Number(x.level) === 1);
  const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));
  const paged=filtered.slice((page-1)*pageSize,page*pageSize);
  useEffect(()=>setPage(1),[keyword,active,onlyStock,onlyAgreement,brand,attributeFilters,sort]);
  return (
    <main className="page">
      <div className="breadcrumb">首页　/　办公集采</div>
      <div className="listing-layout">
        <aside className="filters category-filters">
          <h3>商品分类</h3>
          <button
            className={!active ? "active" : ""}
            onClick={() => chooseCategory(undefined)}
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
                  onClick={() => chooseCategory(Number(root.id))}
                >
                  {root.name}
                  <span>›</span>
                </button>
                {hovered === Number(root.id) && second.length > 0 && (
                  <div className="category-flyout">
                    <header>
                      <strong>{root.name}</strong>
                      <button onClick={() => chooseCategory(Number(root.id))}>
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
                            onClick={() => chooseCategory(Number(level2.id))}
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
                                onClick={() => chooseCategory(Number(item.id))}
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
        </aside>
        <section className="listing">
          <div className="listing-head">
            <div>
              <h1>
                {forceAgreement ? "我的协议商品" : categories.find((x) => Number(x.id) === active)?.name ||
                  "办公集采"}
              </h1>
              <p>共 {filtered.length} 款自营商品</p>
            </div>
          </div>
          <div className="product-search-panel">
            <label>
              <span>品牌</span>
              <select value={brand} onChange={(e)=>setBrand(e.target.value)}>
                <option value="">全部品牌</option>
                {brands.map((item)=><option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="product-keyword">
              <span>关键词</span>
              <input value={keyword}
                onChange={(e) => { setKeyword(e.target.value); routeChanged(active,e.target.value); }}
                placeholder={active ? "搜索当前分类商品" : "搜索商品名称、品牌、型号或编码"}/>
            </label>
            <label className="search-check"><input type="checkbox" checked={onlyStock} onChange={(e)=>setOnlyStock(e.target.checked)}/> 仅看有货</label>
            {hasAgreement && !forceAgreement && <label className="search-check"><input type="checkbox" checked={onlyAgreement} onChange={(e)=>setOnlyAgreement(e.target.checked)}/> 企业协议商品</label>}
            {active && filterDefinitions.map((definition)=><div className="product-attribute-filter" key={definition.code}>
              <span>{definition.name}{definition.unit?`（${definition.unit}）`:""}</span>
              <div>{filterOptions(String(definition.code)).map((value)=><label key={value}>
                <input type="checkbox" checked={(attributeFilters[String(definition.code)]||[]).includes(value)}
                  onChange={(e)=>setAttributeFilters((current)=>{
                    const values=current[String(definition.code)]||[];
                    return {...current,[String(definition.code)]:e.target.checked?[...values,value]:values.filter((item)=>item!==value)};
                  })}/>{value}
              </label>)}</div>
            </div>)}
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
            <span>{hasAgreement ? "协议价优先展示" : "商品原价展示"}</span>
          </div>
          {matchedSolutions.length>0&&<section className="search-solution-results">
            <header><div><b>场景方案</b><small>找到 {matchedSolutions.length} 个相关方案</small></div></header>
            <div>{matchedSolutions.map((row)=><button key={row.id} onClick={()=>openSolution(Number(row.id))}>
              {row.imageUrl?<img src={row.imageUrl} alt=""/>:<i>案</i>}<span><strong>{row.title}</strong><small>{row.subtitle||row.description||"企业一站式采购方案"}</small></span><em>查看方案 ›</em>
            </button>)}</div>
          </section>}
          <div className="product-grid">
            {paged.map((p, i) => (
              <ProductCard
                key={p.skuId}
                product={p}
                index={i}
                open={open}
                add={add}
                loggedIn={loggedIn}
              />
            ))}
          </div>
          {filtered.length>pageSize&&<div className="web-pagination"><button disabled={page===1} onClick={()=>setPage(page-1)}>上一页</button><span>第 {page} / {totalPages} 页</span><button disabled={page===totalPages} onClick={()=>setPage(page+1)}>下一页</button></div>}
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
  useEffect(() => {
    if (type !== "content" || !rows.length || !location.hash) return;
    requestAnimationFrame(() => document.querySelector(location.hash)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [type, rows]);
  const title =
    type === "solutions"
      ? "场景方案"
      : type === "platforms"
        ? "平台比价"
        : "内容中心";
  if (type === "content") return (
    <main className="page content-center">
      <div className="breadcrumb"><button onClick={back}>首页</button>　/　内容中心</div>
      <header className="content-center-head"><span>SERVICE &amp; HELP</span><h1>服务与帮助</h1><p>采购指南、付款开票、配送及售后说明均由管理后台统一维护。</p></header>
      <div className="content-article-list">
        {rows.map((row, index) => <article id={`content-${row.id}`} key={row.id}>
          <div className="content-article-icon">{row.imageUrl ? <img src={row.imageUrl} alt=""/> : <FooterServiceIcon index={index}/>}</div>
          <div><h2>{row.title}</h2><p className="content-summary">{row.subtitle || "平台服务说明"}</p>
            {row.description ? <div className="content-body" dangerouslySetInnerHTML={{__html: row.description}}/> : <p className="content-empty">正文可在管理后台“内容管理”中补充。</p>}
            {row.linkUrl && !["/web/?view=content", "/web/content"].includes(row.linkUrl) && <a className="content-more" href={row.linkUrl}>查看相关页面 →</a>}
          </div>
        </article>)}
      </div>
    </main>
  );
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

function ArticleDetail({ article, back }: { article?: Row; back: () => void }) {
  if (!article) return (
    <main className="page article-detail-page">
      <div className="breadcrumb"><button onClick={back}>内容中心</button>　/　文章详情</div>
      <section className="article-detail-card"><p className="content-empty">文章不存在、尚未发布或已被删除。</p></section>
    </main>
  );
  return (
    <main className="page article-detail-page">
      <div className="breadcrumb"><button onClick={back}>内容中心</button>　/　{article.title}</div>
      <article className="article-detail-card">
        <header><h1>{article.title}</h1>{article.subtitle && <p>{article.subtitle}</p>}</header>
        {article.description ? <div className="content-body" dangerouslySetInnerHTML={{ __html: article.description }}/> : <p className="content-empty">正文内容暂未配置。</p>}
      </article>
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
  const total = chosen.reduce((sum: number, row: Row) => sum + Number(row.marketPrice || 0) * Number(quantities[row.skuId] || 1), 0);
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
        <button className="share-button" onClick={()=>void sharePage(data.solution?.title||"场景方案",data.solution?.subtitle||"查看企业采购场景方案",notify)}>分享方案</button>
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
              <b>{money(row.marketPrice)}</b>
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
  add,
  loggedIn,
}: {
  platformId: number;
  open: (r: Row) => void;
  add: (r: Row) => void;
  loggedIn: boolean;
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
    open({ ...product, platformTitle:data.platform?.title, platformPricePrefix:data.platform?.pricePrefix, clickCount: Number(product.clickCount || 0) + 1 });
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
                platformPricePrefix={data.platform?.pricePrefix}
                loggedIn={loggedIn}
                add={add}
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
  platformPricePrefix,
  loggedIn = false,
}: {
  product: Row;
  index: number;
  open: (r: Row) => void;
  add?: (r: Row) => void;
  platformTitle?: string;
  platformPricePrefix?: string;
  loggedIn?: boolean;
}) {
  const salePrice=customerPrice(product,loggedIn);
  const badge = productBadgeLabel(product);
  return (
    <article className="product-card" onClick={() => open(product)}>
      <div className={`product-image p${index % 5}`}>
        {product.mainImage ? (
          <img src={product.mainImage} alt={product.title} />
        ) : (
          <i>{["💻", "📄", "🖨️", "🖥️", "📦"][index % 5]}</i>
        )}
        {badge && <em>{badge}</em>}
      </div>
      <div className="product-info">
        <div className="platform-tags">
          {Number(product.selfOperated) === 1 && <span className="self-operated-tag">自营</span>}
          {platformTitle && <span>{platformTitle}</span>}
          {!platformTitle && product.platformNames && (
            <>
            {String(product.platformNames)
              .split("、")
              .map((name: string) => (
                <span key={name}>{name}</span>
              ))}
            </>
          )}
        </div>
        <h3>{product.title}</h3>
        <p>{product.summary || "政企采购自营商品，全国配送"}</p>
        <div className={`price${platformTitle ? " platform-price" : ""}`}>
          {platformTitle ? <><span className="price-item"><small>{platformPricePrefix || platformTitle}价</small><strong>{money(product.platformPrice)}</strong></span><span className="price-item member-price"><small>会员价</small><strong>{money(product.memberPrice??product.marketPrice)}</strong></span></> : <><span className="price-item"><small>市场价</small><strong>{money(product.marketPrice)}</strong></span>{loggedIn?<span className="price-item member-price"><small>会员价</small><strong>{money(product.memberPrice??salePrice)}</strong></span>:<span className="login-price-hint">登录后查看会员价</span>}</>}
        </div>
        <div className={`stock${platformTitle ? " platform-stock" : ""}`}>
          <span>{productStockLabel(product.availableStock)}</span>
          <span className="card-actions"><button onClick={(event) => { event.stopPropagation(); void add?.(product); }}>加入购物车</button></span>
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
  loggedIn,
  notify,
}: {
  product: Row;
  back: () => void;
  add: (r: Row, n: number) => void;
  buyNow: (r: Row, n: number) => void;
  loggedIn: boolean;
  notify: (text:string)=>void;
}) {
  const [qty, setQty] = useState(1);
  const variants:Row[]=typeof product.variants==="string"?JSON.parse(product.variants||"[]"):(product.variants||[]);
  const [selectedSku,setSelectedSku]=useState(Number(product.skuId));
  const variant=variants.find((item)=>Number(item.skuId)===selectedSku)||variants[0];
  const current:Row=variant?{...product,...variant,mainImage:variant.skuImage||product.mainImage}:product;
  const currentTitle=String(current.skuTitle||product.title||"").trim();
  const detailBadge=productBadgeLabel(current);
  const variantLabel=(item:Row)=>Object.entries(typeof item.specValues==="string"?JSON.parse(item.specValues||"{}"):item.specValues||{})
    .map(([key,value])=>`${key}：${value}`).join(" / ")||item.skuCode;
  const [detailTab, setDetailTab] = useState<
    "detail" | "specification" | "service"
  >("detail");
  const galleryImages = Array.from(
    new Set(
      [current.mainImage, ...String(product.gallery || "").split("\n")]
        .map((url) => String(url || "").trim())
        .filter(Boolean),
    ),
  );
  const [activeImage, setActiveImage] = useState(galleryImages[0] || "");
  useEffect(() => {
    setActiveImage(galleryImages[0] || "");
  }, [current.skuId, current.mainImage, product.gallery]);
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
  const skuSpecifications=Object.entries(typeof current.specValues==="string"?JSON.parse(current.specValues||"{}"):current.specValues||{});
  const specifications = [...skuSpecifications,...(configuredSpecifications.length ? configuredSpecifications : legacySpecifications)];
  const salePrice=customerPrice(current,loggedIn);
  const subscribeArrival=async()=>{if(!loggedIn){notify("请先登录后设置到货提醒");return;}try{await api(`/api/client/service/stock-subscriptions/${current.skuId}`,{method:"POST"});notify("到货提醒设置成功");}catch(e){notify((e as Error).message);}};
  const addFrequent=async()=>{if(!loggedIn){notify("请先登录后加入常购清单");return;}try{await api("/api/client/purchase-tools/frequent-items",{method:"POST",body:JSON.stringify({skuId:current.skuId,quantity:1,remark:""})});notify("已加入常购清单");}catch(e){notify((e as Error).message);}};
  return (
    <main className="page">
      <div className="breadcrumb">
        首页　/　办公集采　/　<button onClick={back}>返回列表</button>
      </div>
      <section className="detail">
        <div className="detail-gallery">
          <div>
            {activeImage ? (
              <img src={activeImage} alt={currentTitle} />
            ) : (
              <i>暂无商品图片</i>
            )}
            {detailBadge && <span>{detailBadge}</span>}
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
                  <img src={url} alt={`${currentTitle} 图片${index + 1}`} />
                </button>
              ))}
            </nav>
          )}
        </div>
        <div className="detail-main">
          <div className="platform-tags detail-tags">{Number(product.selfOperated) === 1 && <span className="self-operated-tag">自营</span>}{product.platformNames && String(product.platformNames).split("、").map((name:string)=><span key={name}>{name}</span>)}</div>
          <div className="detail-title-row"><h1>{currentTitle}</h1><button className="share-button" onClick={()=>void sharePage(currentTitle,`${currentTitle} ${money(salePrice)}`,notify)}>分享</button></div>
          <p>{product.summary}</p>
          <div className="agreement-price">
            <label>{!loggedIn ? "商品原价" : current.agreementPrice != null ? "企业协议价" : "企业会员价"}</label>
            <strong>
              {money(salePrice)}
            </strong>
            {loggedIn && <del>市场价 {money(current.marketPrice)}</del>}
            <em>{!loggedIn ? "登录后可查看会员价或协议价" : current.agreementPrice != null ? "已匹配当前企业有效协议" : "当前商品按企业会员价结算"}</em>
          </div>
          {variants.length>1&&<div className="sku-selector"><strong>选择规格</strong><div>
            {variants.map((item)=><button key={item.skuId} className={Number(item.skuId)===Number(current.skuId)?"active":""}
              onClick={()=>{setSelectedSku(Number(item.skuId));setQty(1);}}>{variantLabel(item)}{Number(item.availableStock)<=0?"（缺货）":""}</button>)}
          </div></div>}
          <dl>
            <dt>商品编码</dt>
            <dd>{current.skuCode}</dd>
            <dt>配送</dt>
            <dd>
              {product.deliveryDescription ||
                "自营库存，支持全国配送，实际时效以收货地址为准"}
            </dd>
            <dt>服务</dt>
            <dd>
              {productServices(product.services).length?productServices(product.services).map((service)=><span key={service}>{service}</span>):<span>暂无服务配置</span>}
            </dd>
            <dt>数量</dt>
            <dd className="counter">
              <button onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
              <b>{qty}</b>
              <button
                onClick={() =>
                  setQty(Math.min(current.availableStock, qty + 1))
                }
              >
                ＋
              </button>
              <small>{productStockLabel(current.availableStock)}</small>
            </dd>
          </dl>
          {current.productUrl&&<div className="detail-platform-link"><span>平台商品链接</span><a href={current.productUrl} target="_blank" rel="noreferrer">前往{current.platformTitle||"平台"}查看</a></div>}
          <div className="buy">
            <button onClick={()=>void addFrequent()}>加入常购</button>
            {Number(current.availableStock)<=0?<button className="arrival-reminder" onClick={()=>void subscribeArrival()}>到货提醒</button>:<><button onClick={() => void add(current, qty)}>加入购物车</button><button onClick={() => void buyNow(current, qty)}>立即采购</button></>}
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
                    "商品由平台统一采购、统一库存和统一配送。"}
                </p>
              </>
            )}
          <div className="feature-grid">
            {[
              ["正", "自营正品", "严格供应链审核"],
              ["价", product.agreementPrice != null ? "协议专价" : "原价结算", product.agreementPrice != null ? "按企业有效协议计价" : "按商品市场原价计价"],
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
              <dd>{current.skuCode}</dd>
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
        <p>{selected.some((row)=>Number(row.agreementPriced)===1) ? "协议商品按协议价结算，其他商品按原价结算" : "当前无协议价格，商品按原价结算"}</p>
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
              <span>结算单价</span>
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
                  {row.mainImage ? <img src={row.mainImage} alt={row.title}/> : <i>📦</i>}
                  <span>
                    <strong>{row.title}</strong>
                    <small>{row.skuCode}</small>
                    <em>{Number(row.agreementPriced)===1 ? "企业协议价" : "商品原价"}</em>
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
              <small>{selected.some((row)=>Number(row.agreementPriced)===1) ? "协议价格不可与优惠券叠加" : "当前按商品原价结算"}</small>
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
  const [bankAccounts,setBankAccounts]=useState<Row[]>([]);
  const [bankAccountId,setBankAccountId]=useState<number>();
  useEffect(() => {
    void api<Row[]>("/api/client/addresses")
      .then(setAddresses)
      .catch((error) => notify(error.message));
  }, []);
  useEffect(()=>{void api<Row[]>("/api/public/payment-bank-accounts").then(rows=>{setBankAccounts(rows);setBankAccountId(Number(rows[0]?.id)||undefined)}).catch(e=>notify(e.message));},[]);
  const currentAddress = addresses[0];
  useEffect(() => {
    if (!addresses.length) return;
    setAllocations((current) => {
      const next = { ...current };
      selected.forEach((row) => {
        const key = String(row.skuId);
        if (!next[key]?.length)
          next[key] = [
            { addressId: addresses.find(address=>Number(address.id)===Number(row.preferredAddressId))?.id||addresses[0].id, quantity: Number(row.quantity) },
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
          bankAccountId,
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
        <div><h2>收款银行</h2><p>请选择本订单线下转账的收款账号，提交后将记录到订单中</p></div>
        <div className="bank-account-options">{bankAccounts.map(row=><label className={bankAccountId===Number(row.id)?"active":""} key={row.id}><input type="radio" name="bank" checked={bankAccountId===Number(row.id)} onChange={()=>setBankAccountId(Number(row.id))}/><span><strong>{row.bankName}</strong><small>{row.accountName}</small><b>{row.accountNumber}</b>{row.branchName&&<small>{row.branchName}</small>}</span></label>)}{!bankAccounts.length&&<p>暂无可用收款账号，请联系管理员</p>}</div>
      </section>
      <section className="checkout-submit">
        <span>应付总额 <strong>{money(total)}</strong></span>
        <button disabled={!currentAddress || !bankAccountId || submitting} onClick={() => void submit()}>
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
  const confirmReceipt = async (delivery: Row) => {
    if (!detail || !window.confirm(`确认配送单 ${delivery.subOrderNo} 已收货？`)) return;
    await api(`/api/client/service/orders/${detail.order.id}/deliveries/${encodeURIComponent(delivery.subOrderNo)}/confirm-receipt`, { method: "POST" });
    setDetail(await api<Row>(`/api/client/orders/${detail.order.id}`));
    setRows(await api<Row[]>("/api/client/orders"));
  };
  const repurchase=async(row:Row)=>{try{await api(`/api/client/purchase-tools/orders/${row.id}/repurchase`,{method:"POST"});go("cart");}catch(e){window.alert((e as Error).message);}};
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
          ["after-sales", "售后服务"],
          ["notifications", "消息中心"],
          ["invoices", "发票管理"],
          ["finance", "财务中心"],
          ["members", "企业成员"],
          ["organization", "组织与权限"],
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
                <small>企业采购 · 银行转账</small>
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
              <button onClick={() => void repurchase(row)}>再次购买</button>
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
              <h3>配送进度</h3>
              <div className="delivery-confirm-list">{detail.deliveries.map((x:Row)=><article key={x.subOrderNo}><span><b>{x.subOrderNo}</b><small>{x.logisticsCompany&&x.logisticsNo?`${x.logisticsCompany} ${x.logisticsNo}`:"等待物流信息"}</small><em>{x.logisticsStatus||(["待发货","已发货","运输中","已签收"][Number(x.status)]||"待发货")}</em></span>{[1,2].includes(Number(x.status))&&<button onClick={()=>void confirmReceipt(x)}>确认收货</button>}</article>)}</div>
              <button className="secondary-button" onClick={()=>{setDetail(undefined);go("after-sales");}}>申请售后</button>
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
          ["frequent", "常购清单"],
          ["addresses", "地址管理"],
          ["after-sales", "售后服务"],
          ["notifications", "消息中心"],
          ["invoices", "发票管理"],
          ["finance", "财务中心"],
          ["members", "企业成员"],
          ["organization", "组织与权限"],
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
            {profile.agreementName && <span>
              <strong>{money(summary.totalSavings)}</strong>
              <small>累计协议节省</small>
            </span>}
            <span>
              <strong>{summary.activeOrders || 0}</strong>
              <small>进行中订单</small>
            </span>
          </article>
        </div>
        <div className="profile-grid">
          {profile.agreementName && <section>
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
          </section>}
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
          ["frequent", "常购清单"],
          ["addresses", "地址管理"],
          ["invoices", "发票管理"],
          ["finance", "财务中心"],
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
