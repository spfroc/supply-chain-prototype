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
  Modal as AntModal,
  Progress,
  Radio,
  Select,
  Space,
  Statistic,
  Switch,
  Table as AntTable,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import type { ModalProps } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import zhCN from "antd/locale/zh_CN";

type Row = Record<string, any>;

type GuardedModalProps = ModalProps & { guardUnsaved?: boolean };
function GuardedModal({guardUnsaved=true,onCancel,afterOpenChange,modalRender,...props}:GuardedModalProps){
  const {modal}=AntApp.useApp();
  const dirty=useRef(false);
  const opened=useRef(false);
  useEffect(()=>{
    if(props.open&&!opened.current)dirty.current=false;
    opened.current=Boolean(props.open);
  },[props.open]);
  const close:ModalProps["onCancel"]=(event)=>{
    if(!guardUnsaved||!dirty.current){onCancel?.(event);return;}
    modal.confirm({title:"放弃未保存的修改？",content:"关闭后，本次填写或修改的内容不会保留。",okText:"放弃修改",cancelText:"继续编辑",okButtonProps:{danger:true},onOk:()=>{dirty.current=false;onCancel?.(event);}});
  };
  return <AntModal {...props} onCancel={close} afterOpenChange={(visible)=>{if(!visible)dirty.current=false;afterOpenChange?.(visible);}}
    modalRender={(node)=><div onChangeCapture={()=>{dirty.current=true;}} onInputCapture={()=>{dirty.current=true;}}>{modalRender?modalRender(node):node}</div>}/>;
}
const Modal=Object.assign(GuardedModal,{confirm:AntModal.confirm});

type ManagedTableProps<T extends Row> = TableProps<T> & {
  searchPlaceholder?: string;
  toolbarExtra?: ReactNode;
  selectionActions?: (selected: T[], clearSelection: () => void) => ReactNode;
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
  selectionActions,
  toolbarExtra,
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
      <Space wrap className="managed-table-search-row">
        <Input.Search allowClear value={server ? server.keyword : keyword} onChange={(event) => server ? server.setKeyword(event.target.value) : setKeyword(event.target.value)} placeholder={searchPlaceholder} style={{ width: 320 }} />
        {(hasStatus || server) && <Select allowClear value={server ? server.status : status} onChange={(value) => server ? server.setStatus(value) : setStatus(value)} placeholder="全部状态" style={{ width: 150 }} options={server?.statusOptions || [{ label: "启用 / 正常 / 在售", value: "1" }, { label: "停用 / 禁用 / 下架", value: "0" }]} />}
        {toolbarExtra}
      </Space>
      <Space wrap className="managed-table-batch-row">
        <span className="selection-summary">已选 {selectedRowKeys.length} 项</span>
        {selectionActions?.(selected, () => {
          setSelectedRowKeys([]);
          rowSelection?.onChange?.([], [], { type: "none" });
        })}
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
  | "collectJobs"
  | "categories"
  | "attributes"
  | "brands"
  | "platforms"
  | "platformProducts"
  | "platformOrders"
  | "navigations"
  | "banners"
  | "homeFloors"
  | "homeAds"
  | "solutions"
  | "solutionProducts"
  | "contents"
  | "contactSettings"
  | "serviceFeatures"
  | "footerSettings"
  | "seoSettings"
  | "enterprises"
  | "enterpriseUsers"
  | "agreements"
  | "agreementProducts"
  | "agreementOrders"
  | "orders"
  | "finance"
  | "afterSales"
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
const parseTemplateList=(value:unknown):Row[]=>{
  try{return Array.isArray(value)?value:JSON.parse(String(value||"[]"));}catch{return [];}
};
const mergeOrderListItems=(value:unknown):Row[]=>{
  const merged=new Map<string,Row>();
  parseTemplateList(value).forEach((item)=>{
    const key=String(item.skuId||item.skuCode||item.title||item.id);
    const current=merged.get(key);
    if(current){
      current.quantity=Number(current.quantity||0)+Number(item.quantity||0);
      current.totalPrice=Number(current.totalPrice||0)+Number(item.totalPrice||0);
      return;
    }
    merged.set(key,{...item,quantity:Number(item.quantity||0),totalPrice:Number(item.totalPrice||0)});
  });
  return [...merged.values()];
};
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
const collectPlatformLabel = (value?: string) =>
  ({ jd: "京东", taobao: "淘宝/天猫", huiecai: "徽e采", qilu: "齐鲁云采", mixed: "混合" } as Record<string, string>)[String(value || "")] || value || "—";
const detectCollectPlatform = (url: string) => {
  const text = String(url || "").toLowerCase();
  if (text.includes("taobao") || text.includes("tmall")) return "taobao";
  if (text.includes("miniappss") || text.includes("huiecai") || text.includes("goodsinfo/")) return "huiecai";
  if (text.includes("shandong.gov.cn") || text.includes("gpfa-main-web") || text.includes("goodspriceguid") || text.includes("scshortlisted")) return "qilu";
  return "jd";
};
const collectJobStatus = (value?: string) =>
  ({
    PENDING: { label: "排队中", color: "default" },
    RUNNING: { label: "采集中", color: "processing" },
    SUCCEEDED: { label: "已完成", color: "success" },
    PARTIAL: { label: "部分完成", color: "warning" },
    FAILED: { label: "失败", color: "error" },
  } as Record<string, { label: string; color: string }>)[String(value || "")] || { label: String(value || "—"), color: "default" };
const collectItemStatus = (value?: string) =>
  ({
    PENDING: { label: "等待中", color: "default" },
    RUNNING: { label: "采集中", color: "processing" },
    SUCCEEDED: { label: "成功", color: "success" },
    FAILED: { label: "失败", color: "error" },
    SKIPPED: { label: "已跳过", color: "warning" },
  } as Record<string, { label: string; color: string }>)[String(value || "")] || { label: String(value || "—"), color: "default" };
function parseCollectBatchText(text: string, requirePrice = true) {
  const rows: { url: string; memberPrice?: number; error?: string }[] = [];
  const seen = new Set<string>();
  for (const raw of (text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^(url|链接|商品链接)([,，\s\t]|$).*(售价|price)/i.test(line)) continue;
    const parts = line.split(/[,，\t]+/).map((part) => part.trim()).filter(Boolean);
    let url = line;
    let price: number | undefined;
    const last = parts[parts.length - 1]?.replace(/^¥/, "") || "";
    if (parts.length >= 2 && /^\d+(\.\d+)?$/.test(last)) {
      price = Number(last);
      url = parts.slice(0, -1).join(" ").trim();
    } else {
      const spaced = line.split(/\s+/);
      const tail = spaced[spaced.length - 1]?.replace(/^¥/, "") || "";
      if (spaced.length >= 2 && /^\d+(\.\d+)?$/.test(tail)) {
        price = Number(tail);
        url = spaced.slice(0, -1).join(" ");
      }
    }
    if (!url) continue;
    if (seen.has(url)) {
      rows.push({ url, memberPrice: price, error: "重复链接" });
      continue;
    }
    seen.add(url);
    if (requirePrice && !(price && price > 0)) {
      rows.push({ url, memberPrice: price, error: "请填写售价" });
      continue;
    }
    rows.push({ url, memberPrice: price });
  }
  return rows;
}
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

const pendingMutations=new Map<string,Promise<Response>>();
const fetch=(input:RequestInfo|URL,init?:RequestInit):Promise<Response>=>{
  const method=String(init?.method||(input instanceof Request?input.method:"GET")).toUpperCase();
  if(["GET","HEAD","OPTIONS"].includes(method)||init?.body instanceof FormData)
    return window.fetch(input,init);
  const url=typeof input==="string"?input:input instanceof URL?input.toString():input.url;
  const body=typeof init?.body==="string"?init.body:"";
  const key=`${method}:${url}:${body}`;
  if(pendingMutations.has(key))return Promise.reject(new Error("操作正在处理，请勿重复提交"));
  const request=window.fetch(input,init);
  pendingMutations.set(key,request);
  request.finally(()=>{if(pendingMutations.get(key)===request)pendingMutations.delete(key);}).catch(()=>{});
  return request;
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

const inflightRootRequests = new Map<string, Promise<unknown>>();
async function rootApi<T>(path: string): Promise<T> {
  const existing=inflightRootRequests.get(path);
  if(existing)return existing as Promise<T>;
  const request=(async()=>{
    const response = await fetch(path, { headers: apiHeaders() });
    if (!response.ok) throw new Error(`请求失败（${response.status}）`);
    return response.json() as Promise<T>;
  })();
  inflightRootRequests.set(path,request);
  try{return await request;}
  finally{if(inflightRootRequests.get(path)===request)inflightRootRequests.delete(path);}
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
  kind?: "main" | "gallery" | "brand" | "banner" | "portal" | "contentIcon" | "solutionMobile" | "qr" | "adWeb" | "adH5";
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
    qr: { minWidth: 300, minHeight: 300, maxWidth: 2000, maxHeight: 2000, ratio: 1, ratioLabel: "1:1", maxMb: 2, title: "二维码" },
    solutionMobile: { minWidth: 720, minHeight: 1280, maxWidth: 2160, maxHeight: 3840, ratio: 9 / 16, ratioLabel: "9:16", maxMb: 5, title: "H5竖版海报" },
    adWeb: { minWidth: 800, minHeight: 160, maxWidth: 6000, maxHeight: 3000, ratio: 0, ratioLabel: "不限比例", maxMb: 8, title: "Web广告图" },
    adH5: { minWidth: 600, minHeight: 240, maxWidth: 3000, maxHeight: 4000, ratio: 0, ratioLabel: "不限比例", maxMb: 8, title: "H5广告图" },
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
      if (profile.ratio > 0 && Math.abs(width / height - profile.ratio) / profile.ratio > 0.03)
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
  const savedRange = useRef<Range|null>(null);
  const [uploadingLocalImage,setUploadingLocalImage]=useState(false);
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
  const chooseLocalImage = () => {
    const selection=window.getSelection();
    if(selection?.rangeCount&&editor.current?.contains(selection.getRangeAt(0).commonAncestorContainer))
      savedRange.current=selection.getRangeAt(0).cloneRange();
    localImageInput.current?.click();
  };
  const uploadLocalImage = async (file?: File) => {
    if(!file)return;
    try {
      setUploadingLocalImage(true);
      if(!["image/jpeg","image/png"].includes(file.type))throw new Error("仅支持 JPG、PNG 图片");
      if(file.size>8*1024*1024)throw new Error("图片不能超过8MB");
      const body=new FormData();body.append("file",file);body.append("kind","rich");
      const response=await fetch("/api/admin/business/uploads/images",{method:"POST",headers:{Authorization:`Basic ${adminCredential()}`},body});
      if(!response.ok)throw new Error(await uploadFailure(response));
      const result=await response.json();
      const image=document.createElement("img");image.src=result.url;image.alt=file.name.replace(/\.[^.]+$/g,"")||"商品详情图片";image.loading="lazy";
      const selection=window.getSelection();
      if(savedRange.current&&selection){selection.removeAllRanges();selection.addRange(savedRange.current);insertElement(image);}
      else if(editor.current){editor.current.insertAdjacentHTML("beforeend",image.outerHTML);onChange?.(editor.current.innerHTML);}
      message.success("本地图片已上传并插入商品详情");
    } catch(error){message.error((error as Error).message||"本地图片上传失败");}
    finally{setUploadingLocalImage(false);if(localImageInput.current)localImageInput.current.value="";savedRange.current=null;}
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
        <button className="rich-local-image-button" type="button" disabled={uploadingLocalImage} onMouseDown={(event)=>event.preventDefault()} onClick={chooseLocalImage}>
          {uploadingLocalImage?"上传中…":"本地图片"}
        </button>
        <input ref={localImageInput} hidden style={{display:"none"}} className="rich-media-input" type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" onChange={(event)=>void uploadLocalImage(event.target.files?.[0])}/>
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
      { key: "collectJobs", label: "采集任务", icon: <MenuIcon name="log" /> },
      { key: "categories", label: "分类管理", icon: <MenuIcon name="category" /> },
      { key: "brands", label: "品牌管理", icon: <MenuIcon name="brand" /> },
      { key: "attributes", label: "属性模板", icon: <MenuIcon name="config" /> },
    ],
  },
  {
    key: "orderCenter", label: "订单管理", children: [
      { key: "orders", label: "订单管理", icon: <MenuIcon name="order" /> },
      { key: "afterSales", label: "售后服务", icon: <MenuIcon name="agreement" /> },
      { key: "finance", label: "财务与对账", icon: <MenuIcon name="agreement" /> },
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
      { key: "homeFloors", label: "首页楼层管理", icon: <MenuIcon name="content" /> },
      { key: "homeAds", label: "首页广告位", icon: <MenuIcon name="banner" /> },
      { key: "contents", label: "内容管理", icon: <MenuIcon name="content" /> },
      { key: "contactSettings", label: "联系方式", icon: <MenuIcon name="user" /> },
      { key: "serviceFeatures", label: "服务保障", icon: <MenuIcon name="content" /> },
      { key: "footerSettings", label: "页脚配置", icon: <MenuIcon name="config" /> },
      { key: "seoSettings", label: "SEO/GEO配置", icon: <MenuIcon name="config" /> },
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
  overview: "dashboard:view", products: "product:manage", collectJobs: "product:manage", categories: "product:manage",
  attributes: "product:manage", brands: "product:manage", platforms: "product:manage",
  platformProducts: "product:manage", platformOrders: "order:manage",
  navigations: "product:manage", banners: "product:manage", solutions: "product:manage",
  homeFloors: "product:manage", homeAds:"product:manage",
  contents: "product:manage", contactSettings: "product:manage", serviceFeatures: "product:manage", footerSettings: "product:manage", seoSettings:"product:manage", enterprises: "enterprise:manage", enterpriseUsers: "enterprise:manage",
  agreements: "agreement:manage", agreementProducts: "agreement:manage", agreementOrders: "order:manage",
  solutionProducts: "product:manage",
  orders: "order:manage", afterSales: "order:manage", finance: "order:manage", users: "system:user", roles: "system:role",
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
      setError("请输入后台账号或手机号和密码");
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
      if (!response.ok) throw new Error("后台账号、手机号或密码错误");
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
          后台账号或手机号
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onPressEnter={() => void login()}
            placeholder="请输入后台账号或手机号"
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
    collectJobs: ["采集任务", "查看单条和批量商品采集队列、进度与失败原因"],
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
    homeFloors: ["首页楼层管理", "配置 Web 与 H5 首页商品、方案、分类和内容楼层"],
    homeAds: ["首页广告位", "配置首页广告组版式、插入位置、Web/H5 图片和跳转链接"],
    solutions: ["方案管理", "维护企业采购场景方案及客户端展示内容"],
    solutionProducts: ["方案商品管理", "按采购方案维护必选商品、可选商品、数量与排序"],
    contents: ["内容管理", "维护采购指南、服务说明及其他门户内容"],
    contactSettings: ["联系方式", "配置 Web 门户右侧悬浮栏中的座机、手机、微信二维码和邮箱"],
    serviceFeatures: ["服务保障", "配置 Web 门户页脚上方的服务保障图片、标题、副标题、顺序和显示状态"],
    footerSettings: ["页脚配置", "配置门户页脚简介、地址、版权主体和各类备案许可证信息"],
    seoSettings: ["SEO/GEO配置", "配置全站搜索引擎、地域搜索和生成式搜索优化信息"],
    enterprises: ["企业管理", "查看企业客户、成员账户和有效采购协议"],
    enterpriseUsers: ["企业用户管理", "以用户维度查看、创建、编辑和维护全部企业账号"],
    agreements: ["协议管理", "维护协议商品关联及企业专属成交价格"],
    agreementProducts: ["协议商品管理", "按采购协议维护商品范围与企业专属价格"],
    agreementOrders: ["协议订单管理", "查看协议产生的采购订单与履约进度"],
    orders: ["订单管理", "查询采购订单、付款状态与履约进度"],
    afterSales: ["售后服务", "受理企业客户退换、维修和退款申请，跟踪处理进度"],
    finance: ["财务与对账", "处理企业对账单、到款确认和电子发票申请"],
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
          ).includes(module) && <BusinessModule module={module} onOpenCollectJobs={() => setModule("collectJobs")} />}
          {module === "collectJobs" && <CollectJobs />}
          {module === "agreementProducts" && <AssociationProducts type="AGREEMENT" />}
          {module === "agreementOrders" && <BusinessModule module="orders" endpointOverride="/agreement-orders" listTitle="协议订单列表" extraColumn="agreementName" />}
          {module === "platformOrders" && <BusinessModule module="orders" endpointOverride="/platform-orders" listTitle="平台关联商品订单列表" extraColumn="platformNames" />}
          {module === "enterpriseUsers" && <EnterpriseUsers />}
          {module === "finance" && <FinanceManagement />}
          {module === "afterSales" && <AfterSalesManagement />}
          {module === "categories" && <Categories />}
          {module === "attributes" && <AttributeTemplates />}
          {module === "homeFloors" && <HomeFloors />}
          {module === "homeAds" && <HomeAds />}
          {(
            [
              "brands",
              "platforms",
              "navigations",
              "banners",
              "solutions",
            ] as Module[]
          ).includes(module) && <PortalManager module={module} />}
          {module === "contents" && <Articles />}
          {module === "contactSettings" && <ContactSettings />}
          {module === "serviceFeatures" && <ServiceFeatures />}
          {module === "footerSettings" && <FooterSettings />}
          {module === "seoSettings" && <SeoSettings />}
          {module === "platformProducts" && <AssociationProducts type="PLATFORM" />}
          {module === "solutionProducts" && <AssociationProducts type="SOLUTION" />}
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
      <Table rowKey="id" loading={users.loading} dataSource={users.data} server={{...users.server,statusOptions:[{label:"待审核",value:"2"},{label:"已启用",value:"1"},{label:"已停用 / 未通过",value:"0"}]}} searchPlaceholder="搜索企业、账号、姓名或手机" columns={[
        {title:"用户",render:(_:unknown,row:Row)=><div className="user-cell"><i>{String(row.realName||"用").slice(0,1)}</i><span><strong>{row.realName}</strong><small>@{row.username}</small></span></div>},
        {title:"所属企业",dataIndex:"enterpriseName"},{title:"手机号码",dataIndex:"phone"},
        {title:"部门 / 企业角色",dataIndex:"roleCode",render:(value,record)=><Space direction="vertical" size={2}><span>{record.departmentName||"未分配部门"}</span><Tag color={value==="ENTERPRISE_ADMIN"?"blue":undefined}>{record.roleNames||(value==="ENTERPRISE_ADMIN"?"企业管理员":"采购员")}</Tag></Space>},
        {title:"状态",dataIndex:"status",render:(value)=>Number(value)===2?<Tag color="orange">待审核</Tag>:Number(value)===1?<Tag color="green">已启用</Tag>:<Tag>已停用 / 未通过</Tag>},
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
        <Form.Item name="status" label="账号状态" rules={[{required:true}]}><Select options={[{value:2,label:"待审核"},{value:1,label:"审核通过 / 启用"},{value:0,label:"审核不通过 / 停用"}]}/></Form.Item>
      </Form>
    </Modal>
  </>;
}

function AfterSalesManagement(){
  const {message}=AntApp.useApp(); const rows=useLoad<Row[]>(()=>rootApi("/api/admin/business/after-sales"));
  const [detail,setDetail]=useState<Row>(); const [processing,setProcessing]=useState<Row>(); const [form]=Form.useForm();
  const open=async(row:Row)=>setDetail(await rootApi(`/api/admin/business/after-sales/${row.id}`));
  const process=async()=>{try{const values=await form.validateFields();await rootMutation(`/api/admin/business/after-sales/${processing?.id}/status`,{method:"PUT",body:JSON.stringify(values)});setProcessing(undefined);message.success("售后状态已更新");await rows.refresh();}catch(error){if(error instanceof Error)message.error(error.message);}};
  const typeText=(v:string)=>({RETURN:"退货",EXCHANGE:"换货",REPAIR:"维修",REFUND:"退款"}[v]||v); const statusText=(v:number)=>["待处理","处理中","待寄回","待收货","已完成","已驳回","已取消"][v]||"未知";
  return <><Card className="admin-card"><Table<Row> rowKey="id" loading={rows.loading} dataSource={rows.data||[]} searchPlaceholder="搜索售后单、订单、企业、申请人或商品" columns={[
    {title:"售后单",dataIndex:"serviceNo",render:(v:unknown,record:Row)=><button className="table-link" onClick={()=>void open(record)}>{String(v)}</button>},
    {title:"企业 / 申请人",render:(_:unknown,r:Row)=><span>{r.enterpriseName}<small>{r.applicantName} · {r.contactPhone}</small></span>},
    {title:"商品",render:(_:unknown,r:Row)=><div className="admin-product-cell"><img src={r.image}/><span><b>{r.title}</b><small>{r.skuCode} · 订单 {r.orderNo}</small></span></div>},
    {title:"诉求",render:(_:unknown,r:Row)=><span>{typeText(r.serviceType)} × {r.requestedQuantity}<small>{r.reason}</small></span>},
    {title:"状态",dataIndex:"status",render:(v:unknown)=><Tag color={Number(v)===4?"green":Number(v)>=5?"default":"blue"}>{statusText(Number(v))}</Tag>},
    {title:"申请时间",dataIndex:"createdAt"},{title:"操作",render:(_:unknown,r:Row)=><Space><Button type="link" onClick={()=>void open(r)}>详情</Button>{Number(r.status)<4&&<Button type="link" onClick={()=>{setProcessing(r);form.setFieldsValue({status:Number(r.status)===0?1:Number(r.status),handlingResult:r.handlingResult||""});}}>处理</Button>}</Space>}
  ]}/></Card>
  <Drawer width={680} title="售后申请详情" open={!!detail} onClose={()=>setDetail(undefined)}>{detail&&<><Descriptions bordered column={2} items={[
    {key:"no",label:"售后单号",children:detail.request.service_no},{key:"status",label:"状态",children:statusText(Number(detail.request.status))},{key:"enterprise",label:"申请企业",children:detail.request.enterpriseName},{key:"user",label:"申请人",children:detail.request.applicantName},{key:"order",label:"订单号",children:detail.request.orderNo},{key:"type",label:"服务类型",children:typeText(detail.request.service_type)},{key:"product",label:"商品",span:2,children:`${detail.request.title}（${detail.request.skuCode}）`},{key:"reason",label:"原因",span:2,children:detail.request.reason},{key:"description",label:"问题说明",span:2,children:detail.request.description||"—"},{key:"result",label:"处理结果",span:2,children:detail.request.handling_result||"等待处理"}
  ]}/><Typography.Title level={5}>处理记录</Typography.Title>{detail.timeline.map((x:Row,i:number)=><p key={i}><Tag>{x.operatorType}</Tag>{x.content}　<Typography.Text type="secondary">{x.createdAt}</Typography.Text></p>)}</>}</Drawer>
  <Modal title="处理售后申请" open={!!processing} onCancel={()=>setProcessing(undefined)} onOk={()=>void process()}><Form form={form} layout="vertical"><Form.Item name="status" label="处理状态" rules={[{required:true}]}><Select options={[{value:1,label:"处理中"},{value:2,label:"待客户寄回"},{value:3,label:"待平台收货"},{value:4,label:"已完成"},{value:5,label:"已驳回"}]}/></Form.Item><Form.Item name="handlingResult" label="处理说明" rules={[{required:true,message:"请填写处理说明"}]}><Input.TextArea rows={5} placeholder="填写处理意见、寄回要求或最终处理结果"/></Form.Item></Form></Modal></>;
}

function FinanceManagement() {
  const {message,modal}=AntApp.useApp();
  const statements=useLoad<Row[]>(()=>rootApi("/api/admin/business/finance/statements"));
  const invoices=useLoad<Row[]>(()=>rootApi("/api/admin/business/finance/invoice-applications"));
  const [invoiceForm]=Form.useForm();
  const [processing,setProcessing]=useState<Row>();
  const settle=(row:Row)=>modal.confirm({title:`确认 ${row.statementNo} 已全额到款？`,content:"确认后关联订单将同步标记为已付款。",onOk:async()=>{await rootMutation(`/api/admin/business/finance/statements/${row.id}/status`,{method:"PUT",body:JSON.stringify({status:3,remark:"平台财务确认到款"})});message.success("对账单已结清");await statements.refresh();}});
  const showInvoice=(row:Row)=>{setProcessing(row);invoiceForm.resetFields();invoiceForm.setFieldsValue({status:row.status===0?1:row.status,invoiceNo:row.invoiceNo,invoiceFileUrl:row.invoiceFileUrl,failureReason:row.failureReason});};
  const saveInvoice=async()=>{try{const values=await invoiceForm.validateFields();await rootMutation(`/api/admin/business/finance/invoice-applications/${processing?.id}`,{method:"PUT",body:JSON.stringify(values)});setProcessing(undefined);message.success("开票申请已更新");await invoices.refresh();}catch(error){if(error instanceof Error)message.error(error.message);}};
  return <Card className="data-card"><Tabs items={[
    {key:"statements",label:"企业对账单",children:<Table rowKey="id" loading={statements.loading} dataSource={statements.data||[]} columns={[
      {title:"对账单",render:(_:unknown,row:Row)=><Space direction="vertical" size={1}><strong>{row.statementNo}</strong><small>{row.createdAt}</small></Space>},
      {title:"企业",dataIndex:"enterpriseName"},{title:"对账期间",render:(_:unknown,row:Row)=>`${row.periodStart} 至 ${row.periodEnd}`},{title:"订单数",dataIndex:"orderCount"},
      {title:"应付 / 已付",render:(_:unknown,row:Row)=><Space direction="vertical" size={1}><strong>¥{Number(row.payableAmount).toFixed(2)}</strong><small>已付 ¥{Number(row.paidAmount).toFixed(2)}</small></Space>},
      {title:"状态",dataIndex:"status",render:(v)=><Tag color={Number(v)===3?"green":Number(v)===4?"default":"orange"}>{["草稿","待确认","已确认","已结清","已作废"][Number(v)]}</Tag>},
      {title:"付款截止",dataIndex:"dueDate"},{title:"操作",render:(_:unknown,row:Row)=><Space>{[1,2].includes(Number(row.status))&&<Button type="link" onClick={()=>settle(row)}>确认到款</Button>}</Space>},
    ]}/>},
    {key:"invoices",label:"开票申请",children:<Table rowKey="id" loading={invoices.loading} dataSource={invoices.data||[]} columns={[
      {title:"申请单",render:(_:unknown,row:Row)=><Space direction="vertical" size={1}><strong>{row.applicationNo}</strong><small>{row.createdAt}</small></Space>},
      {title:"企业 / 申请人",render:(_:unknown,row:Row)=><Space direction="vertical" size={1}><span>{row.enterpriseName}</span><small>{row.applicantName}</small></Space>},
      {title:"发票信息",render:(_:unknown,row:Row)=><Space direction="vertical" size={1}><span>{row.invoiceTitle}</span><small>{row.invoiceType} · {row.orderCount} 笔</small></Space>},
      {title:"金额",render:(_:unknown,row:Row)=><strong>¥{Number(row.amount).toFixed(2)}</strong>},
      {title:"状态",dataIndex:"status",render:(v)=><Tag color={Number(v)===2?"green":Number(v)===3?"red":"orange"}>{["待处理","开票中","已开具","已驳回"][Number(v)]}</Tag>},
      {title:"操作",render:(_:unknown,row:Row)=><Button type="link" disabled={[2,3].includes(Number(row.status))} onClick={()=>showInvoice(row)}>处理</Button>},
    ]}/>},
  ]}/>
  <Modal open={!!processing} title={`处理开票申请 ${processing?.applicationNo||""}`} onCancel={()=>setProcessing(undefined)} onOk={()=>void saveInvoice()}><Form form={invoiceForm} layout="vertical"><Form.Item name="status" label="处理状态" rules={[{required:true}]}><Select options={[{value:1,label:"开票中"},{value:2,label:"已开具"},{value:3,label:"驳回申请"}]}/></Form.Item><Form.Item noStyle shouldUpdate>{({getFieldValue})=>Number(getFieldValue("status"))===2?<><Form.Item name="invoiceNo" label="发票号码" rules={[{required:true}]}><Input/></Form.Item><Form.Item name="invoiceFileUrl" label="电子发票文件地址" rules={[{required:true}]}><Input placeholder="https://..."/></Form.Item></>:Number(getFieldValue("status"))===3?<Form.Item name="failureReason" label="驳回原因" rules={[{required:true}]}><Input.TextArea/></Form.Item>:null}</Form.Item></Form></Modal>
  </Card>;
}

function BusinessModule({ module,endpointOverride,listTitle,extraColumn,onOpenCollectJobs }: {
  module: Module; endpointOverride?: string; listTitle?: string; extraColumn?: "agreementName"|"platformNames";
  onOpenCollectJobs?: () => void;
}) {
  const { message, modal } = AntApp.useApp();
  const [badgeFilter,setBadgeFilter]=useState<string>();
  const [productCategoryFilter,setProductCategoryFilter]=useState<number>();
  const [productBrandFilter,setProductBrandFilter]=useState<number>();
  const [productSelfFilter,setProductSelfFilter]=useState<number>();
  const [productStockMin,setProductStockMin]=useState<number|null>(null);
  const [productStockMax,setProductStockMax]=useState<number|null>(null);
  const endpoint =
    module === "products"
      ? "/products"
      : module === "enterprises"
        ? "/enterprises"
        : module === "agreements"
          ? "/agreements"
          : "/orders";
  const productSearchParams=new URLSearchParams();
  if(badgeFilter)productSearchParams.set("badgeType",badgeFilter);
  if(productCategoryFilter!=null)productSearchParams.set("categoryId",String(productCategoryFilter));
  if(productBrandFilter!=null)productSearchParams.set("brandId",String(productBrandFilter));
  if(productSelfFilter!=null)productSearchParams.set("selfOperated",String(productSelfFilter));
  if(productStockMin!=null)productSearchParams.set("stockMin",String(productStockMin));
  if(productStockMax!=null)productSearchParams.set("stockMax",String(productStockMax));
  const pagedEndpoint=`/api/admin/business${endpointOverride||endpoint}${module==="products"&&productSearchParams.size?`?${productSearchParams}`:""}`;
  const pagedRows = usePagedLoad(pagedEndpoint, 10, [module,endpointOverride,badgeFilter,productCategoryFilter,productBrandFilter,productSelfFilter,productStockMin,productStockMax]);
  const rows = pagedRows;
  const enterprises = useLoad<Row[]>(() =>
    rootApi("/api/admin/business/enterprises"),
  [],["agreements","orders"].includes(module));
  const products = useLoad<Row[]>(() =>
    rootApi("/api/admin/business/products"),
  [],["agreements","orders"].includes(module));
  const selectableSkus=expandProductSkus(products.data||[]).filter((sku)=>Number(sku.status)===1);
  const categories = useLoad<Row[]>(() =>
    rootApi("/api/admin/business/categories"),
  [],module==="products");
  const brands = useLoad<Row[]>(() =>
    rootApi("/api/admin/content/brands/list"),
  [],module==="products");
  const platforms = useLoad<Row[]>(() =>
    rootApi("/api/admin/content/platform"),
  [],module==="products");
  const agreementOptions = useLoad<Row[]>(() =>
    rootApi("/api/admin/business/agreements"),
  [],module==="products");
  const logisticsCompanies = useLoad<Row[]>(() =>
    rootApi("/api/admin/system/options?type=LOGISTICS_COMPANY&enabled=true"),
  [],module==="orders");
  const productServices=useLoad<Row[]>(()=>rootApi("/api/admin/business/product-service-options"),[],module==="products");
  const productBadgeOptions=useLoad<Row[]>(()=>rootApi("/api/admin/business/product-badge-options"),[],module==="products");
  const stockConfig=useLoad<Row>(()=>rootApi("/api/admin/business/product-default-stock"),[],module==="products");
  const productTemplates=useLoad<Row>(()=>rootApi("/api/admin/business/product-content-templates"),[],module==="products");
  const defaultSkuStock=Number(stockConfig.data?.stock||10000);
  const deliveryTemplates=parseTemplateList(productTemplates.data?.deliveryTemplates);
  const afterSalesTemplates=parseTemplateList(productTemplates.data?.afterSalesTemplates);
  const [form] = Form.useForm();
  const [batchStockForm] = Form.useForm();
  const [platformForm] = Form.useForm();
  const [productAgreementForm] = Form.useForm();
  const [listBadgeForm] = Form.useForm();
  const [collectForm] = Form.useForm();
  const collectPlatform = Form.useWatch("platform", collectForm) || "jd";
  const collectNeedPrice = collectPlatform === "jd";
  const selectedProductCategory = Form.useWatch("categoryId", form);
  const listBadgeType = Form.useWatch("badgeType", listBadgeForm);
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
  const [collectOpen, setCollectOpen] = useState(false);
  const [collectTab, setCollectTab] = useState("single");
  const [batchText, setBatchText] = useState("");
  const [batchRows, setBatchRows] = useState<{ url: string; memberPrice?: number; error?: string }[]>([]);
  const [collecting, setCollecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [productTab,setProductTab]=useState("basic");
  const [editing, setEditing] = useState<Row>();
  const [batchStockRows, setBatchStockRows] = useState<Row[]>([]);
  const [platformProduct, setPlatformProduct] = useState<Row>();
  const [agreementProduct, setAgreementProduct] = useState<Row>();
  const [badgeProduct, setBadgeProduct] = useState<Row>();
  const [inlineBadgeProductId,setInlineBadgeProductId]=useState<number>();
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
  const collectProduct = async () => {
    try {
      const values = await collectForm.validateFields();
      setCollecting(true);
      const result = await business("/products/collect", {
        method: "POST",
        body: JSON.stringify({
          platform: values.platform,
          url: values.url,
          ...(values.memberPrice ? { memberPrice: values.memberPrice } : {}),
        }),
        signal: AbortSignal.timeout(180000),
      });
      message.success(result?.updated
        ? `已补全已有商品 ${result.model || result.title || ""}`
        : `已采集 ${result.model || result.title || ""}`);
      setCollectOpen(false);
      void Promise.all([rows.refresh(), categories.refresh(), brands.refresh()]);
    } catch (error) {
      const err = error as Error;
      message.error(err.name === "TimeoutError" ? "采集超时，请稍后重试" : (err.message || "采集失败"));
    } finally {
      setCollecting(false);
    }
  };
  const applyBatchText = (text: string) => {
    setBatchText(text);
    setBatchRows(parseCollectBatchText(text, collectNeedPrice));
  };
  useEffect(() => {
    if (batchText) setBatchRows(parseCollectBatchText(batchText, collectNeedPrice));
  }, [batchText, collectNeedPrice]);
  const submitBatchCollect = async () => {
    try {
      const values = await collectForm.validateFields(["platform"]);
      const valid = batchRows.filter((row) => row.url && !row.error && (!collectNeedPrice || row.memberPrice));
      if (!valid.length) {
        message.warning(collectNeedPrice ? "请上传或粘贴商品链接和对应售价" : "请上传或粘贴商品链接");
        return;
      }
      if (valid.length > 100) {
        message.warning("单次最多采集 100 条");
        return;
      }
      if (batchRows.some((row) => row.error)) {
        message.warning("请先修正标红的链接或售价");
        return;
      }
      setCollecting(true);
      await business("/products/collect-jobs", {
        method: "POST",
        body: JSON.stringify({
          platform: values.platform,
          items: valid.map((row) => ({ url: row.url, memberPrice: row.memberPrice })),
        }),
      });
      message.success(`已加入采集队列，共 ${valid.length} 条，可在采集任务中查看进度`);
      setCollectOpen(false);
      onOpenCollectJobs?.();
    } catch (error) {
      message.error((error as Error).message || "创建批量采集任务失败");
    } finally {
      setCollecting(false);
    }
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
          ? { ...row, status: Number(row.status), categoryId: Number(row.categoryId), brandId: Number(row.brandId), badgeType: row.badgeType || "NONE", spec: "标准规格",
              skus:(typeof row.skus==="string"?JSON.parse(row.skus||"[]"):row.skus||[]).map((sku:Row)=>({
                ...sku,status:Number(sku.status),specification:Object.entries(typeof sku.specValues==="string"?JSON.parse(sku.specValues||"{}"):sku.specValues||{})
                  .map(([key,value])=>`${key}=${value}`).join("；")
              })),
              attributeValues: typeof row.attributeValues === "string" ? JSON.parse(row.attributeValues || "{}") : (row.attributeValues || {}),
              serviceOptionIds:(typeof row.serviceOptionIds==="string"?JSON.parse(row.serviceOptionIds||"[]"):row.serviceOptionIds||[]).map(Number) }
          : {
              title: [
                (brands.data || []).find((x)=>Number(x.status)===1)?.name,
                (categories.data || []).find((x)=>Number(x.level)===3&&Number(x.status)===1)?.name,
              ].filter(Boolean).join(" "),
              categoryId: (categories.data || []).find(
                (x) => Number(x.level) === 3,
              )?.id,
              brandId: (brands.data || []).find((x)=>Number(x.status)===1)?.id,
              selfOperated: 0,
              status: 1,
              badgeType: "NONE",
              serviceOptionIds:(productServices.data||[]).map((item)=>Number(item.id)),
              deliveryDescription:String(deliveryTemplates.find((item)=>item.isDefault)?.content||""),
              afterSalesHtml:String(afterSalesTemplates.find((item)=>item.isDefault)?.content||""),
              stock: 0,
              skus:[{skuCode:"",skuTitle:"",specification:"",skuImage:"",skuGallery:"",marketPrice:0,memberPrice:0,stock:defaultSkuStock,status:1}],
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
  useEffect(()=>{
    if(!open||module!=="products"||editing)return;
    const current=form.getFieldValue("serviceOptionIds");
    if(!Array.isArray(current)||current.length===0)
      form.setFieldValue("serviceOptionIds",(productServices.data||[]).map((item)=>Number(item.id)));
    if(!form.getFieldValue("deliveryDescription"))
      form.setFieldValue("deliveryDescription",String(deliveryTemplates.find((item)=>item.isDefault)?.content||""));
    if(!form.getFieldValue("afterSalesHtml"))
      form.setFieldValue("afterSalesHtml",String(afterSalesTemplates.find((item)=>item.isDefault)?.content||""));
  },[open,module,editing,productServices.data,productTemplates.data]);
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
          ?"sales":first==="mainImage"||first==="gallery"?"basic"
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
  const batchStatus = async (selected: Row[], status: number, clearSelection: () => void) => {
    try {
      await Promise.all(selected.map((row) => business(`/products/${row.id}/status`, {
        method: "PUT", body: JSON.stringify({ status }),
      })));
      message.success(`已批量${status === 1 ? "上架" : "下架"} ${selected.length} 个商品`);
      clearSelection();
      void rows.refresh();
    } catch (e) { message.error((e as Error).message); }
  };
  const batchSelfOperated=async(selected:Row[],selfOperated:0|1,clearSelection:()=>void)=>{
    try{
      await business("/products/batch-self-operated",{method:"PUT",body:JSON.stringify({ids:selected.map((row)=>Number(row.id)),selfOperated})});
      message.success(`已将 ${selected.length} 个商品设为${selfOperated?"自营":"非自营"}`);clearSelection();void rows.refresh();
    }catch(error){message.error((error as Error).message);}
  };
  const showBatchStock = (selected: Row[]) => {
    setBatchStockRows(selected);
    batchStockForm.resetFields();
    setMode("stock");
  };
  const saveBatchStock = async () => {
    try {
      const { stock } = await batchStockForm.validateFields();
      await Promise.all(batchStockRows.map((row) => business(`/products/${row.id}/stock`, {
        method: "PUT", body: JSON.stringify({ stock }),
      })));
      message.success(`已修改 ${batchStockRows.length} 个商品的库存`);
      setBatchStockRows([]);
      void rows.refresh();
    } catch (e) { if (e instanceof Error) message.error(e.message); }
  };
  const showPlatformAdd = (row: Row) => {
    const skus = typeof row.skus === "string" ? JSON.parse(row.skus || "[]") : row.skus || [];
    setPlatformProduct(row);
    platformForm.resetFields();
    platformForm.setFieldsValue({ skuId: skus[0]?.id || row.skuId, platformPrice: skus[0]?.memberPrice || row.memberPrice, productUrl: "", listingStatus: 1 });
  };
  const savePlatformAdd = async () => {
    try {
      const values = await platformForm.validateFields();
      const response = await fetch(`/api/admin/content/platform/${values.platformId}/products`, {
        method: "POST", headers: apiHeaders(), body: JSON.stringify(values),
      });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.detail || "添加到平台失败"); }
      message.success("商品已添加到平台");
      setPlatformProduct(undefined);
      void rows.refresh();
    } catch (e) { if (e instanceof Error) message.error(e.message); }
  };
  const productAgreementRelations = (row: Row): Row[] => {
    if (Array.isArray(row.agreementRelations)) return row.agreementRelations;
    try { return JSON.parse(row.agreementRelations || "[]"); } catch { return []; }
  };
  const showProductAgreements = (row: Row) => {
    const agreementIds=[...new Set(productAgreementRelations(row).filter((relation)=>Number(relation.status)===1).map((relation)=>Number(relation.agreementId)))];
    setAgreementProduct(row);
    productAgreementForm.resetFields();
    productAgreementForm.setFieldsValue({agreementIds});
  };
  const saveProductAgreements = async () => {
    if (!agreementProduct) return;
    try {
      const {agreementIds=[]}=await productAgreementForm.validateFields();
      const selectedIds=(agreementIds as number[]).map(Number);
      const relations=productAgreementRelations(agreementProduct);
      const skus=(typeof agreementProduct.skus==="string"?JSON.parse(agreementProduct.skus||"[]"):agreementProduct.skus||[])
        .filter((sku:Row)=>Number(sku.status)===1);
      const requests:Promise<void>[]=[];
      selectedIds.forEach((agreementId)=>skus.forEach((sku:Row)=>{
        const exists=relations.some((relation)=>Number(relation.agreementId)===agreementId&&Number(relation.skuId)===Number(sku.id)&&Number(relation.status)===1);
        if (!exists) requests.push(fetch(`/api/admin/agreements/${agreementId}/items`,{
          method:"POST",headers:apiHeaders(),body:JSON.stringify({skuId:Number(sku.id),agreementPrice:Number(sku.memberPrice??agreementProduct.memberPrice??0)}),
        }).then(async(response)=>{if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.detail||"添加协议关联失败");}}));
      }));
      relations.filter((relation)=>!selectedIds.includes(Number(relation.agreementId))).forEach((relation)=>{
        requests.push(fetch(`/api/admin/agreements/${relation.agreementId}/items/${relation.id}`,{
          method:"DELETE",headers:apiHeaders(),
        }).then(async(response)=>{if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.detail||"移除协议关联失败");}}));
      });
      await Promise.all(requests);
      message.success("商品协议关联已更新");
      setAgreementProduct(undefined);
      void rows.refresh();
    } catch (e) { if (e instanceof Error) message.error(e.message); }
  };
  const productPlatformRelations = (row: Row): Row[] => {
    if (Array.isArray(row.platformRelations)) return row.platformRelations;
    try { return JSON.parse(row.platformRelations || "[]"); } catch { return []; }
  };
  const updateProductPlatforms = async (row: Row, nextPlatformIds: number[]) => {
    const relations = productPlatformRelations(row);
    const currentPlatformIds = [...new Set(relations.map((relation) => Number(relation.platformId)))];
    const added = nextPlatformIds.filter((id) => !currentPlatformIds.includes(id));
    const removed = currentPlatformIds.filter((id) => !nextPlatformIds.includes(id));
    const skus = typeof row.skus === "string" ? JSON.parse(row.skus || "[]") : row.skus || [];
    const sku = skus[0] || { id: row.skuId, memberPrice: row.memberPrice };
    try {
      await Promise.all([
        ...added.map((platformId) => fetch(`/api/admin/content/platform/${platformId}/products`, {
          method: "POST", headers: apiHeaders(), body: JSON.stringify({
            skuId: Number(sku.id), platformPrice: Number(sku.memberPrice), productUrl: "", listingStatus: 1,
          }),
        }).then(async (response) => { if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.detail || "添加平台失败"); } })),
        ...relations.filter((relation) => removed.includes(Number(relation.platformId))).map((relation) =>
          fetch(`/api/admin/content/platform/${relation.platformId}/products/${relation.id}`, {
            method: "DELETE", headers: apiHeaders(),
          }).then(async (response) => { if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.detail || "取消平台关联失败"); } }),
        ),
      ]);
      message.success("商品平台关联已更新");
      void rows.refresh();
    } catch (e) { message.error((e as Error).message); }
  };
  const badgeLabel = (row: Row) => {
    if (row.badgeType === "AGREEMENT") return "协议专属";
    if (row.badgeType === "CUSTOM") return row.customBadge || "自定义";
    if (row.badgeType === "PLATFORM") {
      const platform=(platforms.data || []).find((item) => Number(item.id) === Number(row.badgePlatformId));
      const prefix=String(platform?.pricePrefix || platform?.title || "平台");
      return prefix.endsWith("平台") ? prefix : `${prefix}平台`;
    }
    return "未定义";
  };
  const saveQuickBadge=async(row:Row,value:string)=>{try{
    await business(`/products/${row.id}`,{method:"PUT",body:JSON.stringify({
      title:row.title,categoryId:Number(row.categoryId),brandId:Number(row.brandId),selfOperated:Number(row.selfOperated),status:Number(row.status),summary:row.summary,
      badgeType:value==="__UNDEFINED__"?"NONE":"CUSTOM",badgePlatformId:null,customBadge:value==="__UNDEFINED__"?null:value,
    })});message.success("商品角标已更新");setInlineBadgeProductId(undefined);void rows.refresh();
  }catch(error){message.error((error as Error).message);}};
  const toggleSkuStatus=async(product:Row,sku:Row)=>{try{await business(`/products/${product.id}/skus/${sku.id}/status`,{method:"PUT",body:JSON.stringify({status:Number(sku.status)===1?0:1})});message.success(Number(sku.status)===1?"SKU已停用":"SKU已启用");void rows.refresh();}catch(error){message.error((error as Error).message);}};
  const showBadgeConfig = (row: Row) => {
    setBadgeProduct(row);
    listBadgeForm.resetFields();
    listBadgeForm.setFieldsValue({badgeType:row.badgeType || "NONE",badgePlatformId:row.badgePlatformId,customBadge:row.customBadge});
  };
  const saveBadgeConfig = async () => {
    if (!badgeProduct) return;
    try {
      const badge = await listBadgeForm.validateFields();
      await business(`/products/${badgeProduct.id}`, {method:"PUT",body:JSON.stringify({
        title:badgeProduct.title,categoryId:Number(badgeProduct.categoryId),brandId:Number(badgeProduct.brandId),
        selfOperated:Number(badgeProduct.selfOperated),status:Number(badgeProduct.status),summary:badgeProduct.summary,
        ...badge,
      })});
      message.success("商品角标已更新");
      setBadgeProduct(undefined);
      void rows.refresh();
    } catch (e) { if (e instanceof Error) message.error(e.message); }
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
        width: 320,
        render: (_, r) => (
          <div className="user-cell product-main-cell">
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
            <span className="product-main-info">
              <strong>{r.title}</strong>
              <small>{r.spuCode} · {Number(r.skuCount||1)} 个 SKU</small>
              {r.collectionPlatform && r.collectionSourceUrl && (
                <a
                  className="product-collection-source"
                  href={r.collectionSourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  title={`打开${collectPlatformLabel(r.collectionPlatform)}原商品`}
                >
                  采集自：{collectPlatformLabel(r.collectionPlatform)}
                </a>
              )}
            </span>
          </div>
        ),
      },
      {
        title: "所属平台",
        width: 135,
        render: (_, row) => String(row.platformNames || "").trim()
          ? <div className="product-platform-lines">{String(row.platformNames).split("、").filter(Boolean).map((name)=><Tag color="blue" key={name}>{name}</Tag>)}</div>
          : <Typography.Text type="secondary">未关联</Typography.Text>,
      },
      {
        title: "商品角标",
        width: 112,
        render: (_, row) => inlineBadgeProductId===Number(row.id)
          ? <Select autoFocus open style={{width:112}} value={row.badgeType==="CUSTOM"?row.customBadge:"__UNDEFINED__"} onBlur={()=>setInlineBadgeProductId(undefined)} onChange={(value)=>void saveQuickBadge(row,value)} options={[{value:"__UNDEFINED__",label:"未定义"},...(productBadgeOptions.data||[]).map((item)=>({value:String(item.label),label:item.label}))]}/>
          : <span className="quick-badge-cell" title="双击修改角标" onDoubleClick={()=>setInlineBadgeProductId(Number(row.id))}>{badgeLabel(row)}</span>,
      },
      {title:<span className="table-nowrap">经营类型</span>,width:100,dataIndex:"selfOperated",render:(value)=><Tag color={Number(value)===1?"blue":"default"}>{Number(value)===1?"自营":"非自营"}</Tag>},
      {title:"价格",width:122,render:(_,r)=><div className="product-price-cell"><strong>市场价 ¥{Number(r.marketPrice||0).toFixed(2)}</strong><small>会员价 ¥{Number(r.memberPrice||0).toFixed(2)}</small></div>},
      {title:"创建 / 更新时间",width:165,render:(_,r)=><div className="product-time-cell"><span>创建 {r.createdAt||"-"}</span><span>更新 {r.updatedAt||"-"}</span></div>},
      {
        title: <span className="table-nowrap">销量</span>,
        width: 78,
        dataIndex: "soldCount",
        render: (v) => <span className="table-nowrap">{Number(v || 0)} 件</span>,
      },
      {
        title: <span className="table-nowrap">订单 / 销售额</span>,
        width: 145,
        render: (_, r) =>
          <span className="table-nowrap">{Number(r.orderCount || 0)} 单 / ¥{Number(r.salesAmount || 0).toFixed(2)}</span>,
      },
      {
        title: <Tooltip title="前面的数字为可售库存，后面的数字为总库存；可售库存 = 总库存 - 已占用库存">可售 / 总库存</Tooltip>,
        width: 125,
        render: (_, r) => (
          <Tag color={r.stock - r.reservedStock > 10 ? "green" : "orange"}>
            {r.stock - r.reservedStock} / {r.stock}
          </Tag>
        ),
      },
      {
        title: "状态",
        width: 78,
        dataIndex: "status",
        render: (v) => (
          <Tag color={Number(v) === 1 ? "green" : "default"}>
            {Number(v) === 1 ? "在售" : Number(v) === 0 ? "草稿" : "已下架"}
          </Tag>
        ),
      },
      {
        title: "操作",
        width: 105,
        render: (_, r) => (
          <div className="product-actions">
            <Button type="link" onClick={() => show(r)}>
              编辑
            </Button>
            {Number(r.skuCount||1)===1&&<Button type="link" onClick={() => show(r, "stock")}>库存</Button>}
            <Button type="link" onClick={() => showPlatformAdd(r)}>平台</Button>
            <Button type="link" onClick={() => showProductAgreements(r)}>协议</Button>
            <Button type="link" onClick={() => void toggle(r)}>
              {Number(r.status) === 1 ? "下架" : "上架"}
            </Button>
          </div>
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
        title:<div className="order-card-column-head"><span>商品信息</span><span>订单金额</span><span>买方信息</span><span>订单状态</span><span>操作</span></div>,
        render: (_,r) => <article className="admin-order-card">
          <header><span>订单编号：<Typography.Text copyable>{r.orderNo}</Typography.Text></span><span>{dateTime(r.createdAt)} 下单</span>{r.updatedAt&&<span>{dateTime(r.updatedAt)} 更新</span>}<div>{extraColumn&&r[extraColumn]?<Tag color="blue">{r[extraColumn]}</Tag>:r.agreementName?<Tag color="green">{r.agreementName}</Tag>:<Tag>非协议订单</Tag>}</div></header>
          <div className="admin-order-card-body">
            <div className="order-product-list">{mergeOrderListItems(r.items).map((item)=><div className="order-product-row" key={item.skuId||item.skuCode||item.id}>
              <div className="order-product-image">{item.mainImage?<img src={item.mainImage} alt={item.title}/>:<span>商</span>}</div>
              <div className="order-product-main"><strong>{item.title}</strong><small>SKU：{item.skuCode}</small></div>
              <div className="order-product-price"><strong>¥{Number(item.unitPrice||0).toFixed(2)}</strong><small>× {item.quantity}</small><span>小计 ¥{Number(item.totalPrice||0).toFixed(2)}</span></div>
            </div>)}</div>
            <div className="order-amount-cell"><strong>¥{Number(r.payableAmount).toFixed(2)}</strong><span>商品：¥{Number(r.itemAmount||0).toFixed(2)}</span><span>运费：¥{Number(r.freightAmount||0).toFixed(2)}</span><small>{mergeOrderListItems(r.items).length} 种 / {r.itemCount} 件</small></div>
            <div className="order-buyer-cell"><strong>{r.enterpriseName}</strong><span>{r.buyerName||"—"}{r.buyerUsername?`（${r.buyerUsername}）`:""}</span><small>{r.buyerPhone||"未填写联系电话"}</small></div>
            <div className="order-status-cell"><Tag color={Number(r.orderStatus)===3?"green":Number(r.orderStatus)===4?"default":"blue"}>{["待付款", "待发货", "运输中", "已完成", "已取消", "部分发货"][Number(r.orderStatus)]}</Tag><Tag color={Number(r.paymentStatus)===2?"green":"orange"}>{["待付款", "待确认", "已确认"][Number(r.paymentStatus)]}</Tag>{Number(r.refundStatus||0)>0&&<Tag color="red">{Number(r.refundStatus)===1?"已全额退款":"部分退款"}</Tag>}</div>
            <div className="order-card-actions"><Button type="link" onClick={()=>void orderDetail(r)}>订单详情</Button>{[0,2].includes(Number(r.orderStatus))&&<Button type={Number(r.orderStatus)===0?"primary":"link"} onClick={()=>void advanceOrder(r)}>{Number(r.orderStatus)===0?"确认到账":"确认完成"}</Button>}{Number(r.orderStatus)===3&&Number(r.refundStatus||0)===0&&<Button type="link" danger onClick={()=>showRefund(r)}>退款</Button>}</div>
          </div>
        </article>,
      },
    ];
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
            <Space>
              {module === "products" && (
                <Button onClick={() => {
                  collectForm.resetFields();
                  collectForm.setFieldsValue({ platform: "jd", url: "" });
                  setCollectTab("single");
                  setBatchText("");
                  setBatchRows([]);
                  setCollectOpen(true);
                }}>商品采集</Button>
              )}
              <Button type="primary" onClick={() => show()}>
                ＋ 新增
                {module === "products"
                  ? "商品"
                  : module === "enterprises"
                    ? "企业"
                    : "协议"}
              </Button>
            </Space>
          )
        }
      >
        <Table
          className={module==="orders"?"order-card-table":undefined}
          rowKey="id"
          loading={rows.loading}
          dataSource={rows.data}
          columns={columns}
          scroll={{ x: module==="products" ? 1550 : module==="orders" ? 1320 : 1000 }}
          expandable={module==="products"?{
            rowExpandable:(record)=>Number(record.skuCount)>1,
            expandedRowRender:(record)=>{
              const skus=parseTemplateList(record.skus);
              return <div className="product-sku-inline-list">{skus.map((sku:Row)=>{
                const spec=typeof sku.specValues==="string"?JSON.parse(sku.specValues||"{}"):sku.specValues||{};
                const specification=Object.entries(spec).map(([key,value])=>`${key}：${value}`).join("；")||"标准规格";
                const available=Number(sku.stock||0)-Number(sku.reservedStock||0);
                return <div className="product-sku-inline-row" key={sku.id}>
                  <span className="sku-list-image">{(sku.skuImage||record.mainImage)?<img src={sku.skuImage||record.mainImage} alt={sku.skuTitle||record.title}/>:"无图"}</span>
                  <div className="product-sku-inline-main"><strong>{sku.skuTitle||record.title}</strong><small><b>SKU编码：</b>{sku.skuCode||"-"}</small><small><b>销售规格：</b>{specification}</small></div>
                  <div className="product-sku-inline-metric"><small>市场价</small><strong>¥{Number(sku.marketPrice||0).toFixed(2)}</strong><span>会员价 ¥{Number(sku.memberPrice||0).toFixed(2)}</span></div>
                  <div className="product-sku-inline-metric"><small>可售 / 总库存</small><strong>{available} / {Number(sku.stock||0)}</strong><span>占用 {Number(sku.reservedStock||0)}</span></div>
                  <div className="product-sku-inline-time"><span>创建 {sku.createdAt||"-"}</span><span>更新 {sku.updatedAt||"-"}</span></div>
                  <div className="product-sku-inline-status"><Tag color={Number(sku.status)===1?"green":"default"}>{Number(sku.status)===1?"启用":"停用"}</Tag><Button type="link" size="small" onClick={()=>void toggleSkuStatus(record,sku)}>{Number(sku.status)===1?"停用":"启用"}</Button></div>
                </div>;
              })}</div>;
            },
          }:undefined}
          server={{...pagedRows.server,statusOptions:module === "orders" ? [
            {label:"待付款",value:"0"},{label:"待发货",value:"1"},{label:"运输中",value:"2"},{label:"已完成",value:"3"},{label:"已取消",value:"4"},{label:"部分发货",value:"5"},
          ] : module === "agreements" ? [{label:"生效中",value:"1"},{label:"已停用",value:"2"}]
            : module === "products" ? [{label:"在售",value:"1"},{label:"草稿",value:"0"},{label:"已下架",value:"2"}] : undefined}}
          searchPlaceholder={module === "enterprises" ? "搜索企业名称、信用代码、联系人或手机" : module === "agreements" ? "搜索协议名称、协议号或签约企业" : module === "orders" ? "搜索订单号、企业、下单用户、手机、协议或平台" : undefined}
          toolbarExtra={module === "products" ? <>
            <Select allowClear showSearch optionFilterProp="label" value={productCategoryFilter} onChange={setProductCategoryFilter} placeholder="全部分类" style={{width:190}}
              options={(categories.data||[]).filter((item)=>Number(item.level)===3&&Number(item.status)===1).map((item)=>({value:Number(item.id),label:`${item.parentName?`${item.parentName} / `:""}${item.name}`}))}/>
            <Select allowClear showSearch optionFilterProp="label" value={productBrandFilter} onChange={setProductBrandFilter} placeholder="全部品牌" style={{width:145}}
              options={(brands.data||[]).filter((item)=>Number(item.status)===1).map((item)=>({value:Number(item.id),label:item.name}))}/>
            <Select allowClear value={productSelfFilter} onChange={setProductSelfFilter} placeholder="全部经营类型" style={{width:135}} options={[{value:1,label:"自营"},{value:0,label:"非自营"}]}/>
            <span className="product-stock-filter"><InputNumber min={0} precision={0} value={productStockMin} onChange={setProductStockMin} placeholder="最低库存"/><span>至</span><InputNumber min={0} precision={0} value={productStockMax} onChange={setProductStockMax} placeholder="最高库存"/></span>
            <Select allowClear value={badgeFilter} onChange={setBadgeFilter} placeholder="全部角标" style={{width:135}} options={[
              {value:"AUTO",label:"自动"},{value:"AGREEMENT",label:"协议专属"},{value:"PLATFORM",label:"指定平台"},{value:"CUSTOM",label:"自定义角标"},
            ]}/>
          </> : undefined}
          selectionActions={module === "products" ? (selected, clearSelection) => <>
            <Button disabled={!selected.length} onClick={() => void batchStatus(selected, 1, clearSelection)}>批量上架</Button>
            <Button disabled={!selected.length} onClick={() => void batchStatus(selected, 2, clearSelection)}>批量下架</Button>
            <Button disabled={!selected.length} onClick={() => void batchSelfOperated(selected,1,clearSelection)}>设为自营</Button>
            <Button disabled={!selected.length} onClick={() => void batchSelfOperated(selected,0,clearSelection)}>设为非自营</Button>
            <Button disabled={!selected.length} onClick={() => showBatchStock(selected)}>批量改库存</Button>
          </> : undefined}
        />
      </Card>
      <Modal
        open={collectOpen}
        title="商品采集"
        width={collectTab === "batch" ? 840 : 520}
        okText={collectTab === "batch" ? (collecting ? "提交中" : "加入队列") : (collecting ? "采集中" : "采集")}
        confirmLoading={collecting}
        cancelButtonProps={{ disabled: collecting }}
        onCancel={() => { if (!collecting) setCollectOpen(false); }}
        onOk={() => void (collectTab === "batch" ? submitBatchCollect() : collectProduct())}
      >
        <Tabs
          activeKey={collectTab}
          onChange={setCollectTab}
          items={[
            { key: "single", label: "单条采集" },
            { key: "batch", label: "批量采集" },
          ]}
        />
        <Form form={collectForm} layout="vertical" initialValues={{ platform: "jd" }}>
          <Form.Item name="platform" label="平台" rules={[{ required: true, message: "请选择平台" }]}>
            <Select options={[
              { value: "jd", label: "京东" },
              { value: "huiecai", label: "徽e采" },
              { value: "qilu", label: "齐鲁云采框架协议" },
              { value: "taobao", label: "淘宝 / 天猫" },
            ]} />
          </Form.Item>
          {collectTab === "single" ? <>
            <Form.Item name="url" label="商品链接" rules={[{ required: true, message: "请输入商品链接" }]}>
              <Input.TextArea rows={3} placeholder={
                collectPlatform === "huiecai" ? "http://hwly.miniappss.com/goodsInfo/84395.html"
                  : collectPlatform === "qilu" ? "https://ggzyjyzx.shandong.gov.cn:8182/gpfa-main-web/goodslibrary/gpfa/goodsDetail?goodspriceguid=xxxx"
                    : "https://item.jd.com/72054902653.html"
              } />
            </Form.Item>
            <Form.Item name="memberPrice" label={collectNeedPrice ? "售价（可选）" : "售价（可选，覆盖页面价格）"}>
              <InputNumber min={0.01} precision={2} style={{ width: "100%" }} placeholder={collectNeedPrice ? "京东隐藏价格时请填写" : "不填则使用页面售价"} />
            </Form.Item>
            <Alert type="info" showIcon message={
              collectPlatform === "huiecai" ? "支持徽e采商品详情页。采集成功后写入商品管理，约 1 至 2 分钟。"
                : collectPlatform === "qilu" ? "请粘贴入围商品详情链接（含 goodspriceguid），不要使用入围商品库列表页。采集成功后写入商品管理。"
                  : collectPlatform === "taobao" ? "支持淘宝/天猫商品详情链接。采集账号登录凭证失效时会提示管理员更新，凭证不会保存到商品数据中。"
                    : "目前京东、淘宝/天猫、徽e采、齐鲁云采可采集。采集成功后会写入商品管理，约 1 至 2 分钟。若页面隐藏售价，请填写售价后再采集。"
            } />
          </> : <>
            <Space wrap style={{ marginBottom: 12 }}>
              <Upload accept=".csv,.txt" showUploadList={false} beforeUpload={(file) => {
                const reader = new FileReader();
                reader.onload = () => applyBatchText(String(reader.result || ""));
                reader.readAsText(file, "utf-8");
                return false;
              }}>
                <Button>上传 CSV / TXT</Button>
              </Upload>
              <Button onClick={() => {
                const sample = collectPlatform === "huiecai"
                  ? "http://hwly.miniappss.com/goodsInfo/84395.html"
                  : collectPlatform === "qilu"
                    ? "https://ggzyjyzx.shandong.gov.cn:8182/gpfa-main-web/goodslibrary/gpfa/goodsDetail?goodspriceguid=7336215309403226112"
                    : "https://item.jd.com/72054902653.html";
                const csv = collectNeedPrice
                  ? `\ufeff链接,售价\n${sample},199.00\n`
                  : `\ufeff链接\n${sample}\n`;
                const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = `${collectPlatformLabel(collectPlatform)}批量采集模板.csv`;
                anchor.click();
                URL.revokeObjectURL(url);
              }}>下载模板</Button>
            </Space>
            <Input.TextArea
              rows={6}
              value={batchText}
              onChange={(event) => applyBatchText(event.target.value)}
              placeholder={collectNeedPrice
                ? "每行一条：商品链接,售价\nhttps://item.jd.com/72054902653.html,199"
                : "每行一条商品详情链接，售价可省略"}
            />
            <Alert type="info" showIcon style={{ margin: "12px 0" }}
              message={collectPlatform === "qilu"
                ? "齐鲁云采请粘贴商品详情链接。服务端按队列依次采集；下架商品会跳过，失败自动重试 3 次。提交后可在「采集任务」查看进度。"
                : collectNeedPrice
                  ? "京东批量采集需填写售价。服务端会按链接生成队列并依次采集；下架商品会标明原因并跳过，失败自动重试 3 次。提交后可在「采集任务」查看进度。"
                  : "服务端会按链接生成队列并依次采集；下架商品会标明原因并跳过，失败自动重试 3 次。提交后可在「采集任务」查看进度。"} />
            {batchRows.length > 0 && (
              <AntTable
                size="small"
                rowKey="line"
                pagination={false}
                scroll={{ y: 240 }}
                dataSource={batchRows.map((row, index) => ({ ...row, line: index + 1 }))}
                columns={[
                  { title: "平台", width: 110, render: (_: unknown, row: { url: string }) => collectPlatformLabel(detectCollectPlatform(row.url)) },
                  { title: "商品链接", dataIndex: "url", ellipsis: true },
                  { title: "售价", width: 100, dataIndex: "memberPrice", render: (value: number) => value ? `¥${Number(value).toFixed(2)}` : "—" },
                  { title: "校验", width: 110, dataIndex: "error", render: (value: string) => value ? <Tag color="red">{value}</Tag> : <Tag color="green">待采集</Tag> },
                ]}
              />
            )}
          </>}
        </Form>
      </Modal>
      <Modal open={Boolean(badgeProduct)} title={`角标配置 · ${badgeProduct?.title || ""}`} onCancel={() => setBadgeProduct(undefined)} onOk={() => void saveBadgeConfig()}>
        <Form form={listBadgeForm} layout="vertical">
          <Form.Item name="badgeType" label="角标类型" rules={[{required:true}]}><Select options={[
            {value:"NONE",label:"自动"},{value:"AGREEMENT",label:"协议专属"},{value:"PLATFORM",label:"指定平台"},{value:"CUSTOM",label:"自定义角标"},
          ]} /></Form.Item>
          {listBadgeType === "PLATFORM" && <Form.Item name="badgePlatformId" label="角标平台" rules={[{required:true,message:"请选择商品已关联的平台"}]}>
            <Select showSearch optionFilterProp="label" options={(platforms.data || []).filter((platform) => Number(platform.status) === 1 &&
              productPlatformRelations(badgeProduct || {}).some((relation) => Number(relation.platformId) === Number(platform.id)))
              .map((platform) => ({value:Number(platform.id),label:`${platform.title}（显示：${platform.pricePrefix || platform.title}${String(platform.pricePrefix || platform.title).endsWith("平台") ? "" : "平台"}）`}))} />
          </Form.Item>}
          {listBadgeType === "CUSTOM" && <Form.Item name="customBadge" label="自定义角标" rules={[
            {required:true,message:"请输入自定义角标"},{pattern:/^[\u3400-\u9fff]{2,5}$/,message:"请输入2至5个汉字"},
          ]}><Input maxLength={5} showCount placeholder="2～5个汉字" /></Form.Item>}
          {listBadgeType === "AGREEMENT" && <Alert type="info" showIcon message="仅当当前登录用户所属企业命中该商品协议价格时显示“协议专属”。" />}
        </Form>
      </Modal>
      <Modal open={batchStockRows.length > 0} title={`批量修改库存（${batchStockRows.length} 个商品）`} onCancel={() => setBatchStockRows([])} onOk={() => void saveBatchStock()}>
        <Alert type="info" showIcon message="将为所选商品的全部 SKU 设置相同库存；库存不能低于已占用库存。" style={{marginBottom:16}} />
        <Form form={batchStockForm} layout="vertical"><Form.Item name="stock" label="新库存" rules={[{required:true,message:"请输入库存"}]}><InputNumber min={0} precision={0} style={{width:"100%"}} /></Form.Item></Form>
      </Modal>
      <Modal open={Boolean(platformProduct)} title={`平台 · ${platformProduct?.title || ""}`} onCancel={() => setPlatformProduct(undefined)} onOk={() => void savePlatformAdd()}>
        <Form form={platformForm} layout="vertical">
          <Form.Item name="platformId" label="采购平台" rules={[{required:true,message:"请选择平台"}]}><Select showSearch optionFilterProp="label" options={(platforms.data || []).filter(row => Number(row.status) === 1).map(row => ({value:Number(row.id),label:row.title}))} /></Form.Item>
          <Form.Item name="skuId" label="商品 SKU" rules={[{required:true,message:"请选择 SKU"}]}><Select showSearch optionFilterProp="label" options={(platformProduct ? (typeof platformProduct.skus === "string" ? JSON.parse(platformProduct.skus || "[]") : platformProduct.skus || []) : []).map((sku:Row) => ({value:Number(sku.id),label:`${sku.skuCode} · ¥${Number(sku.memberPrice).toFixed(2)}`}))} /></Form.Item>
          <Form.Item name="platformPrice" label="平台售价" rules={[{required:true,message:"请输入平台售价"}]}><InputNumber min={0} precision={2} prefix="¥" style={{width:"100%"}} /></Form.Item>
          <Form.Item name="productUrl" label="平台商品链接"><Input placeholder="可选，填写后客户端可跳转" /></Form.Item>
          <Form.Item name="listingStatus" label="平台状态" rules={[{required:true}]}><Select options={[{value:1,label:"上架"},{value:0,label:"下架"}]} /></Form.Item>
        </Form>
      </Modal>
      <Modal open={Boolean(agreementProduct)} title={`协议 · ${agreementProduct?.title || ""}`} onCancel={() => setAgreementProduct(undefined)} onOk={() => void saveProductAgreements()}>
        <Alert type="info" showIcon message="可同时关联多个协议；新增关联默认使用各 SKU 的会员价作为协议价，已有协议价不会被覆盖。" style={{marginBottom:16}} />
        <Form form={productAgreementForm} layout="vertical">
          <Form.Item name="agreementIds" label="关联协议">
            <Select mode="multiple" allowClear showSearch optionFilterProp="label" placeholder="请选择一个或多个协议"
              options={(agreementOptions.data||[]).filter((row)=>Number(row.status)===1).map((row)=>({value:Number(row.id),label:row.name}))} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        open={open}
        guardUnsaved={false}
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
        <Form form={form} layout="vertical" className="two-column-form" onValuesChange={(changed,values)=>{
          if(module!=="products")return;
          const specificationChanged=Array.isArray(changed.skus)&&changed.skus.some((sku:Row)=>sku&&Object.prototype.hasOwnProperty.call(sku,"specification"));
          if("title" in changed||specificationChanged){
            (values.skus||[]).forEach((sku:Row,index:number)=>{
              const skuTitle=[values.title,String(sku.specification||"").trim()].filter(Boolean).join(" ");
              if(skuTitle&&sku.skuTitle!==skuTitle)form.setFieldValue(["skus",index,"skuTitle"],skuTitle);
            });
          }
        }}>
          {mode === "stock" ? (
            <Form.Item name="stock" label="总库存" rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
          ) : module === "products" ? (
            <Tabs className="full" destroyOnHidden={false} activeKey={productTab} onChange={setProductTab} items={[
              { key: "basic", label: "基本信息", children: <div className="two-column-form">
                <Form.Item name="categoryId" label="分类" className="full" rules={[{ required: true, message: "请选择三级分类" }]}><Select showSearch optionFilterProp="label" placeholder="搜索或选择三级分类" options={(categories.data || []).filter((x) => Number(x.level) === 3 && Number(x.status) === 1).map((x) => ({ value: Number(x.id), label: `${x.parentName || ""} / ${x.name}` }))} /></Form.Item>
                <div className="full product-brand-model-row">
                  <Form.Item name="brandId" label="品牌" rules={[{required:true,message:"请选择品牌"}]}><Select loading={brands.loading} showSearch optionFilterProp="label" options={(brands.data||[]).filter((x)=>Number(x.status)===1).map((x)=>({ value:Number(x.id),label:x.name }))} placeholder="请选择已启用品牌" /></Form.Item>
                  <Form.Item name="model" label="型号"><Input placeholder="请输入商品型号" /></Form.Item>
                  <Form.Item name="selfOperated" label="是否自营" getValueProps={(value)=>({checked:Number(value)===1})} getValueFromEvent={(checked)=>checked?1:0}><Switch checkedChildren="自营" unCheckedChildren="非自营" /></Form.Item>
                </div>
                <Form.Item name="title" label="商品标题" className="full" rules={[{ required: true, message:"请输入商品标题" }]}><Input placeholder="请输入完整商品标题" /></Form.Item>
                <Form.Item name="status" hidden><Input /></Form.Item>
                <Form.Item name="badgeType" hidden><Input /></Form.Item>
                <Form.Item name="badgePlatformId" hidden><Input /></Form.Item>
                <Form.Item name="customBadge" hidden><Input /></Form.Item>
                <Form.Item name="mainImage" label="商品主图" className="full" rules={[{ required: true, message: "请上传商品主图" }]}><ProductImageUpload /></Form.Item>
                <Form.Item name="gallery" label="商品轮播图" className="full"><ProductImageUpload multiple /></Form.Item>
              </div> },
              { key: "sales", label: "规格与 SKU", children: <div className="full">
                <Alert type="info" showIcon message="每行代表一个可独立销售的 SKU。规格格式示例：颜色=黑色；容量=256GB。SKU 编码留空时由系统自动生成。" />
                <Form.List name="skus" rules={[{validator:async(_,items)=>{if(!items?.length)throw new Error("至少添加一个 SKU");}}]}>
                  {(fields,{add,remove},{errors})=><>
                    {fields.map(({key,name})=><Card size="small" key={key} title={`SKU ${name+1}`} style={{marginTop:12}}
                      extra={fields.length>1?<Button type="link" danger onClick={()=>remove(name)}>移除</Button>:null}>
                      <div className="two-column-form">
                        <Form.Item name={[name,"id"]} hidden><Input /></Form.Item>
                        <Form.Item name={[name,"skuCode"]} hidden><Input /></Form.Item>
                        <Form.Item name={[name,"skuTitle"]} label="SKU 标题" className="full" extra="默认按“商品标题 + 销售规格”生成，可继续修改。"><Input /></Form.Item>
                        <Form.Item name={[name,"specification"]} label="销售规格" className="full" rules={[{required:true,message:"请填写销售规格"}]}><Input placeholder="规格=标准；或 颜色=黑色；容量=256GB" /></Form.Item>
                        <div className="full sku-price-stock-row">
                          <Form.Item name={[name,"marketPrice"]} label="市场价" rules={[{required:true}]}><InputNumber min={0} precision={2} style={{width:"100%"}} /></Form.Item>
                          <Form.Item name={[name,"memberPrice"]} label="会员价" rules={[{required:true}]}><InputNumber min={0} precision={2} style={{width:"100%"}} /></Form.Item>
                          <Form.Item name={[name,"stock"]} label={<span>库存 <Tooltip title="默认库存请在：系统设置 → 基本设置 → 库存配置 中设置"><span style={{cursor:"help",color:"#1677ff"}}>ⓘ</span></Tooltip></span>} rules={[{required:true}]}><InputNumber min={0} style={{width:"100%"}} /></Form.Item>
                        </div>
                        {editing ? <Form.Item name={[name,"status"]} label="SKU 状态" rules={[{required:true}]}><Select options={[{value:1,label:"开启"},{value:0,label:"停用"}]} /></Form.Item> : <Form.Item name={[name,"status"]} hidden><Input /></Form.Item>}
                        <Form.Item name={[name,"skuImage"]} label="SKU 主图" className="full" extra={name===0?"主 SKU 未上传主图时，自动使用 SPU 商品主图。":"建议上传与当前销售规格一致的正方形主图。"}><ProductImageUpload /></Form.Item>
                        <Form.Item name={[name,"skuGallery"]} label="SKU 轮播图" className="full" extra="最多上传6张，可拖动调整顺序。"><ProductImageUpload multiple /></Form.Item>
                      </div>
                    </Card>)}
                    <Button block type="dashed" style={{marginTop:12}} onClick={()=>add({skuCode:"",skuTitle:"",specification:"",skuImage:"",skuGallery:"",marketPrice:0,memberPrice:0,stock:defaultSkuStock,status:1})}>＋ 添加 SKU</Button>
                    <Form.ErrorList errors={errors}/>
                  </>}
                </Form.List>
              </div> },
              { key: "attributes", label: `规格属性${attributeTemplate.length ? `（${attributeTemplate.length}）` : ""}`, children: <div className="two-column-form">
                <div className="full"><Alert type="info" showIcon message="以下字段根据所选三级分类生成；标有“继承自上级分类”的属性由一级或二级分类自动提供。" /></div>
                {attributeTemplate.length === 0 && <div className="full"><Alert type="warning" showIcon message="当前分类尚未配置属性模板，可在“属性模板”页面添加。" /></div>}
                {attributeTemplate.map((attribute) => {
                  const name = ["attributeValues", String(attribute.id)];
                  const rules = Number(attribute.requiredFlag) === 1 ? [{ required: true, message: `请填写${attribute.name}` }] : [];
                  const options = (attribute.options || []).filter((x: Row) => Number(x.status) === 1).map((x: Row) => ({ label: x.optionLabel, value: Number(x.id) }));
                  const scopeLabel = attribute.scopeSource === "GLOBAL" ? " · 全局通用" : Number(attribute.inheritedLevel) > 0 ? " · 继承自上级分类" : "";
                  const label = `${attribute.name}${attribute.unit ? `（${attribute.unit}）` : ""}${scopeLabel}`;
                  return <Form.Item key={attribute.id} name={name} label={label} rules={rules}>{attribute.inputType === "NUMBER" ? <InputNumber style={{width:"100%"}} /> : attribute.inputType === "SELECT" ? <Select options={options} allowClear /> : attribute.inputType === "RADIO" ? <Radio.Group options={options} /> : attribute.inputType === "CHECKBOX" ? <Checkbox.Group options={options} /> : attribute.inputType === "SWITCH" ? <Select options={[{label:"是",value:"是"},{label:"否",value:"否"}]} /> : attribute.inputType === "DATE" ? <Input type="date" /> : <Input />}</Form.Item>;
                })}
              </div> },
              { key: "detail", label: "详情与服务", children: <div className="two-column-form">
                <Form.Item name="serviceOptionIds" label={<span>商品服务 <Tooltip title="新建商品默认全选；服务选项在系统设置 → 基本设置 → 商品服务中维护。"><span className="form-help-icon">?</span></Tooltip></span>} className="full"><Checkbox.Group options={(productServices.data||[]).map((item)=>({value:Number(item.id),label:item.label}))}/></Form.Item>
                <Form.Item name="summary" label="商品摘要" className="full product-summary-field"><Input.TextArea autoSize={{minRows:1,maxRows:3}} /></Form.Item>
                <Form.Item name="detailHtml" label="商品详情" className="full product-detail-editor"><RichTextEditor /></Form.Item>
                <Form.Item name="deliveryDescription" label="配送说明模板"><Select allowClear placeholder="请选择配送说明模板" options={deliveryTemplates.map((item)=>({value:String(item.content||""),label:`${item.title}${item.isDefault?"（默认）":""}`}))}/></Form.Item>
                <Form.Item name="afterSalesHtml" label="售后政策模板"><Select allowClear placeholder="请选择售后政策模板" options={afterSalesTemplates.map((item)=>({value:String(item.content||""),label:`${item.title}${item.isDefault?"（默认）":""}`}))}/></Form.Item>
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
                  children: `${detail.order.buyerName||"—"}${detail.order.buyerUsername?`（${detail.order.buyerUsername}）`:""}`,
                },
                { key: "phone", label: "联系电话", children: detail.order.buyerPhone||"—" },
                { key: "agreement", label: "采购协议", children: detail.order.agreementName||"非协议订单" },
                { key: "itemAmount", label: "商品金额", children: `¥${Number(detail.order.itemAmount||0).toFixed(2)}` },
                { key: "freightAmount", label: "运费", children: `¥${Number(detail.order.freightAmount||0).toFixed(2)}` },
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
                { key: "updatedAt", label: "最后更新时间", children: dateTime(detail.order.updatedAt) },
                { key: "paymentDueAt", label: "付款截止时间", children: detail.order.paymentDueAt?dateTime(detail.order.paymentDueAt):"—" },
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
                    Number(detail.order.refundStatus || 0) > 0 ? (
                      <Space direction="vertical" size={2}>
                        <Tag color="red">{Number(detail.order.refundStatus)===1?"已全额退款":"部分退款"}</Tag>
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
                  render: (value: any, row:Row, index:number) => {
                    const addressKey=String(row.subOrderNo||JSON.stringify(value||{}));
                    const sameRows=(detail.items||[]).filter((item:Row)=>String(item.subOrderNo||JSON.stringify(item.addressSnapshot||{}))===addressKey);
                    const firstIndex=(detail.items||[]).findIndex((item:Row)=>String(item.subOrderNo||JSON.stringify(item.addressSnapshot||{}))===addressKey);
                    return {children:firstIndex===index?<div className="admin-delivery-address"><strong>同址配送 · {sameRows.length} 款商品</strong><span>{deliveryAddress(value)}</span><small>配送单：{row.subOrderNo}</small></div>:null,props:{rowSpan:firstIndex===index?sameRows.length:0}};
                  },
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
  const globalFlag = Form.useWatch("globalFlag", form);
  const save = async () => {
    try {
      const values = await form.validateFields();
      if (Number(values.globalFlag) === 1) values.categoryIds = [];
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
  const removeAttribute = (row: Row) => modal.confirm({
    title: `删除属性模板“${row.name}”？`,
    content: "删除后将取消其分类关联；已被商品使用的属性模板不能删除，请先停用。",
    okText: "确认删除",
    cancelText: "取消",
    okButtonProps: { danger: true },
    onOk: async () => {
      try {
        await rootMutation(`/api/admin/business/attributes/${row.id}`, { method: "DELETE" });
        message.success("属性模板已删除");
        void rows.refresh();
      } catch (error) { message.error((error as Error).message); }
    },
  });
  const columns: ColumnsType<Row> = [
    { title: "属性", render: (_, row) => <><strong>{row.name}</strong><br/><small>{row.code}</small></> },
    { title: "分组", dataIndex: "groupName" },
    { title: "用途", dataIndex: "attributeType", render: (v) => ({ BASIC:"基础属性",SPEC:"销售规格",EXTENDED:"扩展属性" }[v as string] || v) },
    { title: "输入方式", dataIndex: "inputType", render: (v) => ({ TEXT:"文本",NUMBER:"数字",SELECT:"下拉单选",RADIO:"单选",CHECKBOX:"多选",SWITCH:"开关",DATE:"日期" }[v as string] || v) },
    { title: "规则", render: (_,r) => <Space wrap>{Number(r.requiredFlag)===1&&<Tag color="red">必填</Tag>}{Number(r.filterable)===1&&<Tag color="blue">可筛选</Tag>}{Number(r.visibleFlag)===1&&<Tag color="green">前台展示</Tag>}</Space> },
    { title: "适用范围", render: (_,r) => Number(r.globalFlag)===1 ? <Tag color="purple">全局通用</Tag> : <><Tag color="blue">分类通用</Tag><small>{r.categoryIds?.length || 0} 个直接关联</small></> },
    { title: "操作", render: (_,r) => <Space><Button type="link" onClick={()=>{setEditing(r);form.setFieldsValue({...r,categoryIds:(r.categoryIds||[]).map(Number)});setOpen(true);}}>编辑</Button>{["SELECT","RADIO","CHECKBOX"].includes(r.inputType)&&<Button type="link" onClick={()=>{setOptionOwner(r);setOptionEditing(undefined);optionForm.resetFields();}}>管理选项</Button>}<Button type="link" danger onClick={()=>removeAttribute(r)}>删除</Button></Space> },
  ];
  return <>
    <Card title="规格属性管理" extra={<Button type="primary" onClick={()=>{setEditing(undefined);form.resetFields();form.setFieldsValue({groupName:"规格参数",attributeType:"BASIC",inputType:"TEXT",requiredFlag:0,filterable:0,searchable:0,visibleFlag:1,allowCustom:0,globalFlag:0,sortOrder:0,status:1});setOpen(true);}}>新增属性</Button>}>
      <Alert type="info" showIcon message="属性适用范围说明" description={<div>全局通用：适用于全部商品分类；分类通用：关联一级分类后由其二、三级分类继承，关联二级分类后由其三级分类继承，关联三级分类时仅当前分类使用。相同含义的属性请复用已有模板并关联分类，不要重复创建；下级分类仍可追加自己的专用属性。已被商品使用的属性只能停用。</div>} style={{marginBottom:16}} />
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
        <Form.Item name="globalFlag" label="适用范围" className="full" rules={[{required:true}]} extra={Number(globalFlag)===1 ? "自动应用到全部分类，无需逐个关联" : "分类属性会自动向其下级分类继承"}><Radio.Group options={[{label:"全局通用",value:1},{label:"指定分类",value:0}]} /></Form.Item>
        {Number(globalFlag)!==1 && <Form.Item name="categoryIds" label="适用分类" className="full" extra="可选择一个或多个分类；选择上级分类即可覆盖其全部下级分类"><Select mode="multiple" showSearch optionFilterProp="label" options={(categories.data||[]).map(c=>({value:Number(c.id),label:`${"　".repeat(Number(c.level)-1)}${c.name}（${c.level}级）`}))} /></Form.Item>}
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
  const [childParent,setChildParent]=useState<Row>();
  const [attributeOwner, setAttributeOwner] = useState<Row>();
  const [selectedAttributeIds, setSelectedAttributeIds] = useState<number[]>([]);
  const [attributeAddOpen, setAttributeAddOpen] = useState(false);
  const [pendingAttributeIds, setPendingAttributeIds] = useState<number[]>([]);
  const [expandedCategoryKeys,setExpandedCategoryKeys]=useState<Key[]>([]);
  const associatedAttributePage = usePagedLoad(`/api/admin/business/attributes?categoryId=${attributeOwner?.id || 0}&associated=true`,10,[attributeOwner?.id],Boolean(attributeOwner));
  const unassociatedAttributePage = usePagedLoad(`/api/admin/business/attributes?categoryId=${attributeOwner?.id || 0}&associated=false`,10,[attributeOwner?.id],Boolean(attributeOwner));
  const show = (row?: Row) => {
    setChildParent(undefined);
    setEditing(row);
    form.resetFields();
    form.setFieldsValue(
      row
        ? { ...row, parentId: row.parentId || undefined }
        : { level: 1, sortOrder: 0, status: 1 },
    );
    setOpen(true);
  };
  const showChild=(parent:Row)=>{
    if(Number(parent.level)>=3){message.warning("商品分类最多三级");return;}
    const siblings=(rows.data||[]).filter((row)=>Number(row.parentId)===Number(parent.id));
    setEditing(undefined);setChildParent(parent);form.resetFields();
    form.setFieldsValue({level:Number(parent.level)+1,parentId:Number(parent.id),sortOrder:(siblings.length+1)*10,status:1});
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
      setChildParent(undefined);
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
  useEffect(()=>{
    setExpandedCategoryKeys((current)=>current.length?current:(rows.data||[]).filter((row)=>Number(row.childCount)>0).map((row)=>row.id));
  },[rows.data]);
  const moveCategory=async(row:Row,direction:-1|1)=>{
    const siblings=(rows.data||[]).filter((item)=>Number(item.parentId||0)===Number(row.parentId||0))
      .sort((a,b)=>Number(a.sortOrder||0)-Number(b.sortOrder||0)||Number(a.id)-Number(b.id));
    const index=siblings.findIndex((item)=>Number(item.id)===Number(row.id));
    const target=index+direction;if(index<0||target<0||target>=siblings.length)return;
    [siblings[index],siblings[target]]=[siblings[target],siblings[index]];
    try{
      await Promise.all(siblings.map((item,position)=>rootMutation(`/api/admin/business/categories/${item.id}`,{
        method:"PUT",body:JSON.stringify({name:item.name,parentId:item.parentId||null,level:Number(item.level),sortOrder:(position+1)*10,icon:item.icon||"",status:Number(item.status)}),
      })));
      message.success(direction<0?"分类已上移":"分类已下移");void rows.refresh();
    }catch(error){message.error((error as Error).message);}
  };
  const siblingPosition=(row:Row)=>{
    const siblings=(rows.data||[]).filter((item)=>Number(item.parentId||0)===Number(row.parentId||0))
      .sort((a,b)=>Number(a.sortOrder||0)-Number(b.sortOrder||0)||Number(a.id)-Number(b.id));
    return {index:siblings.findIndex((item)=>Number(item.id)===Number(row.id)),total:siblings.length};
  };
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
        <div className="category-tree-name" style={{paddingLeft:(Number(row.level)-1)*30}}>
          {Number(row.childCount)>0
            ? <button type="button" className={`category-expand-toggle${expandedCategoryKeys.includes(row.id)?" is-expanded":""}`} aria-label={expandedCategoryKeys.includes(row.id)?"收起分类":"展开分类"} onClick={()=>setExpandedCategoryKeys((keys)=>keys.includes(row.id)?keys.filter((key)=>key!==row.id):[...keys,row.id])}>›</button>
            : <span className="category-expand-placeholder" />}
          <span className="category-title-cell"><strong>{row.name}</strong><small>{row.parentName ? `上级：${row.parentName}` : "一级分类"}</small></span>
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
    { title: "排序", width:130,render:(_,row)=>{const position=siblingPosition(row);return <Space size={2}>
      <Button size="small" aria-label="上移" disabled={position.index<=0} onClick={()=>void moveCategory(row,-1)}>↑</Button>
      <Button size="small" aria-label="下移" disabled={position.index<0||position.index>=position.total-1} onClick={()=>void moveCategory(row,1)}>↓</Button>
      <Typography.Text type="secondary">{row.sortOrder}</Typography.Text>
    </Space>;}},
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
          {Number(row.level)<3&&<Button type="link" onClick={()=>showChild(row)}>添加子分类</Button>}
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
          expandable={{
            expandedRowKeys:expandedCategoryKeys,
            onExpandedRowsChange:(keys)=>setExpandedCategoryKeys([...keys]),
            indentSize:0,
            expandIcon:()=>null,
          }}
          searchPlaceholder="搜索分类名称、上级分类或级别"
        />
      </Card>
      <Modal
        open={open}
        title={editing?"编辑分类":childParent?`添加子分类 · ${childParent.name}`:"新增分类"}
        onCancel={() => {setOpen(false);setChildParent(undefined);}}
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
              disabled={Boolean(childParent)}
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
              <Select disabled={Boolean(childParent)} options={parentOptions} />
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

function SeoSettings(){const {message}=AntApp.useApp();const result=useLoad<Row>(()=>rootApi("/api/admin/content/seo-settings"));const [form]=Form.useForm();useEffect(()=>{if(result.data)form.setFieldsValue(result.data)},[result.data,form]);const save=async()=>{try{const v=await form.validateFields();await rootMutation("/api/admin/content/seo-settings",{method:"PUT",body:JSON.stringify(v)});message.success("SEO/GEO配置已保存");}catch(e){if(e instanceof Error)message.error(e.message)}};return <Card className="data-card settings-card" title="全站 SEO / GEO 配置" extra={<Button type="primary" onClick={()=>void save()}>保存配置</Button>}><Form form={form} layout="vertical" className="settings-form"><section className="form-section"><header><strong>搜索展示</strong><span>应用于 Web 全站标题和搜索结果摘要</span></header><div className="form-grid"><Form.Item className="form-span-2" name="title" label="网站标题" rules={[{required:true}]}><Input/></Form.Item><Form.Item className="form-span-2" name="description" label="网站描述" rules={[{required:true}]}><Input.TextArea rows={3}/></Form.Item><Form.Item className="form-span-2" name="keywords" label="SEO关键词" rules={[{required:true}]}><Input.TextArea rows={2} placeholder="使用逗号分隔"/></Form.Item><Form.Item className="form-span-2" name="geoKeywords" label="GEO地域/生成式搜索关键词" rules={[{required:true}]}><Input.TextArea rows={2} placeholder="使用逗号分隔"/></Form.Item><Form.Item name="organizationName" label="组织名称" rules={[{required:true}]}><Input/></Form.Item></div></section></Form></Card>}

function BankAccounts(){const {message,modal}=AntApp.useApp();const rows=usePagedLoad("/api/admin/content/bank-accounts",10);const [form]=Form.useForm();const [editing,setEditing]=useState<Row>();const [open,setOpen]=useState(false);const show=(r?:Row)=>{setEditing(r);form.resetFields();form.setFieldsValue(r||{sortOrder:10,status:1,branchName:""});setOpen(true)};const save=async()=>{try{const v=await form.validateFields();await rootMutation(`/api/admin/content/bank-accounts${editing?`/${editing.id}`:""}`,{method:editing?"PUT":"POST",body:JSON.stringify(v)});message.success("收款账号已保存");setOpen(false);void rows.refresh()}catch(e){if(e instanceof Error)message.error(e.message)}};const remove=(r:Row)=>modal.confirm({title:`删除收款账号“${r.bankName}”？`,okButtonProps:{danger:true},onOk:async()=>{await rootMutation(`/api/admin/content/bank-accounts/${r.id}`,{method:"DELETE"});void rows.refresh()}});return <><Card className="data-card" title="收款银行账号" extra={<Button type="primary" onClick={()=>show()}>＋ 新增账号</Button>}><Table rowKey="id" loading={rows.loading} dataSource={rows.data} server={rows.server} columns={[{title:"开户名称",dataIndex:"accountName"},{title:"开户银行",dataIndex:"bankName"},{title:"银行账号",dataIndex:"accountNumber"},{title:"开户支行",dataIndex:"branchName"},{title:"顺序",dataIndex:"sortOrder",width:80},{title:"状态",dataIndex:"status",width:90,render:v=><Tag color={Number(v)===1?"green":"default"}>{Number(v)===1?"启用":"停用"}</Tag>},{title:"操作",width:150,render:(_,r)=><Space><Button type="link" onClick={()=>show(r)}>编辑</Button><Button danger type="link" onClick={()=>remove(r)}>删除</Button></Space>}]}/></Card><Modal open={open} title={`${editing?"编辑":"新增"}收款账号`} onCancel={()=>setOpen(false)} onOk={()=>void save()}><Form form={form} layout="vertical"><Form.Item name="accountName" label="开户名称" rules={[{required:true}]}><Input/></Form.Item><Form.Item name="bankName" label="开户银行" rules={[{required:true}]}><Input/></Form.Item><Form.Item name="accountNumber" label="银行账号" rules={[{required:true}]}><Input/></Form.Item><Form.Item name="branchName" label="开户支行"><Input/></Form.Item><Form.Item name="sortOrder" label="排序" rules={[{required:true}]}><InputNumber min={0} style={{width:"100%"}}/></Form.Item><Form.Item name="status" label="状态" rules={[{required:true}]}><Select options={[{value:1,label:"启用"},{value:0,label:"停用"}]}/></Form.Item></Form></Modal></>}

function FooterSettings() {
  const {message}=AntApp.useApp();
  const result=useLoad<Row>(()=>rootApi("/api/admin/content/footer-settings"));
  const [form]=Form.useForm();
  useEffect(()=>{if(result.data)form.setFieldsValue(result.data);},[result.data,form]);
  const save=async()=>{try{const values=await form.validateFields();await rootMutation("/api/admin/content/footer-settings",{method:"PUT",body:JSON.stringify(values)});
    message.success("页脚配置已保存");void result.refresh();}catch(error){if(error instanceof Error)message.error(error.message);}};
  return <Card className="data-card settings-card" title="门户页脚配置">
    <Tabs items={[{key:"base",label:"基础与备案",children:<><div className="settings-action"><Button type="primary" onClick={()=>void save()}>保存配置</Button></div><Form form={form} layout="vertical" className="settings-form">
      <section className="form-section"><header><strong>栏目标题</strong><span>配置 Web 门户页脚四个固定栏目的显示名称，限2～6个汉字</span></header><div className="form-grid">
        <Form.Item name="aboutTitle" label="关于栏目" rules={[{required:true},{pattern:/^[\u3400-\u9fff]{2,6}$/,message:"请输入2至6个汉字"}]}><Input maxLength={6} showCount placeholder="关于壹采" /></Form.Item>
        <Form.Item name="officialTitle" label="平台栏目" rules={[{required:true},{pattern:/^[\u3400-\u9fff]{2,6}$/,message:"请输入2至6个汉字"}]}><Input maxLength={6} showCount placeholder="官方平台" /></Form.Item>
        <Form.Item name="serviceTitle" label="服务栏目" rules={[{required:true},{pattern:/^[\u3400-\u9fff]{2,6}$/,message:"请输入2至6个汉字"}]}><Input maxLength={6} showCount placeholder="我们的服务" /></Form.Item>
        <Form.Item name="contactTitle" label="联系栏目" rules={[{required:true},{pattern:/^[\u3400-\u9fff]{2,6}$/,message:"请输入2至6个汉字"}]}><Input maxLength={6} showCount placeholder="联系我们" /></Form.Item>
      </div></section>
      <section className="form-section"><header><strong>基础信息</strong><span>用于页脚的公司介绍和联系信息</span></header><div className="form-grid">
        <Form.Item className="form-span-2" name="about" label="关于我们" rules={[{required:true,message:"请输入公司简介"}]}><Input.TextArea rows={4} showCount maxLength={300}/></Form.Item>
        <Form.Item className="form-span-2" name="address" label="联系地址" rules={[{required:true}]}><Input /></Form.Item>
      </div></section>
      <section className="form-section"><header><strong>版权信息</strong><span>显示在页脚底部版权横条</span></header><div className="form-grid">
        <Form.Item name="copyrightYears" label="版权年份" rules={[{required:true}]}><Input placeholder="例如：2023-2025" /></Form.Item>
        <Form.Item name="companyName" label="公司名称" rules={[{required:true}]}><Input /></Form.Item>
      </div></section>
      <section className="form-section"><header><strong>备案与许可证</strong><span>备案号将在 Web 页脚展示并链接至官方查询平台</span></header><div className="form-grid form-grid-3">
        <Form.Item name="icpFiling" label="ICP备案号" rules={[{required:true}]}><Input /></Form.Item>
        <Form.Item name="telecomLicense" label="电信增值业务许可证" rules={[{required:true}]}><Input /></Form.Item>
        <Form.Item name="policeFiling" label="公安备案号" rules={[{required:true}]}><Input /></Form.Item>
      </div></section>
    </Form></>},{key:"official",label:"官方平台",children:<FooterLinks group="OFFICIAL"/>},{key:"service",label:"我们的服务",children:<FooterLinks group="SERVICE"/>}]}/>
  </Card>;
}

function FooterLinks({group}:{group:"OFFICIAL"|"SERVICE"}){const {message,modal}=AntApp.useApp();const rows=usePagedLoad(`/api/admin/content/footer-links?group=${group}`,10,[group]);const [form]=Form.useForm();const [editing,setEditing]=useState<Row>();const [open,setOpen]=useState(false);const label=group==="OFFICIAL"?"官方平台":"我们的服务";const show=(r?:Row)=>{setEditing(r);form.resetFields();form.setFieldsValue(r||{linkGroup:group,openTarget:"SELF",sortOrder:10,status:1});setOpen(true)};const save=async()=>{try{const v=await form.validateFields();await rootMutation(`/api/admin/content/footer-links${editing?`/${editing.id}`:""}`,{method:editing?"PUT":"POST",body:JSON.stringify({...v,linkGroup:group})});message.success("页脚链接已保存");setOpen(false);void rows.refresh()}catch(e){if(e instanceof Error)message.error(e.message)}};const remove=(r:Row)=>modal.confirm({title:`删除“${r.title}”？`,okButtonProps:{danger:true},onOk:async()=>{await rootMutation(`/api/admin/content/footer-links/${r.id}`,{method:"DELETE"});void rows.refresh()}});return <><div className="footer-link-tab"><Button type="primary" onClick={()=>show()}>＋ 新增链接</Button></div><Table rowKey="id" loading={rows.loading} dataSource={rows.data} server={rows.server} columns={[{title:"标题",dataIndex:"title"},{title:"链接",dataIndex:"linkUrl",render:v=><Typography.Text copyable>{v}</Typography.Text>},{title:"打开方式",dataIndex:"openTarget",width:120,render:v=>v==="BLANK"?"新页面":"当前页面"},{title:"排序",dataIndex:"sortOrder",width:80},{title:"状态",dataIndex:"status",width:90,render:v=><Tag color={Number(v)===1?"green":"default"}>{Number(v)===1?"显示":"隐藏"}</Tag>},{title:"操作",width:150,render:(_,r)=><Space><Button type="link" onClick={()=>show(r)}>编辑</Button><Button type="link" danger onClick={()=>remove(r)}>删除</Button></Space>}]}/><Modal open={open} title={`${editing?"编辑":"新增"}${label}链接`} onCancel={()=>setOpen(false)} onOk={()=>void save()}><Form form={form} layout="vertical"><Form.Item name="title" label="标题" rules={[{required:true}]}><Input/></Form.Item><Form.Item name="linkUrl" label="链接地址" rules={[{required:true}]}><Input placeholder="站内路径或完整网址"/></Form.Item><Form.Item name="openTarget" label="打开方式" rules={[{required:true}]}><Select options={[{value:"SELF",label:"当前页面打开"},{value:"BLANK",label:"新页面打开"}]}/></Form.Item><Form.Item name="sortOrder" label="排序" rules={[{required:true}]}><InputNumber min={0} style={{width:"100%"}}/></Form.Item><Form.Item name="status" label="是否显示" rules={[{required:true}]}><Select options={[{value:1,label:"显示"},{value:0,label:"隐藏"}]}/></Form.Item></Form></Modal></>}

function ServiceFeatures() {
  const {message,modal}=AntApp.useApp();
  const rows=usePagedLoad("/api/admin/content/service-features",10);
  const [form]=Form.useForm();
  const [open,setOpen]=useState(false);
  const [editing,setEditing]=useState<Row>();
  const show=(row?:Row)=>{setEditing(row);form.resetFields();form.setFieldsValue(row||{sortOrder:(rows.data?.length||0)*10+10,status:1});setOpen(true);};
  const save=async()=>{try{
    const values=await form.validateFields();
    await rootMutation(`/api/admin/content/service-features${editing?`/${editing.id}`:""}`,{method:editing?"PUT":"POST",body:JSON.stringify(values)});
    message.success("服务保障配置已保存");setOpen(false);void rows.refresh();
  }catch(error){if(error instanceof Error)message.error(error.message);}};
  const remove=(row:Row)=>modal.confirm({title:`删除“${row.title}”？`,content:"删除后 Web 门户将不再显示此项。",okButtonProps:{danger:true},onOk:async()=>{
    await rootMutation(`/api/admin/content/service-features/${row.id}`,{method:"DELETE"});message.success("服务保障项已删除");void rows.refresh();}});
  const fourHan={validator:(_:unknown,value:string)=>/^[\u3400-\u9fff]{4}$/.test(value||"")?Promise.resolve():Promise.reject(new Error("标题必须为4个汉字"))};
  const subtitleHan={validator:(_:unknown,value:string)=>/^[\u3400-\u9fff]{8,10}$/.test(value||"")?Promise.resolve():Promise.reject(new Error("副标题必须为8至10个汉字"))};
  return <>
    <Card className="data-card" title="服务保障配置" extra={<Button type="primary" onClick={()=>show()}>＋ 新增保障项</Button>}>
      <Table rowKey="id" loading={rows.loading} dataSource={rows.data} server={rows.server} searchPlaceholder="搜索标题或副标题" columns={[
        {title:"图片",dataIndex:"imageUrl",width:90,render:(value)=><img src={value} alt="" style={{width:52,height:52,objectFit:"contain"}}/>},
        {title:"标题",dataIndex:"title"},{title:"副标题",dataIndex:"subtitle"},{title:"顺序",dataIndex:"sortOrder",width:90},
        {title:"是否显示",dataIndex:"status",width:110,render:(value)=><Tag color={Number(value)===1?"green":"default"}>{Number(value)===1?"显示":"隐藏"}</Tag>},
        {title:"操作",width:150,render:(_,row)=><Space><Button type="link" onClick={()=>show(row)}>编辑</Button><Button type="link" danger onClick={()=>remove(row)}>删除</Button></Space>},
      ]}/>
    </Card>
    <Modal open={open} title={`${editing?"编辑":"新增"}服务保障项`} onCancel={()=>setOpen(false)} onOk={()=>void save()}>
      <Form form={form} layout="vertical">
        <Form.Item name="imageUrl" label="图片" rules={[{required:true,message:"请上传图片"}]}><ProductImageUpload kind="contentIcon" /></Form.Item>
        <Form.Item name="title" label="标题（4个汉字）" rules={[{required:true},fourHan]}><Input maxLength={4} showCount /></Form.Item>
        <Form.Item name="subtitle" label="副标题（8～10个汉字）" rules={[{required:true},subtitleHan]}><Input maxLength={10} showCount /></Form.Item>
        <Form.Item name="sortOrder" label="显示顺序" rules={[{required:true}]}><InputNumber min={0} precision={0} style={{width:"100%"}} /></Form.Item>
        <Form.Item name="status" label="是否显示" rules={[{required:true}]}><Select options={[{value:1,label:"显示"},{value:0,label:"隐藏"}]} /></Form.Item>
      </Form>
    </Modal>
  </>;
}

function ContactSettings() {
  const {message}=AntApp.useApp();
  const result=useLoad<Row>(()=>rootApi("/api/admin/content/contact-settings"));
  const [form]=Form.useForm();
  useEffect(()=>{if(result.data)form.setFieldsValue(result.data);},[result.data,form]);
  const save=async()=>{try{
    const values=await form.validateFields();
    await rootMutation("/api/admin/content/contact-settings",{method:"PUT",body:JSON.stringify(values)});
    message.success("门户联系方式已保存");void result.refresh();
  }catch(error){if(error instanceof Error)message.error(error.message);}};
  const qr=Form.useWatch("wechatQr",form);
  return <Card className="settings-card" title="Web 门户悬浮联系方式" extra={<Button type="primary" onClick={()=>void save()}>保存配置</Button>}>
    <Form form={form} layout="vertical" className="settings-form">
      <section className="form-section"><header><strong>电话与邮箱</strong><span>用于 Web 端右侧悬浮联系栏</span></header><div className="form-grid">
        <Form.Item name="landline" label="座机" rules={[{required:true,message:"请输入座机号码"}]}><Input placeholder="例如：0531-86099058" /></Form.Item>
        <Form.Item name="mobile" label="手机" rules={[{required:true,message:"请输入手机号码"}]}><Input placeholder="例如：13105315957" /></Form.Item>
        <Form.Item className="form-span-2" name="email" label="邮箱" rules={[{required:true,message:"请输入邮箱"},{type:"email",message:"请输入有效的邮箱地址"}]}><Input placeholder="name@example.com" /></Form.Item>
      </div></section>
      <section className="form-section"><header><strong>微信二维码</strong><span>可直接上传，也可继续使用外部图片链接</span></header>
        <Form.Item name="wechatQr" label="图片链接" rules={[{required:true,message:"请上传图片或输入图片地址"}]}><Input placeholder="https://example.com/wechat-qr.png" /></Form.Item>
        <Form.Item label="上传二维码" extra="仅支持 JPG/PNG，1:1，300×300～2000×2000 像素；上传成功后会自动填入上方链接。"><ProductImageUpload kind="qr" value={qr} onChange={(value)=>form.setFieldValue("wechatQr",value)} /></Form.Item>
      </section>
    </Form>
  </Card>;
}

function HelpLinks() {
  const {message,modal}=AntApp.useApp();
  const rows=usePagedLoad("/api/admin/content/help-links",10);
  const articles=useLoad<Row[]>(()=>rootApi("/api/admin/content/content"));
  const [form]=Form.useForm();
  const [open,setOpen]=useState(false);
  const [editing,setEditing]=useState<Row>();
  const iconOptions=[{value:"SHIELD",label:"盾牌"},{value:"USER",label:"用户"},{value:"SERVICE",label:"服务"},{value:"DELIVERY",label:"配送"}];
  const show=(row?:Row)=>{setEditing(row);form.resetFields();form.setFieldsValue(row||{articleId:articles.data?.[0]?.id,icon:"SHIELD",sortOrder:0,status:1});setOpen(true);};
  const save=async()=>{try{const values=await form.validateFields();const response=await fetch(`/api/admin/content/help-links${editing?`/${editing.id}`:""}`,{
    method:editing?"PUT":"POST",headers:apiHeaders(),body:JSON.stringify(values),});if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.detail||"链接保存失败");}
    message.success("服务链接已保存");setOpen(false);void rows.refresh();}catch(error){if(error instanceof Error)message.error(error.message);}};
  const remove=(row:Row)=>modal.confirm({title:`删除链接“${row.title}”？`,okButtonProps:{danger:true},onOk:async()=>{
    await fetch(`/api/admin/content/help-links/${row.id}`,{method:"DELETE",headers:apiHeaders()});message.success("服务链接已删除");void rows.refresh();}});
  return <>
    <Card className="data-card" title="服务与帮助链接" extra={<Button type="primary" onClick={()=>show()}>＋ 新增链接</Button>}>
      <Table rowKey="id" loading={rows.loading} dataSource={rows.data} server={rows.server} searchPlaceholder="搜索链接标题或关联文章" columns={[
        {title:"链接标题",dataIndex:"title"},{title:"关联文章",dataIndex:"articleTitle"},{title:"文章链接",dataIndex:"articleLink",render:(value)=><Typography.Text copyable>{value}</Typography.Text>},
        {title:"图标",dataIndex:"icon",width:90,render:(value)=>iconOptions.find(item=>item.value===value)?.label||value},
        {title:"排序",dataIndex:"sortOrder",width:80},{title:"状态",dataIndex:"status",width:90,render:(value)=><Tag color={Number(value)===1?"green":"default"}>{Number(value)===1?"启用":"停用"}</Tag>},
        {title:"操作",width:150,render:(_,row)=><Space><Button type="link" onClick={()=>show(row)}>编辑</Button><Button type="link" danger onClick={()=>remove(row)}>删除</Button></Space>},
      ]}/>
    </Card>
    <Modal open={open} title={`${editing?"编辑":"新增"}服务链接`} onCancel={()=>setOpen(false)} onOk={()=>void save()}>
      <Form form={form} layout="vertical">
        <Form.Item name="title" label="链接标题" rules={[{required:true,message:"请输入链接标题"}]}><Input /></Form.Item>
        <Form.Item name="articleId" label="链接文章" rules={[{required:true,message:"请选择文章"}]}><Select showSearch optionFilterProp="label" options={(articles.data||[]).filter(row=>Number(row.status)===1).map(row=>({value:Number(row.id),label:`${row.title}${row.subtitle?` · ${row.subtitle}`:""}`}))} /></Form.Item>
        <Form.Item name="icon" label="图标" rules={[{required:true}]}><Select options={iconOptions} /></Form.Item>
        <Form.Item name="sortOrder" label="排序" rules={[{required:true}]}><InputNumber min={0} style={{width:"100%"}} /></Form.Item>
        <Form.Item name="status" label="状态" rules={[{required:true}]}><Select options={[{value:1,label:"启用"},{value:0,label:"停用"}]} /></Form.Item>
      </Form>
    </Modal>
  </>;
}

function Articles() {
  const {message,modal}=AntApp.useApp();
  const rows=usePagedLoad("/api/admin/content/content",10);
  const [form]=Form.useForm();
  const [open,setOpen]=useState(false);
  const [editing,setEditing]=useState<Row>();
  const show=(row?:Row)=>{setEditing(row);form.resetFields();form.setFieldsValue(row||{status:1});setOpen(true);};
  const save=async()=>{try{
    const values=await form.validateFields();
    const response=await fetch(`/api/admin/content/content${editing?`/${editing.id}`:""}`,{
      method:editing?"PUT":"POST",headers:apiHeaders(),body:JSON.stringify({...values,sortOrder:editing?.sortOrder||0}),
    });
    if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.detail||"文章保存失败");}
    message.success("文章已保存");setOpen(false);void rows.refresh();
  }catch(error){if(error instanceof Error)message.error(error.message);}};
  const remove=(row:Row)=>modal.confirm({title:`删除文章“${row.title}”？`,content:"已被门户楼层引用的文章将不再展示。",okButtonProps:{danger:true},onOk:async()=>{
    const response=await fetch(`/api/admin/content/content/${row.id}`,{method:"DELETE",headers:apiHeaders()});
    if(!response.ok)throw new Error("文章删除失败");message.success("文章已删除");void rows.refresh();
  }});
  return <>
    <Card className="data-card" title="文章列表" extra={<Button type="primary" onClick={()=>show()}>＋ 新增文章</Button>}>
      <Table rowKey="id" loading={rows.loading} dataSource={rows.data} server={rows.server} searchPlaceholder="搜索文章标题、副标题或正文"
        columns={[
          {title:"文章标题",render:(_,row)=><><strong>{row.title}</strong><small className="subline">{row.subtitle||"—"}</small></>},
          {title:"正文摘要",dataIndex:"description",ellipsis:true,render:(value)=>String(value||"").replace(/<[^>]+>/g,"").slice(0,100)||"—"},
          {title:"状态",dataIndex:"status",width:90,render:(value)=><Tag color={Number(value)===1?"green":"default"}>{Number(value)===1?"已发布":"未发布"}</Tag>},
          {title:"更新时间",dataIndex:"updatedAt",width:180,render:dateTime},
          {title:"操作",width:150,render:(_,row)=><Space><Button type="link" onClick={()=>show(row)}>编辑</Button><Button type="link" danger onClick={()=>remove(row)}>删除</Button></Space>},
        ]}/>
    </Card>
    <Modal open={open} title={`${editing?"编辑":"新增"}文章`} width={860} onCancel={()=>setOpen(false)} onOk={()=>void save()}>
      <Form form={form} layout="vertical">
        <Form.Item name="title" label="文章标题" rules={[{required:true,message:"请输入文章标题"}]}><Input /></Form.Item>
        <Form.Item name="subtitle" label="文章副标题"><Input /></Form.Item>
        <Form.Item name="description" label="富文本正文" rules={[{required:true,message:"请输入文章正文"}]}><RichTextEditor /></Form.Item>
        <Form.Item name="status" label="发布状态" rules={[{required:true}]}><Select options={[{value:1,label:"发布"},{value:0,label:"暂不发布"}]} /></Form.Item>
      </Form>
    </Modal>
  </>;
}

function AssociationProducts({type}:{type:"PLATFORM"|"AGREEMENT"|"SOLUTION"}) {
  const {message,modal}=AntApp.useApp();
  const labels={PLATFORM:"所属平台",AGREEMENT:"所属协议",SOLUTION:"所属方案"};
  const [targetFilter,setTargetFilter]=useState<number>();
  const endpoint=`/api/admin/business/product-associations?type=${type}${targetFilter?`&targetId=${targetFilter}`:""}`;
  const rows=usePagedLoad(endpoint,10,[type,targetFilter]);
  const targets=useLoad<Row[]>(()=>rootApi(type==="AGREEMENT"?"/api/admin/business/agreements":`/api/admin/content/${type==="PLATFORM"?"platform":"solution"}`),[type]);
  const [form]=Form.useForm();
  const [open,setOpen]=useState(false);
  const [editing,setEditing]=useState<Row>();
  const products=useLoad<Row[]>(()=>rootApi("/api/admin/business/products"),[],open&&!editing);
  const selectableSkus=expandProductSkus(products.data||[]).filter((row)=>Number(row.status)===1);
  const targetOptions=(targets.data||[]).filter((row)=>Number(row.status)!==0).map((row)=>({value:Number(row.id),label:type==="AGREEMENT"?`${row.name} · ${row.enterpriseName}`:row.title}));
  const request=async(path:string,init:RequestInit)=>{const response=await fetch(path,{...init,headers:{...apiHeaders(),...init.headers}});if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.detail||"操作失败");}};
  const show=(row?:Row)=>{setEditing(row);form.resetFields();form.setFieldsValue(row?{
    targetId:Number(row.targetId),skuId:Number(row.skuId),associationPrice:Number(row.associationPrice),productUrl:row.productUrl||"",relationStatus:Number(row.relationStatus),
    defaultQuantity:Number(row.defaultQuantity||1),requiredItem:Number(row.requiredItem??1),sortOrder:Number(row.sortOrder||0),
  }:{targetId:targetFilter||targetOptions[0]?.value,relationStatus:1,defaultQuantity:1,requiredItem:1,sortOrder:0});setOpen(true);};
  const relationPath=(row:Row,targetId=Number(row.targetId))=>type==="PLATFORM"?`/api/admin/content/platform/${targetId}/products/${row.relationId}`:type==="AGREEMENT"?`/api/admin/agreements/${targetId}/items/${row.relationId}`:`/api/admin/content/solution/${targetId}/products/${row.relationId}`;
  const save=async()=>{try{const values=await form.validateFields();const targetId=Number(values.targetId);let path:string;let body:Row;
    if(type==="PLATFORM"){path=editing?relationPath(editing,targetId):`/api/admin/content/platform/${targetId}/products`;body={skuId:Number(values.skuId),platformPrice:Number(values.associationPrice),productUrl:values.productUrl||"",listingStatus:Number(values.relationStatus)};}
    else if(type==="AGREEMENT"){path=editing?relationPath(editing,targetId):`/api/admin/agreements/${targetId}/items`;body={skuId:Number(values.skuId),agreementPrice:Number(values.associationPrice),status:Number(values.relationStatus)};}
    else{path=editing?relationPath(editing,targetId):`/api/admin/content/solution/${targetId}/products`;body={skuId:Number(values.skuId),defaultQuantity:Number(values.defaultQuantity),requiredItem:Number(values.requiredItem),sortOrder:Number(values.sortOrder)};}
    await request(path,{method:editing?"PUT":"POST",body:JSON.stringify(body)});message.success(editing?"关联已更新":"商品已加入");setOpen(false);void rows.refresh();
  }catch(error){if(error instanceof Error)message.error(error.message);}};
  const removeRows=(selected:Row[],clear?:()=>void)=>modal.confirm({title:`确认移除 ${selected.length} 条关联？`,okButtonProps:{danger:true},onOk:async()=>{await Promise.all(selected.map((row)=>request(relationPath(row),{method:"DELETE"})));message.success("关联已移除");clear?.();void rows.refresh();}});
  const updateStatus=async(selected:Row[],status:number,clear?:()=>void)=>{await Promise.all(selected.map((row)=>request(relationPath(row),{method:"PUT",body:JSON.stringify(type==="PLATFORM"?{skuId:Number(row.skuId),platformPrice:Number(row.associationPrice),productUrl:row.productUrl||"",listingStatus:status}:{agreementPrice:Number(row.associationPrice),status})})));message.success(status?"已批量启用/上架":"已批量停用/下架");clear?.();void rows.refresh();};
  const statusOptions=type==="PLATFORM"?[{label:"已上架",value:"1"},{label:"已下架",value:"0"}]:type==="AGREEMENT"?[{label:"已启用",value:"1"},{label:"已停用",value:"0"}]:undefined;
  const associationBadge=(row:Row)=>row.badgeType==="AGREEMENT"?"协议专属":row.badgeType==="CUSTOM"?(row.customBadge||"自定义"):row.badgeType==="PLATFORM"?`${row.badgePlatformPrefix||"平台"}平台`:"自动";
  const associationNameCell=(value:unknown)=>{
    const text=String(value||"");
    if(type!=="AGREEMENT")return <Tag className="association-name-tag" color={type==="PLATFORM"?"blue":"purple"}>{text}</Tag>;
    const matched=text.match(/^(.*)（([^（）]+)）$/);
    return <div className="association-target-cell"><strong>{matched?.[1]||text}</strong>{matched?.[2]&&<small>{matched[2]}</small>}</div>;
  };
  return <><Card className="data-card association-products-card" title={`商品列表 · ${labels[type]}`} extra={<Button type="primary" onClick={()=>show()}>＋ 加入商品</Button>}>
    <Table size="small" rowKey="relationId" loading={rows.loading} dataSource={rows.data} server={{...rows.server,statusOptions}}
      searchPlaceholder={`搜索商品名称、SPU、SKU或${labels[type]}`}
      toolbarExtra={<Select allowClear showSearch optionFilterProp="label" value={targetFilter} onChange={(value)=>setTargetFilter(value)} placeholder={`全部${labels[type].slice(2)}`} style={{width:190}} options={targetOptions}/>} scroll={{x:type==="PLATFORM"?1450:1260}}
      selectionActions={(selected,clear)=><><Button disabled={!selected.length} danger onClick={()=>removeRows(selected,clear)}>批量移除</Button>{type!=="SOLUTION"&&<><Button disabled={!selected.length} onClick={()=>void updateStatus(selected,1,clear)}>{type==="PLATFORM"?"批量上架":"批量启用"}</Button><Button disabled={!selected.length} onClick={()=>void updateStatus(selected,0,clear)}>{type==="PLATFORM"?"批量下架":"批量停用"}</Button></>}</>}
      columns={[
        {title:"商品信息",width:360,render:(_,row)=><div className="user-cell association-product-info">
          <span className="solution-admin-cover"><i>{row.title?.slice(0,1)||"商"}</i>{row.mainImage&&<img src={row.mainImage} alt={row.title} />}</span>
          <span><strong>{row.title}</strong><small>{row.spuCode} · {row.skuCode}</small></span>
        </div>},
        {title:"价格",width:130,render:(_,row)=><div className="product-price-cell"><strong>市场价 ¥{Number(row.marketPrice||0).toFixed(2)}</strong><small>会员价 ¥{Number(row.memberPrice||0).toFixed(2)}</small></div>},
        {title:"经营类型",width:90,render:(_,row)=><Tag color={Number(row.selfOperated)===1?"blue":"default"}>{Number(row.selfOperated)===1?"自营":"非自营"}</Tag>},
        {title:"商品角标",width:100,render:(_,row)=><Tag>{associationBadge(row)}</Tag>},
        {title:"可售库存",dataIndex:"availableStock",width:90},
        {title:labels[type],dataIndex:"associationName",width:type==="AGREEMENT"?250:180,render:associationNameCell},
        {title:type==="AGREEMENT"?"协议价":type==="PLATFORM"?"平台价":"默认数量",width:100,render:(_,row)=>type==="SOLUTION"?`${row.defaultQuantity} 件`:`¥${Number(row.associationPrice||0).toFixed(2)}`},
        ...(type==="PLATFORM"?[{title:"平台链接",dataIndex:"productUrl",width:180,render:(value:string)=>value?<Typography.Text copyable={{text:value}} ellipsis={{tooltip:value}}><a href={value} target="_blank" rel="noreferrer" onClick={(event)=>event.stopPropagation()}>复制 / 打开链接</a></Typography.Text>:<Typography.Text type="secondary">未填写</Typography.Text>}]:[]),
        ...(type==="PLATFORM"?[{title:"点击",dataIndex:"clickCount",width:65}]:[]),
        {title:"状态",dataIndex:"relationStatus",width:78,render:(value)=><Tag color={Number(value)===1?"green":"default"}>{type==="PLATFORM"?(Number(value)===1?"上架":"下架"):type==="AGREEMENT"?(Number(value)===1?"启用":"停用"):"关联"}</Tag>},
        {title:"操作",width:130,fixed:"right",render:(_,row)=><div className="association-row-actions"><Button type="link" size="small" onClick={()=>show(row)}>编辑</Button>{type!=="SOLUTION"&&<Button type="link" size="small" onClick={()=>void updateStatus([row],Number(row.relationStatus)===1?0:1)}>{Number(row.relationStatus)===1?(type==="PLATFORM"?"下架":"停用"):(type==="PLATFORM"?"上架":"启用")}</Button>}<Button type="link" size="small" danger onClick={()=>removeRows([row])}>移除</Button></div>},
      ]} />
  </Card>
  <Modal open={open} title={`${editing?"编辑关联":"加入商品"} · ${labels[type]}`} onCancel={()=>setOpen(false)} onOk={()=>void save()}>
    <Form form={form} layout="vertical"><Form.Item name="targetId" label={labels[type]} rules={[{required:true}]}><Select disabled={Boolean(editing)} showSearch optionFilterProp="label" options={targetOptions}/></Form.Item>
      <Form.Item name="skuId" label="商品 SKU" rules={[{required:!editing,message:"请选择商品 SKU"}]}><Select disabled={Boolean(editing)} loading={products.loading} showSearch optionFilterProp="label" options={selectableSkus.map((row)=>({value:Number(row.id||row.skuId),label:`${row.title} · ${row.skuCode}`}))}/></Form.Item>
      {type!=="SOLUTION"&&<Form.Item name="associationPrice" label={type==="PLATFORM"?"平台售价":"协议价格"} rules={[{required:true}]}><InputNumber min={0} precision={2} style={{width:"100%"}}/></Form.Item>}
      {type==="PLATFORM"&&<Form.Item name="productUrl" label="商品链接"><Input/></Form.Item>}
      {type!=="SOLUTION"&&<Form.Item name="relationStatus" label="关联状态" rules={[{required:true}]}><Select options={type==="PLATFORM"?[{value:1,label:"上架"},{value:0,label:"下架"}]:[{value:1,label:"启用"},{value:0,label:"停用"}]}/></Form.Item>}
      {type==="SOLUTION"&&<><Form.Item name="defaultQuantity" label="默认数量" rules={[{required:true}]}><InputNumber min={1} style={{width:"100%"}}/></Form.Item><Form.Item name="requiredItem" label="选择规则"><Select options={[{value:1,label:"必选商品"},{value:0,label:"可选商品"}]}/></Form.Item><Form.Item name="sortOrder" label="排序"><InputNumber min={0} style={{width:"100%"}}/></Form.Item></>}
    </Form>
  </Modal></>;
}

function HomeAds(){
  const {message,modal}=AntApp.useApp();const rows=usePagedLoad("/api/admin/content/home-ads",10);const floors=useLoad<Row[]>(()=>rootApi("/api/admin/content/home-floors?page=1&pageSize=100")).data as any;
  const floorRows=Array.isArray(floors)?floors:(floors?.records||floors?.content||[]);const [form]=Form.useForm();const [itemForm]=Form.useForm();const [open,setOpen]=useState(false);const [editing,setEditing]=useState<Row>();const [group,setGroup]=useState<Row>();const [items,setItems]=useState<Row[]>([]);const [itemsOpen,setItemsOpen]=useState(false);const [itemEditing,setItemEditing]=useState<Row>();const [itemEditorOpen,setItemEditorOpen]=useState(false);
  const layouts:Row={FULL:"通栏横幅",DOUBLE:"双栏专区",TRIPLE:"三栏专区",GRID4:"四宫格",FEATURED:"左大右小",CAROUSEL:"轮播广告"};
  const placements:Row={TOP:"首页顶部",BEFORE_FLOOR:"指定楼层之前",AFTER_FLOOR:"指定楼层之后",BOTTOM:"首页底部"};
  const show=(row?:Row)=>{setEditing(row);form.resetFields();form.setFieldsValue(row||{layoutType:"DOUBLE",placement:"TOP",targetScope:"ALL",sortOrder:10,status:1,anchorFloorId:null,startsAt:null,endsAt:null});setOpen(true);};
  const save=async()=>{try{const v=await form.validateFields();await rootMutation(`/api/admin/content/home-ads${editing?`/${editing.id}`:""}`,{method:editing?"PUT":"POST",body:JSON.stringify({...v,anchorFloorId:v.anchorFloorId||null,startsAt:v.startsAt||null,endsAt:v.endsAt||null})});message.success("广告组已保存");setOpen(false);void rows.refresh();}catch(e){message.error((e as Error).message)}};
  const manage=async(row:Row)=>{setGroup(row);setItemsOpen(true);setItems(await rootApi<Row[]>(`/api/admin/content/home-ads/${row.id}/items`));};
  const showItem=(row?:Row)=>{setItemEditing(row);itemForm.resetFields();itemForm.setFieldsValue(row||{title:"",openTarget:"SELF",sortOrder:items.length*10+10,status:1});setItemEditorOpen(true);};
  const saveItem=async()=>{try{const v=await itemForm.validateFields();await rootMutation(`/api/admin/content/home-ads/${group!.id}/items${itemEditing?`/${itemEditing.id}`:""}`,{method:itemEditing?"PUT":"POST",body:JSON.stringify({...v,h5ImageUrl:v.h5ImageUrl||null,linkUrl:v.linkUrl||null})});message.success("广告图片已保存");setItemEditorOpen(false);await manage(group!);}catch(e){message.error((e as Error).message)}};
  const removeItem=(row:Row)=>modal.confirm({title:"移除该广告图片？",okButtonProps:{danger:true},onOk:async()=>{await rootMutation(`/api/admin/content/home-ads/${group!.id}/items/${row.id}`,{method:"DELETE"});await manage(group!);}});
  const remove=(row:Row)=>modal.confirm({title:`删除广告组“${row.name}”？`,okButtonProps:{danger:true},onOk:async()=>{await rootMutation(`/api/admin/content/home-ads/${row.id}`,{method:"DELETE"});void rows.refresh();}});
  return <><Card className="data-card" title="首页广告组" extra={<Button type="primary" onClick={()=>show()}>＋ 新增广告组</Button>}><Table rowKey="id" loading={rows.loading} dataSource={rows.data} server={{...rows.server,statusOptions:[{label:"启用",value:"1"},{label:"停用",value:"0"}]}} searchPlaceholder="搜索广告组名称、版式或位置" columns={[
    {title:"广告组",render:(_,r)=><><strong>{r.name}</strong><small className="subline">{layouts[r.layoutType]} · {r.itemCount} 张图片</small></>},{title:"插入位置",render:(_,r)=>`${placements[r.placement]||r.placement}${r.anchorFloorId?` · 楼层 #${r.anchorFloorId}`:""}`},{title:"显示端",dataIndex:"targetScope",render:v=>({ALL:"Web + H5",WEB:"Web",H5:"H5"} as Row)[v]},{title:"排序",dataIndex:"sortOrder",width:80},{title:"状态",dataIndex:"status",width:90,render:v=><Tag color={Number(v)===1?"green":"default"}>{Number(v)===1?"启用":"停用"}</Tag>},{title:"操作",width:210,render:(_,r)=><Space><Button type="link" onClick={()=>void manage(r)}>广告项</Button><Button type="link" onClick={()=>show(r)}>编辑</Button><Button type="link" danger onClick={()=>remove(r)}>删除</Button></Space>}
  ]}/></Card>
  <Modal open={open} title={`${editing?"编辑":"新增"}广告组`} width={760} onCancel={()=>setOpen(false)} onOk={()=>void save()}><Form form={form} layout="vertical" className="two-column-form"><Form.Item name="name" label="广告组名称" rules={[{required:true}]}><Input/></Form.Item><Form.Item name="layoutType" label="展示版式" rules={[{required:true}]}><Select options={Object.entries(layouts).map(([value,label])=>({value,label}))}/></Form.Item><Form.Item name="placement" label="插入位置" rules={[{required:true}]}><Select options={Object.entries(placements).map(([value,label])=>({value,label}))}/></Form.Item><Form.Item noStyle shouldUpdate={(a,b)=>a.placement!==b.placement}>{({getFieldValue})=>["BEFORE_FLOOR","AFTER_FLOOR"].includes(getFieldValue("placement"))?<Form.Item name="anchorFloorId" label="指定楼层" rules={[{required:true}]}><Select options={(floorRows||[]).map((r:Row)=>({value:Number(r.id),label:r.title}))}/></Form.Item>:<span/>}</Form.Item><Form.Item name="targetScope" label="显示端"><Select options={[{value:"ALL",label:"Web + H5"},{value:"WEB",label:"仅 Web"},{value:"H5",label:"仅 H5"}]}/></Form.Item><Form.Item name="sortOrder" label="排序"><InputNumber min={0} style={{width:"100%"}}/></Form.Item><Form.Item name="startsAt" label="生效时间"><Input type="datetime-local"/></Form.Item><Form.Item name="endsAt" label="失效时间"><Input type="datetime-local"/></Form.Item><Form.Item name="status" label="状态"><Select options={[{value:1,label:"启用"},{value:0,label:"停用"}]}/></Form.Item></Form></Modal>
  <Modal open={itemsOpen} title={`${group?.name||""} · 广告项`} width={900} footer={null} onCancel={()=>setItemsOpen(false)}><div style={{textAlign:"right",marginBottom:12}}><Button type="primary" onClick={()=>showItem()}>＋ 添加图片</Button></div><Table rowKey="id" pagination={false} dataSource={items} columns={[{title:"图片",width:160,render:(_,r)=><img src={r.webImageUrl} alt={r.title} style={{width:130,height:60,objectFit:"cover",borderRadius:6}}/>},{title:"标题",dataIndex:"title"},{title:"链接",dataIndex:"linkUrl",render:v=>v||"—"},{title:"打开方式",dataIndex:"openTarget",render:v=>v==="BLANK"?"新页面":"当前页面"},{title:"排序",dataIndex:"sortOrder",width:70},{title:"状态",dataIndex:"status",width:70,render:v=>Number(v)===1?"显示":"隐藏"},{title:"操作",width:130,render:(_,r)=><Space><Button type="link" onClick={()=>showItem(r)}>编辑</Button><Button type="link" danger onClick={()=>removeItem(r)}>移除</Button></Space>}]} /></Modal>
  <Modal open={itemEditorOpen} title={`${itemEditing?"编辑":"新增"}广告项`} width={760} onCancel={()=>setItemEditorOpen(false)} onOk={()=>void saveItem()}><Form form={itemForm} layout="vertical" className="two-column-form"><Form.Item name="title" label="广告标题"><Input/></Form.Item><Form.Item name="linkUrl" label="跳转链接"><Input placeholder="站内路径或完整网址"/></Form.Item><Form.Item name="webImageUrl" label="Web 图片" className="full" rules={[{required:true,message:"请上传 Web 图片"}]}><ProductImageUpload kind="adWeb"/></Form.Item><Form.Item name="h5ImageUrl" label="H5 图片（不填则使用 Web 图片）" className="full"><ProductImageUpload kind="adH5"/></Form.Item><Form.Item name="openTarget" label="打开方式"><Select options={[{value:"SELF",label:"当前页面"},{value:"BLANK",label:"新页面"}]}/></Form.Item><Form.Item name="sortOrder" label="排序"><InputNumber min={0} style={{width:"100%"}}/></Form.Item><Form.Item name="status" label="状态"><Select options={[{value:1,label:"显示"},{value:0,label:"隐藏"}]}/></Form.Item></Form></Modal></>;
}

function HomeFloors() {
  const { message } = AntApp.useApp();
  const rows = usePagedLoad("/api/admin/content/home-floors", 10);
  const products = useLoad<Row[]>(() => rootApi("/api/admin/business/products"));
  const categories = useLoad<Row[]>(() => rootApi("/api/admin/business/categories"));
  const brands = useLoad<Row[]>(() => rootApi("/api/admin/content/brands/list"));
  const platforms = useLoad<Row[]>(() => rootApi("/api/admin/content/platform"));
  const articles = useLoad<Row[]>(() => rootApi("/api/admin/content/content"));
  const selectableSkus = expandProductSkus(products.data || []).filter((row) => Number(row.status) === 1);
  const [form] = Form.useForm();
  const [itemForm] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row>();
  const [floor, setFloor] = useState<Row>();
  const [items, setItems] = useState<Row[]>([]);
  const [itemsOpen, setItemsOpen] = useState(false);
  const selectionRule = Form.useWatch("selectionRule", form);
  const contentType = Form.useWatch("contentType", form);
  const show = async (row?: Row) => {
    setEditing(row);
    form.resetFields();
    form.setFieldsValue(row || { contentType: "PRODUCT", selectionRule: "LATEST", displayCount: 4, targetScope: "ALL", sortOrder: 0, status: 1 });
    setOpen(true);
    if(row?.selectionRule === "MANUAL") {
      try {
        const selected=await rootApi<Row[]>(`/api/admin/content/home-floors/${row.id}/items`);
        form.setFieldValue("contentIds",selected.map((item)=>Number(item.contentId)));
      } catch (error) { message.error((error as Error).message); }
    }
  };
  const save = async () => {
    try {
      const values = await form.validateFields();
      const response = await fetch(`/api/admin/content/home-floors${editing ? `/${editing.id}` : ""}`, {
        method: editing ? "PUT" : "POST", headers: apiHeaders(), body: JSON.stringify(values),
      });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.detail || "楼层保存失败"); }
      setOpen(false); message.success("首页楼层已保存"); void rows.refresh();
    } catch (error) { if (error instanceof Error) message.error(error.message); }
  };
  const manageItems = async (row: Row) => {
    setFloor(row); setItemsOpen(true); itemForm.resetFields();
    const result = await rootApi<Row[]>(`/api/admin/content/home-floors/${row.id}/items`); setItems(result);
  };
  const addItem = async () => {
    try {
      const values = await itemForm.validateFields();
      const response = await fetch(`/api/admin/content/home-floors/${floor!.id}/items`, { method: "POST", headers: apiHeaders(), body: JSON.stringify({...values,sortOrder:items.length}) });
      if (!response.ok) throw new Error("内容添加失败");
      await manageItems(floor!); itemForm.resetFields(); message.success("楼层内容已添加");
    } catch (error) { if (error instanceof Error) message.error(error.message); }
  };
  const removeItem = async (row: Row) => {
    await fetch(`/api/admin/content/home-floors/${floor!.id}/items/${row.id}`, { method: "DELETE", headers: apiHeaders() });
    await manageItems(floor!); message.success("已从楼层移除");
  };
  const moveItem = async (index:number,direction:-1|1) => {
    const target=index+direction;
    if(target<0||target>=items.length)return;
    const ordered=[...items];
    [ordered[index],ordered[target]]=[ordered[target],ordered[index]];
    try{
      await Promise.all(ordered.map((item,position)=>rootMutation(`/api/admin/content/home-floors/${floor!.id}/items`,{method:"POST",body:JSON.stringify({contentId:Number(item.contentId),sortOrder:position})})));
      setItems(ordered.map((item,position)=>({...item,sortOrder:position})));
      message.success("展示顺序已更新");
    }catch(error){message.error((error as Error).message);}
  };
  const typeLabels: Record<string,string> = { PRODUCT: "商品", SOLUTION: "方案", CATEGORY: "分类", CONTENT: "文章" };
  const ruleLabels: Record<string,string> = { MANUAL: "手动选择", LATEST: "最新上架", SALES: "销量排行", VIEWS: "浏览排行", CATEGORY: "指定分类", BRAND: "指定品牌", PLATFORM: "指定平台", AGREEMENT: "协议商品" };
  return <>
    <Card className="data-card" title="首页楼层列表" extra={<Button type="primary" onClick={() => void show()}>＋ 新增楼层</Button>}>
      <Table rowKey="id" loading={rows.loading} dataSource={rows.data} server={rows.server} searchPlaceholder="搜索楼层名称、副标题或选品规则" columns={[
        { title: "楼层", render: (_, row) => <><strong>{row.title}</strong><small className="subline">{row.subtitle || "—"}</small></> },
        { title: "内容", render: (_, row) => `${typeLabels[row.contentType] || row.contentType} · ${ruleLabels[row.selectionRule] || row.selectionRule}` },
        { title: "数量", dataIndex: "displayCount", width: 80 },
        { title: "展示端", dataIndex: "targetScope", width: 90, render: (v) => ({ALL:"Web + H5",WEB:"Web",H5:"H5"} as Row)[v] || v },
        { title: "排序", dataIndex: "sortOrder", width: 80 },
        { title: "状态", dataIndex: "status", width: 90, render: (v) => <Tag color={Number(v)===1?"green":"default"}>{Number(v)===1?"启用":"停用"}</Tag> },
        { title: "操作", width: 210, render: (_, row) => <Space>{row.selectionRule === "MANUAL" && <Button type="link" onClick={() => void manageItems(row)}>内容管理</Button>}<Button type="link" onClick={() => void show(row)}>编辑</Button></Space> },
      ]} />
    </Card>
    <Modal open={open} title={`${editing?"编辑":"新增"}首页楼层`} width={720} onCancel={() => setOpen(false)} onOk={() => void save()}>
      <Form form={form} layout="vertical" className="two-column-form">
        <Form.Item name="title" label="楼层名称" rules={[{required:true}]}><Input placeholder="例如：最新上架" /></Form.Item>
        <Form.Item name="subtitle" label="楼层副标题"><Input /></Form.Item>
        <Form.Item name="contentType" label="内容类型" rules={[{required:true}]}><Select options={Object.entries(typeLabels).map(([value,label])=>({value,label}))} /></Form.Item>
        <Form.Item name="selectionRule" label="选取规则" rules={[{required:true}]}><Select options={Object.entries(ruleLabels).filter(([value])=>contentType==="PRODUCT"||["MANUAL","LATEST"].includes(value)).map(([value,label])=>({value,label}))} /></Form.Item>
        {selectionRule === "MANUAL" && ["PRODUCT","CONTENT"].includes(contentType) && <Form.Item name="contentIds" label={contentType==="PRODUCT"?"楼层商品":"楼层文章"} className="full" rules={[{required:true,type:"array",min:1,message:`请至少选择一${contentType==="PRODUCT"?"个商品":"篇文章"}`}]} extra="已选顺序即楼层展示顺序。">
          <Select mode="multiple" showSearch optionFilterProp="label" placeholder="搜索并选择商品 SKU" maxTagCount="responsive"
            options={(contentType==="PRODUCT"?selectableSkus:articles.data||[]).filter((row)=>Number(row.status)===1).map((row)=>({value:Number(row.id||row.skuId),label:contentType==="PRODUCT"?`${row.title} · ${row.skuCode}`:`${row.title}${row.subtitle?` · ${row.subtitle}`:""}`}))} />
        </Form.Item>}
        {["CATEGORY","BRAND","PLATFORM"].includes(selectionRule) && <Form.Item name="referenceId" label={selectionRule==="CATEGORY"?"指定分类":selectionRule==="BRAND"?"指定品牌":"指定平台"} rules={[{required:true}]}><Select showSearch optionFilterProp="label" placeholder="请选择" options={(selectionRule==="CATEGORY"?categories.data||[]:selectionRule==="BRAND"?brands.data||[]:platforms.data||[]).map(row=>({value:Number(row.id),label:selectionRule==="CATEGORY"?`${"　".repeat(Math.max(0,Number(row.level)-1))}${row.name}`:row.name||row.title}))} /></Form.Item>}
        <Form.Item name="displayCount" label="展示数量" rules={[{required:true}]}><InputNumber min={1} max={50} style={{width:"100%"}} /></Form.Item>
        <Form.Item name="targetScope" label="展示端" rules={[{required:true}]}><Select options={[{value:"ALL",label:"Web + H5"},{value:"WEB",label:"仅 Web"},{value:"H5",label:"仅 H5"}]} /></Form.Item>
        <Form.Item name="linkUrl" label="查看全部跳转链接" className="full"><Input placeholder="/web/products" /></Form.Item>
        <Form.Item name="sortOrder" label="楼层排序"><InputNumber min={0} style={{width:"100%"}} /></Form.Item>
        <Form.Item name="status" label="状态"><Select options={[{value:1,label:"启用"},{value:0,label:"停用"}]} /></Form.Item>
      </Form>
    </Modal>
    <Modal open={itemsOpen} title={`${floor?.title||""} · 内容管理`} width={860} footer={null} className="floor-items-modal" onCancel={() => setItemsOpen(false)}>
      <Form form={itemForm} className="floor-item-add-form">
        <Form.Item name="contentId" label="添加楼层内容" rules={[{required:true,message:"请选择或输入内容"}]}>
          {floor?.contentType==="PRODUCT"
            ? <Select showSearch optionFilterProp="label" placeholder="输入商品名称或 SKU 搜索并选择" options={selectableSkus.map(row=>({value:Number(row.id||row.skuId),label:`${row.title} · ${row.skuCode}`}))} />
            : floor?.contentType==="CONTENT"
              ? <Select showSearch optionFilterProp="label" placeholder="输入文章标题搜索并选择" options={(articles.data||[]).filter(row=>Number(row.status)===1).map(row=>({value:Number(row.id),label:`${row.title}${row.subtitle?` · ${row.subtitle}`:""}`}))} />
            : <InputNumber min={1} style={{width:"100%"}} placeholder="输入方案、分类或文章 ID" />}
        </Form.Item>
        <Button type="primary" onClick={() => void addItem()}>添加</Button>
      </Form>
      <div className="floor-items-table"><Table rowKey="id" pagination={false} dataSource={items} columns={[{title:"内容",render:(_,row)=><><strong>{row.title||`内容 #${row.contentId}`}</strong><small className="subline">{row.subtitle}</small></>},{title:"展示顺序",width:150,render:(_,row,index)=><Space size={4}><Button className="sort-arrow-button" disabled={index===0} onClick={()=>void moveItem(index,-1)} title="上移">↑</Button><Button className="sort-arrow-button" disabled={index===items.length-1} onClick={()=>void moveItem(index,1)} title="下移">↓</Button><Typography.Text type="secondary">第 {index+1} 位</Typography.Text></Space>},{title:"操作",width:90,render:(_,row)=><Button type="link" danger onClick={()=>void removeItem(row)}>移除</Button>}]} /></div>
    </Modal>
  </>;
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
          title: "价格显示",
          dataIndex: "pricePrefix",
          width: 120,
          render: (value: string, row: Row) => `${value || row.title || "平台"}价`,
        }, {
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
          {module === "platforms" && (
            <Form.Item
              name="pricePrefix"
              label="价格显示前缀"
              className="full"
              extra="例如填写“国网”，Web/H5 平台商品列表显示“国网价”；留空时按平台名称自动生成。"
            >
              <Input maxLength={30} placeholder="例如：国网、军采、京东" suffix="价" />
            </Form.Item>
          )}
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
          {module === "navigations" && (
            <Form.Item label="内置页面" className="full" extra="“我的协议商品”仅对已登录且存在生效协议的企业账号显示。">
              <Select
                allowClear
                placeholder="选择后自动填充跳转链接"
                onChange={(value) => value && form.setFieldValue("linkUrl", value)}
                options={[
                  { value: "/web/", label: "首页" },
                  { value: "/web/products", label: "办公集采" },
                  { value: "/web/agreement-products", label: "我的协议商品（按协议状态自动显隐）" },
                  { value: "/web/solutions", label: "场景方案" },
                  { value: "/web/platforms", label: "平台比价" },
                ]}
              />
            </Form.Item>
          )}
          {!isBrand && (
            <Form.Item name="linkUrl" label="跳转链接" className="full">
              <Input placeholder="/web/products 或 https://..." />
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

function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = [], enabled = true) {
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
    if(!enabled){setLoading(false);return;}
    void refresh();
  }, [enabled,...deps]);
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
  const load = async (quiet = false) => {
    if (!quiet) setLoading(true);
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
    } catch (error) {
      if (!quiet) message.error((error as Error).message);
    }
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
  return { data, total, loading, server, refresh: async () => setRevision((value) => value + 1), refreshQuiet: () => load(true) };
}

function CollectJobs() {
  const { message } = AntApp.useApp();
  const rows = usePagedLoad("/api/admin/business/products/collect-jobs", 10);
  const [detail, setDetail] = useState<Row>();
  const [retryingId, setRetryingId] = useState<number>();
  const refreshRef = useRef<() => Promise<void> | void>(rows.refreshQuiet);
  refreshRef.current = rows.refreshQuiet;
  const runningKey = rows.data.map((row) => `${row.id}:${row.status}:${row.finishedCount}`).join("|");
  useEffect(() => {
    const running = rows.data.some((row) => ["PENDING", "RUNNING"].includes(String(row.status)));
    if (!running) return;
    const timer = window.setInterval(() => void refreshRef.current(), 4000);
    return () => window.clearInterval(timer);
  }, [runningKey]);
  const openDetail = async (row: Row) => {
    try {
      setDetail(await rootApi<Row>(`/api/admin/business/products/collect-jobs/${row.id}`));
    } catch (error) {
      message.error((error as Error).message);
    }
  };
  const retryFailed = (row: Row) => {
    const failed = Number(row.failCount || (row.status === "FAILED" ? 1 : 0));
    Modal.confirm({
      title: `重试采集任务 #${row.id}`,
      content: row.mode === "BATCH"
        ? `将重试批量任务中的 ${failed} 个失败项，每个失败项最多尝试 3 次。成功和已跳过的项目不会重复采集。`
        : "将重新采集该失败任务，最多尝试 3 次。",
      okText: "开始重试",
      cancelText: "取消",
      onOk: async () => {
        setRetryingId(Number(row.id));
        try {
          await rootMutation(`/api/admin/business/products/collect-jobs/${row.id}/retry`, { method: "POST" });
          message.success("失败项已重新加入采集队列");
          await rows.refreshQuiet();
          if (detail?.id === row.id) {
            setDetail(await rootApi<Row>(`/api/admin/business/products/collect-jobs/${row.id}`));
          }
        } catch (error) {
          message.error((error as Error).message || "重试任务失败");
          throw error;
        } finally {
          setRetryingId(undefined);
        }
      },
    });
  };
  useEffect(() => {
    if (!detail?.id || !["PENDING", "RUNNING"].includes(String(detail.status))) return;
    const timer = window.setInterval(async () => {
      try {
        const next = await rootApi<Row>(`/api/admin/business/products/collect-jobs/${detail.id}`);
        setDetail(next);
        void refreshRef.current();
      } catch {
        // keep the last known detail while polling
      }
    }, 4000);
    return () => window.clearInterval(timer);
  }, [detail?.id, detail?.status]);
  const jobStatus = collectJobStatus(detail?.status);
  return (
    <>
      <Card className="data-card" title="采集任务">
        <Table
          rowKey="id"
          loading={rows.loading}
          dataSource={rows.data}
          searchPlaceholder="搜索任务编号、平台、链接或创建人"
          scroll={{ x: 1480 }}
          server={{
            ...rows.server,
            statusOptions: [
              { label: "排队中", value: "PENDING" },
              { label: "采集中", value: "RUNNING" },
              { label: "已完成", value: "SUCCEEDED" },
              { label: "部分完成", value: "PARTIAL" },
              { label: "失败", value: "FAILED" },
            ],
          }}
          columns={[
            { title: "任务", dataIndex: "id", width: 90, render: (value: number) => `#${value}` },
            { title: "平台", dataIndex: "platform", width: 110, render: (value: string) => collectPlatformLabel(value) },
            { title: "类型", dataIndex: "mode", width: 110, render: (value: string) => value === "BATCH" ? "批量采集" : "单条采集" },
            {
              title: "状态",
              dataIndex: "status",
              width: 120,
              render: (value: string) => {
                const item = collectJobStatus(value);
                return <Tag color={item.color}>{item.label}</Tag>;
              },
            },
            {
              title: "进度",
              width: 220,
              render: (_: unknown, row: Row) => row.mode === "BATCH" ? (
                <div>
                  <Progress percent={Number(row.progress || 0)} size="small"
                    format={() => `${row.finishedCount || 0}/${row.totalCount || 0}`} />
                  <small>成功 {row.successCount || 0} · 失败 {row.failCount || 0} · 跳过 {row.skipCount || 0}</small>
                </div>
              ) : "—",
            },
            { title: "创建人", dataIndex: "createdBy", width: 120, render: (value: string) => value || "—" },
            { title: "开始时间", dataIndex: "startedAt", width: 170, render: dateTime },
            { title: "完成时间", dataIndex: "finishedAt", width: 170, render: dateTime },
            { title: "创建时间", dataIndex: "createdAt", width: 170, render: dateTime },
            {
              title: "操作",
              width: 150,
              render: (_: unknown, row: Row) => (
                <Space size={0}>
                  <Button type="link" onClick={() => void openDetail(row)}>
                    {row.mode === "BATCH" ? "详情" : "查看"}
                  </Button>
                  {Number(row.failCount || 0) > 0 && !["PENDING", "RUNNING"].includes(String(row.status)) && (
                    <Button type="link" loading={retryingId === Number(row.id)} onClick={() => retryFailed(row)}>重试</Button>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>
      <Drawer
        title={detail ? `采集任务 #${detail.id}` : "采集任务详情"}
        width={880}
        open={Boolean(detail)}
        onClose={() => setDetail(undefined)}
        extra={detail && Number(detail.failCount || 0) > 0 && !["PENDING", "RUNNING"].includes(String(detail.status)) ? (
          <Button type="primary" loading={retryingId === Number(detail.id)} onClick={() => retryFailed(detail)}>
            重试失败项
          </Button>
        ) : null}
      >
        {detail && (
          <>
            <Descriptions size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="平台">{collectPlatformLabel(String(detail.platform))}</Descriptions.Item>
              <Descriptions.Item label="类型">{detail.mode === "BATCH" ? "批量采集" : "单条采集"}</Descriptions.Item>
              <Descriptions.Item label="状态"><Tag color={jobStatus.color}>{jobStatus.label}</Tag></Descriptions.Item>
              <Descriptions.Item label="进度">{detail.finishedCount || 0}/{detail.totalCount || 0}</Descriptions.Item>
              <Descriptions.Item label="开始时间">{dateTime(String(detail.startedAt || ""))}</Descriptions.Item>
              <Descriptions.Item label="完成时间">{dateTime(String(detail.finishedAt || ""))}</Descriptions.Item>
            </Descriptions>
            {detail.mode === "BATCH" && (
              <Progress percent={Number(detail.progress || 0)} style={{ marginBottom: 16 }}
                format={() => `成功 ${detail.successCount || 0} / 失败 ${detail.failCount || 0} / 跳过 ${detail.skipCount || 0}`} />
            )}
            <AntTable
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={detail.items || []}
              columns={[
                { title: "平台", width: 90, dataIndex: "platform", render: (value: string) => collectPlatformLabel(value) },
                { title: "商品链接", dataIndex: "url", ellipsis: true, render: (value: string) => <Typography.Text copyable={{ text: value }}>{value}</Typography.Text> },
                {
                  title: "状态",
                  width: 220,
                  render: (_: unknown, row: Row) => {
                    const item = collectItemStatus(String(row.status));
                    return (
                      <div>
                        <Tag color={item.color}>{item.label}</Tag>
                        {row.errorMessage && <small className="subline">{row.errorMessage}</small>}
                      </div>
                    );
                  },
                },
                { title: "开始时间", dataIndex: "startedAt", width: 160, render: dateTime },
                { title: "完成时间", dataIndex: "finishedAt", width: 160, render: dateTime },
              ]}
            />
          </>
        )}
      </Drawer>
    </>
  );
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
          if(r.groupName==="商品模板")return a;
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
              key:"product-services",label:"商品服务",children:<ProductServiceOptions />,
            },
            {
              key:"delivery-templates",label:"配送模板",children:<ProductTemplateSettings config={(result.data||[]).find((row)=>row.configKey==="product.deliveryTemplates")} title="配送模板" onSaved={()=>void result.refresh()} />,
            },
            {
              key:"after-sales-templates",label:"售后政策模板",children:<ProductTemplateSettings config={(result.data||[]).find((row)=>row.configKey==="product.afterSalesTemplates")} title="售后政策模板" onSaved={()=>void result.refresh()} />,
            },
            {
              key:"bank-accounts",label:"收款银行",children:<BankAccounts />,
            },
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

function ProductTemplateSettings({config,title,onSaved}:{config?:Row;title:string;onSaved:()=>void}){
  const {message,modal}=AntApp.useApp();
  const [form]=Form.useForm();
  const [open,setOpen]=useState(false);
  const [editing,setEditing]=useState<Row>();
  const templates=parseTemplateList(config?.configValue);
  const persist=async(next:Row[])=>{
    if(!config)throw new Error("模板配置尚未初始化，请刷新页面后重试");
    const normalized=next.length&&!next.some((item)=>item.isDefault)
      ? next.map((item,index)=>({...item,isDefault:index===0})) : next;
    await api(`/configs/${config.id}`,{method:"PUT",body:JSON.stringify({configValue:JSON.stringify(normalized),description:config.description,isPublic:Number(config.isPublic||0)})});
    onSaved();
  };
  const show=(row?:Row)=>{setEditing(row);form.resetFields();form.setFieldsValue(row||{title:"",content:"",isDefault:templates.length===0});setOpen(true);};
  const save=async()=>{try{
    const values=await form.validateFields();
    const id=editing?.id||`${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    let next=editing?templates.map((item)=>String(item.id)===String(editing.id)?{...item,...values,id}:item):[...templates,{...values,id}];
    if(values.isDefault)next=next.map((item)=>({...item,isDefault:String(item.id)===String(id)}));
    await persist(next);message.success(`${title}已保存`);setOpen(false);
  }catch(error){if(error instanceof Error)message.error(error.message);}};
  const remove=(row:Row)=>modal.confirm({title:`删除模板“${row.title}”？`,okButtonProps:{danger:true},onOk:async()=>{await persist(templates.filter((item)=>String(item.id)!==String(row.id)));message.success("模板已删除");}});
  const setDefault=async(row:Row)=>{await persist(templates.map((item)=>({...item,isDefault:String(item.id)===String(row.id)})));message.success(`已将“${row.title}”设为默认模板`);};
  return <><div className="footer-link-tab"><Button type="primary" onClick={()=>show()}>＋ 新增{title}</Button></div>
    <Table rowKey="id" dataSource={templates} columns={[
      {title:"模板名称",dataIndex:"title",width:220},{title:"模板内容",dataIndex:"content",ellipsis:true},
      {title:"默认模板",dataIndex:"isDefault",width:110,render:(value,row)=>value?<Tag color="green">默认</Tag>:<Button type="link" onClick={()=>void setDefault(row)}>设为默认</Button>},
      {title:"操作",width:150,render:(_,row)=><Space><Button type="link" onClick={()=>show(row)}>编辑</Button><Button type="link" danger onClick={()=>remove(row)}>删除</Button></Space>},
    ]}/>
    <Modal open={open} title={`${editing?"编辑":"新增"}${title}`} onCancel={()=>setOpen(false)} onOk={()=>void save()}>
      <Form form={form} layout="vertical"><Form.Item name="title" label="模板名称" rules={[{required:true,message:"请输入模板名称"}]}><Input maxLength={80}/></Form.Item>
        <Form.Item name="content" label="模板内容" rules={[{required:true,message:"请输入模板内容"}]}><Input.TextArea rows={7}/></Form.Item>
        <Form.Item name="isDefault" label="默认模板" valuePropName="checked"><Switch checkedChildren="默认" unCheckedChildren="普通"/></Form.Item>
      </Form>
    </Modal>
  </>;
}

function ProductServiceOptions(){
  const {message,modal}=AntApp.useApp();
  const rows=usePagedLoad("/api/admin/system/options?type=PRODUCT_SERVICE",10);
  const [form]=Form.useForm();const [open,setOpen]=useState(false);const [editing,setEditing]=useState<Row>();
  const show=(row?:Row)=>{setEditing(row);form.resetFields();form.setFieldsValue(row||{label:"",optionValue:"",sortOrder:(rows.data.length+1)*10,status:1});setOpen(true);};
  const save=async()=>{try{const values=await form.validateFields();await api(editing?`/options/${editing.id}`:"/options",{
    method:editing?"PUT":"POST",body:JSON.stringify({...values,optionType:"PRODUCT_SERVICE"}),
  });message.success("商品服务已保存");setOpen(false);void rows.refresh();}catch(error){if(error instanceof Error)message.error(error.message);}};
  const remove=(row:Row)=>modal.confirm({title:`删除商品服务“${row.label}”？`,content:"删除后，已选择该服务的商品将自动取消关联。",okButtonProps:{danger:true},onOk:async()=>{
    await api(`/options/${row.id}`,{method:"DELETE"});message.success("商品服务已删除");void rows.refresh();
  }});
  return <><div className="footer-link-tab"><Button type="primary" onClick={()=>show()}>＋ 新增商品服务</Button></div>
    <Table rowKey="id" loading={rows.loading} dataSource={rows.data} server={rows.server} searchPlaceholder="搜索商品服务名称或编码" columns={[
      {title:"服务名称",dataIndex:"label"},{title:"服务编码",dataIndex:"optionValue",render:(value)=><Typography.Text code>{value}</Typography.Text>},
      {title:"排序",dataIndex:"sortOrder",width:90},{title:"状态",dataIndex:"status",width:90,render:(value)=><Tag color={Number(value)===1?"green":"default"}>{Number(value)===1?"启用":"停用"}</Tag>},
      {title:"操作",width:150,render:(_,row)=><Space><Button type="link" onClick={()=>show(row)}>编辑</Button><Button type="link" danger onClick={()=>remove(row)}>删除</Button></Space>},
    ]}/>
    <Modal open={open} title={`${editing?"编辑":"新增"}商品服务`} onCancel={()=>setOpen(false)} onOk={()=>void save()}>
      <Form form={form} layout="vertical">
        <Form.Item name="label" label="服务名称" rules={[{required:true,message:"请输入服务名称"}]}><Input placeholder="例如：全国配送" maxLength={120}/></Form.Item>
        <Form.Item name="optionValue" label="服务编码" extra="用于系统识别，建议使用大写英文和下划线。" rules={[{required:true,message:"请输入服务编码"},{pattern:/^[A-Z][A-Z0-9_]*$/,message:"请使用大写英文、数字和下划线"}]}><Input disabled={Boolean(editing)} placeholder="NATIONWIDE_DELIVERY" maxLength={160}/></Form.Item>
        <Form.Item name="sortOrder" label="排序" rules={[{required:true}]}><InputNumber min={0} precision={0} style={{width:"100%"}}/></Form.Item>
        <Form.Item name="status" label="状态" rules={[{required:true}]}><Select options={[{value:1,label:"启用"},{value:0,label:"停用"}]}/></Form.Item>
      </Form>
    </Modal>
  </>;
}

function ConfigRow({
  row,
  saving,
  save,
}: {
  row: Row;
  saving: boolean;
  save: (value: any) => void | Promise<void>;
}) {
  const [value, setValue] = useState<any>(row.configValue);
  useEffect(() => setValue(row.configValue), [row.configValue]);
  const isLogo=row.configKey==="platform.logo";
  return (
    <div className={`config-row${isLogo?" config-row-upload":""}`}>
      <div>
        <strong>{row.description}</strong>
        <small>
          {row.configKey} · 最近更新 {dateTime(row.updatedAt)}
        </small>
      </div>
      {isLogo ? <div><Input value={value} onChange={(e)=>setValue(e.target.value)} placeholder="上传图片或输入 Logo 链接" /><ProductImageUpload kind="brand" value={value} onChange={(next)=>{setValue(next);if(next.trim())void save(next);}} /></div> : row.valueType === "BOOLEAN" ? (
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
