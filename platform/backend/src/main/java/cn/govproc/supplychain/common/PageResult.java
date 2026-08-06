package cn.govproc.supplychain.common;

import java.util.List;

public record PageResult<T>(List<T> records, long total, int page, int pageSize, int totalPages) {
    public PageResult(List<T> records,long total,int page,int pageSize) {
        this(records,total,page,pageSize,total == 0 ? 0 : (int) Math.ceil((double) total / pageSize));
    }
}
