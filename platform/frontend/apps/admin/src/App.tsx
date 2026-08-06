import { useEffect, useMemo, useRef, useState } from "react";
import type { Key, ReactNode } from "react";
import {
  App as AntApp,
  Alert,
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
  Radio,
  Select,
  Space,
  Statistic,
  Switch,
  Table as AntTable,
  Tabs,
  Tag,
  Typography,
  Upload,
} from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import type { UploadFile } from "antd/es/upload/interface";
import zhCN from "antd/locale/zh_CN";

type Row = Record<string, any>;

type ManagedTableProps<T extends Row> = TableProps<T> & {
  searchPlaceholder?: string;
  server?: {
    total: number;
    page: number;
    pageSize: number;
    keyword: string;
    status?: string;
    setKeyword: (value: string) => void;
    setStatus: (value?: string) => void;
    setPage: (page: number, pageSize: number) => void;
    statusOptions?: { label: string; value: string }[];
  };
};

function Table<T extends Row>({
  dataSource = [],
  pagination,
  rowKey = "id",
  rowSelection,
  server,
  searchPlaceholder = "搜索当前列表的名称、编码或关键字段",
  ...props
}: ManagedTableProps<T>) {
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<string>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const source = dataSource as T[];
  const flatRows = useMemo(() => {
    const result: T[] = [];
    const visit = (items: readonly T[]) => items.forEach((item) => {
      result.push(item);
      if (Array.isArray(item.children)) visit(item.children);
    });
    visit(source);
    return result;
  }, [source]);
  const hasStatus = flatRows.some((row) => row.status !== undefined && row.status !== null);
  const matches = (row: T) => {
    const keywordMatched = !keyword.trim() || Object.entries(row).some(([key, value]) =>
      key !== "children" && ["string", "number"].includes(typeof value) &&
      String(value).toLowerCase().includes(keyword.trim().toLowerCase()),
    );
    return keywordMatched && (!status || String(row.status) === status);
  };
  const filterTree = (items: readonly T[]): T[] => items.flatMap((row) => {
    const children = Array.isArray(row.children) ? filterTree(row.children) : [];
    return matches(row) || children.length ? [{ ...row, ...(children.length ? { children } : {}) }] : [];
  });
  const filteredRows = server ? source : filterTree(source);
  const keyOf = (row: T, index: number): Key =>
    typeof rowKey === "function" ? rowKey(row) : (row[rowKey as string] ?? index);
  const selected = flatRows.filter((row, index) => selectedRowKeys.includes(keyOf(row, index)));
  const exportSelected = () => {
    if (!selected.length) return;
    const keys = [...new Set(selected.flatMap((row) => Object.keys(row)).filter((key) => key !== "children"))];
    const cell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = "\ufeff" + [keys.map(cell).join(","), ...selected.map((row) => keys.map((key) => cell(row[key])).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `列表选中数据-${Date.now()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const pager = {
    current: server?.page,
    total: server?.total,
    pageSize: server?.pageSize || (typeof pagination === "object" ? pagination.pageSize : 10),
    ...(typeof pagination === "object" ? pagination : {}),
    showSizeChanger: true,
    showQuickJumper: true,
    pageSizeOptions: ["10", "20", "50", "100"],
    showTotal: typeof pagination === "object" && pagination.showTotal
      ? pagination.showTotal
      : (total: number) => `共 ${total} 条`,
  };
  return <div className="managed-table">
    <div className="managed-table-toolbar">
      <Space wrap>
        <Input.Search allowClear value={server ? server.keyword : keyword} onChange={(event) => server ? server.setKeyword(event.target.value) : setKeyword(event.target.value)} placeholder={searchPlaceholder} style={{ width: 320 }} />
        {(hasStatus || server) && <Select allowClear value={server ? server.status : status} onChange={(value) => server ? server.setStatus(value) : setStatus(value)} placeholder="全部状态" style={{ width: 150 }} options={server?.statusOptions || [{ label: "启用 / 正常 / 在售", value: "1" }, { label: "停用 / 禁用 / 下架", value: "0" }]} />}
      </Space>
      <Space>
        <span className="selection-summary">已选 {selectedRowKeys.length} 项</span>
        <Button disabled={!selected.length} onClick={exportSelected}>批量导出选中</Button>
        <Button disabled={!selectedRowKeys.length} onClick={() => {
          setSelectedRowKeys([]);
          rowSelection?.onChange?.([], [], { type: "none" });
        }}>清空选择</Button>
      </Space>
    </div>
    <AntTable<T>
      {...props}
      rowKey={rowKey}
      dataSource={filteredRows}
      rowSelection={{
        ...rowSelection,
        preserveSelectedRowKeys: true,
        selectedRowKeys: rowSelection?.selectedRowKeys || selectedRowKeys,
        onChange: (keys, selectedRows, info) => {
          setSelectedRowKeys(keys);
          rowSelection?.onChange?.(keys, selectedRows, info);
        },
      }}
      pagination={pager}
      onChange={(nextPagination, filters, sorter, extra) => {
        if (server) server.setPage(nextPagination.current || 1, nextPagination.pageSize || server.pageSize);
        props.onChange?.(nextPagination, filters, sorter, extra);
      }}
    />
  </div>;
}
type Module =
  | "overview"
  | "products"
  | "categories"
  | "attributes"
  | "brands"
  | "platforms"
  | "platformProducts"
  | "platformOrders"
  | "navigations"
  | "banners"
  | "solutions"
  | "solutionProducts"
  | "contents"
  | "enterprises"
  | "enterpriseUsers"
  | "agreements"
  | "agreementProducts"
  | "agreementOrders"
  | "orders"
  | "users"
  | "roles"
  | "permissions"
  | "logs"
  | "configs";
const adminCredential = () => sessionStorage.getItem("adminCredential") || "";
const expandProductSkus=(products:Row[])=>products.flatMap((product)=>{
  const skus:Row[]=typeof product.skus==="string"?JSON.parse(product.skus||"[]"):(product.skus||[]);
  return skus.length?skus.map((sku)=>({...sku,title:product.title,mainImage:sku.skuImage||product.mainImage,spuId:product.id})):[product];
});
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
async function rootMutation(path: string, init: RequestInit) {
  const response = await fetch(path, { ...init, headers: { ...apiHeaders(), ...init.headers } });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || payload.message || `请求失败（${response.status}）`);
  }
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

async function uploadFailure(response: Response, fallback = "图片上传失败") {
  const contentType = response.headers.get("content-type") || "";
  let detail = "";
  if (contentType.includes("json")) {
    const data = await response.json().catch(() => ({}));
    detail = data.detail || data.message || data.error || data.title || "";
  } else {
    detail = (await response.text().catch(() => "")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  if (!detail) {
    detail = response.status === 401 || response.status === 403
      ? "登录状态已失效或没有上传权限，请重新登录管理后台"
      : response.status === 413
        ? "文件超过服务器上传上限，请压缩后重试"
        : response.status >= 500
          ? "图片存储服务异常，请稍后重试或联系管理员检查存储空间"
          : `${fallback}（HTTP ${response.status}）`;
  }
  return detail;
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
  kind?: "main" | "gallery" | "brand" | "banner" | "portal" | "contentIcon" | "solutionMobile";
}) {
  const { message } = AntApp.useApp();
  const [uploadError, setUploadError] = useState("");
  const limit = multiple ? 6 : 1;
  const profiles = {
    main: { minWidth: 600, minHeight: 600, maxWidth: 3000, maxHeight: 3000, ratio: 1, ratioLabel: "1:1", maxMb: 5, title: "主图" },
    gallery: { minWidth: 600, minHeight: 600, maxWidth: 3000, maxHeight: 3000, ratio: 1, ratioLabel: "1:1", maxMb: 5, title: "配图" },
    brand: { minWidth: 300, minHeight: 300, maxWidth: 2000, maxHeight: 2000, ratio: 1, ratioLabel: "1:1", maxMb: 2, title: "Logo" },
    banner: { minWidth: 1200, minHeight: 400, maxWidth: 3840, maxHeight: 1280, ratio: 3, ratioLabel: "3:1", maxMb: 5, title: "轮播图" },
    portal: { minWidth: 800, minHeight: 450, maxWidth: 3840, maxHeight: 2160, ratio: 16 / 9, ratioLabel: "16:9", maxMb: 5, title: "展示图" },
    contentIcon: { minWidth: 128, minHeight: 128, maxWidth: 1024, maxHeight: 1024, ratio: 1, ratioLabel: "1:1", maxMb: 2, title: "文章图标" },
    solutionMobile: { minWidth: 720, minHeight: 1280, maxWidth: 2160, maxHeight: 3840, ratio: 9 / 16, ratioLabel: "9:16", maxMb: 5, title: "H5竖版海报" },
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
      setUploadError("");
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
      if (!response.ok) throw new Error(await uploadFailure(response));
      const result = await response.json();
      const next = multiple ? [...urls, result.url].slice(0, limit) : [result.url];
      onChange?.(next.join("\n"));
      options.onSuccess(result);
      message.success("图片上传成功");
    } catch (error) {
      options.onError(error);
      const detail = error instanceof TypeError
        ? "无法连接图片上传服务，请检查网络或服务器状态"
        : (error as Error).message || "未知上传错误";
      setUploadError(`${file.name}：${detail}`);
      message.error({ content: detail, duration: 6 });
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
      {uploadError && (
        <Alert
          className="upload-error-detail"
          type="error"
          showIcon
          closable
          message="图片上传失败"
          description={uploadError}
          onClose={() => setUploadError("")}
        />
      )}
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
      if (!response.ok) throw new Error(await uploadFailure(response));
      const result = await response.json();
      const image = document.createElement("img");
      image.src = result.url;
      image.alt = file.name.replace(/\.[^.]+$/, "");
      image.loading = "lazy";
      insertElement(image);
      message.success("图片已插入详情");
    } catch (error) {
      message.error({
        content: error instanceof TypeError ? "无法连接图片上传服务，请检查网络或服务器状态" : (error as Error).message,
        duration: 6,
      });
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
        hidden
        aria-hidden="true"
        tabIndex={-1}
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

function MenuIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    dashboard: <><path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z" /></>,
    goods: <><path d="m4 7 8-4 8 4-8 4zM4 7v10l8 4 8-4V7M12 11v10" /></>,
    category: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    brand: <><path d="M20 13 13 20l-9-9V4h7z" /><circle cx="8.5" cy="8.5" r="1.5" /></>,
    platform: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
    solution: <><path d="M9 18h6M10 22h4M8.5 14.5A7 7 0 1 1 15.5 14.5C14.5 15.3 14 16 14 18h-4c0-2-.5-2.7-1.5-3.5Z" /></>,
    enterprise: <><path d="M4 21V5l8-3v19M12 8h8v13M8 7v1M8 11v1M8 15v1M16 12v1M16 16v1M2 21h20" /></>,
    agreement: <><path d="M6 3h9l3 3v15H6zM14 3v4h4M9 12h6M9 16h6M9 8h2" /></>,
    order: <><path d="M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h4" /></>,
    navigation: <><path d="M3 6h18M3 12h12M3 18h8" /><path d="m17 15 4 3-4 3" /></>,
    banner: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8" cy="9" r="2" /><path d="m3 17 5-5 4 4 3-3 6 6" /></>,
    content: <><path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3-7 8-7s8 3 8 7" /></>,
    role: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-4 2-7 6-7 2 0 3.5.7 4.5 2M16 11l2 2 4-4M15 18h7" /></>,
    permission: <><path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z" /><path d="m9 12 2 2 4-4" /></>,
    log: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2M5 4 3 1M19 4l-3 1" /></>,
    config: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
  };
  return <svg className="menu-svg" width="19" height="19" aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

const navItems = [
  { key: "overview", label: "经营概览", icon: <MenuIcon name="dashboard" /> },
  {
    key: "goodsCenter",
    label: "商品管理",
    children: [
      { key: "products", label: "商品管理", icon: <MenuIcon name="goods" /> },
      { key: "categories", label: "分类管理", icon: <MenuIcon name="category" /> },
      { key: "brands", label: "品牌管理", icon: <MenuIcon name="brand" /> },
      { key: "attributes", label: "属性模板", icon: <MenuIcon name="config" /> },
    ],
  },
  {
    key: "orderCenter", label: "订单管理", children: [
      { key: "orders", label: "订单管理", icon: <MenuIcon name="order" /> },
    ],
  },
  {
    key: "platformCenter", label: "平台管理", children: [
      { key: "platforms", label: "平台管理", icon: <MenuIcon name="platform" /> },
      { key: "platformProducts", label: "平台商品管理", icon: <MenuIcon name="goods" /> },
      { key: "platformOrders", label: "平台订单管理", icon: <MenuIcon name="order" /> },
    ],
  },
  {
    key: "agreementCenter", label: "协议管理", children: [
      { key: "agreements", label: "协议管理", icon: <MenuIcon name="agreement" /> },
      { key: "agreementProducts", label: "协议商品管理", icon: <MenuIcon name="goods" /> },
      { key: "agreementOrders", label: "协议订单管理", icon: <MenuIcon name="order" /> },
    ],
  },
  {
    key: "solutionCenter", label: "方案管理", children: [
      { key: "solutions", label: "方案管理", icon: <MenuIcon name="solution" /> },
      { key: "solutionProducts", label: "方案商品管理", icon: <MenuIcon name="goods" /> },
    ],
  },
  {
    key: "enterpriseCenter", label: "企业管理", children: [
      { key: "enterprises", label: "企业管理", icon: <MenuIcon name="enterprise" /> },
      { key: "enterpriseUsers", label: "用户管理", icon: <MenuIcon name="user" /> },
    ],
  },
  {
    key: "portal",
    label: "门户管理",
    children: [
      { key: "navigations", label: "导航栏管理", icon: <MenuIcon name="navigation" /> },
      { key: "banners", label: "首页轮播图", icon: <MenuIcon name="banner" /> },
      { key: "contents", label: "内容管理", icon: <MenuIcon name="content" /> },
    ],
  },
  {
    key: "system",
    label: "系统管理",
    children: [
      { key: "users", label: "用户管理", icon: <MenuIcon name="user" /> },
      { key: "roles", label: "角色管理", icon: <MenuIcon name="role" /> },
      { key: "permissions", label: "权限管理", icon: <MenuIcon name="permission" /> },
      { key: "logs", label: "操作日志", icon: <MenuIcon name="log" /> },
      { key: "configs", label: "基本配置", icon: <MenuIcon name="config" /> },
    ],
  },
];
const modulePermission: Partial<Record<Module, string>> = {
  overview: "dashboard:view", products: "product:manage", categories: "product:manage",
  attributes: "product:manage", brands: "product:manage", platforms: "product:manage",
  platformProducts: "product:manage", platformOrders: "order:manage",
  navigations: "product:manage", banners: "product:manage", solutions: "product:manage",
  contents: "product:manage", enterprises: "enterprise:manage", enterpriseUsers: "enterprise:manage",
  agreements: "agreement:manage", agreementProducts: "agreement:manage", agreementOrders: "order:manage",
  solutionProducts: "product:manage",
  orders: "order:manage", users: "system:user", roles: "system:role",
  permissions: "system:role", logs: "system:log", configs: "system:config",
};

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
  const {message}=AntApp.useApp();
  const [module, setModule] = useState<Module>("overview");
  const [admin, setAdmin] = useState<Row>({});
  const [health,setHealth]=useState<Row>();
  const [globalSearch,setGlobalSearch]=useState("");
  useEffect(() => {
    void api<Row>("/me").then(setAdmin);
    const refresh=()=>void rootApi<Row>("/api/public/status").then(setHealth).catch(()=>setHealth({status:"DOWN"}));
    refresh();const timer=setInterval(refresh,60000);return()=>clearInterval(timer);
  }, []);
  const permissionSet = useMemo(
    () => new Set(String(admin.permissionCodes || "").split(",").filter(Boolean)),
    [admin.permissionCodes],
  );
  const allowed = (value: Module) => !modulePermission[value] || permissionSet.has(modulePermission[value]!);
  const visibleNavItems = useMemo(() => navItems.map((item) => item.children
    ? { ...item, children: item.children.filter((child) => allowed(child.key as Module)) }
    : item).filter((item) => item.children ? item.children.length > 0 : allowed(item.key as Module)), [permissionSet]);
  useEffect(() => {
    if (!admin.username || allowed(module)) return;
    const fallback = (Object.keys(modulePermission) as Module[]).find(allowed);
    if (fallback) setModule(fallback);
  }, [admin.username, admin.permissionCodes, module]);
  const titles: Record<Module, [string, string]> = {
    overview: ["经营概览", "掌握平台账户、权限与关键业务运行状态"],
    products: ["商品管理", "维护自营商品、SKU、协议价格与可售库存"],
    categories: ["分类管理", "维护客户端使用的三级商品分类、排序与启停状态"],
    attributes: ["分类属性模板", "按商品分类配置基础属性、销售规格、选项及前台展示规则"],
    brands: ["品牌管理", "维护商品品牌、品牌说明、排序与启停状态"],
    platforms: ["平台管理", "维护第三方平台资料、商品参考入口与展示状态"],
    platformProducts: ["平台商品管理", "按采购平台维护关联商品、平台售价、链接及上架状态"],
    platformOrders: ["平台订单管理", "查看包含平台关联商品的采购订单及履约状态"],
    navigations: [
      "导航栏管理",
      "配置 Web 客户端顶部导航名称、链接、排序与状态",
    ],
    banners: ["首页轮播图管理", "配置 Web 与 H5 首页活动内容、图片和跳转链接"],
    solutions: ["方案管理", "维护企业采购场景方案及客户端展示内容"],
    solutionProducts: ["方案商品管理", "按采购方案维护必选商品、可选商品、数量与排序"],
    contents: ["内容管理", "维护采购指南、服务说明及其他门户内容"],
    enterprises: ["企业管理", "查看企业客户、成员账户和有效采购协议"],
    enterpriseUsers: ["企业用户管理", "以用户维度查看、创建、编辑和维护全部企业账号"],
    agreements: ["协议管理", "维护协议商品关联及企业专属成交价格"],
    agreementProducts: ["协议商品管理", "按采购协议维护商品范围与企业专属价格"],
    agreementOrders: ["协议订单管理", "查看协议产生的采购订单与履约进度"],
    orders: ["订单管理", "查询采购订单、付款状态与履约进度"],
    users: ["用户管理", "维护后台登录用户、角色归属与启停状态"],
    roles: ["角色管理", "按岗位配置角色与操作权限"],
    permissions: ["权限管理", "查看系统权限点及所属业务模块"],
    logs: ["操作日志", "追踪关键管理操作，支持审计与问题定位"],
    configs: ["基本配置", "维护平台信息、订单和库存参数"],
  };
  const runGlobalSearch=()=>{
    const keyword=globalSearch.trim().toLowerCase();
    if(!keyword)return;
    const target=(Object.keys(titles) as Module[]).find((key)=>allowed(key)&&titles[key].join(" ").toLowerCase().includes(keyword));
    if(target)setModule(target);else message.warning("没有找到匹配的管理页面");
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
        <div className="sider-menu-scroll">
          <Menu
            mode="inline"
            theme="dark"
            defaultOpenKeys={["goodsCenter", "orderCenter"]}
            selectedKeys={[module]}
            items={visibleNavItems}
            onClick={({ key }) => setModule(key as Module)}
          />
        </div>
      </Layout.Sider>
      <Layout>
        <Layout.Header className="admin-header">
          <div>
            <small>运营管理 / 系统管理 /</small>
            <strong>{titles[module][0]}</strong>
          </div>
          <label className="global-search">
            ⌕ <input value={globalSearch} onChange={(e)=>setGlobalSearch(e.target.value)}
              onKeyDown={(e)=>{if(e.key==="Enter")runGlobalSearch();}}
              placeholder="搜索商品、订单、用户或配置" />
          </label>
          <div
            className="service-health"
            title="当前管理 API 请求正常，且数据库查询成功"
          >
            <i className={health?.status==="UP"?"":"down"} />
            <span>
              <strong>{health?.status==="UP"?"服务正常":health?"服务异常":"检查中"}</strong>
              <small>{health?.components?.api||"—"} API · {health?.components?.database||"—"} 数据库</small>
            </span>
          </div>
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
              <span>{new Intl.DateTimeFormat("zh-CN",{year:"numeric",month:"long",day:"numeric",weekday:"short"}).format(new Date())} · 数据实时更新</span>
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
          {module === "agreementProducts" && <BusinessModule module="agreements" listTitle="采购协议列表（进入商品管理）" />}
          {module === "agreementOrders" && <BusinessModule module="orders" endpointOverride="/agreement-orders" listTitle="协议订单列表" extraColumn="agreementName" />}
          {module === "platformOrders" && <BusinessModule module="orders" endpointOverride="/platform-orders" listTitle="平台关联商品订单列表" extraColumn="platformNames" />}
          {module === "enterpriseUsers" && <EnterpriseUsers />}
          {module === "categories" && <Categories />}
          {module === "attributes" && <AttributeTemplates />}
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
          {module === "platformProducts" && <PortalManager module="platforms" />}
          {module === "solutionProducts" && <PortalManager module="solutions" />}
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

function EnterpriseUsers() {
  const {message,modal}=AntApp.useApp();
  const users=usePagedLoad("/api/admin/business/enterprise-users",12);
  const enterprises=useLoad<Row[]>(()=>rootApi("/api/admin/business/enterprises"));
  const [form]=Form.useForm();
  const [editing,setEditing]=useState<Row>();
  const [open,setOpen]=useState(false);
  const show=(row?:Row)=>{
    setEditing(row);
    form.resetFields();
    form.setFieldsValue(row?{...row,password:""}:{enterpriseId:enterprises.data?.[0]?.id,roleCode:"BUYER",status:1,password:""});
    setOpen(true);
  };
  const save=async()=>{
    try{
      const values=await form.validateFields();
      const enterpriseId=Number(editing?.enterpriseId||values.enterpriseId);
      const response=await fetch(`/api/admin/business/enterprises/${enterpriseId}/members${editing?`/${editing.id}`:""}`,{
        method:editing?"PUT":"POST",headers:apiHeaders(),body:JSON.stringify(values),
      });
      if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.detail||"企业用户保存失败");}
      setOpen(false);message.success("企业用户已保存");void users.refresh();
    }catch(error){if(error instanceof Error)message.error(error.message);}
  };
  const remove=(row:Row)=>modal.confirm({
    title:`确认删除用户“${row.realName}”？`,content:`所属企业：${row.enterpriseName}`,
    okButtonProps:{danger:true},onOk:async()=>{
      const response=await fetch(`/api/admin/business/enterprises/${row.enterpriseId}/members/${row.id}`,{method:"DELETE",headers:apiHeaders()});
      if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.detail||"企业用户删除失败");}
      message.success("企业用户已删除");void users.refresh();
    },
  });
  return <>
    <Card className="data-card" title="企业用户列表" extra={<Space>
      <Button type="primary" onClick={()=>show()}>＋ 新增企业用户</Button>
    </Space>}>
      <Table rowKey="id" loading={users.loading} dataSource={users.data} server={users.server} searchPlaceholder="搜索企业、账号、姓名或手机" columns={[
        {title:"用户",render:(_:unknown,row:Row)=><div className="user-cell"><i>{String(row.realName||"用").slice(0,1)}</i><span><strong>{row.realName}</strong><small>@{row.username}</small></span></div>},
        {title:"所属企业",dataIndex:"enterpriseName"},{title:"手机号码",dataIndex:"phone"},
        {title:"企业角色",dataIndex:"roleCode",render:(value)=>value==="ENTERPRISE_ADMIN"?<Tag color="blue">企业管理员</Tag>:<Tag>采购员</Tag>},
        {title:"状态",dataIndex:"status",render:(value)=><Tag color={Number(value)===1?"green":"default"}>{Number(value)===1?"启用":"停用"}</Tag>},
        {title:"创建时间",dataIndex:"createdAt",render:dateTime},
        {title:"操作",render:(_:unknown,row:Row)=><Button type="link" onClick={()=>show(row)}>编辑</Button>},
      ]}/>
    </Card>
    <Modal open={open} title={`${editing?"编辑":"新增"}企业用户`} onCancel={()=>setOpen(false)} onOk={()=>void save()}>
      <Form form={form} layout="vertical">
        <Form.Item name="enterpriseId" label="所属企业" rules={[{required:true,message:"请选择所属企业"}]}><Select showSearch optionFilterProp="label" disabled={!!editing} options={(enterprises.data||[]).map((row)=>({value:row.id,label:row.name}))}/></Form.Item>
        <Form.Item name="username" label="登录账号" rules={[{required:true,message:"请输入登录账号"},{min:3,max:80}]}><Input disabled={!!editing}/></Form.Item>
        <Form.Item name="password" label={editing?"重置密码":"初始密码"} extra={editing?"不修改密码请留空":undefined} rules={[{required:!editing,message:"请输入初始密码"},{min:8,max:72,message:"密码长度必须为8至72位"}]}><Input.Password autoComplete="new-password"/></Form.Item>
        <Form.Item name="realName" label="姓名" rules={[{required:true,message:"请输入姓名"}]}><Input/></Form.Item>
        <Form.Item name="phone" label="手机号码" rules={[{required:true,message:"请输入手机号码"},{pattern:/^1\d{10}$/,message:"请输入11位手机号码"}]}><Input/></Form.Item>
        <Form.Item name="roleCode" label="企业角色" rules={[{required:true}]}><Select options={[{value:"BUYER",label:"采购员"},{value:"ENTERPRISE_ADMIN",label:"企业管理员"}]}/></Form.Item>
        <Form.Item name="status" label="账号状态" rules={[{required:true}]}><Select options={[{value:1,label:"启用"},{value:0,label:"停用"}]}/></Form.Item>
      </Form>
    </Modal>
  </>;
}

function BusinessModule({ module,endpointOverride,listTitle,extraColumn }: {
  module: Module; endpointOverride?: string; listTitle?: string; extraColumn?: "agreementName"|"platformNames";
}) {
  const { message, modal } = AntApp.useApp();
  const endpoint =
    module === "products"
      ? "/products"
      : module === "enterprises"
        ? "/enterprises"
        : module === "agreements"
          ? "/agreements"
          : "/orders";
  const regularRows = useLoad<Row[]>(
    () => rootApi(`/api/admin/business${endpointOverride||endpoint}`),
    [module,endpointOverride],
  );
  const serverEnabled = true;
  const pagedRows = usePagedLoad(`/api/admin/business${endpointOverride||endpoint}`, 10, [module,endpointOverride]);
  const rows = serverEnabled ? pagedRows : regularRows;
  const enterprises = useLoad<Row[]>(() =>
    rootApi("/api/admin/business/enterprises"),
  );
  const products = useLoad<Row[]>(() =>
    rootApi("/api/admin/business/products"),
  );
  const selectableSkus=expandProductSkus(products.data||[]).filter((sku)=>Number(sku.status)===1);
  const categories = useLoad<Row[]>(() =>
    rootApi("/api/admin/business/categories"),
  );
  const brands = useLoad<Row[]>(() =>
    rootApi("/api/admin/content/brands/list"),
  );
  const logisticsCompanies = useLoad<Row[]>(() =>
    rootApi("/api/admin/system/options?type=LOGISTICS_COMPANY&enabled=true"),
  );
  const [form] = Form.useForm();
  const selectedProductCategory = Form.useWatch("categoryId", form);
  const [attributeTemplate, setAttributeTemplate] = useState<Row[]>([]);
  useEffect(() => {
    if (module !== "products" || !selectedProductCategory) { setAttributeTemplate([]); return; }
    void rootApi<Row[]>(`/api/admin/business/attributes/category/${selectedProductCategory}`)
      .then(setAttributeTemplate).catch(() => setAttributeTemplate([]));
  }, [module, selectedProductCategory]);
  const [memberForm] = Form.useForm();
  const [logisticsForm] = Form.useForm();
  const [refundForm] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [productTab,setProductTab]=useState("basic");
  const [editing, setEditing] = useState<Row>();
  const [mode, setMode] = useState<"entity" | "stock" | "item">("entity");
  const [agreement, setAgreement] = useState<Row>();
  const [items, setItems] = useState<Row[]>([]);
  const [itemOpen, setItemOpen] = useState(false);
  const [detail, setDetail] = useState<Row>();
  const [logisticsItem, setLogisticsItem] = useState<Row>();
  const [refundOrder, setRefundOrder] = useState<Row>();
  const [memberEnterprise, setMemberEnterprise] = useState<Row>();
  const [members, setMembers] = useState<Row[]>([]);
  const [memberOpen, setMemberOpen] = useState(false);
  const [memberEditing, setMemberEditing] = useState<Row>();
  const [memberEditorOpen, setMemberEditorOpen] = useState(false);
  const agreementItemsPage = usePagedLoad(`/api/admin/agreements/${agreement?.id || 0}/items`,10,[agreement?.id],Boolean(agreement));
  const memberPage = usePagedLoad(`/api/admin/business/enterprises/${memberEnterprise?.id || 0}/members`,10,[memberEnterprise?.id],Boolean(memberEnterprise));
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
    setProductTab("basic");
    if (nextMode === "stock") form.setFieldsValue({ stock: row?.stock });
    else if (module === "products")
      form.setFieldsValue(
        row
          ? { ...row, status: Number(row.status), spec: "标准规格",
              skus:(typeof row.skus==="string"?JSON.parse(row.skus||"[]"):row.skus||[]).map((sku:Row)=>({
                ...sku,status:Number(sku.status),specification:Object.entries(typeof sku.specValues==="string"?JSON.parse(sku.specValues||"{}"):sku.specValues||{})
                  .map(([key,value])=>`${key}=${value}`).join("；")
              })),
              attributeValues: typeof row.attributeValues === "string" ? JSON.parse(row.attributeValues || "{}") : (row.attributeValues || {}) }
          : {
              categoryId: (categories.data || []).find(
                (x) => Number(x.level) === 3,
              )?.id,
              brandId: (brands.data || []).find((x)=>Number(x.status)===1)?.id,
              selfOperated: 1,
              status: 1,
              stock: 0,
              skus:[{skuCode:"",specification:"规格=标准",skuImage:"",marketPrice:0,memberPrice:0,stock:0,status:1}],
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
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const values = await form.validateFields();
      if(module==="products"&&Array.isArray(values.skus)){
        values.skus=values.skus.map((sku:Row)=>({
          ...sku,
          specValues:Object.fromEntries(String(sku.specification||"").split(/[；;]/).map((part)=>part.trim()).filter(Boolean)
            .map((part)=>{const index=part.search(/[=＝:：]/);return index>0?[part.slice(0,index).trim(),part.slice(index+1).trim()]:["规格",part];})),
        }));
        const first=values.skus[0];
        values.marketPrice=first.marketPrice;values.memberPrice=first.memberPrice;values.stock=first.stock;
        values.spec=first.specification;
      }
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
      const error=e as Row;
      const first=error.errorFields?.[0]?.name?.[0];
      if(module==="products"&&first){
        const tab=first==="skus"||first==="stock"||first==="marketPrice"||first==="memberPrice"||first==="spec"
          ?"sales":first==="mainImage"||first==="gallery"?"images"
          :first==="attributeValues"||first==="attributes"?"attributes"
          :first==="detailHtml"||first==="deliveryDescription"||first==="afterSalesHtml"?"detail":"basic";
        setProductTab(tab);
        message.error(error.errorFields[0].errors?.[0]||"请检查表单必填项");
      } else if (e instanceof Error) message.error(e.message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const closeEditor = () => {
    if (savingRef.current) return;
    if (!form.isFieldsTouched()) {
      setOpen(false);
      return;
    }
    modal.confirm({
      title: "放弃未保存的修改？",
      content: "关闭后，本次填写或修改的内容不会保留。",
      okText: "放弃修改",
      cancelText: "继续编辑",
      okButtonProps: { danger: true },
      onOk: () => setOpen(false),
    });
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
      void agreementItemsPage.refresh();
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
        void agreementItemsPage.refresh();
        message.success("已移除");
      },
    });
  const orderDetail = async (row: Row) =>
    setDetail(await business(`/orders/${row.id}`));
  const editLogistics = (row: Row) => {
    setLogisticsItem(row);
    logisticsForm.setFieldsValue({
      fulfillmentStatus: Number(row.fulfillmentStatus || 0),
      logisticsCompany: row.logisticsCompany || "",
      logisticsNo: row.logisticsNo || "",
      logisticsStatus: row.logisticsStatus || "",
    });
  };
  const saveLogistics = async () => {
    try {
      const values = await logisticsForm.validateFields();
      await business(
        `/orders/${detail!.order.id}/items/${logisticsItem!.id}/logistics`,
        { method: "PUT", body: JSON.stringify(values) },
      );
      setDetail(await business(`/orders/${detail!.order.id}`));
      setLogisticsItem(undefined);
      message.success("商品物流信息已保存，订单状态已自动更新");
      void rows.refresh();
    } catch (error) {
      message.error((error as Error).message);
    }
  };
  const advanceOrder = async (row: Row) => {
    const payment = Number(row.paymentStatus) === 2 ? 2 : 2;
    const status =
      Number(row.orderStatus) === 0
        ? 1
        : Math.min(3, Number(row.orderStatus) + 1);
    const submit = async () => {
      await business(`/orders/${row.id}/status`, {
        method: "PUT",
        body: JSON.stringify({ paymentStatus: payment, orderStatus: status }),
      });
      message.success(
        status === 3
          ? "订单已完成，订单商品物流状态已同步为已签收"
          : "订单状态已更新",
      );
      void rows.refresh();
    };
    if (status === 3) {
      modal.confirm({
        title: "确认完成订单",
        content:
          "确认后订单状态将变为已完成，订单内已发货或运输中的商品将同步标记为已签收。是否继续？",
        okText: "确认完成",
        cancelText: "取消",
        onOk: submit,
      });
      return;
    }
    await submit();
  };
  const showRefund = (row: Row) => {
    setRefundOrder(row);
    refundForm.setFieldsValue({
      refundAmount: Number(row.payableAmount),
      refundReason: "",
    });
  };
  const saveRefund = async () => {
    try {
      const values = await refundForm.validateFields();
      await business(`/orders/${refundOrder!.id}/refund`, {
        method: "POST",
        body: JSON.stringify(values),
      });
      message.success("退款信息已记录");
      setRefundOrder(undefined);
      void rows.refresh();
      if (detail?.order.id === refundOrder!.id)
        setDetail(await business(`/orders/${refundOrder!.id}`));
    } catch (error) {
      if (error instanceof Error) message.error(error.message);
    }
  };
  const loadMembers = async (enterprise: Row) => {
    setMemberEnterprise(enterprise);
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
      void memberPage.refresh();
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
          void memberPage.refresh();
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
            <span className="solution-admin-cover">
              <i>{r.title?.slice(0, 1) || "商"}</i>
              {r.mainImage && (
                <img
                  src={r.mainImage}
                  alt={r.title}
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              )}
            </span>
            <span>
              <strong>{r.title}</strong>
              <small>{r.spuCode} · {Number(r.skuCount||1)} 个 SKU {Number(r.selfOperated) === 1 && <Tag color="blue">自营</Tag>}</small>
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
        title: "销量",
        dataIndex: "soldCount",
        render: (v) => `${Number(v || 0)} 件`,
      },
      {
        title: "订单 / 销售额",
        render: (_, r) =>
          `${Number(r.orderCount || 0)} 单 / ¥${Number(r.salesAmount || 0).toFixed(2)}`,
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
            {Number(r.skuCount||1)===1&&<Button type="link" onClick={() => show(r, "stock")}>库存</Button>}
            <Button type="link" onClick={() => void toggle(r)}>
              {Number(r.status) === 1 ? "下架" : "上架"}
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
            {["待付款", "待发货", "运输中", "已完成", "已取消", "部分发货"][v]}
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
            {[0, 2].includes(Number(r.orderStatus)) && (
              <Button type="link" onClick={() => void advanceOrder(r)}>
                {Number(r.orderStatus) === 0 ? "确认到账" : "确认完成"}
              </Button>
            )}
            {Number(r.orderStatus) === 3 && Number(r.refundStatus || 0) === 0 && (
              <Button type="link" danger onClick={() => showRefund(r)}>
                退款
              </Button>
            )}
            {Number(r.refundStatus || 0) === 1 && <Tag color="red">已退款</Tag>}
          </Space>
        ),
      },
    ];
  if(module === "orders" && extraColumn) columns.splice(2,0,{
    title: extraColumn==="agreementName"?"采购协议":"关联平台",
    dataIndex: extraColumn,
    render: (value) => value || "—",
  });
  const defaultListTitle =
    module === "products"
      ? "商品列表"
      : module === "enterprises"
        ? "企业客户列表"
        : module === "agreements"
          ? "采购协议列表"
          : "采购订单列表";
  return (
    <>
      <Card
        className="data-card"
        title={listTitle||defaultListTitle}
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
          server={serverEnabled ? {...pagedRows.server,statusOptions:module === "orders" ? [
            {label:"待付款",value:"0"},{label:"待发货",value:"1"},{label:"运输中",value:"2"},{label:"已完成",value:"3"},{label:"已取消",value:"4"},{label:"部分发货",value:"5"},
          ] : module === "agreements" ? [{label:"生效中",value:"1"},{label:"已停用",value:"2"}]
            : module === "products" ? [{label:"在售",value:"1"},{label:"草稿",value:"0"},{label:"已下架",value:"2"}] : undefined} : undefined}
          searchPlaceholder={module === "enterprises" ? "搜索企业名称、信用代码、联系人或手机" : module === "agreements" ? "搜索协议名称、协议号或签约企业" : module === "orders" ? "搜索订单号、企业、协议或平台" : undefined}
        />
      </Card>
      <Modal
        open={open}
        title={
          mode === "stock"
            ? "调整库存"
            : `${editing ? "编辑" : "新增"}${module === "products" ? "商品" : module === "enterprises" ? "企业" : "协议"}`
        }
        onCancel={closeEditor}
        onOk={save}
        confirmLoading={saving}
        maskClosable={!saving}
        keyboard={!saving}
        width={module === "products" && mode !== "stock" ? 920 : 760}
      >
        <Form form={form} layout="vertical" className="two-column-form">
          {mode === "stock" ? (
            <Form.Item name="stock" label="总库存" rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
          ) : module === "products" ? (
            <Tabs className="full" destroyOnHidden={false} activeKey={productTab} onChange={setProductTab} items={[
              { key: "basic", label: "基本信息", children: <div className="two-column-form">
                <Form.Item name="title" label="商品标题" className="full" rules={[{ required: true }]}><Input /></Form.Item>
                <Form.Item name="categoryId" label="三级分类" rules={[{ required: true, message: "请选择三级分类" }]}><Select options={(categories.data || []).filter((x) => Number(x.level) === 3 && Number(x.status) === 1).map((x) => ({ value: x.id, label: `${x.parentName || ""} / ${x.name}` }))} /></Form.Item>
                <Form.Item name="brandId" label="品牌" rules={[{required:true,message:"请选择品牌"}]}><Select loading={brands.loading} showSearch optionFilterProp="label" options={(brands.data||[]).filter((x)=>Number(x.status)===1).map((x)=>({ value:x.id,label:x.name }))} placeholder="请选择已启用品牌" /></Form.Item>
                <Form.Item name="selfOperated" label="经营类型" rules={[{required:true,message:"请选择经营类型"}]}><Radio.Group options={[{value:1,label:"自营"},{value:0,label:"非自营"}]} /></Form.Item>
                <Form.Item name="status" label="状态"><Select options={[{ value: 1, label: "在售" },{ value: 0, label: "草稿" },{ value: 2, label: "下架" }]} /></Form.Item>
                <Form.Item name="summary" label="商品摘要" className="full"><Input.TextArea rows={3} /></Form.Item>
              </div> },
              { key: "sales", label: "规格与 SKU", children: <div className="full">
                <Alert type="info" showIcon message="每行代表一个可独立销售的 SKU。规格格式示例：颜色=黑色；容量=256GB。SKU 编码留空时由系统自动生成。" />
                <Form.List name="skus" rules={[{validator:async(_,items)=>{if(!items?.length)throw new Error("至少添加一个 SKU");}}]}>
                  {(fields,{add,remove},{errors})=><>
                    {fields.map(({key,name})=><Card size="small" key={key} title={`SKU ${name+1}`} style={{marginTop:12}}
                      extra={fields.length>1?<Button type="link" danger onClick={()=>remove(name)}>移除</Button>:null}>
                      <div className="two-column-form">
                        <Form.Item name={[name,"id"]} hidden><Input /></Form.Item>
                        <Form.Item name={[name,"skuCode"]} label="SKU 编码"><Input placeholder="留空自动生成" /></Form.Item>
                        <Form.Item name={[name,"specification"]} label="销售规格" rules={[{required:true,message:"请填写销售规格"}]}><Input placeholder="颜色=黑色；容量=256GB" /></Form.Item>
                        <Form.Item name={[name,"marketPrice"]} label="市场价" rules={[{required:true}]}><InputNumber min={0} precision={2} style={{width:"100%"}} /></Form.Item>
                        <Form.Item name={[name,"memberPrice"]} label="会员价" rules={[{required:true}]}><InputNumber min={0} precision={2} style={{width:"100%"}} /></Form.Item>
                        <Form.Item name={[name,"stock"]} label="库存" rules={[{required:true}]}><InputNumber min={0} style={{width:"100%"}} /></Form.Item>
                        <Form.Item name={[name,"status"]} label="状态" rules={[{required:true}]}><Select options={[{value:1,label:"启用"},{value:0,label:"停用"}]} /></Form.Item>
                        <Form.Item name={[name,"skuImage"]} label="SKU 图片" className="full"><ProductImageUpload /></Form.Item>
                      </div>
                    </Card>)}
                    <Button block type="dashed" style={{marginTop:12}} onClick={()=>add({skuCode:"",specification:"",skuImage:"",marketPrice:0,memberPrice:0,stock:0,status:1})}>＋ 添加 SKU</Button>
                    <Form.ErrorList errors={errors}/>
                  </>}
                </Form.List>
              </div> },
              { key: "images", label: "图片素材", children: <div className="two-column-form">
                <Form.Item name="mainImage" label="商品主图" className="full" rules={[{ required: true, message: "请上传商品主图" }]}><ProductImageUpload /></Form.Item>
                <Form.Item name="gallery" label="商品配图" className="full"><ProductImageUpload multiple /></Form.Item>
              </div> },
              { key: "attributes", label: `规格属性${attributeTemplate.length ? `（${attributeTemplate.length}）` : ""}`, children: <div className="two-column-form">
                <div className="full"><Alert type="info" showIcon message="以下字段根据所选三级分类生成；标有“继承自上级分类”的属性由一级或二级分类自动提供。" /></div>
                {attributeTemplate.length === 0 && <div className="full"><Alert type="warning" showIcon message="当前分类尚未配置属性模板，可在“属性模板”页面添加。" /></div>}
                {attributeTemplate.map((attribute) => {
                  const name = ["attributeValues", String(attribute.id)];
                  const rules = Number(attribute.requiredFlag) === 1 ? [{ required: true, message: `请填写${attribute.name}` }] : [];
                  const options = (attribute.options || []).filter((x: Row) => Number(x.status) === 1).map((x: Row) => ({ label: x.optionLabel, value: Number(x.id) }));
                  const label = `${attribute.name}${attribute.unit ? `（${attribute.unit}）` : ""}${Number(attribute.inheritedLevel) > 0 ? " · 继承自上级分类" : ""}`;
                  return <Form.Item key={attribute.id} name={name} label={label} rules={rules}>{attribute.inputType === "NUMBER" ? <InputNumber style={{width:"100%"}} /> : attribute.inputType === "SELECT" ? <Select options={options} allowClear /> : attribute.inputType === "RADIO" ? <Radio.Group options={options} /> : attribute.inputType === "CHECKBOX" ? <Checkbox.Group options={options} /> : attribute.inputType === "SWITCH" ? <Select options={[{label:"是",value:"是"},{label:"否",value:"否"}]} /> : attribute.inputType === "DATE" ? <Input type="date" /> : <Input />}</Form.Item>;
                })}
                <Form.Item name="attributes" label="历史字符串属性（兼容）" className="full"><Input.TextArea rows={2} placeholder="仅用于旧商品兼容，新商品请使用结构化属性" /></Form.Item>
              </div> },
              { key: "detail", label: "详情与服务", children: <div className="two-column-form">
                <Form.Item name="detailHtml" label="富文本详情" className="full"><RichTextEditor /></Form.Item>
                <Form.Item name="deliveryDescription" label="配送说明" className="full"><Input.TextArea rows={3} placeholder="填写配送范围、预计时效、运费及安装等说明" /></Form.Item>
                <Form.Item name="afterSalesHtml" label="售后政策" className="full"><Input.TextArea rows={4} placeholder="填写退换货、质保、维修及售后联系方式，支持 HTML" /></Form.Item>
              </div> },
            ]} />
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
              form.setFieldsValue({ skuId: selectableSkus[0]?.id||selectableSkus[0]?.skuId });
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
                options={selectableSkus.map((x) => ({
                  value: x.id||x.skuId,
                  label: `${x.title} · ${x.skuCode}`,
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
          loading={agreementItemsPage.loading}
          dataSource={agreementItemsPage.data}
          server={agreementItemsPage.server}
          searchPlaceholder="搜索协议商品名称或SKU"
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
          loading={memberPage.loading}
          dataSource={memberPage.data}
          server={memberPage.server}
          searchPlaceholder="搜索成员账号、姓名、手机或角色"
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
        title={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>订单详情</span>
            {detail &&
              Number(detail.order.orderStatus) === 3 &&
              Number(detail.order.refundStatus || 0) === 0 && (
                <Button
                  danger
                  onClick={() => showRefund(detail.order)}
                  style={{ marginRight: 32 }}
                >
                  退款
                </Button>
              )}
          </div>
        }
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
                {
                  key: "refund",
                  label: "退款状态",
                  children:
                    Number(detail.order.refundStatus || 0) === 1 ? (
                      <Space direction="vertical" size={2}>
                        <Tag color="red">已退款</Tag>
                        <span>退款金额：¥{Number(detail.order.refundAmount).toFixed(2)}</span>
                        <span>退款原因：{detail.order.refundReason}</span>
                        <small>{dateTime(detail.order.refundedAt)}</small>
                      </Space>
                    ) : (
                      "未退款"
                    ),
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
                {
                  title: "发货状态",
                  dataIndex: "fulfillmentStatus",
                  width: 95,
                  render: (value) => (
                    <Tag color={Number(value) >= 1 ? "blue" : "orange"}>
                      {["待发货", "已发货", "运输中", "已签收", "已取消"][
                        Number(value)
                      ] || "待发货"}
                    </Tag>
                  ),
                },
                {
                  title: "物流信息",
                  width: 170,
                  render: (_: any, row: Row) =>
                    row.logisticsNo ? (
                      <div className="admin-logistics">
                        <strong>{row.logisticsCompany}</strong>
                        <span>{row.logisticsNo}</span>
                        {row.logisticsStatus && <small>{row.logisticsStatus}</small>}
                      </div>
                    ) : (
                      "—"
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
                {
                  title: "操作",
                  width: 90,
                  fixed: "right",
                  render: (_: any, row: Row) => (
                    Number(detail.order.orderStatus) < 3 &&
                    Number(detail.order.refundStatus || 0) === 0 ? (
                      <Button type="link" onClick={() => editLogistics(row)}>
                        物流
                      </Button>
                    ) : (
                      <span className="subline">只读</span>
                    )
                  ),
                },
              ]}
              scroll={{ x: 1280 }}
            />
            <Card title="订单操作时间线" size="small" style={{ marginTop: 16 }}>
              <div className="order-timeline">
                {(detail.timeline || []).map((event: Row, index: number) => (
                  <div key={`${event.createdAt}-${index}`}>
                    <i />
                    <span>
                      <strong>{event.description}</strong>
                      <small>{dateTime(event.createdAt)} · {event.operatorType === "CLIENT" ? "客户端" : "管理后台"}</small>
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}
      </Modal>
      <Modal
        open={!!logisticsItem}
        title={`商品物流 · ${logisticsItem?.title || ""}`}
        okText="保存物流"
        cancelText="取消"
        onOk={() => void saveLogistics()}
        onCancel={() => setLogisticsItem(undefined)}
      >
        <Form form={logisticsForm} layout="vertical">
          <Form.Item
            name="fulfillmentStatus"
            label="商品发货状态"
            rules={[{ required: true, message: "请选择商品发货状态" }]}
          >
            <Select
              options={[
                { value: 0, label: "待发货" },
                { value: 1, label: "已发货" },
                { value: 2, label: "运输中" },
                { value: 3, label: "已签收" },
                { value: 4, label: "已取消" },
              ]}
            />
          </Form.Item>
          <Form.Item name="logisticsCompany" label="物流公司">
            <Select
              allowClear
              showSearch
              placeholder="请选择物流公司"
              optionFilterProp="label"
              options={(logisticsCompanies.data || []).map((item) => ({
                value: item.optionValue,
                label: item.label,
              }))}
            />
          </Form.Item>
          <Form.Item name="logisticsNo" label="运单号">
            <Input placeholder="请输入物流运单号" />
          </Form.Item>
          <Form.Item name="logisticsStatus" label="物流状态说明">
            <Input placeholder="例如：已揽收、运输途中、派送中" />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        open={!!refundOrder}
        title={`订单退款 · ${refundOrder?.orderNo || ""}`}
        okText="确认退款"
        cancelText="取消"
        onOk={() => void saveRefund()}
        onCancel={() => setRefundOrder(undefined)}
      >
        <Form form={refundForm} layout="vertical">
          <Form.Item
            name="refundAmount"
            label="退款金额"
            rules={[{ required: true, message: "请输入退款金额" }]}
          >
            <InputNumber
              min={0.01}
              max={Number(refundOrder?.payableAmount || 0)}
              precision={2}
              prefix="¥"
              style={{ width: "100%" }}
            />
          </Form.Item>
          <Form.Item
            name="refundReason"
            label="退款原因"
            rules={[{ required: true, message: "请输入退款原因" }]}
          >
            <Input.TextArea rows={4} maxLength={500} showCount />
          </Form.Item>
          <small>退款在第三方或线下完成，此处用于记录平台退款结果。</small>
        </Form>
      </Modal>
    </>
  );
}

function AttributeTemplates() {
  const { message, modal } = AntApp.useApp();
  const rows = usePagedLoad("/api/admin/business/attributes",10);
  const categories = useLoad<Row[]>(() => rootApi("/api/admin/business/categories"));
  const [form] = Form.useForm();
  const [optionForm] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row>();
  const [optionOwner, setOptionOwner] = useState<Row>();
  const [optionEditing, setOptionEditing] = useState<Row>();
  const save = async () => {
    try {
      const values = await form.validateFields();
      await rootMutation(`/api/admin/business/attributes${editing ? `/${editing.id}` : ""}`, {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(values),
      });
      message.success("属性模板已保存"); setOpen(false); void rows.refresh();
    } catch (error) { if (error instanceof Error) message.error(error.message); }
  };
  const saveOption = async () => {
    try {
      const values = await optionForm.validateFields();
      await rootMutation(`/api/admin/business/attributes/${optionOwner!.id}/options${optionEditing ? `/${optionEditing.id}` : ""}`, {
        method: optionEditing ? "PUT" : "POST", body: JSON.stringify(values),
      });
      message.success("选项已保存"); setOptionEditing(undefined); optionForm.resetFields(); void rows.refresh();
    } catch (error) { if (error instanceof Error) message.error(error.message); }
  };
  const columns: ColumnsType<Row> = [
    { title: "属性", render: (_, row) => <><strong>{row.name}</strong><br/><small>{row.code}</small></> },
    { title: "分组", dataIndex: "groupName" },
    { title: "用途", dataIndex: "attributeType", render: (v) => ({ BASIC:"基础属性",SPEC:"销售规格",EXTENDED:"扩展属性" }[v as string] || v) },
    { title: "输入方式", dataIndex: "inputType", render: (v) => ({ TEXT:"文本",NUMBER:"数字",SELECT:"下拉单选",RADIO:"单选",CHECKBOX:"多选",SWITCH:"开关",DATE:"日期" }[v as string] || v) },
    { title: "规则", render: (_,r) => <Space wrap>{Number(r.requiredFlag)===1&&<Tag color="red">必填</Tag>}{Number(r.filterable)===1&&<Tag color="blue">可筛选</Tag>}{Number(r.visibleFlag)===1&&<Tag color="green">前台展示</Tag>}</Space> },
    { title: "关联分类", render: (_,r) => `${r.categoryIds?.length || 0} 个` },
    { title: "操作", render: (_,r) => <Space><Button type="link" onClick={()=>{setEditing(r);form.setFieldsValue({...r,categoryIds:(r.categoryIds||[]).map(Number)});setOpen(true);}}>编辑</Button>{["SELECT","RADIO","CHECKBOX"].includes(r.inputType)&&<Button type="link" onClick={()=>{setOptionOwner(r);setOptionEditing(undefined);optionForm.resetFields();}}>管理选项</Button>}</Space> },
  ];
  return <>
    <Card title="属性模板列表" extra={<Button type="primary" onClick={()=>{setEditing(undefined);form.resetFields();form.setFieldsValue({groupName:"规格参数",attributeType:"BASIC",inputType:"TEXT",requiredFlag:0,filterable:0,searchable:0,visibleFlag:1,allowCustom:0,sortOrder:0,status:1});setOpen(true);}}>新增属性</Button>}>
      <Alert type="info" showIcon message="属性会从一级分类向下继承；下级分类可以追加自己的属性。已被商品使用的属性只能停用。" style={{marginBottom:16}} />
      <Table rowKey="id" loading={rows.loading} dataSource={rows.data || []} columns={columns} server={rows.server} searchPlaceholder="搜索属性名称、编码、分组或输入方式" />
    </Card>
    <Modal open={open} title={`${editing?"编辑":"新增"}属性`} onCancel={()=>setOpen(false)} onOk={save} width={760}>
      <Form form={form} layout="vertical" className="two-column-form">
        <Form.Item name="name" label="属性名称" rules={[{required:true}]}><Input placeholder="例如：内存容量" /></Form.Item>
        <Form.Item name="code" label="属性编码" rules={[{required:true,pattern:/^[A-Za-z][A-Za-z0-9_]*$/,message:"使用字母、数字和下划线"}]}><Input placeholder="MEMORY_SIZE" disabled={Boolean(editing)} /></Form.Item>
        <Form.Item name="groupName" label="属性分组" rules={[{required:true}]}><Input placeholder="规格参数" /></Form.Item>
        <Form.Item name="attributeType" label="属性用途" rules={[{required:true}]}><Radio.Group options={[{label:"基础属性",value:"BASIC"},{label:"销售规格",value:"SPEC"},{label:"扩展属性",value:"EXTENDED"}]} /></Form.Item>
        <Form.Item name="inputType" label="输入组件" rules={[{required:true}]}><Select options={[{label:"文本",value:"TEXT"},{label:"数字",value:"NUMBER"},{label:"下拉单选",value:"SELECT"},{label:"Radio单选",value:"RADIO"},{label:"Checkbox多选",value:"CHECKBOX"},{label:"开关",value:"SWITCH"},{label:"日期",value:"DATE"}]} /></Form.Item>
        <Form.Item name="unit" label="单位"><Input placeholder="GB、W、米、个月" /></Form.Item>
        <Form.Item name="categoryIds" label="适用分类" className="full" extra="可留空；留空时保留属性模板，但不关联任何分类"><Select mode="multiple" showSearch optionFilterProp="label" options={(categories.data||[]).map(c=>({value:Number(c.id),label:`${"　".repeat(Number(c.level)-1)}${c.name}（${c.level}级）`}))} /></Form.Item>
        <Form.Item name="requiredFlag" label="是否必填"><Radio.Group options={[{label:"必填",value:1},{label:"选填",value:0}]} /></Form.Item>
        <Form.Item name="visibleFlag" label="前台展示"><Radio.Group options={[{label:"展示",value:1},{label:"隐藏",value:0}]} /></Form.Item>
        <Form.Item name="filterable" label="参与筛选"><Radio.Group options={[{label:"是",value:1},{label:"否",value:0}]} /></Form.Item>
        <Form.Item name="searchable" label="参与搜索"><Radio.Group options={[{label:"是",value:1},{label:"否",value:0}]} /></Form.Item>
        <Form.Item name="allowCustom" label="允许自定义值"><Radio.Group options={[{label:"是",value:1},{label:"否",value:0}]} /></Form.Item>
        <Form.Item name="sortOrder" label="排序"><InputNumber min={0} style={{width:"100%"}} /></Form.Item>
        <Form.Item name="status" label="状态"><Select options={[{label:"启用",value:1},{label:"停用",value:0}]} /></Form.Item>
      </Form>
    </Modal>
    <Modal open={Boolean(optionOwner)} title={`${optionOwner?.name || ""} · 选项管理`} onCancel={()=>setOptionOwner(undefined)} footer={null} width={720}>
      <Form form={optionForm} layout="inline" initialValues={{sortOrder:0,status:1}} style={{marginBottom:16}}>
        <Form.Item name="optionLabel" rules={[{required:true}]}><Input placeholder="选项名称" /></Form.Item><Form.Item name="optionCode" rules={[{required:true}]}><Input placeholder="选项编码" /></Form.Item><Form.Item name="sortOrder"><InputNumber min={0} placeholder="排序" /></Form.Item><Form.Item name="status"><Select style={{width:90}} options={[{label:"启用",value:1},{label:"停用",value:0}]} /></Form.Item><Button type="primary" onClick={saveOption}>{optionEditing?"保存":"添加"}</Button>
      </Form>
      <Table<Row> rowKey="id" dataSource={(rows.data||[]).find(r=>r.id===optionOwner?.id)?.options || optionOwner?.options || []} pagination={{pageSize:8}} columns={[{title:"选项",dataIndex:"optionLabel"},{title:"编码",dataIndex:"optionCode"},{title:"排序",dataIndex:"sortOrder"},{title:"状态",dataIndex:"status",render:v=>Number(v)===1?<Tag color="green">启用</Tag>:<Tag>停用</Tag>},{title:"操作",render:(_,r)=><Button type="link" onClick={()=>{setOptionEditing(r);optionForm.setFieldsValue(r);}}>编辑</Button>}]}/>
    </Modal>
  </>;
}

function Categories() {
  const { message, modal } = AntApp.useApp();
  const rows = useLoad<Row[]>(() => rootApi("/api/admin/business/categories"));
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row>();
  const [attributeOwner, setAttributeOwner] = useState<Row>();
  const [selectedAttributeIds, setSelectedAttributeIds] = useState<number[]>([]);
  const [attributeAddOpen, setAttributeAddOpen] = useState(false);
  const [pendingAttributeIds, setPendingAttributeIds] = useState<number[]>([]);
  const associatedAttributePage = usePagedLoad(`/api/admin/business/attributes?categoryId=${attributeOwner?.id || 0}&associated=true`,10,[attributeOwner?.id],Boolean(attributeOwner));
  const unassociatedAttributePage = usePagedLoad(`/api/admin/business/attributes?categoryId=${attributeOwner?.id || 0}&associated=false`,10,[attributeOwner?.id],Boolean(attributeOwner));
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
  const treeData = useMemo(() => {
    const nodes = new Map<number, Row>();
    (rows.data || []).forEach((row) => nodes.set(Number(row.id), { ...row, children: [] }));
    const roots: Row[] = [];
    nodes.forEach((node) => {
      const parent = nodes.get(Number(node.parentId));
      if (parent) parent.children.push(node);
      else roots.push(node);
    });
    const sort = (items: Row[]): Row[] => items
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || Number(a.id) - Number(b.id))
      .map((item) => ({ ...item, children: item.children.length ? sort(item.children) : undefined }));
    return sort(roots);
  }, [rows.data]);
  const showAttributes = (row: Row) => {
    setAttributeOwner(row);
    setSelectedAttributeIds([]);
  };
  const updateAttributeAssociation = (attribute: Row, attach: boolean) => {
    const categoryIds = (attribute.categoryIds || []).map(Number)
      .filter((id: number) => id !== Number(attributeOwner?.id));
    if (attach && attributeOwner) categoryIds.push(Number(attributeOwner.id));
    return rootMutation(`/api/admin/business/attributes/${attribute.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...attribute, categoryIds, options: undefined }),
    });
  };
  const addAttributes = async () => {
    if (!attributeOwner) return;
    try {
      await Promise.all(unassociatedAttributePage.data.filter((attribute) => pendingAttributeIds.includes(Number(attribute.id)))
        .map((attribute) => updateAttributeAssociation(attribute, true)));
      message.success(`已为“${attributeOwner.name}”添加 ${pendingAttributeIds.length} 个属性`);
      setAttributeAddOpen(false);
      setPendingAttributeIds([]);
      await Promise.all([associatedAttributePage.refresh(),unassociatedAttributePage.refresh()]);
    } catch (error) { message.error((error as Error).message); }
  };
  const detachAttributes = () => {
    if (!attributeOwner || !selectedAttributeIds.length) return;
    modal.confirm({
      title: `取消关联 ${selectedAttributeIds.length} 个属性？`,
      content: "只取消与当前分类的直接关联，不影响属性模板及其他分类。",
      onOk: async () => {
        await Promise.all(associatedAttributePage.data.filter((attribute) => selectedAttributeIds.includes(Number(attribute.id)))
          .map((attribute) => updateAttributeAssociation(attribute, false)));
        message.success("已取消属性关联");
        setSelectedAttributeIds([]);
        await Promise.all([associatedAttributePage.refresh(),unassociatedAttributePage.refresh()]);
      },
    });
  };
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
          <Button type="link" onClick={() => showAttributes(row)}>
            属性管理
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
          dataSource={treeData}
          columns={columns}
          expandable={{ defaultExpandAllRows: true, indentSize: 24 }}
          searchPlaceholder="搜索分类名称、上级分类或级别"
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
      <Modal
        open={Boolean(attributeOwner)}
        title={`${attributeOwner?.name || ""} · 属性管理`}
        width={760}
        onCancel={() => setAttributeOwner(undefined)}
        footer={<Space><Button onClick={() => setAttributeOwner(undefined)}>关闭</Button><Button disabled={!selectedAttributeIds.length} onClick={detachAttributes}>批量取消关联</Button><Button type="primary" onClick={() => { setPendingAttributeIds([]); setAttributeAddOpen(true); }}>添加关联属性</Button></Space>}
      >
        <Alert type="info" showIcon message="这里只显示当前分类直接关联的属性；上级分类属性仍会自动继承。" style={{ marginBottom: 16 }} />
        <Table<Row>
          rowKey="id"
          loading={associatedAttributePage.loading}
          dataSource={associatedAttributePage.data}
          server={associatedAttributePage.server}
          searchPlaceholder="搜索已关联属性的名称、编码或分组"
          rowSelection={{
            selectedRowKeys: selectedAttributeIds,
            onChange: (keys) => setSelectedAttributeIds(keys.map(Number)),
          }}
          columns={[
            { title: "属性名称", render: (_, row) => <><strong>{row.name}</strong><div className="subline">{row.code}</div></> },
            { title: "分组", dataIndex: "groupName" },
            { title: "输入方式", dataIndex: "inputType" },
            { title: "状态", dataIndex: "status", render: (value) => Number(value) === 1 ? <Tag color="green">启用</Tag> : <Tag>停用</Tag> },
          ]}
        />
      </Modal>
      <Modal
        open={attributeAddOpen}
        title={`${attributeOwner?.name || ""} · 添加关联属性`}
        width={760}
        onCancel={() => setAttributeAddOpen(false)}
        onOk={() => void addAttributes()}
        okText={`添加所选属性${pendingAttributeIds.length ? `（${pendingAttributeIds.length}）` : ""}`}
        okButtonProps={{ disabled: !pendingAttributeIds.length }}
      >
        <Alert type="info" showIcon message="以下仅列出尚未与当前分类直接关联的属性，可搜索后批量选择。" style={{ marginBottom: 16 }} />
        <Table<Row>
          rowKey="id"
          loading={unassociatedAttributePage.loading}
          dataSource={unassociatedAttributePage.data}
          server={unassociatedAttributePage.server}
          searchPlaceholder="搜索未关联属性的名称、编码、分组或输入方式"
          rowSelection={{ selectedRowKeys: pendingAttributeIds, onChange: (keys) => setPendingAttributeIds(keys.map(Number)) }}
          columns={[
            { title: "属性名称", render: (_, row) => <><strong>{row.name}</strong><div className="subline">{row.code}</div></> },
            { title: "分组", dataIndex: "groupName" },
            { title: "输入方式", dataIndex: "inputType" },
            { title: "已关联分类", render: (_, row) => `${row.categoryIds?.length || 0} 个` },
          ]}
        />
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
  const isBrand = module === "brands";
  const endpoint = `/api/admin/content/${current.type}`;
  const resourceRows = usePagedLoad(endpoint,10,[module]);
  const brandRows = usePagedLoad("/api/admin/content/brands/list", 10, [module]);
  const rows = isBrand ? brandRows : resourceRows;
  const products = useLoad<Row[]>(() =>
    rootApi("/api/admin/business/products"),
  );
  const selectableSkus=expandProductSkus(products.data||[]).filter((sku)=>Number(sku.status)===1);
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row>();
  const [relationForm] = Form.useForm();
  const [platform, setPlatform] = useState<Row>();
  const [relations, setRelations] = useState<Row[]>([]);
  const [productOpen, setProductOpen] = useState(false);
  const [relationEditing, setRelationEditing] = useState<Row>();
  const [relationEditorOpen, setRelationEditorOpen] = useState(false);
  const [solution, setSolution] = useState<Row>();
  const [solutionItems, setSolutionItems] = useState<Row[]>([]);
  const [solutionItemsOpen, setSolutionItemsOpen] = useState(false);
  const [solutionItemEditing, setSolutionItemEditing] = useState<Row>();
  const [solutionItemEditorOpen, setSolutionItemEditorOpen] = useState(false);
  const [solutionItemForm] = Form.useForm();
  const platformProductsPage = usePagedLoad(`/api/admin/content/platform/${platform?.id || 0}/products`,10,[platform?.id],Boolean(platform));
  const solutionProductsPage = usePagedLoad(`/api/admin/content/solution/${solution?.id || 0}/products`,10,[solution?.id],Boolean(solution));
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
    setProductOpen(true);
  };
  const showRelation = (row?: Row) => {
    setRelationEditing(row);
    relationForm.resetFields();
    relationForm.setFieldsValue(
      row || { skuId: selectableSkus[0]?.id||selectableSkus[0]?.skuId, productUrl: "", listingStatus: 1 },
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
      void platformProductsPage.refresh();
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
        void platformProductsPage.refresh();
        message.success("平台商品已移除");
      },
    });
  const loadSolutionProducts = async (row: Row) => {
    setSolution(row);
    setSolutionItemsOpen(true);
  };
  const showSolutionItem = (row?: Row) => {
    setSolutionItemEditing(row);
    solutionItemForm.resetFields();
    solutionItemForm.setFieldsValue(
      row || { skuId: selectableSkus[0]?.id||selectableSkus[0]?.skuId, defaultQuantity: 1, requiredItem: 1, sortOrder: 0 },
    );
    setSolutionItemEditorOpen(true);
  };
  const saveSolutionItem = async () => {
    try {
      const values = await solutionItemForm.validateFields();
      const url = `/api/admin/content/solution/${solution!.id}/products${solutionItemEditing ? `/${solutionItemEditing.id}` : ""}`;
      const response = await fetch(url, {
        method: solutionItemEditing ? "PUT" : "POST",
        headers: apiHeaders(),
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "方案商品保存失败");
      }
      void solutionProductsPage.refresh();
      setSolutionItemEditorOpen(false);
      message.success("方案商品已保存");
    } catch (error) {
      message.error((error as Error).message);
    }
  };
  const removeSolutionItem = (row: Row) =>
    modal.confirm({
      title: `确认从方案中移除“${row.title}”？`,
      onOk: async () => {
        await fetch(`/api/admin/content/solution/${solution!.id}/products/${row.id}`, {
          method: "DELETE",
          headers: apiHeaders(),
        });
        void solutionProductsPage.refresh();
        message.success("方案商品已移除");
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
            title: module === "platforms" ? "配置跳转链接" : "跳转链接",
            dataIndex: "linkUrl",
            render: (v: string) => v || "—",
          },
        ]),
    ...(module === "platforms"
      ? [{
          title: "内部跳转链接",
          width: 290,
          render: (_: unknown, row: Row) => {
            const internalUrl = `/web/platforms/${row.id}/products`;
            return <Typography.Text code copyable={{ text: internalUrl, tooltips: ["复制链接", "已复制"] }}>{internalUrl}</Typography.Text>;
          },
        }]
      : []),
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
      width: ["platforms", "solutions"].includes(module) ? 250 : 150,
      render: (_, row) => (
        <Space>
          {module === "platforms" && (
            <Button type="link" onClick={() => void loadPlatformProducts(row)}>
              商品管理
            </Button>
          )}
          {module === "solutions" && (
            <Button type="link" onClick={() => void loadSolutionProducts(row)}>
              商品管理
            </Button>
          )}
          <Button type="link" onClick={() => show(row)}>
            编辑
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
          server={isBrand ? brandRows.server : resourceRows.server}
          searchPlaceholder={isBrand ? "搜索品牌名称或说明" : `搜索${current.name}名称、说明或链接`}
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
            label={module === "solutions" ? "适用场景" : "说明"}
            className="full"
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          {module === "solutions" && (
            <Form.Item name="description" label="方案说明" className="full">
              <Input.TextArea rows={5} placeholder="说明方案目标、设备组合、实施建议等" />
            </Form.Item>
          )}
          {module === "contents" && (
            <Form.Item name="description" label="文章正文" className="full">
              <RichTextEditor />
            </Form.Item>
          )}
          <Form.Item
            name={isBrand ? "logo" : "imageUrl"}
            label={isBrand ? "品牌 Logo" : module === "solutions" ? "Web端横版宣传海报（16:9）" : module === "contents" ? "文章图标（1:1）" : "展示图片"}
            className="full"
            rules={
              ["banners", "solutions"].includes(module)
                ? [{ required: true, message: module === "solutions" ? "请上传Web端16:9横版宣传海报" : "请上传轮播图片" }]
                : undefined
            }
          >
            <ProductImageUpload
              kind={
                isBrand
                  ? "brand"
                  : module === "contents"
                    ? "contentIcon"
                  : module === "banners"
                    ? "banner"
                    : "portal"
              }
            />
          </Form.Item>
          {module === "solutions" && (
            <Form.Item
              name="mobileImageUrl"
              label="H5端竖版宣传海报（9:16）"
              className="full"
              rules={[{ required: true, message: "请上传H5端9:16竖版宣传海报" }]}
            >
              <ProductImageUpload kind="solutionMobile" />
            </Form.Item>
          )}
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
              text: `/web/platforms/${platform?.id}/products`,
            }}
          >
            导航入口：/web/platforms/{platform?.id}/products
          </Typography.Text>
        </Space>
        <Table
          rowKey="id"
          loading={platformProductsPage.loading}
          dataSource={platformProductsPage.data}
          server={platformProductsPage.server}
          searchPlaceholder="搜索平台商品名称、SKU或平台链接"
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
              options={selectableSkus.map((row) => ({
                value: row.id||row.skuId,
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
      <Modal
        open={solutionItemsOpen}
        title={`${solution?.title || ""} · 方案商品`}
        width={980}
        footer={null}
        onCancel={() => setSolutionItemsOpen(false)}
      >
        <Space style={{ marginBottom: 16 }}>
          <Button type="primary" onClick={() => showSolutionItem()}>
            ＋ 添加商品
          </Button>
          <Typography.Text copyable={{ text: `/web/?view=solution-detail&solutionId=${solution?.id}` }}>
            分享入口：/web/?view=solution-detail&amp;solutionId={solution?.id}
          </Typography.Text>
        </Space>
        <Table
          rowKey="id"
          loading={solutionProductsPage.loading}
          dataSource={solutionProductsPage.data}
          server={solutionProductsPage.server}
          searchPlaceholder="搜索方案商品名称或SKU"
          columns={[
            {
              title: "商品",
              render: (_, row) => (
                <div className="user-cell">
                  <span className="solution-admin-cover"><i>{row.title?.slice(0, 1) || "商"}</i>{row.mainImage && <img src={row.mainImage} alt={row.title} onError={(event) => { event.currentTarget.style.display = "none"; }} />}</span>
                  <span><strong>{row.title}</strong><small>{row.skuCode}</small></span>
                </div>
              ),
            },
            { title: "默认数量", dataIndex: "defaultQuantity", width: 110 },
            {
              title: "选择规则",
              dataIndex: "requiredItem",
              width: 110,
              render: (value) => <Tag color={Number(value) === 1 ? "blue" : "orange"}>{Number(value) === 1 ? "必选" : "可选"}</Tag>,
            },
            { title: "排序", dataIndex: "sortOrder", width: 90 },
            {
              title: "操作",
              width: 150,
              render: (_, row) => (
                <Space>
                  <Button type="link" onClick={() => showSolutionItem(row)}>编辑</Button>
                  <Button type="link" danger onClick={() => removeSolutionItem(row)}>移除</Button>
                </Space>
              ),
            },
          ]}
        />
      </Modal>
      <Modal
        open={solutionItemEditorOpen}
        title={`${solutionItemEditing ? "编辑" : "添加"}方案商品`}
        onCancel={() => setSolutionItemEditorOpen(false)}
        onOk={() => void saveSolutionItem()}
      >
        <Form form={solutionItemForm} layout="vertical">
          <Form.Item name="skuId" label="关联现有商品" rules={[{ required: true, message: "请选择商品" }]}>
            <Select
              showSearch
              optionFilterProp="label"
              disabled={!!solutionItemEditing}
              options={selectableSkus.map((row) => ({
                value: row.id||row.skuId,
                label: `${row.title} · ${row.skuCode}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="defaultQuantity" label="默认数量" rules={[{ required: true, message: "请输入默认数量" }]}>
            <InputNumber min={1} max={9999} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="requiredItem" label="选择规则" rules={[{ required: true }]}>
            <Radio.Group optionType="button" buttonStyle="solid">
              <Radio.Button value={1}>必选商品</Radio.Button>
              <Radio.Button value={0}>可选商品</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber min={0} style={{ width: "100%" }} />
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

type PageResult<T> = { records: T[]; total: number; page: number; pageSize: number; totalPages: number };
function usePagedLoad(endpoint: string, initialPageSize = 10, deps: unknown[] = [], enabled = true) {
  const { message } = AntApp.useApp();
  const [data, setData] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPageValue] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [keyword, setKeywordValue] = useState("");
  const [status, setStatusValue] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const load = async () => {
    setLoading(true);
    try {
      const url = new URL(endpoint, window.location.origin);
      url.searchParams.set("page", String(page));
      url.searchParams.set("pageSize", String(pageSize));
      if (keyword.trim()) url.searchParams.set("keyword", keyword.trim());
      if (status !== undefined) url.searchParams.set("status", status);
      const result = await rootApi<PageResult<Row>>(url.pathname + url.search);
      setData(result.records || []);
      setTotal(Number(result.total || 0));
      if (result.total > 0 && page > Math.max(1, result.totalPages)) setPageValue(Math.max(1, result.totalPages));
    } catch (error) { message.error((error as Error).message); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    if (!enabled) { setData([]); setTotal(0); setLoading(false); return; }
    const timer = window.setTimeout(() => void load(), keyword ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [endpoint, page, pageSize, keyword, status, revision, enabled, ...deps]);
  const server = {
    total, page, pageSize, keyword, status,
    setKeyword: (value: string) => { setKeywordValue(value); setPageValue(1); },
    setStatus: (value?: string) => { setStatusValue(value); setPageValue(1); },
    setPage: (nextPage: number, nextPageSize: number) => {
      setPageSize(nextPageSize);
      setPageValue(nextPageSize !== pageSize ? 1 : nextPage);
    },
  };
  return { data, total, loading, server, refresh: async () => setRevision((value) => value + 1) };
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
  const users = usePagedLoad("/api/admin/system/users",8);
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
        server={users.server}
        searchPlaceholder="搜索后台账号、姓名、手机、邮箱或角色"
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
  const roles = usePagedLoad("/api/admin/system/roles",10);
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
          server={roles.server}
          searchPlaceholder="搜索角色名称、编码或说明"
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
  const result = usePagedLoad("/api/admin/system/permissions",10);
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
        server={result.server}
        searchPlaceholder="搜索权限名称、权限编码、模块或说明"
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
  const result = usePagedLoad("/api/admin/system/logs",20);
  const [detail, setDetail] = useState<Row>();
  return (
    <Card
      className="data-card"
      title="操作日志"
      extra={
        <Space>
          <Tag color="green">服务端分页查询</Tag>
          <Button onClick={result.refresh}>刷新</Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        loading={result.loading}
        dataSource={result.data}
        server={result.server}
        searchPlaceholder="搜索模块、动作、对象、IP、请求ID或结果"
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
  const options = usePagedLoad("/api/admin/system/option-groups",10);
  const [optionForm] = Form.useForm();
  const [valueForm] = Form.useForm();
  const [optionOpen, setOptionOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<Row>();
  const [managedGroup, setManagedGroup] = useState<Row>();
  const [valueOpen, setValueOpen] = useState(false);
  const [editingValue, setEditingValue] = useState<Row>();
  const optionValues = usePagedLoad(
    `/api/admin/system/options?type=${encodeURIComponent(managedGroup?.optionCode || "")}`,
    8,[managedGroup?.optionCode],Boolean(managedGroup),
  );
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
  const showOption = (row?: Row) => {
    setEditingOption(row);
    optionForm.resetFields();
    optionForm.setFieldsValue(
      row || {
        optionName: "",
        controlType: "RADIO",
        sortOrder: (options.data?.length || 0) * 10 + 10,
        status: 1,
      },
    );
    setOptionOpen(true);
  };
  const saveOption = async () => {
    try {
      const values = await optionForm.validateFields();
      await api(
        editingOption
          ? `/option-groups/${editingOption.id}`
          : "/option-groups",
        {
        method: editingOption ? "PUT" : "POST",
        body: JSON.stringify(values),
        },
      );
      message.success(editingOption ? "选项配置已更新" : "选项配置已添加");
      setOptionOpen(false);
      void options.refresh();
    } catch (error) {
      if (error instanceof Error) message.error(error.message);
    }
  };
  const updateOptionStatus = async (row: Row, checked: boolean) => {
    try {
      await api(`/option-groups/${row.id}`, {
        method: "PUT",
        body: JSON.stringify({
          optionName: row.optionName,
          controlType: row.controlType,
          sortOrder: row.sortOrder,
          status: checked ? 1 : 0,
        }),
      });
      message.success(checked ? "选项配置已启用" : "选项配置已停用");
      void options.refresh();
    } catch (error) {
      message.error((error as Error).message);
    }
  };
  const removeOption = (row: Row) =>
    Modal.confirm({
      title: "删除选项配置",
      content: `确认删除“${row.optionName}”吗？请先清空其中的选项值。`,
      okText: "删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        await api(`/option-groups/${row.id}`, { method: "DELETE" });
        message.success("选项配置已删除");
        void options.refresh();
      },
    });
  const showValue = (row?: Row) => {
    setEditingValue(row);
    valueForm.resetFields();
    valueForm.setFieldsValue(
      row || {
        optionType: managedGroup?.optionCode,
        sortOrder: (optionValues.data?.length || 0) * 10 + 10,
        status: 1,
      },
    );
    setValueOpen(true);
  };
  const saveValue = async () => {
    try {
      const values = await valueForm.validateFields();
      await api(editingValue ? `/options/${editingValue.id}` : "/options", {
        method: editingValue ? "PUT" : "POST",
        body: JSON.stringify({
          ...values,
          optionType: managedGroup?.optionCode,
        }),
      });
      message.success(editingValue ? "选项值已更新" : "选项值已添加");
      setValueOpen(false);
      void optionValues.refresh();
      void options.refresh();
    } catch (error) {
      if (error instanceof Error) message.error(error.message);
    }
  };
  const removeValue = (row: Row) =>
    Modal.confirm({
      title: "删除选项值",
      content: `确认删除“${row.label}”吗？`,
      okText: "删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        await api(`/options/${row.id}`, { method: "DELETE" });
        message.success("选项值已删除");
        void optionValues.refresh();
        void options.refresh();
      },
    });
  return (
    <>
      <Card className="config-tabs">
        <Tabs
          items={[
            ...groups.map(([group, items]) => ({
              key: group,
              label: group,
              children: (
                <div className="config-tab-panel">
                  {items.map((row) => (
                    <ConfigRow
                      key={row.id}
                      row={row}
                      saving={saving === row.id}
                      save={(value) => save(row, value)}
                    />
                  ))}
                </div>
              ),
            })),
            {
              key: "option-management",
              label: "选项管理",
              children: (
                <Card
                  title="选项配置列表"
                  extra={
                    <Button type="primary" onClick={() => showOption()}>
                      新增选项配置
                    </Button>
                  }
                >
                  <Table
                    rowKey="id"
                    loading={options.loading}
                    dataSource={options.data || []}
                    server={options.server}
                    searchPlaceholder="搜索选项配置名称、编码或类型"
                    columns={[
                      { title: "选项名称", dataIndex: "optionName" },
                      {
                        title: "选项类型",
                        dataIndex: "controlType",
                        render: (value: string) =>
                          ({
                            RADIO: "单选",
                            SELECT_MULTIPLE: "下拉多选",
                            CHECKBOX_MULTIPLE: "Checkbox 多选",
                          })[value] || value,
                      },
                      {
                        title: "选项数量",
                        dataIndex: "optionCount",
                        width: 110,
                      },
                      { title: "排序", dataIndex: "sortOrder", width: 100 },
                      {
                        title: "状态",
                        width: 110,
                        render: (_: unknown, row: Row) => (
                          <Switch
                            checked={Number(row.status) === 1}
                            checkedChildren="启用"
                            unCheckedChildren="停用"
                            onChange={(checked) =>
                              void updateOptionStatus(row, checked)
                            }
                          />
                        ),
                      },
                      {
                        title: "更新时间",
                        width: 180,
                        render: (_: unknown, row: Row) =>
                          dateTime(row.updatedAt),
                      },
                      {
                        title: "操作",
                        width: 260,
                        render: (_: unknown, row: Row) => (
                          <Space>
                            <Button
                              type="link"
                              onClick={() => setManagedGroup(row)}
                            >
                              管理选项
                            </Button>
                            <Button type="link" onClick={() => showOption(row)}>
                              编辑
                            </Button>
                          </Space>
                        ),
                      },
                    ]}
                  />
                </Card>
              ),
            },
          ]}
        />
      </Card>
      <Modal
        open={optionOpen}
        title={editingOption ? "编辑选项配置" : "新增选项配置"}
        okText="保存"
        cancelText="取消"
        onOk={() => void saveOption()}
        onCancel={() => setOptionOpen(false)}
      >
        <Form form={optionForm} layout="vertical">
          <Form.Item
            name="optionName"
            label="选项名称"
            rules={[{ required: true, message: "请输入选项名称" }]}
          >
            <Input placeholder="例如：物流公司、商品标签" maxLength={120} />
          </Form.Item>
          <Form.Item
            name="controlType"
            label="选项类型"
            rules={[{ required: true, message: "请选择选项类型" }]}
          >
            <Select
              options={[
                { value: "RADIO", label: "单选" },
                { value: "SELECT_MULTIPLE", label: "下拉多选" },
                { value: "CHECKBOX_MULTIPLE", label: "Checkbox 多选" },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="sortOrder"
            label="排序"
            rules={[{ required: true, message: "请输入排序值" }]}
          >
            <InputNumber min={0} precision={0} style={{ width: "100%" }} />
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
      <Modal
        open={!!managedGroup}
        width={880}
        footer={null}
        title={`${managedGroup?.optionName || ""} · 选项管理`}
        onCancel={() => setManagedGroup(undefined)}
      >
        <div style={{ marginBottom: 16, textAlign: "right" }}>
          <Button type="primary" onClick={() => showValue()}>
            新增选项
          </Button>
        </div>
        <Table
          rowKey="id"
          loading={optionValues.loading}
          dataSource={optionValues.data || []}
          server={optionValues.server}
          searchPlaceholder="搜索选项名称或选项值"
          columns={[
            { title: "选项名称", dataIndex: "label" },
            { title: "选项值", dataIndex: "optionValue" },
            { title: "排序", dataIndex: "sortOrder", width: 90 },
            {
              title: "状态",
              width: 90,
              render: (_: unknown, row: Row) => (
                <Tag color={Number(row.status) === 1 ? "green" : "default"}>
                  {Number(row.status) === 1 ? "启用" : "停用"}
                </Tag>
              ),
            },
            {
              title: "操作",
              width: 140,
              render: (_: unknown, row: Row) => (
                <Space>
                  <Button type="link" onClick={() => showValue(row)}>
                    编辑
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Modal>
      <Modal
        open={valueOpen}
        title={editingValue ? "编辑选项值" : "新增选项值"}
        okText="保存"
        cancelText="取消"
        onOk={() => void saveValue()}
        onCancel={() => setValueOpen(false)}
      >
        <Form form={valueForm} layout="vertical">
          <Form.Item
            name="label"
            label="选项名称"
            rules={[{ required: true, message: "请输入选项名称" }]}
          >
            <Input placeholder="请输入展示名称" maxLength={120} />
          </Form.Item>
          <Form.Item
            name="optionValue"
            label="选项值"
            rules={[{ required: true, message: "请输入选项值" }]}
          >
            <Input placeholder="请输入保存值" maxLength={160} />
          </Form.Item>
          <Form.Item
            name="sortOrder"
            label="排序"
            rules={[{ required: true, message: "请输入排序值" }]}
          >
            <InputNumber min={0} precision={0} style={{ width: "100%" }} />
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
