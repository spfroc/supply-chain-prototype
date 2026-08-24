package cn.govproc.supplychain.business;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class CollectOutcomeTest {
    @Test
    void treatsDelistedAndMissingGoodsAsSkip() {
        assertThat(CollectOutcome.fromHttp(410, "京东商品已下架")).isEqualTo(CollectOutcome.SKIP);
        assertThat(CollectOutcome.fromHttp(502, "该商品已下架")).isEqualTo(CollectOutcome.SKIP);
        assertThat(CollectOutcome.fromHttp(400, "淘宝/天猫采集尚未开放")).isEqualTo(CollectOutcome.SKIP);
        assertThat(CollectOutcome.skipReason("商品已下架")).isEqualTo("商品已下架，已跳过");
    }

    @Test
    void retriesTransientCollectorFailures() {
        assertThat(CollectOutcome.fromHttp(429, "采集任务进行中，请稍后再试")).isEqualTo(CollectOutcome.BUSY);
        assertThat(CollectOutcome.fromHttp(502, "京东 PC 频控，改用移动端采集")).isEqualTo(CollectOutcome.RETRY);
        assertThat(CollectOutcome.fromHttp(0, "采集超时或采集服务不可用")).isEqualTo(CollectOutcome.RETRY);
        assertThat(CollectOutcome.fromHttp(504, "gateway")).isEqualTo(CollectOutcome.RETRY);
    }

    @Test
    void doesNotRetryClientErrors() {
        assertThat(CollectOutcome.fromHttp(400, "无法从链接解析京东 SKU")).isEqualTo(CollectOutcome.FAIL_NO_RETRY);
        assertThat(CollectOutcome.fromHttp(422, "京东隐藏了售价")).isEqualTo(CollectOutcome.FAIL_NO_RETRY);
        assertThat(CollectOutcome.fromHttp(409, "数据冲突或仍被其他业务引用")).isEqualTo(CollectOutcome.FAIL_NO_RETRY);
        assertThat(CollectOutcome.fromHttp(401, "请先登录后再采集")).isEqualTo(CollectOutcome.FAIL_NO_RETRY);
    }

    @Test
    void detectsJdAndTaobaoHosts() {
        assertThat(CollectJobService.detectPlatform("https://item.jd.com/12345678.html")).isEqualTo("jd");
        assertThat(CollectJobService.detectPlatform("https://item.m.jd.com/product/12345678.html")).isEqualTo("jd");
        assertThat(CollectJobService.detectPlatform("72054902653")).isEqualTo("jd");
        assertThat(CollectJobService.detectPlatform("https://item.taobao.com/item.htm?id=1")).isEqualTo("taobao");
        assertThat(CollectJobService.detectPlatform("https://detail.tmall.com/item.htm?id=1")).isEqualTo("taobao");
        assertThat(CollectJobService.detectPlatform("http://hwly.miniappss.com/goodsInfo/84395.html")).isEqualTo("huiecai");
        assertThat(CollectJobService.detectPlatform(
            "https://ggzyjyzx.shandong.gov.cn:8182/gpfa-main-web/scShortlistedGoodsLibrary")).isEqualTo("qilu");
        assertThat(CollectJobService.detectPlatform(
            "https://ggzyjyzx.shandong.gov.cn:8182/gpfa-main-web/goodslibrary/gpfa/goodsDetail?goodspriceguid=1"
        )).isEqualTo("qilu");
    }
}
