-- ============================================================
-- 用户域:C 端用户 / 会员 / 风控 / 会话
-- 由 test/gen_testdata.py 自动生成,请勿手工编辑
-- ============================================================
SET NAMES utf8mb4;
USE `mtrip_business`;


-- 会员等级
INSERT INTO `user_member_level` (`id`,`site_id`,`level_name`,`level_order`,`upgrade_amount`,`discount_rate`,`benefits`,`icon`,`status`,`created_at`,`updated_at`) VALUES
(1001,0,'普通会员',1,0.00,100.00,'["生日礼券"]','',1,'2026-02-11 04:19:43','2026-02-11 04:19:43'),
(1002,0,'银卡会员',2,1000.00,98.00,'["生日礼券", "免费取消"]','',1,'2026-02-11 04:19:43','2026-02-11 04:19:43'),
(1003,0,'金卡会员',3,5000.00,95.00,'["生日礼券", "免费取消", "专属客服"]','',1,'2026-02-11 04:19:43','2026-02-11 04:19:43'),
(1004,0,'铂金会员',4,20000.00,92.00,'["生日礼券", "免费取消", "专属客服"]','',1,'2026-02-11 04:19:43','2026-02-11 04:19:43');

-- C 端用户(覆盖 1正常 2冻结 3注销 4拉黑)
INSERT INTO `user_info` (`id`,`site_id`,`nickname`,`avatar`,`mobile`,`mobile_hash`,`email`,`password`,`register_source`,`register_time`,`last_login_at`,`last_login_ip`,`member_level_id`,`member_expire_time`,`balance`,`points`,`real_name_status`,`real_name`,`id_card`,`user_status`,`tags`,`remark`,`referral_code`,`created_at`,`updated_at`) VALUES
(1001,3,'Quentin S.','https://cdn.mtrip.test/prod/avatar/1001.png','StLFI3b2EBFwgEiZVERKWscUGld9znaPrLXIXe3LkYhGtcAQr+3+jw==','ec739e6510853678718b8c96512cb55ff6420ba9eabf9b03123f2eb19a973eee','izuNmfmLYaqyw+NdcigkRSJxHlqTdJLoC3x6cbP5eIXg0tztdjME6GGTX/hE75Y=','$2y$10$eBNDY6iXrb3imjI6m/GNBuVcrxHqGrHR1bGfuqFYStC6LNrjwDo9K',1,'2026-01-09 04:19:43',NULL,'57.126.13.79',1003,'2027-02-26 04:19:43',1500.00,4987,0,'5LefVbKS78lpCs10rbITpGwcYJGjP/pq/wGH4Cug1Y7FOgmWbJ1f+A==','/JEu+0pZLLodlrSSY1xPnJ0kAGVau2w5gmG53h8EVdvxCtZxJEQ=',4,'["价格敏感"]','测试数据','REF001001','2026-01-09 04:19:43','2026-08-27 07:29:43'),
(1002,3,'Hugo L.','https://cdn.mtrip.test/prod/avatar/1002.png','e2yefzwUq7oCMKJxoX++d9nsZoX+g3S2KwkQ+Jzx+GFqVNc4pWDCXw==','2ee3851645a94f40a047b614a24655c9f997ff14f604d0b9305ada9b7659d65a','XqXI6wT041lE8iHVDSKesx+1gcCgNEZJ6OAwsezGoi5IBjGA4MVfWEszKK5Jhk0=','$2y$10$dUOCOPfZ1Cyne2YofGv/6ecr1glMTy3/5C7uSs1/cbQ0laCyPCMEm',4,'2026-03-20 04:19:43','2026-08-01 12:11:43','136.40.105.133',1004,'2027-02-26 04:19:43',0.00,6829,1,'u7PqVZrN2iKBFJyojVOmKFadge6N7zTUlt32K5Y8TeZncPle94ay','GwzW37vlh0n4fUzjolsO+mbLVWXfCbDtcJ2XHi3/P4yKAaKvCBo=',1,'["家庭出行", "高频用户"]','测试数据','REF001002','2026-03-20 04:19:43','2026-08-29 00:51:43'),
(1003,4,'Bruno D.','https://cdn.mtrip.test/prod/avatar/1003.png','dNqS+oENAqfiM1vhx7Z4pQNx7fz1NbEiZmSVjci6EvgkdNLHv2FNWg==','0dd823bdce2cc88cf338b60ddc6d8fee3869cc00bbfb56f602964678cac13111','mklnbW2+Uuxt8J2wrnS5E71Y6g5uuQr4UwBMRjjo8zB8nlr5/61IVwkLycgWGi0=','$2y$10$fKDk5orAj1utaVLoZvNmCOG9atla11.FzQwa8NXiTbeBJynsDVUc6',2,'2025-12-01 04:19:43','2026-08-09 09:10:43','32.148.223.75',1001,'2027-02-26 04:19:43',480.00,1426,0,'PGv44y9X0nRyUsOMfAwK3JTD0HsKUzwzjVcl5ULhYd0TsC5GJfX78+o=','rj5zfXVSQ7rg4Uxy6WDdd53p8/uN3K/evm1cjKBh5gAF47khGs8=',1,'["商旅", "价格敏感"]','测试数据','REF001003','2025-12-01 04:19:43','2026-08-11 09:44:43'),
(1004,4,'Hugo B.','https://cdn.mtrip.test/prod/avatar/1004.png','L55sFjyGmiQUDqK4dZMUcuTS98qAPXebUzAwaItF7bHSB9hxlj1TgA==','36c2dd3e8d32878396168a58e573d8ffb352a6b8de7732dacb7eb27f81f9241f','4Drf+Dl9JogPN0Hyjw1MF49VyQBvlcR3Rtjr7z9wt/SSUqqVkHafXJjOsUxV4Lw=','$2y$10$l27FYEVKHdlBcOKjM9gdNOHz.9GzrH3M0kIleHQV2YXIT.G6Nu9JK',1,'2026-03-18 04:19:43','2026-08-23 21:31:43','86.188.81.39',1004,'2027-02-26 04:19:43',480.00,781,0,'JoRUywfKtPKecN+EgxtrRVqYVSEpDxMJjy4gpegwBFtVsN8X0CjE','9QQXhKNoFE3+CK7QklXRj18L0FxaTjmV8xOqzohHmFjoIL3w3HI=',1,'["商旅"]','测试数据','REF001004','2026-03-18 04:19:43','2026-08-16 20:52:43'),
(1005,3,'Hugo D.','https://cdn.mtrip.test/prod/avatar/1005.png','3JIpacMxsDg+cJs2+W/+Y5BLdRoda1t09b/yD3/Fm5LMkXRExroTHQ==','55c507ce9c68e6fc770d281e31fdd66e58ccc63fad455013c4ab02387cbe52db','TPWS3lAL1L2FZvM3xPnCXr7eTvcT+5UOpLN7R86MZpOcipcRpz/HVSuPdUrgBuo=','$2y$10$7n93uBtMW/m4YKW6fg6e5uglsDb/O2Xz0.s8iKNLdwfoA2Eh0uTui',4,'2025-10-26 04:19:43',NULL,'59.91.78.185',1003,'2027-02-26 04:19:43',0.00,3520,0,'0L8sDldSeaGFNufTnf1eh3yMcfVbA5mEwxK0eBs+8JMZFCfULWE=','EFSLCSb4AvSy0It/JIpZ51r/XfHjSGHzLvhUbp/R5JRKjLoGA3Y=',2,'["高频用户", "价格敏感"]','测试数据','REF001005','2025-10-26 04:19:43','2026-08-25 23:06:43'),
(1006,4,'Julien L.','https://cdn.mtrip.test/prod/avatar/1006.png','zXNyFPntx0MYJUtwrp9TaZoxZEN9/uAfr9yCdnvpUNdJIfoGgO56Fg==','2af0908a11c3d9e5ba854cd7c34b3e00fbc4457a6fd290ae4364be5d9e19af5c','RmTAEvsrmVTbrw1N/2wtO32xOnDJPyjoXVSbIqNjyu/TIdNiZQ6wRQcSCWGjf1o=','$2y$10$xEpgcWZxLztN2a6AGDui9OknlusFIaUd6g0lWOUaK/u.VaNdNGac6',3,'2025-10-13 04:19:43','2026-08-23 19:04:43','26.127.112.254',1004,'2027-02-26 04:19:43',0.00,538,0,'eXQ7j6Gne6F4cn8lulj8LpaT7ZVXJ/iQxnhHXeFXchRYWZuWs6QQ0g==','dSawEXey46lh1NLKuALMAZqxVd45i7Hvfrc3G9QCBo9zpKWs97c=',1,'["价格敏感"]','测试数据','REF001006','2025-10-13 04:19:43','2026-08-15 17:36:43'),
(1007,1,'Nina S.','https://cdn.mtrip.test/prod/avatar/1007.png','r6VKoEMRwfX+XPgv0YFId3pmacU5nOUHq3EjH2y82UIUunyfeTqkFw==','b091ccf21c36fea9fa838f2a3ada1cfc1081257b090d77ab15ecbdfa80dfbf64','B81x+tFu0tGVJeCRHtWnmIXwysRvEBeuqjfKS2W0WrugZph+hrjOy2WKbn/Qpyo=','$2y$10$PExC/dw0Ea2lmc1VtOhzie.RVR7/TVmI0qMm9evXf64cZPDXGNEJa',1,'2025-12-17 04:19:43','2026-08-06 14:15:43','91.37.7.76',1003,'2027-02-26 04:19:43',120.00,3796,1,'CQDfuu+wm/137ourxftOtD69Fg4nU+Dnl/EvfmKkvpDanNXRXFHB','RnjaE9I36gU6dr6cdGVTo0+afVW3r/ml2vOo7JvnpBJXqpc0OAA=',1,'["新客", "家庭出行"]','测试数据','REF001007','2025-12-17 04:19:43','2026-08-20 14:56:43'),
(1008,3,'Emma M.','https://cdn.mtrip.test/prod/avatar/1008.png','3nbvt4uKnZm24sfkhfljqqudsYXjxmqhsbJoAPkIL152lFaja6oF9w==','c255491bcf1e6f96676a93ee20928392d6ecb7fab1ce2e98e8faab821abf312e','gsDbE7o0W9QSL57yPQ5Zd/g8vXAHO1+jEjUP1cs87eZp/an3OcH6SZ7j+6n6Zvo=','$2y$10$5BR3t/hpEjscnJJUO7fO2OpPk0tn5SPy/u26uStKr.vhsH/V1lqhK',1,'2025-08-22 04:19:43','2026-08-12 14:49:43','152.135.50.8',1001,'2027-02-26 04:19:43',0.00,4048,1,'PSqq2q/D7UN9ZIxvQmmSu09BSqkV44AIjKy3YpnNSc7x3nYxZqHhaGfb','PGTcQbEcznclncqYqk+0jL7iGgOshqin0v7BMunCemLIhl/393I=',1,'["商旅", "高频用户"]','测试数据','REF001008','2025-08-22 04:19:43','2026-08-17 07:36:43'),
(1009,4,'Isabelle W.','https://cdn.mtrip.test/prod/avatar/1009.png','5Yyl8QmRdjrsXSD8Lxha20aQnORVapIKJyfUZrM4Y/UsdlcIFPC8kw==','12965207158d36192172e6fe9a32b7cad975bf2c8b289f277ff86e26cc581787','5floKhd6UDBp4QtK4jdt3VeMTe1Y18hvEaok26MCziaKKZ8AKriw7nmRtZQb4U8=','$2y$10$816LtaXVM1Kh76kioMJhieCs8tNhiu3UJCHM58WsjtdkmLE5y2ZMW',4,'2025-11-26 04:19:43','2026-08-05 10:29:43','85.172.173.14',1004,'2027-02-26 04:19:43',120.00,4798,0,'yMach+pRV8+L9oFgFQPhOsPdbyC5HbwQKEfqd3EZUyUdPpLJlGgGZA==','vmmYxtg1RmJ8tGlo9ynOPkY/sUwh+QlI2hPivYPNdzkK0Z/gySY=',1,'["商旅"]','测试数据','REF001009','2025-11-26 04:19:43','2026-08-21 17:02:43'),
(1010,3,'Quentin R.','https://cdn.mtrip.test/prod/avatar/1010.png','YkyBZXns/iyBnfK0qXj7M3sfcIyfS7glxqNUTCZcn5ZyIHQnoWSn3w==','d3a8aef2986cc9fec03da10ab624ca389aa95c427ab5d2196cec47a34e54ec8c','jmd/zNCvaZnZ4VRTxDwooU0LeGejVh1D6GVSV1t24yFbLkpIXXTFjh0ieZ0u/vo=','$2y$10$n0AZ3xljQNifVsAq0DqwUu.8lqQu8CU/OtWSpbQQ6OM1hAc5437CK',1,'2026-02-05 04:19:43',NULL,'158.48.182.200',1003,'2027-02-26 04:19:43',25.00,740,0,'F6lXO6Y5cm+by17NJeR6b1N+JZek4/bJ/HiAc1mVs4D2NRgHGeVXIg==','jjGsQX6QKMmZmHu57PnBQ3YD1ti8SprOYAbJkqddnZ4aUObrzco=',2,'["商旅", "家庭出行"]','测试数据','REF001010','2026-02-05 04:19:43','2026-08-13 01:00:43'),
(1011,3,'Julien R.','https://cdn.mtrip.test/prod/avatar/1011.png','n85evD6vsgos0nyGAcuFP/RFhCyPW5o6cxPAUli9pAmytEw5v2AyLw==','b79926c342256cd5a90266fd961bd27d28399834bf26eb8a31b24cdcbcac3b36','d/yjdtZkVO2w6MgE0R4BkwudRgXCtcDsDuaFruwY2Yjr08z3kqenPv8ZwxaDesU=','$2y$10$shAogHNNSAuV2nKvNuDy1eKAIXLIrXrQOzIv6uy2ODIu05Q0v/swq',4,'2025-12-20 04:19:43','2026-08-08 00:15:43','87.44.84.52',1004,'2027-02-26 04:19:43',0.00,6463,1,'Hnqvq9Izi5tfLiVOoXKF2pWA9YB8P9riMmGgFPXYOtm5Jg2QyMqSCA==','TiydofzmVIGQC5pS5hZz1K0v8NsNLfgiiYpWpRj5cD3OlGmzh7M=',1,'["价格敏感", "新客"]','测试数据','REF001011','2025-12-20 04:19:43','2026-08-18 08:04:43'),
(1012,1,'Isabelle R.','https://cdn.mtrip.test/prod/avatar/1012.png','H4dfC2j3aEj6SSWFxOUk2iOEZpM/xtXaWym1XPl7y3dugwu6G1NQdw==','7277e8c71a9cb77fd2c1942b3e017e6b3ff124c3ab4390369fc160eb8be6332b','jm7ByPsaLjlxYqLqfvfK9SCVZwvjLAaeW08QhLk0sfrP/d0s/U0kQHS4pCuvraE=','$2y$10$g0AFa2LGkOfDd8QgY1NrF.GWw5slOs5SoqQfS0sAg6CHiVkWFsaZW',4,'2026-01-15 04:19:43','2026-08-06 13:16:43','102.225.44.212',1001,'2027-02-26 04:19:43',0.00,3788,1,'v61fiwGfk2/A/mxafkIbSUPb7qiNExyDgTAf0kCP8q8swcTxaN/aYH2B','tFuXcY2NfMf7fnGobCk4hZeSbyIQYMjeHXtIOPvpeXtSkj2oGrk=',1,'["家庭出行", "新客"]','测试数据','REF001012','2026-01-15 04:19:43','2026-08-24 11:52:43'),
(1013,1,'Isabelle N.','https://cdn.mtrip.test/prod/avatar/1013.png','sTkKkCR2p+XBGFBjb2UTWnt8b5C+bS2UDjNWXQ+9Xfst9o7kEQ5tQw==','a5c62da0bfa8f22ddb67aa217c3e86e86f8583cad6172f25edad73b673bd7bf7','orOnQATwJju0rIhYx7QbhWYyZNKcDN2ZQjXqfjiPzz756ICdSrrYYQSz3vpY7HI=','$2y$10$O40vID8g/.jN6Ha7RzjuTOKH6PFsYpeuJqg8AV3BgKjkcWXZWrArS',2,'2025-11-25 04:19:43','2026-08-06 01:59:43','191.176.81.62',1003,'2027-02-26 04:19:43',1500.00,2648,0,'QR9ChSL55flUbIIHE9tnSvyS4AtqECB5a6dR+7soRpfWNyJJgLvj1g==','SZVrznaqy6O18IP6xVEUNQV7GCjIuvj0+RhSYuqgi0Ye9vTUk5k=',1,'["新客", "家庭出行"]','测试数据','REF001013','2025-11-25 04:19:43','2026-08-19 00:16:43'),
(1014,3,'Alice N.','https://cdn.mtrip.test/prod/avatar/1014.png','arI+O5XqfpKhdzCh6bVrjD61KIY8RC1Fr2s7g68aZWyRGfPUNlkq0Q==','bc762be35f0d785276f5e1b56c2e9e159144458c37ab370db306cb9ae7e1c374','opX2AN8TtGna0cq715FVzGJ1UIqeAmDQRi4ew58u8QIHr4AlfoKIRchxWHMq0l0=','$2y$10$jeKCIZH8lmvxd12GGGYdSO06OFIHP4sVnTyB6I2eOJ8wZRpsT20Ra',3,'2026-03-20 04:19:43','2026-08-26 20:40:43','61.60.18.140',1003,'2027-02-26 04:19:43',1500.00,6198,1,'5vp1hudXsNf70MAb67ABtbwGscaJjLURtZOcFwoFZ675H9P9+3Nq','Ej3RknOfAbgYCq8BgK7te+vGisCusp7v9SjjJrx/giP/emGYiUs=',1,'["家庭出行", "商旅"]','测试数据','REF001014','2026-03-20 04:19:43','2026-08-21 23:03:43'),
(1015,1,'Karim M.','https://cdn.mtrip.test/prod/avatar/1015.png','7kzjRCiLH8QGxOOkodWspCKFHpR/5Vkp4FuYNKdY+0iqAy885jpuQA==','8f04f7ccd16c7ac93a352ea40868eed556a97bc240f65f6002f60494ab7d438e','uHM/mx2yD8UrllJKgN/3NDUCNi2nxyYD9XT/G/wb9Mb/SD4Q8UFuy9xFIBqj980=','$2y$10$oo6Rp9OqlD2Zt6bEWdFN8.XsTMM95ZMqsnxoLeEnkq5RxIwat4mfG',4,'2026-01-13 04:19:43','2026-08-26 17:46:43','45.208.53.217',1004,'2027-02-26 04:19:43',25.00,7218,0,'6oCMbf8gcFwMySv8pBIVnampzGDiaEcPljn2qKGI13LSsx7XB0/NI9d9','YF1zHs/hYpKJuc1z+id/swAfOCSK7nAVvNgPGNU0Mhb+fj44E4I=',1,'["新客", "高频用户"]','测试数据','REF001015','2026-01-13 04:19:43','2026-08-25 14:11:43'),
(1016,3,'Rania R.','https://cdn.mtrip.test/prod/avatar/1016.png','dacH10X/ulyDwpQhgq97NEmsC0UCORcqvuOzrSiqXgEZuLaQTYfYZg==','2cc0c10c7ba940365a8cb31a0a4a3c78b0c4e0523fc2a295d128f2c63f8fc6aa','5QjlJJVAK6gMnBYef1JIdoIHLzaVNetUkepBWWNyDH1PPhbKcOg3bM+l2hKh5XE=','$2y$10$i1/qPCCe47yxoIYy6YYEWuqhlXUP3zOgU/I6laWxLX.faXgH.JAx.',1,'2025-08-12 04:19:43','2026-08-01 18:02:43','73.253.87.96',1001,'2027-02-26 04:19:43',1500.00,6744,1,'syqF96O2CUyCTArRRgCdLgaDeqCe+H0+Z+HCFCCHs8VIIzunQgySPg==','M9TamRtjc/vztHOUbf0ATP3AnuNUtz1r1hsWKZBnwiqXsCdCQKM=',1,'["新客", "家庭出行"]','测试数据','REF001016','2025-08-12 04:19:43','2026-08-27 08:31:43'),
(1017,4,'Quentin R.','https://cdn.mtrip.test/prod/avatar/1017.png','sM5TsrRXT054AjWDsOrAiyWmD4ViuRc8U2o1+QUkSLu4zkEbmL9K4A==','981bdb336f302627320f887e87d458fe3c9f099c22715fe2fe0aadd8dc2feda3','nhKNT+BpSULdzOnuZoK3AcEslOCvNeyrRL0pGWUolejYmo+t2R4zbUd8bWLT/Wk=','$2y$10$QVHyVmMR7F4Tg3esiUaIa.7YEhNlhYel/7UwlIJqF92u8tp4qoic.',2,'2026-07-12 04:19:43','2026-08-23 22:57:43','143.155.138.232',1002,'2027-02-26 04:19:43',1500.00,4261,0,'KOazPQYcMxoDJxo6/yzlEy9UzbCz7o6ClS7DbjQ5JPk7+PhVt1UVhDuN','07Ej4zSOXlGmjuH+/pay9ua2UXr0IsfCm95rAoa3r2WCWjJMAPg=',1,'["高频用户", "新客"]','测试数据','REF001017','2026-07-12 04:19:43','2026-08-09 23:14:43'),
(1018,3,'Daniel R.','https://cdn.mtrip.test/prod/avatar/1018.png','Ar+GQkDR7EIR3hQYqP/gNH8S738pu37D1TgnPX9kZrnr7eN8BDnRtQ==','fdee30f7a4e64516cc1ee2715e1ff822f77b3f6eeb399173c5b4b00151a328e7','zvB28+UdZ+AcvoTSMHsLIJLAO9wIsblVUD8dVZTRvp3+nmcnmfxt2OuV9sF9uZk=','$2y$10$MDmM0azHAiU6lbsKmOJjvep8gKU0/fpsIC3QDknLhFTDpQVaIxd6C',4,'2025-09-06 04:19:43','2026-08-09 03:11:43','1.185.38.198',1004,'2027-02-26 04:19:43',0.00,3406,1,'BInnK+M4Li3qDf67PsK2PsjQ6AT+vwhsYL3ks5+QNOgJ1w5HSZOqHhs=','UE1pqubQSkKKTPDdT7Iy35dW5ixbf/Cn87IBK1h/+nhT+shW1mE=',1,'["商旅", "价格敏感"]','测试数据','REF001018','2025-09-06 04:19:43','2026-08-25 07:07:43'),
(1019,4,'Emma M.','https://cdn.mtrip.test/prod/avatar/1019.png','QC/fhZ4wdNxKI8AX+EnOEUx/Kh9Lq+x8f8MMo6moEJM+eMXyzE0DZg==','a4f7ff12042fae0a6d12942dd89803c7195a9a0c54b0a0ae05a215736cd1679f','JX8e1nh6d+wkUtb3JE76eNe2+pWIaIO63fWPDtzEECPas6tCO6wj3Y27rLvOY/k=','$2y$10$WWpTPzE7QdTtzIsLFGnYZOiLYckcAhxL5jBDQsVr2fZIER5m3vtM6',3,'2025-12-23 04:19:43','2026-08-16 15:18:43','25.171.98.42',1002,'2027-02-26 04:19:43',1500.00,3133,0,'H3dN4LRSBvO518b9DqoxiWiiKc52PllRa4U8QvwpA2csDWyUYp8U64o=','amug5aSo3EitKkj26zmsg+tGGLXVIfMPunM7gDEwf/+uPH2/S5s=',1,'["家庭出行", "价格敏感"]','测试数据','REF001019','2025-12-23 04:19:43','2026-08-24 04:24:43'),
(1020,4,'Bruno P.','https://cdn.mtrip.test/prod/avatar/1020.png','su0kXfOYfQfiVN9JwIK/7r5/M+6R+E6KLiLpgTSPt01YF/0022ljQw==','a78fc52be0f19943c54ab9e21ee08c908cc8582b12bb8886b7e5a5a0ac6a2721','YHjov7UG5P8rSXf338OuVsdHn02MmQuI20SnwdZ0m0vkvlhsCrhk1J9SbAxTII0=','$2y$10$cBz6mCZq2tzE.rSLHZY34en57l1A6aXl5atmAIrVOiAZpTH08/YNG',4,'2026-07-17 04:19:43','2026-08-14 13:57:43','25.218.15.14',1003,'2027-02-26 04:19:43',480.00,7915,1,'K643rcRin01QD0RAFPh03OPvxD6juEhopGMsMftEK4H0TOkyZ06k3yDL','a+wA4aKA4hzD/o2Tfg9E+SbYO8vapxJrzaWs4y2kAhgA2M4Pn00=',1,'["新客"]','测试数据','REF001020','2026-07-17 04:19:43','2026-08-11 05:23:43'),
(1021,4,'Karim L.','https://cdn.mtrip.test/prod/avatar/1021.png','cg8C+Yvd8IeuNYprA91qnZeWkXSkPKYxwBKkIz7l+zquCG9Z0UeveQ==','b88b406553994e7778325c028ecdcaf97da52d3a4cc2c8683efaf504c90ec0ca','Q5jRmNhg+Bg7C7/g2P7uWr80a60JnnKDuiUUJyJD5IYQand2KpurL5IbZbuH/4E=','$2y$10$2lkxWqGoonbXFsBh6L0Md.fU6SUxoTDEAxbDX3L.EkxOxgjJkpIIm',4,'2026-06-09 04:19:43','2026-08-28 01:21:43','8.56.242.63',1001,'2027-02-26 04:19:43',120.00,3049,2,'VAq7oXAZZWaubbvjxey0eVoIgLcIuYjwjtnLRv8j62x01qlRT+wjOw==','iRLTDy6N93/memEXhNElhmpBKAlKEzf+TWMqFrG2SQ0tRo+eWAc=',1,'["商旅", "价格敏感"]','测试数据','REF001021','2026-06-09 04:19:43','2026-08-23 19:43:43'),
(1022,4,'Karim M.','https://cdn.mtrip.test/prod/avatar/1022.png','V25j0WWWLAACrkVz7AXJofW0qOHoLtyCC4Wi/9NHmSjHkBN8BWH6Pg==','146a64bcd89234aa1cecd7c66a6055b30b7d96af591485ce7ec8f12405421ca4','qAEtPbPkVMpr3UO8kXUIsFeFW2NABnG7U8telbxqNkn776niRijKs5dxaGSPK0Q=','$2y$10$K7CobN8zfS.07AR4dvzP..PEqLXM7yADdc6YiA9SdgsSXnthTDCs6',3,'2025-11-08 04:19:43','2026-08-19 06:20:43','212.151.28.246',1003,'2027-02-26 04:19:43',0.00,552,1,'F4us+50+RNi3qnvGKPvsyDKKiXegEXgza8XbmlsFMtjcpM3KciwpTjQ=','CP2gdJZZeFaHNEr4v4PhsU8/z3L7MFPBAwwEIQ2EjqHePqcpEIc=',1,'["家庭出行"]','测试数据','REF001022','2025-11-08 04:19:43','2026-08-24 03:45:43'),
(1023,1,'Rania G.','https://cdn.mtrip.test/prod/avatar/1023.png','HXHOXTy62xRG7UFoVaSZw98fKtY0IToizbbpoEndzP5/g9PG2kRAOA==','674a396d5e46f43548c5e36bf9b57f63a44d8bd21ab00b4edd3773dc515ee249','GAud69yZrTnhBdC9Zmq7h47ETcs2XZrTVXLDkO6jUPPHngMBj3NnbZ8+JSCbcLA=','$2y$10$e22/jQTbYi2uR9IymdwWi.cDvHKI4tZpUpz6aIhL8o/oyK5WlSjO2',3,'2025-08-05 04:19:43','2026-08-13 14:26:43','81.53.100.177',1003,'2027-02-26 04:19:43',480.00,530,1,'Mz0qjQzvLzVVcdbMFvQNpgxc8Uyy9ObRT/zkPViUxhMKznU2X24gsQI=','jnUvvsBJ06C5HdcmvRz2tXHutLK1gVS+b4pk3zQFV3IQYYMNSE0=',1,'["高频用户", "商旅"]','测试数据','REF001023','2025-08-05 04:19:43','2026-08-26 15:47:43'),
(1024,4,'Tomas S.','https://cdn.mtrip.test/prod/avatar/1024.png','MhX5AVI1SO0cY329HJdDvSdngnlHHf+jHiQ0o6nUVsXP0sowuuoFiA==','b687d5b9a9b221c2a46ffd9f3435d487e0eda7e0e0a096cfb40739546780631f','adheT19R8s3QIvVNTvgS0OuMYrXW+1/AHBsShJZ7NmCV8RhK5/rpUf0HPQ2uUxA=','$2y$10$9gRNyVqxaMFQMQpMMkb8qu8EPJitrt4g5oU9L0ng4mbmTv9mIXgHy',3,'2025-08-03 04:19:43',NULL,'174.164.77.205',1003,'2027-02-26 04:19:43',1500.00,5521,0,'jKaT2N3OLGnwonBKnahDxjNXo5n6zgfvzgvuznogxtsvsdW7AYQ=','HENUwdmlSMSOppKO5ZTscCDl9giDYZ+tBEuCk+pCALVAZC+sNqA=',2,'["商旅", "家庭出行"]','测试数据','REF001024','2025-08-03 04:19:43','2026-08-27 14:20:43'),
(1025,3,'Karim R.','https://cdn.mtrip.test/prod/avatar/1025.png','0Yp1Ejm7j4MmNYLoevyWF115EcFiWjgNANOV5dq0O8TfhvBWIReK1g==','a875dddc52ed835f4792a9d9d705f5bcb088542807b1486c9acc7f15424a1bb5','PlcR0Lw5qwXmZNnPEP2+yKvhQyNZ/rYhN76A/ZVccv7ujIXUucp/8iUBHmBh2x0=','$2y$10$.NLhi/BPd5JuSkL3W4bj2uzAu9bXVn5KW7pTybkBf8sLilSVLnj3S',1,'2026-03-29 04:19:43','2026-08-06 23:23:43','150.61.85.32',1004,'2027-02-26 04:19:43',0.00,4467,0,'2370zqPduCz7MHjzUxPvFmtI769/5gcSseWZLWPZJHlZ/sHlmZ3O90H8qA==','v/I1fREHLX9wNBAY/7OkRDnGsXVImYUrRRSk7Z9wFE9eTyp+vRw=',1,'["商旅"]','测试数据','REF001025','2026-03-29 04:19:43','2026-08-11 12:05:43'),
(1026,1,'Rania G.','https://cdn.mtrip.test/prod/avatar/1026.png','7J8ETounLTQOXr8ft6Gr3OXvmhtkfmE0bJQXl5x2Bzc+Zt0y8MEQLQ==','3efa180430c1963076e38b9d64496e1cf937ec7a6a818208af0a5893718422b1','ZGu51S2qajTrxtMWjqgKyLwRl2naHXJUDUIRfKF7A1qd7VY7CvPn9IxKNFPgUqw=','$2y$10$kqII.OrCXTCWxhcn4OVmBO/2P60ERr5LVNrVjRrpF4bYF1NhUNPIO',2,'2026-04-20 04:19:43','2026-08-13 18:24:43','139.109.122.50',1003,'2027-02-26 04:19:43',120.00,1418,2,'UmsbAkKw7LZ5sdbtnWbFeLDMbda4RzEoj45bjlOlGa/sGCyQtI648Q==','l0z7RdNoEcmeDFXECQdjM9vrcQFogcrHlJXIt3ArgDDDfgiS4eY=',1,'["家庭出行", "商旅"]','测试数据','REF001026','2026-04-20 04:19:43','2026-08-11 20:56:43'),
(1027,4,'Isabelle R.','https://cdn.mtrip.test/prod/avatar/1027.png','eZvpSlgXqjGtm7JNeOzYupmMcE17HWpAhQ2GfOzlouwG6CcxyUwgiw==','7ae3fb4cb38d24411c2a1d690f8df75a2379994ae0fffef3dbda6aab70318908','EaOGhneGhDBuodXHpngkgKZ7Ebn2OKKCVyIfUcOcIIzGThWuBkH79CMuQQMDzC4=','$2y$10$NbBcCqBiovd3IqbQ39zey.wUrzCTNE66xey.l1q2PJp6wxO7omM9u',1,'2026-02-11 04:19:43',NULL,'83.124.169.132',1004,'2027-02-26 04:19:43',1500.00,2114,1,'WNzG79DVgTQIdBs3SzobRD/cGYfjAPemjxBya8W1Ve5YOZXf/Y2BeQ==','vz+vTqQb6U0Y0hGfYjWgEf+6+p5HfLiMBhVAhtexbo+O5znrN7s=',2,'["价格敏感", "新客"]','测试数据','REF001027','2026-02-11 04:19:43','2026-08-19 14:48:43'),
(1028,4,'Daniel D.','https://cdn.mtrip.test/prod/avatar/1028.png','mAlhoW9Nh/4A1UihEAtyLNuxtIfEBYh/kLyPhE+vKpzeL5fyfLdkgQ==','e5fe98f4f7b5fd436f37a7c6b9daa0c9cbab66f78491d99454507db1a79be9e8','77IxZHSwoLtBZ0ZBAODS6ePZORep5itaLtmfP/BRF7sze+uT2c1NjcTacr6hKy8=','$2y$10$YXNBtDS0qGr39UzO/KphbOR5ZJhCUMjrq6gSCr8JUAYFHuWBgy0lq',3,'2025-10-06 04:19:43','2026-08-05 18:14:43','69.102.107.234',1002,'2027-02-26 04:19:43',120.00,3757,1,'1CGv3AU9ExVv5O37JNsTWtE2lTO2nCi29zG/0UMgKgD+PtGhFDQZ','f7uTRtZOobMvh9ZdgdZzzAqPWez/QrS0Nxj8/WKzfsFjSGhRFr4=',1,'["价格敏感", "商旅"]','测试数据','REF001028','2025-10-06 04:19:43','2026-08-15 08:49:43'),
(1029,1,'Lea N.','https://cdn.mtrip.test/prod/avatar/1029.png','YzV9Jx1zgzGq8UxFe/hk8edHqXW/wnBiJsBkGRT0ujU2LQ+rJNzCIg==','05527396b79b76b519ba182a2f4d5bba4e9e211cca97f10941627ad03a80cc21','0saZYBW1E7nKLZ4aHCaY+wnZZPv8eSYDA+EfzLjLKPCagSsT15bHB/8ZzOdSFVc=','$2y$10$dulZFwpJ8Vzt7.FKDWnmpONsLeacmsAa9ZQdCgL6SMWJOuIHFjn4C',2,'2025-09-09 04:19:43','2026-08-14 04:08:43','196.214.163.228',1001,'2027-02-26 04:19:43',0.00,5454,1,'AkidOdSu6J3Rw7BLBEvAlSfUO6RSGX8GOxa5wNuyc4DZHtXGbEYGfQ==','1Mgo8kc+8EEVEX9iRS7J7gkpAx2Jk/zVJbHfbhXAZTL202OXKYk=',1,'["新客"]','测试数据','REF001029','2025-09-09 04:19:43','2026-08-20 08:12:43'),
(1030,4,'Julien S.','https://cdn.mtrip.test/prod/avatar/1030.png','Tvqt9GIGzVGGQbZVblcE97Ps7ln/QpKLEfyvEj3dbyxIYrO74ZjuCQ==','fa79d6d1191939febf229e6e20f56006378274c3f543b7458052f5362a1592a2','SWeIpov3ZijKfZSWXwqwOwes1R9dEhBRQ8I2ylDwWOUEqIx0X8OnS1jZRgVvmsM=','$2y$10$To5AvEge2DDnP8uM6ib.1eg5P6TgririOrX8igwcXpWB5uHbfGd8e',3,'2026-04-29 04:19:43','2026-08-01 10:33:43','111.151.52.62',1002,'2027-02-26 04:19:43',0.00,4514,0,'+nmDF3G40XVCchVPcIOlMvFrRC8FPk2VJt/jgOdEf+ZwJt/FG+vY','94F9ITLD32CCZ8hmlY79HrD9FLGmNReLjqXUEFRbpt4sGMy9GJo=',1,'["新客", "价格敏感"]','测试数据','REF001030','2026-04-29 04:19:43','2026-08-26 09:40:43'),
(1031,1,'Karim M.','https://cdn.mtrip.test/prod/avatar/1031.png','ZTVDUHHe3IsLP67XpMxLfh8Rmv1Cf/ZUB+rvdax+3K4oJZt0JXfN6w==','df33bb3febb16d4ca81b5d98ec74af0482b7307fe63c9830e7c2e9ac3a823307','vN4LL6TsHe3w/WgTDmb/zfA1C5D3GEzHf+YRTDIR0zBnJk2Glpw4EiRlzLDw+gA=','$2y$10$YbgtyuxctoROPs7JGuAOIeU2giai2IdsIRmOT2cAHOfXBQYPyXj72',4,'2026-07-17 04:19:43','2026-08-13 05:16:43','180.125.187.60',1002,'2027-02-26 04:19:43',1500.00,7724,1,'Ezdi0w9kE8WryrQdSud7qxV+lfAMVMYBSIrAwni8cUqUtx/4Bc3N','IDLDzH7lv2z/wvwesVr268JA5il/kv7itUxBNKHzaoKlV4AL+uo=',1,'["商旅"]','测试数据','REF001031','2026-07-17 04:19:43','2026-08-20 09:27:43'),
(1032,3,'Daniel P.','https://cdn.mtrip.test/prod/avatar/1032.png','RMmB5C9WpKyYSoiSo5YM0TATM0Kno8c3KklZ+52uRGIoa9C8B+umfw==','b14cdacf7eca926456b5c4df120e10f2fa92af2e08315d800ace8d5675908dce','zdznY+toNS59MfTyu4WMEYIvhjjCI/Az2eiocmwQscl49KO/xonU1ofnZz/UP7w=','$2y$10$SBR2kePS4NYuNkyRnEsNl.mUvdncoTfcFprZbvMBE7zv7TlGeJKpy',1,'2026-01-16 04:19:43',NULL,'181.106.72.89',1003,'2027-02-26 04:19:43',120.00,1,0,'U/POhwJj9jlg26rwUEEQaNF4dSBBgonDtI7wE2eCgqHTvDOYLUy1hdA=','InYBBF5DsGe/+ZxXMl9BDhy3YjsTQYlgbIWfzQYDGmwJUy3sTa4=',3,'["价格敏感", "高频用户"]','测试数据','REF001032','2026-01-16 04:19:43','2026-08-11 08:59:43'),
(1033,3,'Chen D.','https://cdn.mtrip.test/prod/avatar/1033.png','qkBoP98GXlFS5PaifDpLZnzTX8Da9Cejz1mjDIS3OPYKuigdWewIDA==','4b048911f08924bd217d4a6ea2b7e43b7ade4af293bc7d7aab3be1eeca44f7fd','R+qp9elZcVgOQ5l3Ee4QLKiP225hWE8Fwh1A/HwcLibzG1PU7z/XBYM8we9c0QQ=','$2y$10$RgtBb5RyHIsI2V3sVTjFke1qXxisBNVHyD/uP8JETUjTpD43Ft/lS',3,'2026-01-21 04:19:43','2026-08-26 11:16:43','97.237.154.30',1004,'2027-02-26 04:19:43',25.00,3410,1,'RLn22HQME9pSWz7yrU0eYfO0C65NzC1oTMmFQ20KKrsLZ6Rk922b','5WEm9vuAsxqgzWIxK4XwSyZWqaEvWrLjd8hTjKVyl3oFd5HCgNA=',1,'["商旅"]','测试数据','REF001033','2026-01-21 04:19:43','2026-08-18 06:05:43'),
(1034,3,'Lea G.','https://cdn.mtrip.test/prod/avatar/1034.png','CQxtvRfwFKnf8W+HKEAJ2fl9KjJ25+zqeRBdd0f1vmxjEgVr932YLg==','1fc9d2ba8cd7b08016fe8a364c0262f1fb7f9c10d85fde0b5bb6ef262a4c378a','I22f1Vvt8ionF0RSTz8n2FpiB6AIHAZN1ZowkW67BA/OmZ/3elfZS5u7yjL+uO8=','$2y$10$YFZeeIk/N5kPPM1elKSr/Oy6AsrniDnv6I8qeXkdLXi3VXDyY13cC',3,'2026-05-09 04:19:43',NULL,'55.150.161.169',1001,'2027-02-26 04:19:43',1500.00,4283,0,'PRwBIQzymdppvFhJT0Y/6n8GSLf1H16zkVHHDM3p2K9UyC0M4ZY=','XRinWqzvWQWtdekhSyH4uyo1z+aUTwURN/OffF/JRidwCyUCN1Y=',3,'["价格敏感"]','测试数据','REF001034','2026-05-09 04:19:43','2026-08-12 03:56:43'),
(1035,1,'Felix M.','https://cdn.mtrip.test/prod/avatar/1035.png','1f5IArEBAgpjD/oyRSleeE+oxCzXfND/fAcM6PrhTKkYRtgKf9XCGg==','5c16d8266bae60ac4f232034d6b82e36b77c77971a40a9e055dbf0d5471b7bd7','FWqLX/mzoj0e+3pBh08FVkw/ISU8sMjwKq3eynY7rxC7nmmDMLJZXMOlONCEhNs=','$2y$10$.fbXwbVaiesOKIPWjVFTEeM5W7WAk.FUcWPI1wyON61enG3FkB3wW',1,'2026-05-15 04:19:43',NULL,'119.240.194.13',1001,'2027-02-26 04:19:43',25.00,370,1,'ypTEMZYZr+LypZPbotH1twneEsbB0i77AvWrXPrTrv94aHAUJJBev7Q=','yfT4uGjBY3JR9pKbujfSdmfDNbodd7nPzXoDDniA4tw5GP2s2L8=',2,'["家庭出行"]','测试数据','REF001035','2026-05-15 04:19:43','2026-08-26 04:03:43'),
(1036,4,'Tomas M.','https://cdn.mtrip.test/prod/avatar/1036.png','DxGZP/nz9qvyo6XbDDRG6xIf+2OmDFMuG4UhuyixB0AJVJEXq1emFg==','8f9409bb1bf841e634438492ba8c2de17309ef90962781c01288ac199f33ee58','E0UHqON3o/ETv24V6kZWUjfqCXzS1Q/H0BlbAzjS/htI0mW7BeP1HTiivKEOkII=','$2y$10$b0MFFusTINroaPVTMGNysuvhdc2TslsgFoAATbwQyU1XrnOG4u9OC',2,'2025-09-24 04:19:43',NULL,'25.184.232.66',1001,'2027-02-26 04:19:43',480.00,5438,1,'0IU71+jZi6N0LNcVab229NZIeJQ9p2xvB5jWDsEVTJfmqHDl0Ldy2A==','iIPY5ZuC795sYncPNSHTUaL0Dk41/Pr6uLE33ke3czHYIeVrBh0=',3,'["家庭出行"]','测试数据','REF001036','2025-09-24 04:19:43','2026-08-13 10:32:43'),
(1037,1,'Lea L.','https://cdn.mtrip.test/prod/avatar/1037.png','JIgn4ws9ZE5bunihbY2uB/rWJVY8/eRKXMa70D9UrviEGcMti6iTIw==','333f65dfac0290ffce3f323e5370421bb0a5c0c5a4e8045b8840925c84f4c852','/tEPK3o46dgJJGvzJSu6XtYpCqq1EzlKnw4F1kbUrdivk6SvFHG7IySfCws3p/U=','$2y$10$Z0K2fL6OHRvT7XjtezDYYu.CQXAWEuTBQwhpnuAIqpdDQ.mh4FjOG',1,'2026-02-16 04:19:43','2026-07-30 21:06:43','197.215.245.158',1003,'2027-02-26 04:19:43',480.00,7597,1,'qgryCe9EWqLx1zBIsx7qxDR6bYCNaKuAsuJVQfKLK9gW9FS6VXAHCtU1','A0e629Bzw4j1UNf1Xr4noFT3T4ipJaOeXrHLLIV81t/j7v3rmho=',1,'["商旅", "新客"]','测试数据','REF001037','2026-02-16 04:19:43','2026-08-25 02:15:43'),
(1038,1,'Pauline B.','https://cdn.mtrip.test/prod/avatar/1038.png','FapmhuE6nTqgzMHEHUw7WSVnXwAvqfQ9jKwu3gzamW2BTpASlkxX4g==','c3e218fb66c3eadbf3c432f4a387261163afee4a1b261438fc3623fae4b2af33','cbbXQfKNZwMDPrtd3wGnjFoo+eEAq8dZDEk++AKSoAXtLN9wap8NOprINm7qAko=','$2y$10$o80cfZSRU.B5mLEzJOLr8ekEJyh9Bgo2urqGvCpqM3H./.wrREFei',1,'2026-02-16 04:19:43','2026-08-24 23:21:43','211.167.66.120',1004,'2027-02-26 04:19:43',0.00,5871,0,'VnnMVQECjZf1nHfch93fbZqcrz5p0CI/v1I0uNKkdNS3vsLpJSmFAjs=','mHwdjbn/npWpEUKdxmgk5uM4hpAc+h+ykIBPtre9s7xfr+SL7EU=',1,'["价格敏感"]','测试数据','REF001038','2026-02-16 04:19:43','2026-08-11 19:47:43'),
(1039,1,'Alice N.','https://cdn.mtrip.test/prod/avatar/1039.png','uKPcKlUNKDs+RrZGLQaJhzkvNLmF2Psrl5OqfDk0EXbMu5BFBTnqSg==','4110ef27897a5eb609cef62da53e44cb11a65ad6bdd3c1fa749d5825fc3a0da5','qn0FTEsa8JW4iNxchVo9eDuGNrJQjD32PJKUwatWru/fFB3vFc6qXlLg2cKhSpA=','$2y$10$vjD5kduw21rEirKRLGThmuBNuMXJ2KjJzEA0H20veGPJsQpzQsi2y',3,'2026-05-15 04:19:43',NULL,'129.162.241.170',1001,'2027-02-26 04:19:43',25.00,3290,1,'BRLweqTkNqUTAMZ14eF6+gbD82D8Ek7nZzSLzVFNmvYDQGOmIUI=','zM+mH/FiMhCGIz8unBzF6Dzhij4zCcksPDIOGR4jlvZ7ALvITXE=',2,'["高频用户"]','测试数据','REF001039','2026-05-15 04:19:43','2026-08-12 03:21:43'),
(1040,3,'Tomas M.','https://cdn.mtrip.test/prod/avatar/1040.png','/CJ3ezvJnXoX4D0KQfsk5uxSZFhAi7bKA0R0wTQ1K4ndvfHfDd1eGQ==','e452b4aac61b0a9c8ee5f64abc438006fb517201cda8d779e25865cabeb51399','0wYEwRg9cvDUY3ISJeRIHUUrPpKFfeAGQNJ5QJKphZKt8b9PmdzhIwca1lL2zIc=','$2y$10$QUlim51HIIbaQ60LD5ZOeu9m1FKoIOM7mb.L3FQPmIyi9M3q5EVxK',2,'2025-12-24 04:19:43','2026-07-31 03:14:43','140.127.59.201',1004,'2027-02-26 04:19:43',120.00,1815,0,'ve22qhJXGdW3MW3L6KwQz8SGtWXkSkQPUDEYEcMhcehzet0lUVH9','OM65uALVPmKBh2KsX4STmOwk29pB7CxvJP3JZylPZ+qWrW9J7M8=',1,'["家庭出行", "价格敏感"]','测试数据','REF001040','2025-12-24 04:19:43','2026-08-28 04:16:43');

-- 常旅客
INSERT INTO `user_traveler` (`id`,`site_id`,`user_id`,`nationality`,`first_name`,`last_name`,`id_type`,`id_no`,`id_expire_date`,`is_default`,`created_at`,`updated_at`) VALUES
(1001,3,1001,'DE','Bruno','Laurent',3,'vIdbDWp5jDS9c71DktXtB+coplow04tODvB1uXn8P1NowxA+','2028-12-30 00:00:00',1,'2026-01-09 04:19:43','2026-08-27 07:29:43'),
(1002,3,1002,'CN','Sophie','Robert',1,'PBbwHEgdCcMsRw3e+LZ+UO/BdjOE3jDyNNDOPPMeM9EYyRF1','2031-02-09 00:00:00',0,'2026-03-20 04:19:43','2026-08-29 00:51:43'),
(1003,4,1003,'GB','Nina','Haddad',1,'6HBR0QOfCtQnNxPVpaeL2ZzDigLim2wd0I/+Pm0e3Vq4SszY','2030-03-30 00:00:00',0,'2025-12-01 04:19:43','2026-08-11 09:44:43'),
(1004,4,1004,'FR','Tomas','Martin',1,'1EnWN9RKg8RbTa6oKT7xJA1qQI2ecve2sGYYXOhvxG30toZf','2028-02-05 00:00:00',0,'2026-03-18 04:19:43','2026-08-16 20:52:43'),
(1005,3,1005,'GB','Karim','Martin',3,'yFWHEw9AmlC1sQawA+oQUc1Ax/6gv0/GC6tkAXcJ+GT3tUqj','2031-02-18 00:00:00',0,'2025-10-26 04:19:43','2026-08-25 23:06:43'),
(1006,4,1006,'CN','Marc','Thomas',1,'jRq2eG4lztiGHO6Vs+B13P/BY3DhxQIEPiaxCNG+KD8tglz6','2031-01-17 00:00:00',0,'2025-10-13 04:19:43','2026-08-15 17:36:43'),
(1007,1,1007,'GB','Julien','Petit',1,'gZH+Q1HA2thlj8v4DBGLYpwbY1IDYc0yiQA9UJq89Y9+fjaJ','2029-10-31 00:00:00',0,'2025-12-17 04:19:43','2026-08-20 14:56:43'),
(1008,3,1008,'US','Quentin','Leroy',2,'1tzFDRZDla6dgy5+yfyBHos3oO8WbqZ5SYPTCUuqVnxLG4tp','2030-10-14 00:00:00',0,'2025-08-22 04:19:43','2026-08-17 07:36:43'),
(1009,4,1009,'CN','Karim','Richard',3,'eIrHo87Xh8vpIJUn6K4J2iphp/A2PkSED71BvVSwDcwyjZgw','2030-10-24 00:00:00',0,'2025-11-26 04:19:43','2026-08-21 17:02:43'),
(1010,3,1010,'DE','Bruno','Martin',3,'hIxFZDZ209qsCRYRVLJAx1tv7oI2J4ro3Bm9wg2uR6au5Oe3','2029-04-13 00:00:00',0,'2026-02-05 04:19:43','2026-08-13 01:00:43'),
(1011,3,1011,'US','Nina','Richard',3,'kHKap0Z4HYTR6UyQ6E0AF4RZaYKmr/ETXS8dia2eipakHI43','2029-02-16 00:00:00',0,'2025-12-20 04:19:43','2026-08-18 08:04:43'),
(1012,1,1012,'US','Nina','Thomas',2,'PKffV841wYYk4ALdRAUmzTvanckIYYU4gmDjFfVPDH7BqhTA','2027-03-25 00:00:00',0,'2026-01-15 04:19:43','2026-08-24 11:52:43'),
(1013,1,1013,'US','Felix','Garcia',3,'2vDDE6lmODRGHwQ/s7diz+Fn4HUGcPOuQuLA2bs+JVgcdqO2','2030-04-03 00:00:00',0,'2025-11-25 04:19:43','2026-08-19 00:16:43'),
(1014,3,1014,'CN','Lea','Costa',3,'QLEkZO6UAjM7UUMRAmd32Rnha16B+gdcdWHlwGIrlS9m9Wmj','2027-08-09 00:00:00',0,'2026-03-20 04:19:43','2026-08-21 23:03:43'),
(1015,1,1015,'US','Marc','Nguyen',3,'cy/x0PUcA6mIw1zgSAh7atZbjVY9n7jwX/uugsXEtd7wjwCd','2028-12-25 00:00:00',0,'2026-01-13 04:19:43','2026-08-25 14:11:43');

-- 余额流水 / 积分流水
INSERT INTO `user_balance_log` (`id`,`site_id`,`user_id`,`change_type`,`amount`,`before_balance`,`after_balance`,`order_id`,`operator_id`,`remark`,`created_at`) VALUES
(1001,3,1001,2,-207.00,430.00,223.00,0,0,'订单消费','2026-07-29 11:06:43'),
(1002,3,1002,3,226.00,1551.00,1777.00,0,0,'订单退款','2026-08-03 09:49:43'),
(1003,4,1003,4,-37.00,1472.00,1435.00,0,101,'平台调账','2026-07-09 01:27:43'),
(1004,4,1004,2,-292.00,151.00,-141.00,0,0,'订单消费','2026-08-17 10:21:43'),
(1005,3,1005,5,-408.00,1529.00,1121.00,0,101,'用户提现','2026-07-27 02:30:43'),
(1006,4,1006,5,-238.00,175.00,-63.00,0,101,'用户提现','2026-08-10 12:51:43'),
(1007,1,1007,1,302.00,1518.00,1820.00,0,0,'在线充值','2026-07-02 22:04:43'),
(1008,3,1008,4,-190.00,334.00,144.00,0,101,'平台调账','2026-07-18 12:56:43'),
(1009,4,1009,2,-158.00,449.00,291.00,0,0,'订单消费','2026-08-26 03:36:43'),
(1010,3,1010,4,-348.00,1953.00,1605.00,0,101,'平台调账','2026-08-11 16:35:43'),
(1011,3,1011,2,-386.00,1559.00,1173.00,0,0,'订单消费','2026-07-26 06:34:43'),
(1012,1,1012,4,-57.00,1457.00,1400.00,0,101,'平台调账','2026-07-05 13:27:43'),
(1013,1,1013,4,-339.00,1715.00,1376.00,0,101,'平台调账','2026-08-08 04:39:43'),
(1014,3,1014,1,391.00,1822.00,2213.00,0,0,'在线充值','2026-08-28 06:34:43'),
(1015,1,1015,1,430.00,1590.00,2020.00,0,0,'在线充值','2026-08-22 14:18:43'),
(1016,3,1016,3,360.00,1797.00,2157.00,0,0,'订单退款','2026-08-04 18:49:43'),
(1017,4,1017,2,-340.00,1861.00,1521.00,0,0,'订单消费','2026-08-29 12:56:43'),
(1018,3,1018,2,-415.00,430.00,15.00,0,0,'订单消费','2026-07-02 01:50:43'),
(1019,4,1019,2,-202.00,1945.00,1743.00,0,0,'订单消费','2026-07-12 13:26:43'),
(1020,4,1020,3,20.00,898.00,918.00,0,0,'订单退款','2026-08-29 19:52:43');
INSERT INTO `user_points_log` (`id`,`site_id`,`user_id`,`change_type`,`points`,`after_points`,`order_id`,`remark`,`created_at`) VALUES
(1001,3,1001,5,16,4987,0,'测试数据','2026-08-23 03:33:43'),
(1002,3,1002,3,-13,6829,0,'测试数据','2026-08-08 01:40:43'),
(1003,4,1003,3,705,1426,0,'测试数据','2026-08-28 18:16:43'),
(1004,4,1004,5,-480,781,0,'测试数据','2026-08-04 23:58:43'),
(1005,3,1005,2,878,3520,0,'测试数据','2026-08-19 07:03:43'),
(1006,4,1006,1,511,538,0,'测试数据','2026-07-20 23:21:43'),
(1007,1,1007,3,-146,3796,0,'测试数据','2026-07-21 06:22:43'),
(1008,3,1008,1,513,4048,0,'测试数据','2026-07-27 09:46:43'),
(1009,4,1009,1,258,4798,0,'测试数据','2026-06-30 19:20:43'),
(1010,3,1010,1,705,740,0,'测试数据','2026-07-26 14:03:43'),
(1011,3,1011,5,-216,6463,0,'测试数据','2026-08-02 11:03:43'),
(1012,1,1012,1,259,3788,0,'测试数据','2026-08-22 10:00:43'),
(1013,1,1013,3,-302,2648,0,'测试数据','2026-07-02 08:04:43'),
(1014,3,1014,5,21,6198,0,'测试数据','2026-07-16 20:21:43'),
(1015,1,1015,1,564,7218,0,'测试数据','2026-07-28 00:23:43'),
(1016,3,1016,4,831,6744,0,'测试数据','2026-07-14 23:30:43'),
(1017,4,1017,5,670,4261,0,'测试数据','2026-08-24 15:32:43'),
(1018,3,1018,5,405,3406,0,'测试数据','2026-08-20 12:42:43'),
(1019,4,1019,4,652,3133,0,'测试数据','2026-08-29 12:26:43'),
(1020,4,1020,4,587,7915,0,'测试数据','2026-08-02 12:58:43');

-- 用户反馈与投诉(覆盖 0~3 全部状态)
INSERT INTO `user_feedback` (`id`,`site_id`,`user_id`,`feedback_type`,`content`,`images`,`order_id`,`status`,`reply_content`,`handler_id`,`handled_at`,`created_at`,`updated_at`) VALUES
(1001,3,1001,3,'房间卫生状况不佳,希望改进',NULL,0,2,'已收到您的反馈,我们会尽快处理。',104,'2026-08-11 22:56:43','2026-08-08 20:12:43','2026-08-20 03:07:43'),
(1002,3,1002,2,'App 搜索筛选不好用',NULL,0,0,'',0,NULL,'2026-08-09 14:47:43','2026-08-19 12:20:43'),
(1003,4,1003,2,'希望增加更多支付方式',NULL,0,2,'已收到您的反馈,我们会尽快处理。',104,'2026-08-25 07:04:43','2026-07-23 07:30:43','2026-08-22 18:14:43'),
(1004,4,1004,4,'商户拒绝接待已确认的订单',NULL,0,1,'已收到您的反馈,我们会尽快处理。',104,NULL,'2026-07-02 01:39:43','2026-08-23 21:57:43'),
(1005,3,1005,3,'App 搜索筛选不好用',NULL,0,2,'已收到您的反馈,我们会尽快处理。',104,'2026-08-11 22:16:43','2026-08-20 23:24:43','2026-08-24 15:51:43'),
(1006,4,1006,3,'房间卫生状况不佳,希望改进',NULL,0,0,'',0,NULL,'2026-08-11 09:04:43','2026-08-24 08:51:43'),
(1007,1,1007,1,'希望增加更多支付方式',NULL,0,0,'',0,NULL,'2026-08-15 08:38:43','2026-08-21 10:05:43'),
(1008,3,1008,1,'房间卫生状况不佳,希望改进',NULL,0,0,'',0,NULL,'2026-07-14 02:12:43','2026-08-29 05:46:43'),
(1009,4,1009,4,'希望增加更多支付方式',NULL,0,1,'已收到您的反馈,我们会尽快处理。',104,NULL,'2026-07-02 23:09:43','2026-08-21 14:51:43'),
(1010,3,1010,3,'App 搜索筛选不好用',NULL,0,1,'已收到您的反馈,我们会尽快处理。',104,NULL,'2026-08-10 20:34:43','2026-08-22 03:54:43'),
(1011,3,1011,1,'客服响应速度太慢',NULL,0,0,'',0,NULL,'2026-08-06 01:34:43','2026-08-20 14:26:43'),
(1012,1,1012,1,'客服响应速度太慢',NULL,0,1,'已收到您的反馈,我们会尽快处理。',104,NULL,'2026-08-08 05:39:43','2026-08-27 00:06:43');

-- 用户操作日志
INSERT INTO `user_action_log` (`id`,`site_id`,`user_id`,`action_type`,`content`,`client_ip`,`device_info`,`created_at`) VALUES
(1001,3,1001,4,'测试数据','10.1.7.136','H5','2026-08-07 01:14:43'),
(1002,3,1002,3,'测试数据','10.1.1.89','Pixel 8','2026-07-24 14:05:43'),
(1003,4,1003,4,'测试数据','10.1.2.149','H5','2026-08-27 08:05:43'),
(1004,4,1004,4,'测试数据','10.1.0.240','H5','2026-08-20 22:59:43'),
(1005,3,1005,3,'测试数据','10.1.5.126','iPhone 15','2026-07-30 16:55:43'),
(1006,4,1006,3,'测试数据','10.1.9.29','Pixel 8','2026-07-17 14:04:43'),
(1007,1,1007,2,'测试数据','10.1.2.123','Pixel 8','2026-08-08 21:32:43'),
(1008,3,1008,2,'测试数据','10.1.6.250','H5','2026-08-24 00:12:43'),
(1009,4,1009,4,'测试数据','10.1.1.233','Pixel 8','2026-08-06 19:11:43'),
(1010,3,1010,2,'测试数据','10.1.3.80','H5','2026-08-02 21:12:43'),
(1011,3,1011,5,'测试数据','10.1.7.99','Pixel 8','2026-07-20 09:13:43'),
(1012,1,1012,5,'测试数据','10.1.2.235','Pixel 8','2026-07-18 16:54:43'),
(1013,1,1013,3,'测试数据','10.1.4.47','iPhone 15','2026-08-06 13:07:43'),
(1014,3,1014,5,'测试数据','10.1.9.201','H5','2026-07-28 15:18:43'),
(1015,1,1015,2,'测试数据','10.1.3.13','Pixel 8','2026-07-21 13:08:43'),
(1016,3,1016,5,'测试数据','10.1.8.111','Pixel 8','2026-08-21 10:51:43'),
(1017,4,1017,4,'测试数据','10.1.2.156','Pixel 8','2026-08-11 21:18:43'),
(1018,3,1018,3,'测试数据','10.1.5.180','iPhone 15','2026-07-22 22:18:43'),
(1019,4,1019,3,'测试数据','10.1.1.174','iPhone 15','2026-07-15 08:56:43'),
(1020,4,1020,4,'测试数据','10.1.9.58','H5','2026-07-16 11:55:43'),
(1021,4,1021,2,'测试数据','10.1.8.207','iPhone 15','2026-08-14 08:32:43'),
(1022,4,1022,2,'测试数据','10.1.4.74','Pixel 8','2026-08-17 07:10:43'),
(1023,1,1023,1,'测试数据','10.1.9.5','Pixel 8','2026-08-10 22:43:43'),
(1024,4,1024,2,'测试数据','10.1.7.129','H5','2026-07-16 23:06:43'),
(1025,3,1025,1,'测试数据','10.1.7.35','Pixel 8','2026-08-17 08:48:43'),
(1026,1,1026,3,'测试数据','10.1.6.128','Pixel 8','2026-08-01 20:32:43'),
(1027,4,1027,2,'测试数据','10.1.9.245','iPhone 15','2026-08-04 09:53:43'),
(1028,4,1028,4,'测试数据','10.1.9.119','H5','2026-07-20 11:24:43'),
(1029,1,1029,3,'测试数据','10.1.5.167','iPhone 15','2026-08-20 03:51:43'),
(1030,4,1030,5,'测试数据','10.1.5.28','Pixel 8','2026-08-06 00:58:43');

-- 收藏 / 推荐返利 / 站内通知
INSERT INTO `user_favorite` (`id`,`site_id`,`user_id`,`goods_id`,`created_at`) VALUES
(1001,3,1001,1001,'2026-08-07 22:07:43'),
(1002,3,1002,1002,'2026-08-13 10:33:43'),
(1003,4,1003,1003,'2026-07-11 12:34:43'),
(1004,4,1004,1004,'2026-07-13 14:22:43'),
(1005,3,1005,1005,'2026-07-28 10:55:43'),
(1006,4,1006,1006,'2026-08-02 01:38:43'),
(1007,1,1007,1007,'2026-08-24 19:14:43'),
(1008,3,1008,1008,'2026-08-29 09:22:43'),
(1009,4,1009,1009,'2026-07-15 14:42:43'),
(1010,3,1010,1010,'2026-08-04 05:20:43');
INSERT INTO `user_referral` (`id`,`site_id`,`inviter_user_id`,`invitee_user_id`,`reward_status`,`reward_amount`,`reward_order_id`,`bind_time`,`reward_time`,`created_at`,`updated_at`) VALUES
(1001,3,1001,1002,2,0.00,0,'2026-08-04 05:36:43','2026-08-02 02:56:43','2026-07-10 04:00:43','2026-08-27 23:44:43'),
(1002,3,1002,1003,2,0.00,0,'2026-08-06 03:25:43',NULL,'2026-07-09 10:15:43','2026-08-11 01:53:43'),
(1003,4,1003,1004,1,20.00,0,'2026-07-05 16:54:43',NULL,'2026-07-07 21:29:43','2026-08-12 20:49:43'),
(1004,4,1004,1005,0,10.00,0,'2026-08-21 03:12:43','2026-08-04 00:32:43','2026-07-12 00:57:43','2026-08-05 23:15:43'),
(1005,3,1005,1006,2,0.00,0,'2026-06-09 05:43:43','2026-08-15 19:23:43','2026-06-08 01:47:43','2026-08-09 22:21:43'),
(1006,4,1006,1007,1,20.00,0,'2026-07-05 07:08:43','2026-08-22 22:09:43','2026-08-01 04:57:43','2026-08-09 23:33:43'),
(1007,1,1007,1008,0,10.00,0,'2026-06-11 01:38:43','2026-08-28 11:10:43','2026-07-29 21:25:43','2026-08-01 02:09:43'),
(1008,3,1008,1009,1,20.00,0,'2026-08-02 14:54:43','2026-07-30 10:46:43','2026-06-04 07:35:43','2026-08-27 00:11:43');
INSERT INTO `notify_record` (`id`,`site_id`,`user_id`,`event_key`,`title`,`content`,`biz_type`,`biz_id`,`is_read`,`read_at`,`created_at`) VALUES
(1001,3,1001,'review_request','订单已确认','测试数据通知内容',1,0,1,'2026-08-27 07:33:43','2026-08-08 10:03:43'),
(1002,3,1002,'booking_confirmed','期待您的评价','测试数据通知内容',1,0,0,'2026-08-20 22:42:43','2026-08-10 08:49:43'),
(1003,4,1003,'booking_cancelled','期待您的评价','测试数据通知内容',1,0,0,'2026-08-20 18:51:43','2026-08-12 20:11:43'),
(1004,4,1004,'booking_confirmed','期待您的评价','测试数据通知内容',2,0,1,NULL,'2026-08-27 16:30:43'),
(1005,3,1005,'review_request','期待您的评价','测试数据通知内容',1,0,1,NULL,'2026-08-28 22:25:43'),
(1006,4,1006,'review_request','订单已取消','测试数据通知内容',3,0,0,'2026-08-28 04:34:43','2026-08-23 12:46:43'),
(1007,1,1007,'booking_confirmed','期待您的评价','测试数据通知内容',1,0,1,'2026-08-20 08:11:43','2026-08-07 04:13:43'),
(1008,3,1008,'booking_confirmed','订单已取消','测试数据通知内容',2,0,1,NULL,'2026-08-25 23:55:43'),
(1009,4,1009,'booking_cancelled','订单已确认','测试数据通知内容',1,0,1,NULL,'2026-08-24 17:58:43'),
(1010,3,1010,'booking_confirmed','订单已确认','测试数据通知内容',3,0,1,'2026-08-26 22:05:43','2026-08-25 16:21:43'),
(1011,3,1011,'booking_cancelled','订单已确认','测试数据通知内容',1,0,1,'2026-08-27 20:28:43','2026-08-17 20:17:43'),
(1012,1,1012,'booking_cancelled','订单已取消','测试数据通知内容',2,0,1,'2026-08-22 22:50:43','2026-08-26 18:54:43'),
(1013,1,1013,'booking_confirmed','订单已取消','测试数据通知内容',1,0,0,'2026-08-29 10:38:43','2026-08-18 20:36:43'),
(1014,3,1014,'review_request','期待您的评价','测试数据通知内容',2,0,1,'2026-08-20 21:13:43','2026-08-25 02:42:43'),
(1015,1,1015,'booking_confirmed','订单已取消','测试数据通知内容',3,0,0,NULL,'2026-08-26 15:39:43'),
(1016,3,1016,'booking_confirmed','订单已确认','测试数据通知内容',2,0,1,'2026-08-25 07:46:43','2026-08-03 12:21:43'),
(1017,4,1017,'booking_confirmed','期待您的评价','测试数据通知内容',3,0,1,NULL,'2026-08-04 02:11:43'),
(1018,3,1018,'review_request','订单已确认','测试数据通知内容',1,0,1,NULL,'2026-08-28 09:38:43'),
(1019,4,1019,'booking_confirmed','订单已取消','测试数据通知内容',2,0,1,NULL,'2026-08-12 17:16:43'),
(1020,4,1020,'review_request','订单已取消','测试数据通知内容',1,0,0,NULL,'2026-08-15 09:25:43');

-- 风控态 / 申诉 / 黑名单
INSERT INTO `user_fraud` (`id`,`site_id`,`user_id`,`fraud_score`,`level`,`last_reason`,`last_eval_at`,`created_at`,`updated_at`) VALUES
(1001,3,1001,94,3,'异常下单行为','2026-08-26 21:28:43','2026-01-09 04:19:43','2026-08-20 00:54:43'),
(1002,3,1002,80,2,'异常下单行为','2026-08-15 19:35:43','2026-03-20 04:19:43','2026-08-21 09:59:43'),
(1003,4,1003,90,3,'异常下单行为','2026-08-26 11:53:43','2025-12-01 04:19:43','2026-08-21 12:07:43'),
(1004,4,1004,45,1,'','2026-08-15 09:17:43','2026-03-18 04:19:43','2026-08-27 06:05:43'),
(1005,3,1005,46,1,'','2026-08-27 07:07:43','2025-10-26 04:19:43','2026-08-28 06:38:43'),
(1006,4,1006,95,3,'异常下单行为','2026-08-23 08:16:43','2025-10-13 04:19:43','2026-08-26 14:57:43'),
(1007,1,1007,65,2,'异常下单行为','2026-08-15 04:49:43','2025-12-17 04:19:43','2026-08-16 14:40:43'),
(1008,3,1008,65,2,'异常下单行为','2026-08-26 15:45:43','2025-08-22 04:19:43','2026-08-28 23:02:43'),
(1009,4,1009,55,1,'','2026-08-19 09:32:43','2025-11-26 04:19:43','2026-08-24 03:09:43'),
(1010,3,1010,25,0,'','2026-08-27 22:26:43','2026-02-05 04:19:43','2026-08-25 07:04:43'),
(1011,3,1011,92,3,'异常下单行为','2026-08-29 11:59:43','2025-12-20 04:19:43','2026-08-24 10:32:43'),
(1012,1,1012,5,0,'','2026-08-24 22:57:43','2026-01-15 04:19:43','2026-08-21 09:23:43'),
(1013,1,1013,12,0,'','2026-08-19 13:08:43','2025-11-25 04:19:43','2026-08-19 13:42:43'),
(1014,3,1014,29,0,'','2026-08-27 04:27:43','2026-03-20 04:19:43','2026-08-21 14:54:43'),
(1015,1,1015,19,0,'','2026-08-24 21:29:43','2026-01-13 04:19:43','2026-08-16 15:43:43');
INSERT INTO `user_appeal` (`id`,`site_id`,`user_id`,`content`,`attachments`,`status`,`handler_id`,`handle_remark`,`handled_at`,`created_at`,`updated_at`) VALUES
(1001,3,1001,'我的账号被误判为风险用户,请求复核。',NULL,2,104,'','2026-08-29 17:00:43','2026-08-28 00:57:43','2026-08-25 22:34:43'),
(1002,3,1002,'我的账号被误判为风险用户,请求复核。',NULL,3,104,'','2026-08-26 02:25:43','2026-08-18 11:59:43','2026-08-29 13:31:43'),
(1003,4,1003,'我的账号被误判为风险用户,请求复核。',NULL,2,104,'','2026-08-24 06:24:43','2026-08-09 15:11:43','2026-08-25 18:46:43'),
(1004,4,1004,'我的账号被误判为风险用户,请求复核。',NULL,2,104,'','2026-08-26 08:05:43','2026-08-20 23:28:43','2026-08-29 11:52:43'),
(1005,3,1005,'我的账号被误判为风险用户,请求复核。',NULL,0,0,'',NULL,'2026-08-23 05:14:43','2026-08-26 15:56:43'),
(1006,4,1006,'我的账号被误判为风险用户,请求复核。',NULL,3,104,'','2026-08-27 17:16:43','2026-08-16 02:45:43','2026-08-28 19:10:43'),
(1007,1,1007,'我的账号被误判为风险用户,请求复核。',NULL,0,0,'',NULL,'2026-08-16 22:47:43','2026-08-26 03:52:43'),
(1008,3,1008,'我的账号被误判为风险用户,请求复核。',NULL,0,0,'',NULL,'2026-08-19 16:26:43','2026-08-25 14:48:43');
INSERT INTO `user_blacklist` (`id`,`site_id`,`user_id`,`reason`,`evidence`,`operator_id`,`operator_name`,`status`,`removed_at`,`removed_by`,`created_at`,`updated_at`) VALUES
(1001,3,1001,'虚假下单','',104,'客服专员',1,NULL,0,'2026-08-09 13:03:43','2026-08-25 05:54:43');

-- 客服会话与消息
INSERT INTO `chat_conversation` (`id`,`site_id`,`user_id`,`type`,`target_id`,`title`,`status`,`last_message`,`last_time`,`rating`,`created_at`,`updated_at`) VALUES
(1001,3,1001,1,0,'订单咨询',1,'好的,感谢您的帮助!','2026-08-27 19:49:43',5,'2026-08-16 10:40:43','2026-08-30 01:51:43'),
(1002,3,1002,1,0,'订单咨询',0,'好的,感谢您的帮助!','2026-08-28 20:23:43',0,'2026-08-16 13:31:43','2026-08-25 01:50:43'),
(1003,4,1003,1,0,'订单咨询',0,'好的,感谢您的帮助!','2026-08-23 08:53:43',5,'2026-08-17 17:10:43','2026-08-27 04:30:43'),
(1004,4,1004,1,0,'订单咨询',1,'好的,感谢您的帮助!','2026-08-24 21:07:43',4,'2026-08-23 14:09:43','2026-08-30 01:35:43'),
(1005,3,1005,2,0,'订单咨询',0,'好的,感谢您的帮助!','2026-08-22 21:13:43',4,'2026-08-27 03:21:43','2026-08-29 15:34:43'),
(1006,4,1006,2,0,'订单咨询',0,'好的,感谢您的帮助!','2026-08-23 01:05:43',4,'2026-08-19 21:01:43','2026-08-29 19:15:43'),
(1007,1,1007,2,0,'订单咨询',0,'好的,感谢您的帮助!','2026-08-27 03:25:43',4,'2026-08-14 17:40:43','2026-08-28 04:04:43'),
(1008,3,1008,1,0,'订单咨询',0,'好的,感谢您的帮助!','2026-08-25 06:43:43',4,'2026-08-19 18:31:43','2026-08-23 19:18:43');

-- 会话消息(每会话 2~3 条)
INSERT INTO `chat_message` (`id`,`site_id`,`conversation_id`,`sender_type`,`content`,`msg_type`,`created_at`) VALUES
(1001,3,1001,1,'你好,我想咨询一下订单退款进度。',1,'2026-08-24 06:10:43'),
(1002,3,1001,3,'你好,我想咨询一下订单退款进度。',1,'2026-08-24 01:09:43'),
(1003,3,1001,2,'你好,我想咨询一下订单退款进度。',1,'2026-08-29 07:04:43'),
(1004,3,1002,1,'你好,我想咨询一下订单退款进度。',1,'2026-08-30 01:00:43'),
(1005,3,1002,2,'你好,我想咨询一下订单退款进度。',1,'2026-08-27 09:51:43'),
(1006,4,1003,1,'你好,我想咨询一下订单退款进度。',1,'2026-08-26 21:00:43'),
(1007,4,1003,3,'你好,我想咨询一下订单退款进度。',1,'2026-08-28 15:17:43'),
(1008,4,1003,2,'你好,我想咨询一下订单退款进度。',1,'2026-08-28 03:41:43'),
(1009,4,1004,1,'你好,我想咨询一下订单退款进度。',1,'2026-08-26 00:21:43'),
(1010,4,1004,2,'你好,我想咨询一下订单退款进度。',1,'2026-08-26 16:15:43'),
(1011,3,1005,1,'你好,我想咨询一下订单退款进度。',1,'2026-08-22 16:51:43'),
(1012,3,1005,3,'你好,我想咨询一下订单退款进度。',1,'2026-08-29 11:48:43'),
(1013,3,1005,2,'你好,我想咨询一下订单退款进度。',1,'2026-08-24 14:01:43'),
(1014,4,1006,1,'你好,我想咨询一下订单退款进度。',1,'2026-08-23 09:04:43'),
(1015,4,1006,2,'你好,我想咨询一下订单退款进度。',1,'2026-08-28 15:36:43'),
(1016,1,1007,1,'你好,我想咨询一下订单退款进度。',1,'2026-08-26 08:41:43'),
(1017,1,1007,3,'你好,我想咨询一下订单退款进度。',1,'2026-08-27 03:30:43'),
(1018,1,1007,2,'你好,我想咨询一下订单退款进度。',1,'2026-08-27 06:07:43'),
(1019,3,1008,1,'你好,我想咨询一下订单退款进度。',1,'2026-08-27 10:07:43'),
(1020,3,1008,2,'你好,我想咨询一下订单退款进度。',1,'2026-08-28 21:52:43');
