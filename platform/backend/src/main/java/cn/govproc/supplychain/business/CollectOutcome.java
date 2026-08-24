package cn.govproc.supplychain.business;

public enum CollectOutcome {
    SUCCESS,
    SKIP,
    FAIL_NO_RETRY,
    RETRY,
    BUSY;

    public static CollectOutcome fromHttp(int status, String detail) {
        String text = detail == null ? "" : detail;
        if (status == 410 || containsAny(text, "已下架", "已下柜", "不可售", "商品不存在", "没有找到相关商品")) {
            return SKIP;
        }
        if (containsAny(text, "尚未开放")) {
            return SKIP;
        }
        if (status == 429 || containsAny(text, "采集任务进行中")) {
            return BUSY;
        }
        if (containsAny(text, "数据冲突", "仍被其他业务引用")) {
            return FAIL_NO_RETRY;
        }
        if (status == 0 || status == 408 || status == 502 || status == 503 || status == 504) {
            return RETRY;
        }
        if (status >= 400 && status < 500) {
            return FAIL_NO_RETRY;
        }
        if (status >= 500) {
            return RETRY;
        }
        return SUCCESS;
    }

    public static String skipReason(String detail) {
        String text = detail == null || detail.isBlank() ? "京东商品已下架或不可售" : detail.trim();
        if (text.contains("尚未开放")) {
            return text;
        }
        if (!text.contains("下架") && !text.contains("下柜") && !text.contains("不存在")) {
            return "京东商品已下架或不可售，已跳过";
        }
        return text.endsWith("已跳过") ? text : text + "，已跳过";
    }

    private static boolean containsAny(String text, String... tokens) {
        for (String token : tokens) {
            if (text.contains(token)) {
                return true;
            }
        }
        return false;
    }
}
