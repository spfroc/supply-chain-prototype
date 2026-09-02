package cn.govproc.supplychain.client;

import cn.govproc.supplychain.auth.ClientAuthService;
import cn.govproc.supplychain.notification.NotificationService;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/client/notifications")
public class NotificationController {
    private final JdbcClient jdbc; private final ClientAuthService auth; private final NotificationService notifications;
    public NotificationController(JdbcClient jdbc,ClientAuthService auth,NotificationService notifications){this.jdbc=jdbc;this.auth=auth;this.notifications=notifications;}

    @GetMapping
    List<Map<String,Object>> list(){materializeAgreementReminder();return jdbc.sql("""
      SELECT id,message_type AS messageType,title,content,link_url AS linkUrl,business_type AS businessType,business_id AS businessId,
        CASE WHEN read_at IS NULL THEN 0 ELSE 1 END AS isRead,DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') AS createdAt
      FROM notification_message WHERE user_id=:userId ORDER BY id DESC LIMIT 100
      """).param("userId",userId()).query().listOfRows();}

    @GetMapping("/unread-count") Map<String,Object> unreadCount(){materializeAgreementReminder();long count=jdbc.sql("SELECT COUNT(*) FROM notification_message WHERE user_id=:userId AND read_at IS NULL").param("userId",userId()).query(Long.class).single();return Map.of("count",count);}
    @PutMapping("/{id}/read") void read(@PathVariable long id){jdbc.sql("UPDATE notification_message SET read_at=COALESCE(read_at,NOW()) WHERE id=:id AND user_id=:userId").params(Map.of("id",id,"userId",userId())).update();}
    @PutMapping("/read-all") void readAll(){jdbc.sql("UPDATE notification_message SET read_at=NOW() WHERE user_id=:userId AND read_at IS NULL").param("userId",userId()).update();}

    @Transactional void materializeAgreementReminder(){var rows=jdbc.sql("""
      SELECT a.id,a.enterprise_id AS enterpriseId,a.name,DATE_FORMAT(a.expiry_date,'%Y-%m-%d') AS expiryDate,DATEDIFF(a.expiry_date,CURRENT_DATE) AS daysLeft
      FROM agreement a WHERE a.enterprise_id=:enterpriseId AND a.status=1 AND a.deleted_at IS NULL AND a.expiry_date BETWEEN CURRENT_DATE AND DATE_ADD(CURRENT_DATE,INTERVAL 30 DAY)
      """).param("enterpriseId",enterpriseId()).query().listOfRows();for(var row:rows){long id=((Number)row.get("id")).longValue();notifications.send(enterpriseId(),userId(),"AGREEMENT","采购协议即将到期",row.get("name")+" 将于 "+row.get("expiryDate")+" 到期，剩余 "+row.get("daysLeft")+" 天。","/web/account","AGREEMENT",id,"agreement-expiry-"+id+"-"+row.get("expiryDate"));}}
    private long userId(){return auth.current().userId();}private long enterpriseId(){return auth.current().enterpriseId();}
}
