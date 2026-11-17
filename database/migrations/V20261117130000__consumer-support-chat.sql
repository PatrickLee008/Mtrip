-- Consumer App PRD v1.0.6 模块 13「Live Chat & Customer Support」(mTrip 平台客服,chat_conversation.type=2)
-- 1. 会话:转人工时间、评价备注/时间;消息:系统动作标记(机器人建议转人工 / 已转人工)
-- 2. chat_support_faq:客服机器人「推荐问题 + 关键词自动回复」配置(按站点/语言/预订场景,site_id=0 全站通用)
-- 幂等:列/索引走 information_schema 守卫,种子按唯一键 INSERT IGNORE(运营已改过的文案不覆盖)
SET NAMES utf8mb4;
USE `mtrip_business`;

SET @ddl=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='chat_conversation' AND COLUMN_NAME='handoff_at')=0,
  'ALTER TABLE `chat_conversation` ADD COLUMN `handoff_at` DATETIME NULL COMMENT ''客服会话转人工时间(UTC),NULL=机器人应答中''','SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='chat_conversation' AND COLUMN_NAME='rating_comment')=0,
  'ALTER TABLE `chat_conversation` ADD COLUMN `rating_comment` VARCHAR(500) NOT NULL DEFAULT '''' COMMENT ''客服会话评价备注''','SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='chat_conversation' AND COLUMN_NAME='rated_at')=0,
  'ALTER TABLE `chat_conversation` ADD COLUMN `rated_at` DATETIME NULL COMMENT ''评价时间(UTC)''','SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='chat_message' AND COLUMN_NAME='action')=0,
  'ALTER TABLE `chat_message` ADD COLUMN `action` VARCHAR(20) NOT NULL DEFAULT '''' COMMENT ''系统动作:suggest_agent 建议转人工 / handoff 已转人工''','SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl=IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='chat_conversation' AND INDEX_NAME='idx_chat_user_type_status')=0,
  'ALTER TABLE `chat_conversation` ADD KEY `idx_chat_user_type_status` (`site_id`,`user_id`,`type`,`status`)','SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `chat_support_faq` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `site_id`    BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=全站通用;站点行按 faq_key 覆盖通用行',
  `faq_key`    VARCHAR(50)  NOT NULL COMMENT '稳定键(推荐问题点击回传)',
  `scene`      VARCHAR(20)  NOT NULL COMMENT 'general 一般 / payment 待支付 / upcoming 待入住 / in_stay 入住中 / completed 已完成 / cancelled 已取消退款 / trigger 仅关键词 / system 系统话术',
  `language`   VARCHAR(10)  NOT NULL COMMENT 'en-US / zh-CN / my-MM(缺失回退 en-US)',
  `question`   VARCHAR(200) NOT NULL DEFAULT '' COMMENT '推荐问题文案(trigger/system 可空)',
  `answer`     VARCHAR(2000) NOT NULL COMMENT '机器人回复',
  `keywords`   VARCHAR(500) NOT NULL DEFAULT '' COMMENT '逗号分隔关键词(小写,包含即命中)',
  `handoff`    TINYINT      NOT NULL DEFAULT 0 COMMENT '0 仅回答 1 回答后建议转人工 2 直接转人工',
  `sort`       INT          NOT NULL DEFAULT 0,
  `status`     TINYINT      NOT NULL DEFAULT 1 COMMENT '1启用 0停用',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_support_faq` (`site_id`,`language`,`faq_key`),
  KEY `idx_support_faq_scene` (`language`,`scene`,`status`,`sort`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='平台客服机器人常见问题/关键词应答';

INSERT IGNORE INTO `chat_support_faq` (`site_id`,`faq_key`,`scene`,`language`,`question`,`answer`,`keywords`,`handoff`,`sort`) VALUES
-- ---------- en-US ----------
(0,'general_change','general','en-US','How do I change or cancel a booking?','Open More > My Bookings, choose the booking and tap "Cancel booking". Free cancellation depends on the policy shown on the booking. Date or room changes are handled by our support team — tap "Contact customer support" and we will help.','cancel,change,modify,reschedule',0,10),
(0,'general_payment','general','en-US','Which payment methods can I use?','You can pay with KBZPay / MMQR, and use your mTrip Wallet balance to cover all or part of a booking. Some hotels also offer Pay at Hotel.','payment method,pay with,kbz,mmqr,wallet',0,20),
(0,'general_refund','general','en-US','When will I receive my refund?','Refunds to your mTrip Wallet arrive immediately after approval. Refunds to KBZPay usually take 3-7 business days. You can track the status on the booking detail page.','refund,money back',0,30),
(0,'general_checkin','general','en-US','What are the check-in and check-out times?','Check-in and check-out times are set by each hotel and shown in the hotel Policies tab and on your booking detail page.','check-in,check in,check-out,check out,checkout',0,40),
(0,'general_account','general','en-US','I can''t log in to my account','Try "Forgot password" on the login page to reset it with an OTP sent to your phone. If you still can''t log in, contact customer support.','login,log in,password,account,otp',1,50),
(0,'payment_complete','payment','en-US','How do I complete payment for this booking?','Open the booking and tap "Pay now" before the payment window ends. Unpaid bookings are cancelled automatically when the timer runs out.','pay now,complete payment,unpaid,pending payment',0,10),
(0,'payment_failed','payment','en-US','My payment failed or the timer expired','If the payment window has expired the booking is released — please book again. If money was deducted but the booking is not confirmed, contact customer support with your booking number.','payment failed,failed,expired,deducted',1,20),
(0,'upcoming_confirmed','upcoming','en-US','Is my booking confirmed?','Paid bookings are confirmed instantly. Your confirmation and booking number are on the booking detail page and in your notifications.','confirm,confirmed,confirmation',0,10),
(0,'upcoming_cancel_policy','upcoming','en-US','What is the cancellation policy for this booking?','The cancellation policy captured when you booked is shown on the booking detail page. Tap "Cancel booking" to see the exact refund before you confirm.','cancellation policy,cancel policy,free cancellation',0,20),
(0,'upcoming_special_request','upcoming','en-US','Can I add a special request (early check-in, extra bed)?','You can message the hotel directly from the booking detail page ("Message property"). For anything the hotel cannot arrange, our support team can help.','special request,early check-in,late check-out,extra bed',1,30),
(0,'upcoming_directions','upcoming','en-US','How do I get to the hotel?','The hotel address and map are on the booking detail page. Tap the address to open directions.','direction,address,location,map,how to get',0,40),
(0,'in_stay_contact','in_stay','en-US','How do I contact the hotel?','Use "Message property" on the booking detail page to chat with the hotel. The hotel phone number is shown there too.','contact hotel,message hotel,hotel phone,call hotel',0,10),
(0,'in_stay_problem','in_stay','en-US','I have a problem with my room','Sorry to hear that. Please tell the front desk first so they can fix it right away. If it is not resolved, connect with our support team and we will follow up with the hotel.','problem,issue,dirty,broken,noise,not working',1,20),
(0,'in_stay_extend','in_stay','en-US','Can I extend my stay?','Please make a new booking for the extra nights from the hotel page, or ask the front desk. Support can help if the hotel shows no availability.','extend,extra night,stay longer',0,30),
(0,'completed_receipt','completed','en-US','How do I get a receipt?','Your payment details and booking number are on the booking detail page. If you need an official invoice, contact customer support.','receipt,invoice,bill',1,10),
(0,'completed_review','completed','en-US','How do I write a review?','Open the completed booking and tap "Write a review". Reviews are published after moderation.','review,rate the hotel,feedback',0,20),
(0,'completed_lost_item','completed','en-US','I left something at the hotel','Please message the hotel from the booking detail page. If you get no response, our support team will contact the hotel for you.','lost,left something,forgot',1,30),
(0,'cancelled_refund','cancelled','en-US','When will I get the refund for this cancelled booking?','Refunds follow the cancellation policy of the booking. Wallet refunds arrive immediately; KBZPay refunds usually take 3-7 business days.','refund,money back',0,10),
(0,'cancelled_rebook','cancelled','en-US','Can I book the same hotel again?','Yes — open the hotel from your booking or search for it and make a new booking.','rebook,book again',0,20),
(0,'trigger_agent','trigger','en-US','','Sure — connecting you to an mTrip support agent now.','agent,human,real person,live support,customer support,customer service,talk to someone,speak to someone',2,10),
(0,'trigger_dispute','trigger','en-US','','I''m sorry about this. Payment disputes, complaints and special cases are best handled by our support team. Tap "Contact customer support" to talk to an agent.','dispute,complaint,complain,chargeback,charged twice,double charge,overcharged,fraud,scam',1,20),
(0,'system_fallback','system','en-US','','Sorry, I couldn''t find an answer to that. Would you like to talk to a support agent?','',1,10),
(0,'system_handoff','system','en-US','','You''re now connected to the mTrip support team. An agent will reply here shortly — you can leave this page and come back any time.','',0,20),
-- ---------- zh-CN ----------
(0,'general_change','general','zh-CN','如何修改或取消预订?','打开「更多 > 我的预订」,选择预订后点「取消预订」,能否免费取消以预订上显示的政策为准。修改日期或房型由客服处理,点「联系客户支持」即可。','取消,修改,改期,更改',0,10),
(0,'general_payment','general','zh-CN','支持哪些支付方式?','支持 KBZPay / MMQR,也可以用 mTrip 钱包余额抵扣全部或部分房费;部分酒店支持到店支付。','支付方式,付款方式,怎么付,钱包,kbz,mmqr',0,20),
(0,'general_refund','general','zh-CN','退款多久到账?','退回 mTrip 钱包的款项审核通过后即时到账;原路退回 KBZPay 通常需要 3-7 个工作日,可在预订详情查看进度。','退款,退钱',0,30),
(0,'general_checkin','general','zh-CN','入住和退房时间是几点?','入住/退房时间由各酒店设定,可在酒店「政策」页签和预订详情中查看。','入住时间,退房时间,几点入住,几点退房,入住,退房',0,40),
(0,'general_account','general','zh-CN','我无法登录账号','可在登录页点「忘记密码」,用手机验证码重置密码;仍无法登录请联系客户支持。','登录,登陆,密码,账号,验证码',1,50),
(0,'payment_complete','payment','zh-CN','如何完成这笔预订的支付?','打开预订,在支付倒计时结束前点「立即支付」。超时未支付的预订会自动取消。','立即支付,完成支付,未支付,待支付',0,10),
(0,'payment_failed','payment','zh-CN','支付失败或倒计时已过期','支付超时后预订会释放,请重新预订。如已扣款但预订未确认,请带上预订号联系客户支持。','支付失败,失败,过期,已扣款,扣款',1,20),
(0,'upcoming_confirmed','upcoming','zh-CN','我的预订确认了吗?','已支付的预订即时确认,确认信息与预订号可在预订详情和通知中查看。','确认,确认了吗,确认单',0,10),
(0,'upcoming_cancel_policy','upcoming','zh-CN','这笔预订的取消政策是什么?','预订详情会显示下单时锁定的取消政策;点「取消预订」可在确认前看到准确的退款金额。','取消政策,免费取消',0,20),
(0,'upcoming_special_request','upcoming','zh-CN','可以提特殊要求吗(提前入住、加床)?','可在预订详情点「联系酒店」直接与酒店沟通;酒店无法安排的,客服可以协助。','特殊要求,提前入住,延迟退房,加床',1,30),
(0,'upcoming_directions','upcoming','zh-CN','怎么去酒店?','酒店地址和地图在预订详情中,点地址即可打开导航。','怎么去,地址,位置,地图,导航',0,40),
(0,'in_stay_contact','in_stay','zh-CN','如何联系酒店?','在预订详情点「联系酒店」即可与酒店聊天,酒店电话也在该页显示。','联系酒店,酒店电话,打电话',0,10),
(0,'in_stay_problem','in_stay','zh-CN','我的房间有问题','很抱歉给您带来不便。请先告知前台以便尽快处理;如未解决,可转接客服,我们会跟进酒店。','问题,脏,坏了,噪音,不能用,故障',1,20),
(0,'in_stay_extend','in_stay','zh-CN','可以续住吗?','请在酒店页为续住的晚数新下一单,或咨询前台;如酒店显示无房,客服可以协助。','续住,多住,延长',0,30),
(0,'completed_receipt','completed','zh-CN','如何获取收据?','支付明细和预订号在预订详情中;如需正式发票,请联系客户支持。','收据,发票,账单',1,10),
(0,'completed_review','completed','zh-CN','如何写评价?','打开已完成的预订,点「写评价」,评价审核后发布。','评价,点评,打分',0,20),
(0,'completed_lost_item','completed','zh-CN','我有东西落在酒店了','请先在预订详情联系酒店;如酒店未回复,客服会替您联系酒店。','落下,遗失,丢了,忘带',1,30),
(0,'cancelled_refund','cancelled','zh-CN','这笔已取消的预订什么时候退款?','退款按预订的取消政策执行:退回钱包即时到账,退回 KBZPay 通常 3-7 个工作日。','退款,退钱',0,10),
(0,'cancelled_rebook','cancelled','zh-CN','可以重新预订同一家酒店吗?','可以,从预订或搜索打开该酒店重新下单即可。','重新预订,再订',0,20),
(0,'trigger_agent','trigger','zh-CN','','好的,正在为您转接 mTrip 人工客服。','人工,客服,真人,转人工,人工服务',2,10),
(0,'trigger_dispute','trigger','zh-CN','','非常抱歉。支付争议、投诉和特殊情况建议由人工客服处理,点「联系客户支持」即可转接。','争议,投诉,重复扣款,多扣,盗刷,诈骗,欺诈',1,20),
(0,'system_fallback','system','zh-CN','','抱歉,我暂时无法回答这个问题。需要为您转接人工客服吗?','',1,10),
(0,'system_handoff','system','zh-CN','','已为您接入 mTrip 客服团队,客服会在这里尽快回复;您可以先离开,稍后随时回来继续。','',0,20);

-- 历史客服会话标题是写死的中文「在线客服」;App 已按 type=2 本地化显示,这里统一为英文默认值供后台列表展示
UPDATE `chat_conversation` SET `title`='mTrip Support' WHERE `type`=2 AND `title`='在线客服';
