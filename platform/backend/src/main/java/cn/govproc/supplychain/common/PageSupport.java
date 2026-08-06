package cn.govproc.supplychain.common;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;

public final class PageSupport {
    private PageSupport() {}

    public static PageResult<Map<String,Object>> query(
        JdbcClient jdbc, String baseSql, String orderBy, Map<String,?> baseParams,
        int requestedPage, int requestedPageSize, String keyword, Integer status,
        List<String> searchColumns, String statusColumn
    ) {
        int page=Math.max(1,requestedPage);
        int pageSize=Math.max(1,Math.min(100,requestedPageSize));
        StringBuilder where=new StringBuilder(" WHERE 1=1");
        var params=new LinkedHashMap<String,Object>();
        if(baseParams!=null) params.putAll(baseParams);
        if(keyword!=null&&!keyword.isBlank()&&!searchColumns.isEmpty()) {
            where.append(" AND (");
            for(int i=0;i<searchColumns.size();i++) {
                if(i>0) where.append(" OR ");
                where.append("CAST(q.").append(searchColumns.get(i)).append(" AS CHAR) LIKE :pageKeyword");
            }
            where.append(')');
            params.put("pageKeyword","%"+keyword.trim()+"%");
        }
        if(status!=null&&statusColumn!=null&&!statusColumn.isBlank()) {
            where.append(" AND q.").append(statusColumn).append("=:pageStatus");
            params.put("pageStatus",status);
        }
        String source=" FROM ("+baseSql+") q"+where;
        long total=jdbc.sql("SELECT COUNT(*)"+source).params(params).query(Long.class).single();
        params.put("pageLimit",pageSize);
        params.put("pageOffset",(page-1)*pageSize);
        var records=jdbc.sql("SELECT q.*"+source+" ORDER BY "+orderBy+" LIMIT :pageLimit OFFSET :pageOffset")
            .params(params).query().listOfRows();
        return new PageResult<>(records,total,page,pageSize);
    }
}
