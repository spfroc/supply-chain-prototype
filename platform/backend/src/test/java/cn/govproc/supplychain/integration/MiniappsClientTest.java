package cn.govproc.supplychain.integration;

import static org.assertj.core.api.Assertions.assertThat;
import java.util.LinkedHashMap;
import java.util.List;
import org.junit.jupiter.api.Test;

class MiniappsClientTest {
    @Test void signsScalarParametersLikeDocumentation() {
        var data=new LinkedHashMap<String,Object>();
        data.put("time",1713865171L);data.put("page",0);data.put("page_size",20);
        data.put("sort","add_time");data.put("sort_type","desc");
        assertThat(MiniappsClient.signature(data,"dqj2dqttx80qie6h"))
            .isEqualTo("D08F7FAF411BE2A145BC485953D992F0");
    }
    @Test void signsArrayParametersLikeDocumentation() {
        var data=new LinkedHashMap<String,Object>();
        data.put("time",1714111929L);data.put("type_list",List.of(1,2,3,4,7,8));
        assertThat(MiniappsClient.signature(data,"dqj2dqttx80qie6h"))
            .isEqualTo("7BAD904EAB8D1D75DC138316A2AAE7F7");
    }
}
