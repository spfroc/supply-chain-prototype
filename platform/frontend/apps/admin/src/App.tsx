import { useEffect, useMemo, useRef, useState } from "react";
import {
  App as AntApp,
  Button,
  Card,
  Checkbox,
  ConfigProvider,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Layout,
  Menu,
  Modal,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
  Upload,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { UploadFile } from "antd/es/upload/interface";
import zhCN from "antd/locale/zh_CN";

type Row = Record<string, any>;
type Module =
  | "overview"
  | "products"
  | "categories"
  | "brands"
  | "platforms"
  | "navigations"
  | "banners"
  | "solutions"
  | "contents"
  | "enterprises"
  | "agreements"
  | "orders"
  | "users"
  | "roles"
  | "permissions"
  | "logs"
  | "configs";
const adminCredential = () => sessionStorage.getItem("adminCredential") || "";
const apiHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Basic ${adminCredential()}`,
});
const dateTime = (value?: string) =>
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

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin/system${path}`, {
    ...init,
    headers: { ...apiHeaders(), ...init?.headers },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(
      payload.message || payload.detail || `请求失败（${response.status}）`,
    );
  }
  if (response.status === 204 || response.headers.get("content-length") === "0")
    return undefined as T;
  return response.json();
}

async function rootApi<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: apiHeaders() });
  if (!response.ok) throw new Error(`请求失败（${response.status}）`);
  return response.json();
}

function imageDimensions(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("无法读取图片"));
    };
    image.src = url;
  });
}

function ProductImageUpload({
  value,
  onChange,
  multiple = false,
  kind = multiple ? "gallery" : "main",
}: {
  value?: string;
  onChange?: (value: string) => void;
  multiple?: boolean;
  kind?: "main" | "gallery" | "brand" | "banner" | "portal";
}) {
  const { message } = AntApp.useApp();
  const limit = multiple ? 6 : 1;
  const profiles = {
    main: { minWidth: 600, minHeight: 600, maxWidth: 3000, maxHeight: 3000, ratio: 1, ratioLabel: "1:1", maxMb: 5, title: "主图" },
    gallery: { minWidth: 600, minHeight: 600, maxWidth: 3000, maxHeight: 3000, ratio: 1, ratioLabel: "1:1", maxMb: 5, title: "配图" },
    brand: { minWidth: 300, minHeight: 300, maxWidth: 2000, maxHeight: 2000, ratio: 1, ratioLabel: "1:1", maxMb: 2, title: "Logo" },
    banner: { minWidth: 1200, minHeight: 400, maxWidth: 3840, maxHeight: 1280, ratio: 3, ratioLabel: "3:1", maxMb: 5, title: "轮播图" },
    portal: { minWidth: 800, minHeight: 450, maxWidth: 3840, maxHeight: 2160, ratio: 16 / 9, ratioLabel: "16:9", maxMb: 5, title: "展示图" },
  };
  const profile = profiles[kind];
  const urls = String(value || "")
    .split("\n")
    .map((url) => url.trim())
    .filter(Boolean);
  const files: UploadFile[] = urls.map((url, index) => ({
    uid: `${index}-${url}`,
    name: url.split("/").pop() || `商品图片${index + 1}`,
    status: "done",
    url,
  }));
  const upload = async (options: any) => {
    const file = options.file as File;
    try {
      if (!["image/jpeg", "image/png"].includes(file.type))
        throw new Error("仅支持 JPG、PNG 图片");
      if (file.size > profile.maxMb * 1024 * 1024)
        throw new Error(`图片不能超过${profile.maxMb}MB`);
      const { width, height } = await imageDimensions(file);
      if (
        width < profile.minWidth ||
        height < profile.minHeight ||
        width > profile.maxWidth ||
        height > profile.maxHeight
      )
        throw new Error(
          `图片尺寸须在${profile.minWidth}×${profile.minHeight}至${profile.maxWidth}×${profile.maxHeight}之间`,
        );
      if (Math.abs(width / height - profile.ratio) / profile.ratio > 0.03)
        throw new Error(`图片须为${profile.ratioLabel}比例`);
      const body = new FormData();
      body.append("file", file);
      body.append("kind", kind);
      const response = await fetch("/api/admin/business/uploads/images", {
        method: "POST",
        headers: { Authorization: `Basic ${adminCredential()}` },
        body,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "图片上传失败");
      const next = multiple ? [...urls, result.url].slice(0, limit) : [result.url];
      onChange?.(next.join("\n"));
      options.onSuccess(result);
      message.success("图片上传成功");
    } catch (error) {
      options.onError(error);
      message.error((error as Error).message);
    }
  };
  return (
    <div className="product-image-upload">
      <Upload
        accept=".jpg,.jpeg,.png"
        listType="picture-card"
        fileList={files}
        maxCount={limit}
        customRequest={upload}
        itemRender={(originNode, file) =>
          multiple ? (
            <div
              className="sortable-upload-item"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", file.url || "");
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const sourceUrl = event.dataTransfer.getData("text/plain");
                const targetUrl = file.url || "";
                const sourceIndex = urls.indexOf(sourceUrl);
                const targetIndex = urls.indexOf(targetUrl);
                if (
                  sourceIndex < 0 ||
                  targetIndex < 0 ||
                  sourceIndex === targetIndex
                )
                  return;
                const next = [...urls];
                const [moved] = next.splice(sourceIndex, 1);
                next.splice(targetIndex, 0, moved);
                onChange?.(next.join("\n"));
                message.success("配图顺序已调整，请保存商品");
              }}
            >
              {originNode}
              <span className="upload-order">
                {urls.indexOf(file.url || "") + 1}
              </span>
              <span className="upload-drag-hint">拖动排序</span>
            </div>
          ) : (
            originNode
          )
        }
        onRemove={(file) => {
          onChange?.(urls.filter((url) => url !== file.url).join("\n"));
          return true;
        }}
      >
        {files.length < limit && (
          <div className="upload-trigger">
            <b>＋</b>
            <span>上传{profile.title}</span>
          </div>
        )}
      </Upload>
      <small>
        JPG/PNG，{profile.ratioLabel}，{profile.minWidth}×{profile.minHeight} 至{" "}
        {profile.maxWidth}×{profile.maxHeight}，单张不超过{profile.maxMb}MB
        {multiple ? "，最多6张，可拖动调整顺序" : ""}
      </small>
    </div>
  );
}

function RichTextEditor({
  value,
  onChange,
}: {
  value?: string;
  onChange?: (value: string) => void;
}) {
  const { message } = AntApp.useApp();
  const editor = useRef<HTMLDivElement>(null);
  const localImageInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editor.current && editor.current.innerHTML !== (value || ""))
      editor.current.innerHTML = value || "";
  }, [value]);
  const command = (name: string, commandValue?: string) => {
    editor.current?.focus();
    document.execCommand(name, false, commandValue);
    onChange?.(editor.current?.innerHTML || "");
  };
  const validNetworkUrl = (value: string) => {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol);
    } catch {
      return false;
    }
  };
  const insertElement = (element: HTMLElement) => {
    command("insertHTML", element.outerHTML);
  };
  const uploadLocalImage = async (file?: File) => {
    if (!file) return;
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("kind", "rich");
      const response = await fetch("/api/admin/business/uploads/images", {
        method: "POST",
        headers: { Authorization: `Basic ${adminCredential()}` },
        body,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "图片上传失败");
      const image = document.createElement("img");
      image.src = result.url;
      image.alt = file.name.replace(/\.[^.]+$/, "");
      image.loading = "lazy";
      insertElement(image);
      message.success("图片已插入详情");
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      if (localImageInput.current) localImageInput.current.value = "";
    }
  };
  return (
    <div className="rich-editor">
      <div className="rich-toolbar">
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("bold")}>
          加粗
        </button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("italic")}>
          斜体
        </button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("formatBlock", "h2")}>
          标题
        </button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("insertUnorderedList")}>
          列表
        </button>
        <button type="button" onClick={() => localImageInput.current?.click()}>
          本地图片
        </button>
        <button
          type="button"
          onClick={() => {
            const url = window.prompt("请输入网络图片地址（http/https）")?.trim();
            if (!url) return;
            if (!validNetworkUrl(url)) {
              window.alert("请输入有效的网络图片地址");
              return;
            }
            const image = document.createElement("img");
            image.src = url;
            image.alt = "商品详情图片";
            image.loading = "lazy";
            insertElement(image);
          }}
        >
          网络图片
        </button>
        <button
          type="button"
          onClick={() => {
            const url = window.prompt("请输入网络视频直链（MP4/WebM 等）")?.trim();
            if (!url) return;
            if (!validNetworkUrl(url)) {
              window.alert("请输入有效的网络视频地址");
              return;
            }
            const video = document.createElement("video");
            video.src = url;
            video.controls = true;
            video.preload = "metadata";
            insertElement(video);
          }}
        >
          网络视频
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            const url = window.prompt("请输入链接地址");
            if (url) command("createLink", url);
          }}
        >
          链接
        </button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("removeFormat")}>
          清除格式
        </button>
      </div>
      <input
        ref={localImageInput}
        className="rich-media-input"
        type="file"
        accept=".jpg,.jpeg,.png"
        onChange={(event) => void uploadLocalImage(event.target.files?.[0])}
      />
      <div
        ref={editor}
        className="rich-content"
        contentEditable
        suppressContentEditableWarning
        data-placeholder="请输入商品详情，可设置标题、加粗、列表和链接"
        onInput={(event) => onChange?.(event.currentTarget.innerHTML)}
      />
    </div>
  );
}

const navItems = [
  { key: "overview", label: "经营概览", icon: <span>概</span> },
  {
    type: "group" as const,
    label: "业务管理",
    children: [
      { key: "products", label: "商品管理", icon: <span>商</span> },
      { key: "categories", label: "分类管理", icon: <span>类</span> },
      { key: "brands", label: "品牌管理", icon: <span>牌</span> },
      { key: "platforms", label: "平台管理", icon: <span>台</span> },
      { key: "solutions", label: "方案管理", icon: <span>案</span> },
      { key: "enterprises", label: "企业管理", icon: <span>企</span> },
      { key: "agreements", label: "协议管理", icon: <span>协</span> },
      { key: "orders", label: "订单管理", icon: <span>单</span> },
    ],
  },
  {
    type: "group" as const,
    label: "门户管理",
    children: [
      { key: "navigations", label: "导航栏管理", icon: <span>导</span> },
      { key: "banners", label: "首页轮播图", icon: <span>播</span> },
      { key: "contents", label: "内容管理", icon: <span>文</span> },
    ],
  },
  {
    type: "group" as const,
    label: "系统管理",
    children: [
      { key: "users", label: "用户管理", icon: <span>用</span> },
      { key: "roles", label: "角色管理", icon: <span>角</span> },
      { key: "permissions", label: "权限管理", icon: <span>权</span> },
      { key: "logs", label: "操作日志", icon: <span>志</span> },
      { key: "configs", label: "基本配置", icon: <span>设</span> },
    ],
  },
];

export function App() {
  const [authenticated, setAuthenticated] = useState(!!adminCredential());
  const logout = () => {
    sessionStorage.removeItem("adminCredential");
    setAuthenticated(false);
  };
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#1767d2",
          borderRadius: 10,
          fontSize: 16,
          colorText: "#17243d",
        },
      }}
    >
      <AntApp>
        {authenticated ? (
          <AdminApp logout={logout} />
        ) : (
          <AdminLogin success={() => setAuthenticated(true)} />
        )}
      </AntApp>
    </ConfigProvider>
  );
}

function AdminLogin({ success }: { success: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const login = async () => {
    setError("");
    if (!username.trim() || !password) {
      setError("请输入后台账号和密码");
      return;
    }
    setLoading(true);
    try {
      const credential = btoa(
        unescape(encodeURIComponent(`${username.trim()}:${password}`)),
      );
      const response = await fetch("/api/admin/system/me", {
        headers: { Authorization: `Basic ${credential}` },
      });
      if (!response.ok) throw new Error("后台账号或密码错误");
      sessionStorage.setItem("adminCredential", credential);
      success();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <main className="admin-login">
      <section>
        <div className="brand">
          <i>链</i>
          <div>
            <strong>供应链运营中心</strong>
            <small>ADMIN CONSOLE</small>
          </div>
        </div>
        <h1>管理后台登录</h1>
        <p>仅限平台运营、财务及系统管理人员使用</p>
        <label>
          后台账号
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onPressEnter={() => void login()}
            placeholder="请输入后台账号"
          />
        </label>
        <label>
          登录密码
          <Input.Password
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onPressEnter={() => void login()}
            placeholder="请输入登录密码"
          />
        </label>
        {error && <div className="login-error">{error}</div>}
        <Button
          type="primary"
          loading={loading}
          block
          onClick={() => void login()}
        >
          登录管理后台
        </Button>
        <small>企业采购成员请使用 Web 或 H5 客户端登录</small>
      </section>
    </main>
  );
}

function AdminApp({ logout }: { logout: () => void }) {
  const [module, setModule] = useState<Module>("overview");
  const [admin, setAdmin] = useState<Row>({});
  useEffect(() => {
    void api<Row>("/me").then(setAdmin);
  }, []);
  const titles: Record<Module, [string, string]> = {
    overview: ["经营概览", "掌握平台账户、权限与关键业务运行状态"],
    products: ["商品管理", "维护自营商品、SKU、协议价格与可售库存"],
    categories: ["分类管理", "维护客户端使用的三级商品分类、排序与启停状态"],
    brands: ["品牌管理", "维护商品品牌、品牌说明、排序与启停状态"],
    platforms: ["平台管理", "维护第三方平台资料、商品参考入口与展示状态"],
    navigations: [
      "导航栏管理",
      "配置 Web 客户端顶部导航名称、链接、排序与状态",
    ],
    banners: ["首页轮播图管理", "配置 Web 与 H5 首页活动内容、图片和跳转链接"],
    solutions: ["方案管理", "维护企业采购场景方案及客户端展示内容"],
    contents: ["内容管理", "维护采购指南、服务说明及其他门户内容"],
    enterprises: ["企业管理", "查看企业客户、成员账户和有效采购协议"],
    agreements: ["协议管理", "维护协议商品关联及企业专属成交价格"],
    orders: ["订单管理", "查询采购订单、付款状态与履约进度"],
    users: ["用户管理", "维护后台登录用户、角色归属与启停状态"],
    roles: ["角色管理", "按岗位配置角色与操作权限"],
    permissions: ["权限管理", "查看系统权限点及所属业务模块"],
    logs: ["操作日志", "追踪关键管理操作，支持审计与问题定位"],
    configs: ["基本配置", "维护平台信息、订单和库存参数"],
  };
  return (
    <Layout className="admin-shell">
      <Layout.Sider width={242} className="admin-sider">
        <div className="brand">
          <i>链</i>
          <div>
            <strong>供应链运营中心</strong>
            <small>ADMIN CONSOLE</small>
          </div>
        </div>
        <Menu
          mode="inline"
          theme="dark"
          selectedKeys={[module]}
          items={navItems}
          onClick={({ key }) => setModule(key as Module)}
        />
        <div className="service-state">
          <span>
            <i /> 系统服务正常
          </span>
          <small>数据库与缓存已连接</small>
        </div>
      </Layout.Sider>
      <Layout>
        <Layout.Header className="admin-header">
          <div>
            <small>运营管理 / 系统管理 /</small>
            <strong>{titles[module][0]}</strong>
          </div>
          <label className="global-search">
            ⌕ <input placeholder="搜索用户、角色或日志" />
          </label>
          <div className="admin-account">
            <span>{String(admin.realName || "管").slice(0, 1)}</span>
            <div>
              <strong>{admin.realName || admin.username || "后台用户"}</strong>
              <small>{admin.roleNames || "后台角色"}</small>
            </div>
            <Button type="text" onClick={logout}>
              退出
            </Button>
          </div>
        </Layout.Header>
        <Layout.Content className="admin-content">
          <div className="page-heading">
            <div>
              <span>2026年7月29日 · 数据实时更新</span>
              <Typography.Title level={2}>{titles[module][0]}</Typography.Title>
              <p>{titles[module][1]}</p>
            </div>
            <Space>
              <Button onClick={() => location.reload()}>刷新数据</Button>
            </Space>
          </div>
          {module === "overview" && <Overview go={setModule} />}
          {(
            ["products", "enterprises", "agreements", "orders"] as Module[]
          ).includes(module) && <BusinessModule module={module} />}
          {module === "categories" && <Categories />}
          {(
            [
              "brands",
              "platforms",
              "navigations",
              "banners",
              "solutions",
              "contents",
            ] as Module[]
          ).includes(module) && <PortalManager module={module} />}
          {module === "users" && <Users />}
          {module === "roles" && <Roles />}
          {module === "permissions" && <Permissions />}
          {module === "logs" && <Logs />}
          {module === "configs" && <Configs />}
        </Layout.Content>
      </Layout>
    </Layout>
  );
}

function BusinessModule({ module }: { module: Module }) {
  const { message, modal } = AntApp.useApp();
  const endpoint =
    module === "products"
      ? "/products"
      : module === "enterprises"
        ? "/enterprises"
        : module === "agreements"
          ? "/agreements"
          : "/orders";
  const rows = useLoad<Row[]>(
    () => rootApi(`/api/admin/business${endpoint}`),
    [module],
  );
  const enterprises = useLoad<Row[]>(() =>
    rootApi("/api/admin/business/enterprises"),
  );
  const products = useLoad<Row[]>(() =>
    rootApi("/api/admin/business/products"),
  );
  const categories = useLoad<Row[]>(() =>
    rootApi("/api/admin/business/categories"),
  );
  const [form] = Form.useForm();
  const [memberForm] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row>();
  const [mode, setMode] = useState<"entity" | "stock" | "item">("entity");
  const [agreement, setAgreement] = useState<Row>();
  const [items, setItems] = useState<Row[]>([]);
  const [itemOpen, setItemOpen] = useState(false);
  const [detail, setDetail] = useState<Row>();
  const [memberEnterprise, setMemberEnterprise] = useState<Row>();
  const [members, setMembers] = useState<Row[]>([]);
  const [memberOpen, setMemberOpen] = useState(false);
  const [memberEditing, setMemberEditing] = useState<Row>();
  const [memberEditorOpen, setMemberEditorOpen] = useState(false);
  const business = async (path: string, init?: RequestInit) => {
    const r = await fetch(`/api/admin/business${path}`, {
      ...init,
      headers: { ...apiHeaders(), ...init?.headers },
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.detail || "操作失败");
    }
    const text = await r.text();
    return text ? JSON.parse(text) : undefined;
  };
  const show = (row?: Row, nextMode: "entity" | "stock" = "entity") => {
    setEditing(row);
    setMode(nextMode);
    form.resetFields();
    if (nextMode === "stock") form.setFieldsValue({ stock: row?.stock });
    else if (module === "products")
      form.setFieldsValue(
        row
          ? { ...row, status: Number(row.status), spec: "标准规格" }
          : {
              categoryId: (categories.data || []).find(
                (x) => Number(x.level) === 3,
              )?.id,
              brandId: 1,
              status: 1,
              stock: 0,
            },
      );
    else if (module === "enterprises")
      form.setFieldsValue(row || { status: 1 });
    else if (module === "agreements")
      form.setFieldsValue(
        row || {
          enterpriseId: 1,
          status: 1,
          effectiveDate: "2026-07-29",
          expiryDate: "2027-07-28",
          amount: 0,
        },
      );
    setOpen(true);
  };
  const save = async () => {
    try {
      const values = await form.validateFields();
      if (mode === "stock")
        await business(`/products/${editing!.id}/stock`, {
          method: "PUT",
          body: JSON.stringify(values),
        });
      else
        await business(`${endpoint}${editing ? `/${editing.id}` : ""}`, {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify(values),
        });
      message.success("保存成功");
      setOpen(false);
      void rows.refresh();
      void products.refresh();
      void enterprises.refresh();
    } catch (e) {
      if (e instanceof Error) message.error(e.message);
    }
  };
  const remove = (row: Row) =>
    modal.confirm({
      title: `确认删除“${row.title || row.name}”？`,
      content: "有关联订单的数据会提示改为停用。",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await business(`${endpoint}/${row.id}`, { method: "DELETE" });
          message.success("删除成功");
          void rows.refresh();
        } catch (e) {
          message.error((e as Error).message);
        }
      },
    });
  const toggle = async (row: Row) => {
    try {
      await business(`/products/${row.id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: Number(row.status) === 1 ? 2 : 1 }),
      });
      message.success(Number(row.status) === 1 ? "商品已下架" : "商品已上架");
      void rows.refresh();
    } catch (e) {
      message.error((e as Error).message);
    }
  };
  const openItems = async (row: Row) => {
    setAgreement(row);
    setItems(await rootApi(`/api/admin/agreements/${row.id}/items`));
    setItemOpen(true);
  };
  const saveItem = async () => {
    try {
      const v = await form.validateFields();
      const url = editing
        ? `/api/admin/agreements/${agreement!.id}/items/${editing.id}`
        : `/api/admin/agreements/${agreement!.id}/items`;
      const r = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: apiHeaders(),
        body: JSON.stringify(v),
      });
      if (!r.ok) throw new Error("协议商品保存失败");
      setItems(await rootApi(`/api/admin/agreements/${agreement!.id}/items`));
      setMode("entity");
      setEditing(undefined);
      form.resetFields();
      message.success("协议商品已保存");
    } catch (e) {
      message.error((e as Error).message);
    }
  };
  const removeItem = (row: Row) =>
    modal.confirm({
      title: "移除协议商品？",
      onOk: async () => {
        await fetch(`/api/admin/agreements/${agreement!.id}/items/${row.id}`, {
          method: "DELETE",
          headers: apiHeaders(),
        });
        setItems(await rootApi(`/api/admin/agreements/${agreement!.id}/items`));
        message.success("已移除");
      },
    });
  const orderDetail = async (row: Row) =>
    setDetail(await business(`/orders/${row.id}`));
  const advanceOrder = async (row: Row) => {
    const payment = Number(row.paymentStatus) === 2 ? 2 : 2;
    const status =
      Number(row.orderStatus) === 0
        ? 1
        : Math.min(3, Number(row.orderStatus) + 1);
    await business(`/orders/${row.id}/status`, {
      method: "PUT",
      body: JSON.stringify({ paymentStatus: payment, orderStatus: status }),
    });
    message.success("订单状态已更新");
    void rows.refresh();
  };
  const loadMembers = async (enterprise: Row) => {
    setMemberEnterprise(enterprise);
    setMembers(await business(`/enterprises/${enterprise.id}/members`));
    setMemberOpen(true);
  };
  const showMember = (row?: Row) => {
    setMemberEditing(row);
    memberForm.setFieldsValue(
      row
        ? { ...row, password: "" }
        : { roleCode: "BUYER", status: 1, password: "" },
    );
    setMemberEditorOpen(true);
  };
  const saveMember = async () => {
    try {
      const values = await memberForm.validateFields();
      await business(
        `/enterprises/${memberEnterprise!.id}/members${memberEditing ? `/${memberEditing.id}` : ""}`,
        {
          method: memberEditing ? "PUT" : "POST",
          body: JSON.stringify(values),
        },
      );
      setMembers(
        await business(`/enterprises/${memberEnterprise!.id}/members`),
      );
      setMemberEditorOpen(false);
      message.success("企业成员已保存");
      void rows.refresh();
    } catch (e) {
      message.error((e as Error).message);
    }
  };
  const removeMember = (row: Row) =>
    modal.confirm({
      title: `确认删除成员“${row.realName}”？`,
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await business(
            `/enterprises/${memberEnterprise!.id}/members/${row.id}`,
            { method: "DELETE" },
          );
          setMembers(
            await business(`/enterprises/${memberEnterprise!.id}/members`),
          );
          message.success("企业成员已删除");
          void rows.refresh();
        } catch (e) {
          message.error((e as Error).message);
        }
      },
    });
  let columns: ColumnsType<Row> = [];
  if (module === "products")
    columns = [
      {
        title: "商品信息",
        render: (_, r) => (
          <div className="user-cell">
            <i>商</i>
            <span>
              <strong>{r.title}</strong>
              <small>{r.skuCode}</small>
            </span>
          </div>
        ),
      },
      {
        title: "市场价",
        dataIndex: "marketPrice",
        render: (v) => `¥${Number(v).toFixed(2)}`,
      },
      {
        title: "会员价",
        dataIndex: "memberPrice",
        render: (v) => `¥${Number(v).toFixed(2)}`,
      },
      {
        title: "库存",
        render: (_, r) => (
          <Tag color={r.stock - r.reservedStock > 10 ? "green" : "orange"}>
            {r.stock - r.reservedStock} / {r.stock}
          </Tag>
        ),
      },
      {
        title: "状态",
        dataIndex: "status",
        render: (v) => (
          <Tag color={Number(v) === 1 ? "green" : "default"}>
            {Number(v) === 1 ? "在售" : Number(v) === 0 ? "草稿" : "已下架"}
          </Tag>
        ),
      },
      {
        title: "操作",
        render: (_, r) => (
          <Space>
            <Button type="link" onClick={() => show(r)}>
              编辑
            </Button>
            <Button type="link" onClick={() => show(r, "stock")}>
              库存
            </Button>
            <Button type="link" onClick={() => void toggle(r)}>
              {Number(r.status) === 1 ? "下架" : "上架"}
            </Button>
            <Button type="link" danger onClick={() => remove(r)}>
              删除
            </Button>
          </Space>
        ),
      },
    ];
  if (module === "enterprises")
    columns = [
      {
        title: "企业",
        render: (_, r) => (
          <div className="user-cell">
            <i>企</i>
            <span>
              <strong>{r.name}</strong>
              <small>{r.creditCode}</small>
            </span>
          </div>
        ),
      },
      {
        title: "联系人",
        render: (_, r) => (
          <>
            {r.contactName}
            <small className="subline">{r.contactPhone}</small>
          </>
        ),
      },
      { title: "成员", dataIndex: "memberCount", render: (v) => `${v} 人` },
      {
        title: "有效协议",
        dataIndex: "agreementName",
        render: (v) => v || "—",
      },
      {
        title: "状态",
        dataIndex: "status",
        render: (v) => (
          <Tag color={v ? "green" : "default"}>{v ? "正常" : "停用"}</Tag>
        ),
      },
      {
        title: "操作",
        render: (_, r) => (
          <Space>
            <Button type="link" onClick={() => void loadMembers(r)}>
              成员管理
            </Button>
            <Button type="link" onClick={() => show(r)}>
              编辑
            </Button>
            <Button type="link" danger onClick={() => remove(r)}>
              删除
            </Button>
          </Space>
        ),
      },
    ];
  if (module === "agreements")
    columns = [
      {
        title: "协议",
        render: (_, r) => (
          <>
            <strong>{r.name}</strong>
            <small className="subline">{r.agreementNo}</small>
          </>
        ),
      },
      { title: "签约企业", dataIndex: "enterpriseName" },
      { title: "商品数", dataIndex: "itemCount", render: (v) => `${v} 款` },
      {
        title: "协议金额",
        dataIndex: "amount",
        render: (v) => `¥${Number(v).toLocaleString("zh-CN")}`,
      },
      {
        title: "有效期",
        render: (_, r) => `${r.effectiveDate} 至 ${r.expiryDate}`,
      },
      {
        title: "状态",
        dataIndex: "status",
        render: (v) => (
          <Tag color={Number(v) === 1 ? "green" : "default"}>
            {Number(v) === 1 ? "生效中" : "已停用"}
          </Tag>
        ),
      },
      {
        title: "操作",
        render: (_, r) => (
          <Space>
            <Button type="link" onClick={() => void openItems(r)}>
              商品管理
            </Button>
            <Button type="link" onClick={() => show(r)}>
              编辑
            </Button>
            <Button type="link" danger onClick={() => remove(r)}>
              删除
            </Button>
          </Space>
        ),
      },
    ];
  if (module === "orders")
    columns = [
      {
        title: "订单号",
        dataIndex: "orderNo",
        render: (v) => <strong>{v}</strong>,
      },
      { title: "企业", dataIndex: "enterpriseName" },
      {
        title: "商品",
        render: (_, r) => `${r.itemKinds} 种 / ${r.itemCount} 件`,
      },
      {
        title: "金额",
        dataIndex: "payableAmount",
        render: (v) => `¥${Number(v).toFixed(2)}`,
      },
      {
        title: "付款",
        dataIndex: "paymentStatus",
        render: (v) => (
          <Tag color={v === 2 ? "green" : "orange"}>
            {["待付款", "待确认", "已确认"][v]}
          </Tag>
        ),
      },
      {
        title: "状态",
        dataIndex: "orderStatus",
        render: (v) => (
          <Tag color="blue">
            {["待付款", "待发货", "运输中", "已完成", "已取消"][v]}
          </Tag>
        ),
      },
      { title: "下单时间", dataIndex: "createdAt", render: dateTime },
      {
        title: "操作",
        render: (_, r) => (
          <Space>
            <Button type="link" onClick={() => void orderDetail(r)}>
              详情
            </Button>
            {Number(r.orderStatus) < 3 && (
              <Button type="link" onClick={() => void advanceOrder(r)}>
                {Number(r.orderStatus) === 0 ? "确认到账" : "推进状态"}
              </Button>
            )}
          </Space>
        ),
      },
    ];
  const title =
    module === "products"
      ? "自营商品列表"
      : module === "enterprises"
        ? "企业客户列表"
        : module === "agreements"
          ? "采购协议列表"
          : "采购订单列表";
  return (
    <>
      <Card
        className="data-card"
        title={title}
        extra={
          module !== "orders" && (
            <Button type="primary" onClick={() => show()}>
              ＋ 新增
              {module === "products"
                ? "商品"
                : module === "enterprises"
                  ? "企业"
                  : "协议"}
            </Button>
          )
        }
      >
        <Table
          rowKey="id"
          loading={rows.loading}
          dataSource={rows.data}
          columns={columns}
          scroll={{ x: 1000 }}
        />
      </Card>
      <Modal
        open={open}
        title={
          mode === "stock"
            ? "调整库存"
            : `${editing ? "编辑" : "新增"}${module === "products" ? "商品" : module === "enterprises" ? "企业" : "协议"}`
        }
        onCancel={() => setOpen(false)}
        onOk={save}
        width={760}
      >
        <Form form={form} layout="vertical" className="two-column-form">
          {mode === "stock" ? (
            <Form.Item name="stock" label="总库存" rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
          ) : module === "products" ? (
            <>
              <Form.Item
                name="title"
                label="商品标题"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item name="spec" label="SKU规格">
                <Input placeholder="例如：黑色 / 标准版" />
              </Form.Item>
              <Form.Item
                name="categoryId"
                label="三级分类"
                rules={[{ required: true, message: "请选择三级分类" }]}
              >
                <Select
                  options={(categories.data || [])
                    .filter(
                      (x) => Number(x.level) === 3 && Number(x.status) === 1,
                    )
                    .map((x) => ({
                      value: x.id,
                      label: `${x.parentName || ""} / ${x.name}`,
                    }))}
                />
              </Form.Item>
              <Form.Item name="brandId" label="品牌">
                <Select
                  options={[
                    { value: 1, label: "联想" },
                    { value: 2, label: "得力" },
                  ]}
                />
              </Form.Item>
              <Form.Item
                name="marketPrice"
                label="市场价"
                rules={[{ required: true }]}
              >
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item
                name="memberPrice"
                label="会员价"
                rules={[{ required: true }]}
              >
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="stock" label="库存" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="status" label="状态">
                <Select
                  options={[
                    { value: 1, label: "在售" },
                    { value: 0, label: "草稿" },
                    { value: 2, label: "下架" },
                  ]}
                />
              </Form.Item>
              <Form.Item
                name="mainImage"
                label="商品主图"
                className="full"
                rules={[{ required: true, message: "请上传商品主图" }]}
              >
                <ProductImageUpload />
              </Form.Item>
              <Form.Item name="gallery" label="商品配图" className="full">
                <ProductImageUpload multiple />
              </Form.Item>
              <Form.Item name="attributes" label="商品属性" className="full">
                <Input.TextArea
                  rows={2}
                  placeholder="例如：颜色：黑色；保修：三年"
                />
              </Form.Item>
              <Form.Item name="summary" label="商品摘要" className="full">
                <Input.TextArea rows={2} />
              </Form.Item>
              <Form.Item name="detailHtml" label="富文本详情" className="full">
                <RichTextEditor />
              </Form.Item>
              <Form.Item name="deliveryDescription" label="配送说明" className="full">
                <Input.TextArea
                  rows={3}
                  placeholder="填写配送范围、预计时效、运费及安装等说明"
                />
              </Form.Item>
              <Form.Item name="afterSalesHtml" label="售后政策" className="full">
                <Input.TextArea
                  rows={4}
                  placeholder="填写退换货、质保、维修及售后联系方式，支持 HTML"
                />
              </Form.Item>
            </>
          ) : module === "enterprises" ? (
            <>
              <Form.Item
                name="name"
                label="企业名称"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="creditCode"
                label="统一社会信用代码"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="contactName"
                label="联系人"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="contactPhone"
                label="联系电话"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item name="address" label="企业地址" className="full">
                <Input />
              </Form.Item>
              <Form.Item name="status" label="状态">
                <Select
                  options={[
                    { value: 1, label: "正常" },
                    { value: 0, label: "停用" },
                  ]}
                />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item
                name="enterpriseId"
                label="签约企业"
                rules={[{ required: true }]}
              >
                <Select
                  options={(enterprises.data || []).map((x) => ({
                    value: x.id,
                    label: x.name,
                  }))}
                />
              </Form.Item>
              <Form.Item
                name="name"
                label="协议名称"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="amount"
                label="协议金额"
                rules={[{ required: true }]}
              >
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="status" label="状态">
                <Select
                  options={[
                    { value: 1, label: "生效中" },
                    { value: 0, label: "待生效" },
                    { value: 2, label: "停用" },
                  ]}
                />
              </Form.Item>
              <Form.Item
                name="effectiveDate"
                label="生效日期"
                rules={[{ required: true }]}
              >
                <Input type="date" />
              </Form.Item>
              <Form.Item
                name="expiryDate"
                label="到期日期"
                rules={[{ required: true }]}
              >
                <Input type="date" />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
      <Modal
        open={itemOpen}
        title={`${agreement?.name || ""} · 协议商品`}
        width={850}
        onCancel={() => setItemOpen(false)}
        footer={null}
      >
        <Space style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            onClick={() => {
              setEditing(undefined);
              setMode("item");
              form.setFieldsValue({ skuId: products.data?.[0]?.skuId });
            }}
          >
            ＋ 添加现有商品
          </Button>
        </Space>
        {mode === "item" && (
          <Form form={form} layout="inline" style={{ marginBottom: 16 }}>
            <Form.Item name="skuId" rules={[{ required: true }]}>
              <Select
                style={{ width: 280 }}
                disabled={!!editing}
                options={(products.data || []).map((x) => ({
                  value: x.skuId,
                  label: x.title,
                }))}
              />
            </Form.Item>
            <Form.Item name="agreementPrice" rules={[{ required: true }]}>
              <InputNumber min={0} placeholder="协议价" />
            </Form.Item>
            <Button onClick={() => void saveItem()} type="primary">
              保存
            </Button>
            <Button onClick={() => setMode("entity")}>取消</Button>
          </Form>
        )}
        <Table
          rowKey="id"
          dataSource={items}
          pagination={false}
          columns={[
            { title: "商品", dataIndex: "title" },
            { title: "SKU", dataIndex: "skuCode" },
            {
              title: "协议价",
              dataIndex: "agreementPrice",
              render: (v) => `¥${Number(v).toFixed(2)}`,
            },
            {
              title: "操作",
              render: (_, r) => (
                <Space>
                  <Button
                    type="link"
                    onClick={() => {
                      setEditing(r);
                      setMode("item");
                      form.setFieldsValue({
                        skuId: r.skuId,
                        agreementPrice: r.agreementPrice,
                      });
                    }}
                  >
                    改价
                  </Button>
                  <Button type="link" danger onClick={() => removeItem(r)}>
                    移除
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Modal>
      <Modal
        open={memberOpen}
        title={`${memberEnterprise?.name || ""} · 企业成员`}
        width={820}
        footer={null}
        onCancel={() => setMemberOpen(false)}
      >
        <Button
          type="primary"
          style={{ marginBottom: 16 }}
          onClick={() => showMember()}
        >
          ＋ 添加成员
        </Button>
        <Table
          rowKey="id"
          dataSource={members}
          pagination={false}
          columns={[
            {
              title: "成员",
              render: (_, r) => (
                <>
                  <strong>{r.realName}</strong>
                  <small className="subline">@{r.username}</small>
                </>
              ),
            },
            { title: "手机", dataIndex: "phone" },
            {
              title: "角色",
              dataIndex: "roleCode",
              render: (v) =>
                v === "ENTERPRISE_ADMIN" ? "企业管理员" : "采购员",
            },
            {
              title: "状态",
              dataIndex: "status",
              render: (v) => (
                <Tag color={Number(v) === 1 ? "green" : "default"}>
                  {Number(v) === 1 ? "启用" : "停用"}
                </Tag>
              ),
            },
            { title: "创建时间", dataIndex: "createdAt", render: dateTime },
            {
              title: "操作",
              render: (_, r) => (
                <Space>
                  <Button type="link" onClick={() => showMember(r)}>
                    编辑
                  </Button>
                  <Button type="link" danger onClick={() => removeMember(r)}>
                    删除
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Modal>
      <Modal
        open={memberEditorOpen}
        title={`${memberEditing ? "编辑" : "添加"}企业成员`}
        onCancel={() => setMemberEditorOpen(false)}
        onOk={() => void saveMember()}
      >
        <Form form={memberForm} layout="vertical">
          <Form.Item
            name="username"
            label="登录账号"
            rules={[{ required: true, message: "请输入登录账号" }]}
          >
            <Input disabled={!!memberEditing} />
          </Form.Item>
          <Form.Item
            name="password"
            label={memberEditing ? "重置密码" : "初始密码"}
            extra={memberEditing ? "如不修改密码，请保持为空" : undefined}
            rules={[
              { required: !memberEditing, message: "请输入初始密码" },
              { min: 8, max: 72, message: "密码长度必须为8至72位" },
            ]}
          >
            <Input.Password
              autoComplete="new-password"
              placeholder={
                memberEditing ? "输入新密码（可选）" : "请输入8至72位初始密码"
              }
            />
          </Form.Item>
          <Form.Item
            name="realName"
            label="姓名"
            rules={[{ required: true, message: "请输入姓名" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="phone"
            label="手机号码"
            rules={[
              { required: true, message: "请输入手机号码" },
              { pattern: /^1\d{10}$/, message: "请输入11位手机号码" },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="roleCode"
            label="企业角色"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: "BUYER", label: "采购员" },
                { value: "ENTERPRISE_ADMIN", label: "企业管理员" },
              ]}
            />
          </Form.Item>
          <Form.Item name="status" label="账号状态">
            <Select
              options={[
                { value: 1, label: "启用" },
                { value: 0, label: "停用" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        open={!!detail}
        title="订单详情"
        width={1080}
        footer={null}
        onCancel={() => setDetail(undefined)}
      >
        {detail && (
          <>
            <Descriptions
              bordered
              column={2}
              items={[
                { key: "no", label: "订单号", children: detail.order.orderNo },
                {
                  key: "ent",
                  label: "企业",
                  children: detail.order.enterpriseName,
                },
                {
                  key: "buyer",
                  label: "采购人",
                  children: detail.order.buyerName,
                },
                {
                  key: "amount",
                  label: "应付金额",
                  children: `¥${Number(detail.order.payableAmount).toFixed(2)}`,
                },
                {
                  key: "createdAt",
                  label: "下单时间",
                  children: dateTime(detail.order.createdAt),
                },
                {
                  key: "status",
                  label: "付款状态",
                  children:
                    ["待付款", "待确认", "已确认"][
                      Number(detail.order.paymentStatus)
                    ] || "处理中",
                },
              ]}
            />
            <Table
              className="admin-order-detail-table"
              rowKey="id"
              pagination={false}
              dataSource={detail.items}
              columns={[
                {
                  title: "商品",
                  dataIndex: "title",
                  width: 250,
                  render: (_: any, row: Row) => (
                    <div className="admin-order-product">
                      {row.mainImage ? (
                        <img src={row.mainImage} alt={row.title} />
                      ) : (
                        <i>商</i>
                      )}
                      <span>
                        <strong>{row.title}</strong>
                        <small>{row.skuCode}</small>
                        <small>配送单：{row.subOrderNo}</small>
                      </span>
                    </div>
                  ),
                },
                {
                  title: "配送地址",
                  dataIndex: "addressSnapshot",
                  width: 310,
                  render: (value: any) => (
                    <div className="admin-delivery-address">
                      {deliveryAddress(value)}
                    </div>
                  ),
                },
                { title: "数量", dataIndex: "quantity", width: 70 },
                {
                  title: "单价",
                  dataIndex: "unitPrice",
                  width: 100,
                  render: (v) => `¥${Number(v).toFixed(2)}`,
                },
                {
                  title: "小计",
                  dataIndex: "totalPrice",
                  width: 110,
                  render: (v) => `¥${Number(v).toFixed(2)}`,
                },
              ]}
            />
          </>
        )}
      </Modal>
    </>
  );
}

function Categories() {
  const { message, modal } = AntApp.useApp();
  const rows = useLoad<Row[]>(() => rootApi("/api/admin/business/categories"));
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row>();
  const show = (row?: Row) => {
    setEditing(row);
    form.resetFields();
    form.setFieldsValue(
      row
        ? { ...row, parentId: row.parentId || undefined }
        : { level: 1, sortOrder: 0, status: 1 },
    );
    setOpen(true);
  };
  const save = async () => {
    try {
      const values = await form.validateFields();
      const response = await fetch(
        `/api/admin/business/categories${editing ? `/${editing.id}` : ""}`,
        {
          method: editing ? "PUT" : "POST",
          headers: apiHeaders(),
          body: JSON.stringify(values),
        },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "分类保存失败");
      }
      setOpen(false);
      message.success("分类已保存");
      void rows.refresh();
    } catch (error) {
      message.error((error as Error).message);
    }
  };
  const remove = (row: Row) =>
    modal.confirm({
      title: `确认删除分类“${row.name}”？`,
      content: "存在子分类或关联商品时不能删除。",
      okButtonProps: { danger: true },
      onOk: async () => {
        const response = await fetch(
          `/api/admin/business/categories/${row.id}`,
          { method: "DELETE", headers: apiHeaders() },
        );
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.detail || "分类删除失败");
        }
        message.success("分类已删除");
        void rows.refresh();
      },
    });
  const level = Form.useWatch("level", form);
  const parentOptions = (rows.data || [])
    .filter(
      (row) =>
        Number(row.level) === Number(level) - 1 &&
        Number(row.status) === 1 &&
        row.id !== editing?.id,
    )
    .map((row) => ({ value: row.id, label: `${row.level}级 · ${row.name}` }));
  const columns: ColumnsType<Row> = [
    {
      title: "分类名称",
      render: (_, row) => (
        <div className="user-cell">
          <i>{row.level}</i>
          <span>
            <strong>{row.name}</strong>
            <small>
              {row.parentName ? `上级：${row.parentName}` : "一级分类"}
            </small>
          </span>
        </div>
      ),
    },
    {
      title: "级别",
      dataIndex: "level",
      render: (value) => (
        <Tag
          color={
            Number(value) === 1
              ? "blue"
              : Number(value) === 2
                ? "cyan"
                : "purple"
          }
        >
          {value}级
        </Tag>
      ),
    },
    { title: "排序", dataIndex: "sortOrder" },
    {
      title: "子分类",
      dataIndex: "childCount",
      render: (value) => `${value} 个`,
    },
    {
      title: "商品",
      dataIndex: "productCount",
      render: (value) => `${value} 款`,
    },
    {
      title: "状态",
      dataIndex: "status",
      render: (value) => (
        <Tag color={Number(value) === 1 ? "green" : "default"}>
          {Number(value) === 1 ? "启用" : "停用"}
        </Tag>
      ),
    },
    {
      title: "操作",
      render: (_, row) => (
        <Space>
          <Button type="link" onClick={() => show(row)}>
            编辑
          </Button>
          <Button type="link" danger onClick={() => remove(row)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];
  return (
    <>
      <Card
        className="data-card"
        title="三级商品分类"
        extra={
          <Button type="primary" onClick={() => show()}>
            ＋ 新增分类
          </Button>
        }
      >
        <Table
          rowKey="id"
          loading={rows.loading}
          dataSource={rows.data}
          columns={columns}
        />
      </Card>
      <Modal
        open={open}
        title={`${editing ? "编辑" : "新增"}分类`}
        onCancel={() => setOpen(false)}
        onOk={() => void save()}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="分类名称"
            rules={[{ required: true, message: "请输入分类名称" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="level" label="分类级别" rules={[{ required: true }]}>
            <Select
              onChange={() => form.setFieldValue("parentId", undefined)}
              options={[1, 2, 3].map((value) => ({
                value,
                label: `${value}级分类`,
              }))}
            />
          </Form.Item>
          {Number(level) > 1 && (
            <Form.Item
              name="parentId"
              label="上级分类"
              rules={[{ required: true, message: "请选择上级分类" }]}
            >
              <Select options={parentOptions} />
            </Form.Item>
          )}
          <Form.Item name="icon" label="分类图标">
            <Input placeholder="图标文字或 OSS 图片地址" />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              options={[
                { value: 1, label: "启用" },
                { value: 0, label: "停用" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function PortalManager({ module }: { module: Module }) {
  const { message, modal } = AntApp.useApp();
  const meta: Record<string, { title: string; type: string; name: string }> = {
    brands: { title: "品牌列表", type: "brands/list", name: "品牌" },
    platforms: { title: "采购平台列表", type: "platform", name: "平台" },
    navigations: { title: "客户端导航栏", type: "navigation", name: "导航" },
    banners: { title: "首页轮播图", type: "banner", name: "轮播图" },
    solutions: { title: "采购方案列表", type: "solution", name: "方案" },
    contents: { title: "门户内容列表", type: "content", name: "内容" },
  };
  const current = meta[module];
  const endpoint = `/api/admin/content/${current.type}`;
  const rows = useLoad<Row[]>(() => rootApi(endpoint), [module]);
  const products = useLoad<Row[]>(() =>
    rootApi("/api/admin/business/products"),
  );
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row>();
  const [relationForm] = Form.useForm();
  const [platform, setPlatform] = useState<Row>();
  const [relations, setRelations] = useState<Row[]>([]);
  const [productOpen, setProductOpen] = useState(false);
  const [relationEditing, setRelationEditing] = useState<Row>();
  const [relationEditorOpen, setRelationEditorOpen] = useState(false);
  const isBrand = module === "brands";
  const show = (row?: Row) => {
    setEditing(row);
    form.resetFields();
    form.setFieldsValue(row || { sortOrder: 0, status: 1 });
    setOpen(true);
  };
  const save = async () => {
    try {
      const values = await form.validateFields();
      const response = await fetch(
        `${endpoint}${editing ? `/${editing.id}` : ""}`,
        {
          method: editing ? "PUT" : "POST",
          headers: apiHeaders(),
          body: JSON.stringify(values),
        },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || data.message || "保存失败");
      }
      setOpen(false);
      message.success(`${current.name}已保存`);
      void rows.refresh();
    } catch (error) {
      if (error instanceof Error) message.error(error.message);
    }
  };
  const remove = (row: Row) =>
    modal.confirm({
      title: `确认删除“${row.title || row.name}”？`,
      okButtonProps: { danger: true },
      onOk: async () => {
        const response = await fetch(`${endpoint}/${row.id}`, {
          method: "DELETE",
          headers: apiHeaders(),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.detail || "删除失败");
        }
        message.success("删除成功");
        void rows.refresh();
      },
    });
  const loadPlatformProducts = async (row: Row) => {
    setPlatform(row);
    setRelations(
      await rootApi(`/api/admin/content/platform/${row.id}/products`),
    );
    setProductOpen(true);
  };
  const showRelation = (row?: Row) => {
    setRelationEditing(row);
    relationForm.resetFields();
    relationForm.setFieldsValue(
      row || { skuId: products.data?.[0]?.skuId, listingStatus: 1 },
    );
    setRelationEditorOpen(true);
  };
  const saveRelation = async () => {
    try {
      const values = await relationForm.validateFields();
      const url = `/api/admin/content/platform/${platform!.id}/products${relationEditing ? `/${relationEditing.id}` : ""}`;
      const response = await fetch(url, {
        method: relationEditing ? "PUT" : "POST",
        headers: apiHeaders(),
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "平台商品保存失败");
      }
      setRelations(
        await rootApi(`/api/admin/content/platform/${platform!.id}/products`),
      );
      setRelationEditorOpen(false);
      message.success("平台商品已保存");
    } catch (error) {
      message.error((error as Error).message);
    }
  };
  const removeRelation = (row: Row) =>
    modal.confirm({
      title: `确认移除“${row.title}”？`,
      onOk: async () => {
        await fetch(
          `/api/admin/content/platform/${platform!.id}/products/${row.id}`,
          { method: "DELETE", headers: apiHeaders() },
        );
        setRelations(
          await rootApi(`/api/admin/content/platform/${platform!.id}/products`),
        );
        message.success("平台商品已移除");
      },
    });
  const columns: ColumnsType<Row> = [
    {
      title: current.name,
      render: (_, row) => (
        <div className="user-cell">
          <i>{current.name.slice(0, 1)}</i>
          <span>
            <strong>{row.title || row.name}</strong>
            <small>{row.subtitle || row.description || "—"}</small>
          </span>
        </div>
      ),
    },
    ...(isBrand
      ? []
      : [
          {
            title: "跳转链接",
            dataIndex: "linkUrl",
            render: (v: string) => v || "—",
          },
        ]),
    { title: "排序", dataIndex: "sortOrder", width: 90 },
    {
      title: "状态",
      dataIndex: "status",
      width: 100,
      render: (v: number) => (
        <Tag color={Number(v) === 1 ? "green" : "default"}>
          {Number(v) === 1 ? "启用" : "停用"}
        </Tag>
      ),
    },
    {
      title: "更新时间",
      dataIndex: isBrand ? "createdAt" : "updatedAt",
      render: dateTime,
    },
    {
      title: "操作",
      width: module === "platforms" ? 250 : 150,
      render: (_, row) => (
        <Space>
          {module === "platforms" && (
            <Button type="link" onClick={() => void loadPlatformProducts(row)}>
              商品管理
            </Button>
          )}
          <Button type="link" onClick={() => show(row)}>
            编辑
          </Button>
          <Button type="link" danger onClick={() => remove(row)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];
  return (
    <>
      <Card
        className="data-card"
        title={current.title}
        extra={
          <Button type="primary" onClick={() => show()}>
            ＋ 新增{current.name}
          </Button>
        }
      >
        <Table
          rowKey="id"
          loading={rows.loading}
          dataSource={rows.data}
          columns={columns}
        />
      </Card>
      <Modal
        open={open}
        title={`${editing ? "编辑" : "新增"}${current.name}`}
        width={680}
        onCancel={() => setOpen(false)}
        onOk={() => void save()}
      >
        <Form form={form} layout="vertical" className="two-column-form">
          <Form.Item
            name={isBrand ? "name" : "title"}
            label={`${current.name}名称`}
            rules={[{ required: true, message: `请输入${current.name}名称` }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            name={isBrand ? "description" : "subtitle"}
            label="说明"
            className="full"
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item
            name={isBrand ? "logo" : "imageUrl"}
            label={isBrand ? "品牌 Logo" : "展示图片"}
            className="full"
            rules={
              module === "banners"
                ? [{ required: true, message: "请上传轮播图片" }]
                : undefined
            }
          >
            <ProductImageUpload
              kind={
                isBrand
                  ? "brand"
                  : module === "banners"
                    ? "banner"
                    : "portal"
              }
            />
          </Form.Item>
          {!isBrand && (
            <Form.Item name="linkUrl" label="跳转链接" className="full">
              <Input placeholder="/web/?view=products 或 https://..." />
            </Form.Item>
          )}
          <Form.Item name="status" label="状态">
            <Select
              options={[
                { value: 1, label: "启用" },
                { value: 0, label: "停用" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        open={productOpen}
        title={`${platform?.title || ""} · 平台商品`}
        width={940}
        footer={null}
        onCancel={() => setProductOpen(false)}
      >
        <Space style={{ marginBottom: 16 }}>
          <Button type="primary" onClick={() => showRelation()}>
            ＋ 添加商品
          </Button>
          <Typography.Text
            copyable={{
              text: `/web/?view=platform-products&platformId=${platform?.id}`,
            }}
          >
            导航入口：/web/?view=platform-products&amp;platformId={platform?.id}
          </Typography.Text>
        </Space>
        <Table
          rowKey="id"
          dataSource={relations}
          pagination={false}
          columns={[
            {
              title: "商品",
              render: (_, r) => (
                <>
                  <strong>{r.title}</strong>
                  <small className="subline">{r.skuCode}</small>
                </>
              ),
            },
            {
              title: "平台价",
              dataIndex: "platformPrice",
              render: (v) => `¥${Number(v).toFixed(2)}`,
            },
            { title: "平台链接", dataIndex: "productUrl", ellipsis: true },
            {
              title: "状态",
              dataIndex: "listingStatus",
              render: (v) => (
                <Tag color={Number(v) === 1 ? "green" : "default"}>
                  {Number(v) === 1 ? "上架" : "下架"}
                </Tag>
              ),
            },
            { title: "点击量", dataIndex: "clickCount" },
            {
              title: "操作",
              render: (_, r) => (
                <Space>
                  <Button type="link" onClick={() => showRelation(r)}>
                    编辑
                  </Button>
                  <Button type="link" danger onClick={() => removeRelation(r)}>
                    移除
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Modal>
      <Modal
        open={relationEditorOpen}
        title={`${relationEditing ? "编辑" : "添加"}平台商品`}
        onCancel={() => setRelationEditorOpen(false)}
        onOk={() => void saveRelation()}
      >
        <Form form={relationForm} layout="vertical">
          <Form.Item
            name="skuId"
            label="关联现有商品"
            rules={[{ required: true, message: "请选择商品" }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              disabled={!!relationEditing}
              options={(products.data || []).map((row) => ({
                value: row.skuId,
                label: `${row.title} · ${row.skuCode}`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="platformPrice"
            label="平台售价"
            rules={[{ required: true, message: "请输入平台售价" }]}
          >
            <InputNumber min={0} precision={2} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            name="productUrl"
            label="平台商品链接"
            extra="选填；不填写时 Web/H5 不显示平台跳转入口"
          >
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="listingStatus" label="上架状态">
            <Select
              options={[
                { value: 1, label: "上架" },
                { value: 0, label: "下架" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const { message } = AntApp.useApp();
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    setLoading(true);
    try {
      setData(await loader());
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
  }, deps);
  return { data, loading, refresh };
}

function Overview({ go }: { go: (value: Module) => void }) {
  const { data = {}, loading } = useLoad<Row>(() => api("/summary"));
  const metrics = [
    ["后台用户", data.users ?? 0, "用", "#e9f2ff"],
    ["系统角色", data.roles ?? 0, "角", "#e8faf6"],
    ["权限点", data.permissions ?? 0, "权", "#f4edff"],
    ["今日操作", data.todayLogs ?? 0, "志", "#fff4e5"],
  ];
  return (
    <>
      <div className="metric-grid">
        {metrics.map(([label, value, icon, color]) => (
          <Card loading={loading} key={label as string}>
            <div className="metric">
              <div>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>数据来自正式数据库</small>
              </div>
              <i style={{ background: color as string }}>{icon}</i>
            </div>
          </Card>
        ))}
      </div>
      <div className="overview-grid">
        <Card
          title="系统管理快捷入口"
          extra={<Tag color="green">权限系统已启用</Tag>}
        >
          <div className="quick-grid">
            {[
              ["users", "用户管理", "创建用户、分配角色与状态控制", "用"],
              ["roles", "角色管理", "配置角色的业务操作权限", "角"],
              ["permissions", "权限清单", "查看全部权限点与模块", "权"],
              ["logs", "操作审计", "追踪增删改和配置变更", "志"],
            ].map((item) => (
              <button key={item[0]} onClick={() => go(item[0] as Module)}>
                <i>{item[3]}</i>
                <span>
                  <strong>{item[1]}</strong>
                  <small>{item[2]}</small>
                </span>
                <em>›</em>
              </button>
            ))}
          </div>
        </Card>
        <Card title="安全检查">
          <div className="security-list">
            <p>
              <i className="ok">✓</i>
              <span>
                <strong>数据库迁移</strong>
                <small>结构版本已由 Flyway 管理</small>
              </span>
            </p>
            <p>
              <i className="ok">✓</i>
              <span>
                <strong>操作审计</strong>
                <small>系统变更自动写入操作日志</small>
              </span>
            </p>
            <p>
              <i className="warn">!</i>
              <span>
                <strong>开发账号</strong>
                <small>上线前需替换临时 Basic Auth</small>
              </span>
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}

function Users() {
  const { message, modal } = AntApp.useApp();
  const roles = useLoad<Row[]>(() => api("/roles"));
  const users = useLoad<Row[]>(() => api("/users"));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row>();
  const [form] = Form.useForm();
  const show = (row?: Row) => {
    setEditing(row);
    form.setFieldsValue(
      row
        ? {
            ...row,
            roleIds: String(row.roleIds || "")
              .split(",")
              .filter(Boolean)
              .map(Number),
            password: "",
          }
        : { status: 1, roleIds: [] },
    );
    setOpen(true);
  };
  const save = async () => {
    try {
      const values = await form.validateFields();
      await api(editing ? `/users/${editing.id}` : "/users", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(values),
      });
      message.success(editing ? "用户已更新" : "用户已创建");
      setOpen(false);
      void users.refresh();
    } catch (error) {
      if (error instanceof Error) message.error(error.message);
    }
  };
  const remove = (row: Row) =>
    modal.confirm({
      title: `确认删除用户“${row.realName}”？`,
      content: "删除后该账号将无法登录。",
      okText: "确认删除",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api(`/users/${row.id}`, { method: "DELETE" });
          message.success("用户已删除");
          void users.refresh();
        } catch (error) {
          message.error((error as Error).message);
        }
      },
    });
  const columns: ColumnsType<Row> = [
    {
      title: "用户",
      render: (_, row) => (
        <div className="user-cell">
          <i>{row.realName?.slice(0, 1)}</i>
          <span>
            <strong>{row.realName}</strong>
            <small>@{row.username}</small>
          </span>
        </div>
      ),
    },
    {
      title: "联系方式",
      render: (_, row) => (
        <span>
          {row.phone || "—"}
          <small className="subline">{row.email || "—"}</small>
        </span>
      ),
    },
    {
      title: "角色",
      dataIndex: "roleNames",
      render: (value) => <Tag color="blue">{value || "未分配"}</Tag>,
    },
    {
      title: "状态",
      dataIndex: "status",
      render: (value) => (
        <Tag color={value ? "green" : "default"}>{value ? "启用" : "停用"}</Tag>
      ),
    },
    { title: "最近登录", dataIndex: "lastLoginAt", render: dateTime },
    { title: "创建时间", dataIndex: "createdAt", render: dateTime },
    {
      title: "操作",
      fixed: "right",
      render: (_, row) => (
        <Space>
          <Button type="link" onClick={() => show(row)}>
            编辑
          </Button>
          <Button
            type="link"
            danger
            disabled={row.id === 1}
            onClick={() => remove(row)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];
  return (
    <Card
      className="data-card"
      title="后台用户列表"
      extra={
        <Button type="primary" onClick={() => show()}>
          ＋ 新增用户
        </Button>
      }
    >
      <Table
        rowKey="id"
        loading={users.loading}
        dataSource={users.data}
        columns={columns}
        scroll={{ x: 1050 }}
        pagination={{ pageSize: 8, showTotal: (n) => `共 ${n} 位用户` }}
      />
      <Modal
        open={open}
        title={editing ? "编辑用户" : "新增用户"}
        onCancel={() => setOpen(false)}
        onOk={save}
        okText="保存"
        width={680}
      >
        <Form form={form} layout="vertical" className="two-column-form">
          <Form.Item
            name="username"
            label="登录账号"
            rules={[{ required: true, message: "请输入登录账号" }]}
          >
            <Input placeholder="例如：operation01" />
          </Form.Item>
          <Form.Item
            name="realName"
            label="姓名"
            rules={[{ required: true, message: "请输入姓名" }]}
          >
            <Input placeholder="请输入真实姓名" />
          </Form.Item>
          <Form.Item name="phone" label="手机号码">
            <Input placeholder="请输入手机号码" />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input placeholder="name@example.com" />
          </Form.Item>
          <Form.Item
            name="password"
            label={editing ? "重置密码（不修改请留空）" : "初始密码"}
            rules={
              editing
                ? []
                : [
                    { required: true, message: "请输入初始密码" },
                    { min: 8, message: "至少8位" },
                  ]
            }
          >
            <Input.Password />
          </Form.Item>
          <Form.Item name="status" label="账号状态">
            <Select
              options={[
                { value: 1, label: "启用" },
                { value: 0, label: "停用" },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="roleIds"
            label="分配角色"
            className="full"
            rules={[{ required: true, message: "至少选择一个角色" }]}
          >
            <Select
              mode="multiple"
              options={(roles.data || []).map((r) => ({
                value: r.id,
                label: r.name,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

function Roles() {
  const { message, modal } = AntApp.useApp();
  const roles = useLoad<Row[]>(() => api("/roles"));
  const permissions = useLoad<Row[]>(() => api("/permissions"));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row>();
  const [form] = Form.useForm();
  const grouped = useMemo(
    () =>
      Object.entries(
        (permissions.data || []).reduce((a: Record<string, Row[]>, p) => {
          (a[p.module] ??= []).push(p);
          return a;
        }, {}),
      ),
    [permissions.data],
  );
  const show = (row?: Row) => {
    setEditing(row);
    form.setFieldsValue(
      row
        ? {
            ...row,
            permissionIds: String(row.permissionIds || "")
              .split(",")
              .filter(Boolean)
              .map(Number),
          }
        : { status: 1, permissionIds: [] },
    );
    setOpen(true);
  };
  const save = async () => {
    try {
      const values = await form.validateFields();
      await api(editing ? `/roles/${editing.id}` : "/roles", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(values),
      });
      message.success("角色已保存");
      setOpen(false);
      void roles.refresh();
    } catch (error) {
      if (error instanceof Error) message.error(error.message);
    }
  };
  const remove = (row: Row) =>
    modal.confirm({
      title: `删除角色“${row.name}”？`,
      content: "有关联用户的角色不能删除。",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api(`/roles/${row.id}`, { method: "DELETE" });
          message.success("角色已删除");
          void roles.refresh();
        } catch (error) {
          message.error((error as Error).message);
        }
      },
    });
  return (
    <div className="role-layout">
      <Card
        className="data-card"
        title="角色列表"
        extra={
          <Button type="primary" onClick={() => show()}>
            ＋ 新增角色
          </Button>
        }
      >
        <Table
          rowKey="id"
          loading={roles.loading}
          dataSource={roles.data}
          pagination={false}
          columns={[
            {
              title: "角色名称",
              render: (_, r) => (
                <>
                  <strong>{r.name}</strong>
                  <small className="subline">{r.roleCode}</small>
                </>
              ),
            },
            { title: "说明", dataIndex: "description" },
            {
              title: "用户数",
              dataIndex: "userCount",
              render: (v) => `${v} 人`,
            },
            {
              title: "状态",
              dataIndex: "status",
              render: (v) => (
                <Tag color={v ? "green" : "default"}>{v ? "启用" : "停用"}</Tag>
              ),
            },
            {
              title: "操作",
              render: (_, r) => (
                <Space>
                  <Button type="link" onClick={() => show(r)}>
                    配置权限
                  </Button>
                  <Button
                    type="link"
                    danger
                    disabled={r.id === 1}
                    onClick={() => remove(r)}
                  >
                    删除
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>
      <Drawer
        open={open}
        width={600}
        title={editing ? "编辑角色" : "新增角色"}
        onClose={() => setOpen(false)}
        extra={
          <Button type="primary" onClick={save}>
            保存角色
          </Button>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="角色名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="roleCode"
            label="角色编码"
            rules={[{ required: true }]}
          >
            <Input placeholder="例如：CONTENT_EDITOR" />
          </Form.Item>
          <Form.Item name="description" label="角色说明">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              options={[
                { value: 1, label: "启用" },
                { value: 0, label: "停用" },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="permissionIds"
            label="权限范围"
            rules={[{ required: true, message: "至少选择一个权限" }]}
          >
            <Checkbox.Group className="permission-groups">
              {grouped.map(([module, items]) => (
                <section key={module}>
                  <strong>{module}</strong>
                  {items.map((p) => (
                    <Checkbox key={p.id} value={p.id}>
                      {p.name}
                      <small>{p.description}</small>
                    </Checkbox>
                  ))}
                </section>
              ))}
            </Checkbox.Group>
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}

function Permissions() {
  const result = useLoad<Row[]>(() => api("/permissions"));
  return (
    <Card
      className="data-card"
      title="权限点清单"
      extra={<Tag color="blue">权限由代码注册，避免误删</Tag>}
    >
      <Table
        rowKey="id"
        loading={result.loading}
        dataSource={result.data}
        columns={[
          {
            title: "所属模块",
            dataIndex: "module",
            filters: [...new Set((result.data || []).map((x) => x.module))].map(
              (v) => ({ text: v, value: v }),
            ),
            onFilter: (v, r) => r.module === v,
          },
          {
            title: "权限名称",
            dataIndex: "name",
            render: (v) => <strong>{v}</strong>,
          },
          {
            title: "权限编码",
            dataIndex: "permissionCode",
            render: (v) => <code>{v}</code>,
          },
          { title: "说明", dataIndex: "description" },
        ]}
      />
    </Card>
  );
}

function Logs() {
  const result = useLoad<Row[]>(() => api("/logs"));
  const [detail, setDetail] = useState<Row>();
  return (
    <Card
      className="data-card"
      title="操作日志"
      extra={
        <Space>
          <Tag color="green">保留最近 200 条</Tag>
          <Button onClick={result.refresh}>刷新</Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        loading={result.loading}
        dataSource={result.data}
        columns={[
          { title: "操作时间", dataIndex: "createdAt", render: dateTime },
          { title: "模块", dataIndex: "module" },
          {
            title: "操作",
            dataIndex: "action",
            render: (v) => <strong>{v}</strong>,
          },
          {
            title: "对象",
            render: (_, r) => (
              <>
                <span>{r.targetType}</span>
                <small className="subline">ID：{r.targetId}</small>
              </>
            ),
          },
          {
            title: "操作人",
            dataIndex: "operatorId",
            render: (v) => `管理员 #${v}`,
          },
          { title: "IP地址", dataIndex: "ip" },
          {
            title: "结果",
            dataIndex: "result",
            render: (v) => (
              <Tag color={v === "SUCCESS" ? "green" : "red"}>
                {v === "SUCCESS" ? "成功" : "失败"}
              </Tag>
            ),
          },
          {
            title: "",
            render: (_, r) => (
              <Button type="link" onClick={() => setDetail(r)}>
                详情
              </Button>
            ),
          },
        ]}
        pagination={{ pageSize: 10 }}
      />
      <Modal
        open={!!detail}
        footer={null}
        title="操作日志详情"
        onCancel={() => setDetail(undefined)}
      >
        <Descriptions
          column={1}
          bordered
          items={
            detail
              ? Object.entries(detail).map(([key, value]) => ({
                  key,
                  label: key,
                  children: String(value ?? "—"),
                }))
              : []
          }
        />
      </Modal>
    </Card>
  );
}

function Configs() {
  const { message } = AntApp.useApp();
  const result = useLoad<Row[]>(() => api("/configs"));
  const [saving, setSaving] = useState<number>();
  const save = async (row: Row, value: any) => {
    setSaving(row.id);
    try {
      await api(`/configs/${row.id}`, {
        method: "PUT",
        body: JSON.stringify({
          configValue: String(value),
          description: row.description,
          isPublic: row.isPublic,
        }),
      });
      message.success(`${row.description}已保存`);
      void result.refresh();
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setSaving(undefined);
    }
  };
  const groups = useMemo(
    () =>
      Object.entries(
        (result.data || []).reduce((a: Record<string, Row[]>, r) => {
          (a[r.groupName] ??= []).push(r);
          return a;
        }, {}),
      ),
    [result.data],
  );
  return (
    <div className="config-layout">
      {groups.map(([group, items]) => (
        <Card key={group} title={group}>
          {items.map((row) => (
            <ConfigRow
              key={row.id}
              row={row}
              saving={saving === row.id}
              save={(value) => save(row, value)}
            />
          ))}
        </Card>
      ))}
    </div>
  );
}

function ConfigRow({
  row,
  saving,
  save,
}: {
  row: Row;
  saving: boolean;
  save: (value: any) => void;
}) {
  const [value, setValue] = useState<any>(row.configValue);
  useEffect(() => setValue(row.configValue), [row.configValue]);
  return (
    <div className="config-row">
      <div>
        <strong>{row.description}</strong>
        <small>
          {row.configKey} · 最近更新 {dateTime(row.updatedAt)}
        </small>
      </div>
      {row.valueType === "BOOLEAN" ? (
        <Switch
          checked={value === "true"}
          onChange={(checked) => {
            setValue(String(checked));
            void save(checked);
          }}
        />
      ) : row.valueType === "NUMBER" ? (
        <InputNumber value={Number(value)} min={0} onChange={setValue} />
      ) : (
        <Input value={value} onChange={(e) => setValue(e.target.value)} />
      )}
      {row.valueType !== "BOOLEAN" && (
        <Button loading={saving} onClick={() => save(value)}>
          保存
        </Button>
      )}
    </div>
  );
}
