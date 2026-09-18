-- ============================================================
-- 用户域:C 端用户 / 会员 / 风控 / 会话
-- 由 test/gen_testdata.py 自动生成,请勿手工编辑
-- ============================================================
SET NAMES utf8mb4;
USE `mtrip_business`;


-- 会员等级
INSERT INTO `user_member_level` (`id`,`site_id`,`level_name`,`level_order`,`upgrade_amount`,`discount_rate`,`benefits`,`icon`,`status`,`created_at`,`updated_at`) VALUES
(1001,0,'普通会员',1,0.00,100.00,'["生日礼券"]','',1,'2026-02-28 05:14:11','2026-02-28 05:14:11'),
(1002,0,'银卡会员',2,1000.00,98.00,'["生日礼券", "免费取消"]','',1,'2026-02-28 05:14:11','2026-02-28 05:14:11'),
(1003,0,'金卡会员',3,5000.00,95.00,'["生日礼券", "免费取消", "专属客服"]','',1,'2026-02-28 05:14:11','2026-02-28 05:14:11'),
(1004,0,'铂金会员',4,20000.00,92.00,'["生日礼券", "免费取消", "专属客服"]','',1,'2026-02-28 05:14:11','2026-02-28 05:14:11');

-- C 端用户(覆盖 1正常 2冻结 3注销 4拉黑)
INSERT INTO `user_info` (`id`,`site_id`,`nickname`,`avatar`,`mobile`,`mobile_hash`,`email`,`password`,`register_source`,`register_time`,`last_login_at`,`last_login_ip`,`member_level_id`,`member_expire_time`,`balance`,`points`,`real_name_status`,`real_name`,`id_card`,`user_status`,`tags`,`remark`,`referral_code`,`created_at`,`updated_at`) VALUES
(1001,1,'Felix G.','https://cdn.mtrip.test/prod/avatar/1001.png','wPQxOvA7qmqLjzaQMpEY5YZWjVm8aos9z00fjZ/WlH5qMJnMiWd6Gg==','7a80045c5bb0863d70eb643240de6c0a3519250dffbf59b636820962157a50c8','wYSOyfuRxdOn4MWtEjBfrUD1aQS7Q523vDy/0y69s8MJ4ZBaU139C8lmF0WPY68=','$2y$10$wzqW/QW1eDM.R8cv1E9AMO2Q5n6XresRv2xw3iPyqjS20JqQAEV5q',3,'2026-01-15 05:14:11','2026-08-25 12:49:11','223.236.120.109',1003,'2027-03-15 05:14:11',0.00,6021,0,'s4LGPq9TMvWiQDddzwAPrxBTZ/8+eA1C82mhCdHcz+rtP8NUeQ==','FZ0iSWxlFKS1F3QF5qoLEtVDJ/vCPySevnmUMXQQteXi+yKIG/c=',1,'["高频用户"]','测试数据','REF001001','2026-01-15 05:14:11','2026-09-06 17:50:11'),
(1002,4,'Nina D.','https://cdn.mtrip.test/prod/avatar/1002.png','FGi6EtkO6ikbds7pMzmnon6cdVlfbyMXyhNNdE2oZWyORjE1Cn9seA==','aba06f3b0c816fb8aff18c9b7504bf4bd12a5b07367cebeb7c2240a785a86b9e','2AlNyNbt5HNdswLiTUxnaK1rfX3rpRNFCVBo+4fyFJ8zVD0ktph8cbInjr960JE=','$2y$10$L3rnQJuCrVEuUgDwEAUq8etzgEB.ROlI9R2K4hXYvV3oXZI97KaKe',1,'2025-10-04 05:14:11',NULL,'142.172.206.80',1004,'2027-03-15 05:14:11',25.00,2998,0,'1N2w62T5oNwa7gn26SoMOwJWFI51KAYtRtVaYbLbNthWBYm7rS+9','xVPhamMIM9bGVuM+Ftu7dNUYXjckml99yZr84ERlkyi4Q3GOU7c=',3,'["新客"]','测试数据','REF001002','2025-10-04 05:14:11','2026-09-02 13:37:11'),
(1003,4,'Chen B.','https://cdn.mtrip.test/prod/avatar/1003.png','K6pxnth6VSSbyKvjCkyHmgQ/AkbX2TQbIvzfCywxsHRJaiGIccnZFg==','94f3071da852cb6ea966ab29e390acd21076e2a3180ba796c4ca87aad53f2373','S0RnfI47APxKm2oSmCsNIeQdS2LVJXiE2ziXikuAaFsJ0e1nYrW9M/JpBfA4n44=','$2y$10$GQhs1pQl64H3qvmWzGrfyOY4U1lzh0Ba3Lm5AUvGgIzh8RQm6dWKK',4,'2026-08-12 05:14:11',NULL,'140.112.31.194',1003,'2027-03-15 05:14:11',25.00,529,0,'vZcAq2TJ2KR3RlAIVh+GUIXdcnBq3j2EcURX3GnWsD/LoCJQct2p','PXuSOv+slUASV5z1eqx8Ie5owZG5f+tvCT7Qv/uA1GRcagMWCUY=',2,'["新客", "家庭出行"]','测试数据','REF001003','2026-08-12 05:14:11','2026-08-29 18:53:11'),
(1004,4,'Marc M.','https://cdn.mtrip.test/prod/avatar/1004.png','pjbIEVAte48pcMkzqeXrX9IlS5tmbgsBxqG+gqCDY6S6LbE9vCXWEQ==','bc715bdd9b84ddef0f4caed3cd9f00d5b1580dc60048eac3c030091164b4138a','fFjqnP0Lz1bmSdjZAoR5OQgxBu/SfpTTo+HNrXocV/VPgERwTsF0zPJzC+mJ9xM=','$2y$10$G/EOUShNi8VDHnreUrECXu823JJKtbSG2obwBOPC04oXiCDu2h68a',1,'2025-08-13 05:14:11','2026-08-22 23:15:11','33.226.45.73',1003,'2027-03-15 05:14:11',25.00,2243,0,'AjfQE+ZivMwwDC0mMW+2miOZgimxml8bntRUp5S47+g2bnBpPisQ36A=','2hAM6JL4nOpyskMcyXfasqykvPStmvAW4h/0834vYhrlj6IjTWg=',1,'["高频用户"]','测试数据','REF001004','2025-08-13 05:14:11','2026-08-28 01:32:11'),
(1005,4,'Isabelle S.','https://cdn.mtrip.test/prod/avatar/1005.png','g6CzfUxrwLvY3ybD2sK0qXlGm3jkLwI2aE0YzWGF6Rnjxm1khz22yg==','758f57eae0cb9d41d8d41e7bb74565af945f88737a75570bf49f5e20184d949d','/XtSUIY2xwMp+vZggJs5lKgCOAwNV+wBxh2p5IAo35AHOQbbByFAeFxekNdrXeU=','$2y$10$AsRmRRN0BZDfpSSfSDQTTukNDEhqhsEEqcM8z0t1WMK1xO7lDEg2e',1,'2025-08-27 05:14:11','2026-09-06 15:07:11','87.106.167.224',1003,'2027-03-15 05:14:11',120.00,4545,0,'sLpdFZXyndjveTq1AeJ3wKxhe+vNjgzDJUmTxFx+oQMIz8iEl6BWK1O1','DxczAD1jgY4XmwgQmR8lfXVtqsH27Bcl9VPh5xemYj50hXjUpTs=',1,'["商旅", "价格敏感"]','测试数据','REF001005','2025-08-27 05:14:11','2026-08-30 12:25:11'),
(1006,3,'Tomas D.','https://cdn.mtrip.test/prod/avatar/1006.png','Driqm6tc5xr7Vg7dP8U4Zxv+4L63iprqudgO8vFca1jcn2Yg3Uls/w==','62911ddb54ea94395aef9f316333e7b92a8c0e5faf741f1cc520b73a46cd418f','a+Af0daT7SZq39RYNhHXoDf1RzaoMAJvzIUq/Pqhz/sIaRzwXluBAtvUvM7brFY=','$2y$10$tsznNqKfCd6VlHk2Uvii2e1tAf7Z0v7xBx038gzdQAcqeO7XlxEmO',2,'2026-07-20 05:14:11','2026-09-09 12:42:11','112.60.178.245',1001,'2027-03-15 05:14:11',480.00,7704,1,'s2spdVc1QB+6qUtUL9VGIJriNgHhnREwb/2+yMeT1me1zu7JKrzK6A==','xVbwpHsOLkh2AaG3TH1DJygfwV/MrhMV6RTDGdL45HCXh4QybJM=',1,'["商旅"]','测试数据','REF001006','2026-07-20 05:14:11','2026-09-01 05:49:11'),
(1007,4,'Pauline B.','https://cdn.mtrip.test/prod/avatar/1007.png','y6k8qngDEajfTWxRxpxE42cHgsA/s5ACKRFA1paLGg0FDZCaf5JcNg==','bda74cbaae320e04dc9ab7b590ea064b5e88118f3e254a01c5373f70e2afaed9','Mxc7xyQ3OW1mtrrUeaMl8zMX/JlROtzpB972eYkXLjUQLsbDRwgk4etbFH22BSo=','$2y$10$/X7kpK9qcEAFyp5HQPoF7eThzbHyGynxWd.BP4Asx4rcbwVmL5Omi',4,'2026-02-06 05:14:11','2026-09-02 02:22:11','1.75.236.175',1004,'2027-03-15 05:14:11',25.00,5299,0,'hMaxZubVTZAC85gDI3Lu2XH2lnlN7MYUWYDjIwPzMaSY3r+xWkBIMw==','hKuLmJweoaYrMC/4jQLyN2dWxtXcsHHNbSeX9wQmy4QQdSfWv3s=',1,'["高频用户", "价格敏感"]','测试数据','REF001007','2026-02-06 05:14:11','2026-09-07 07:44:11'),
(1008,4,'Lea R.','https://cdn.mtrip.test/prod/avatar/1008.png','DuzHhQCzNqiRkMIJ3K45J2cpmq9vT6uVfhX1vRjSfPZOgUTqyDvk+Q==','7a5afc3cee415fb9d77e3635ec3a4990e6e61447e2d7856c94573a183c476f37','aalnvGbzFaS8OLvPHgObMOfBrYVbP+vZNNzKSTF9il82wu9QZrblcpZso86aewM=','$2y$10$rF3sLOtQst0z/RYcQVO3Xu70hvtBzi9CIB0c3.DJi4Lj25Mn4X4a6',2,'2026-03-20 05:14:11','2026-08-29 20:31:11','83.74.98.246',1001,'2027-03-15 05:14:11',25.00,3616,1,'cv9+EyaafxU4ZcaHCdQY3BSPs7U0LRJvMl3ADcTudiuqh2wjmfo=','z289zQa5qn0Vv5QgrV9aasvi/No5zfYzzs3GMd91Ys88wzXkOEc=',1,'["高频用户"]','测试数据','REF001008','2026-03-20 05:14:11','2026-09-15 20:57:11'),
(1009,1,'Hugo W.','https://cdn.mtrip.test/prod/avatar/1009.png','IT5VuWcdvnYVG2QPEIy469DJC5GPR16IsYIRHYTJmec/hzI2p41Yng==','e6591321b31abc17393a4358f22d6e0f78c66717cc65ff0fb18d13dee4e74d5d','GfBxu3ATOSCkxUKrKLYNbJ1O0wr2zOlfE0vFaB1mriRpEU5PthfNg5icDTpoziM=','$2y$10$PKrkPOyYb4W.oOU3UsmiR.72IW1oGHilP5QRWsoNwmJbfVn614o1i',2,'2026-04-19 05:14:11','2026-09-13 03:40:11','74.106.105.85',1004,'2027-03-15 05:14:11',120.00,5427,2,'d3kIP+5MH2fhhqte1IOo6Yn1xzfBjvJCG0hwBgwm+qQRF0DuKAcG','oNDm9w5CK25DZalg/z/xp5RtlKup5aaMj+njcz8uqQTRPTtZy/Y=',1,'["商旅"]','测试数据','REF001009','2026-04-19 05:14:11','2026-09-13 20:53:11'),
(1010,3,'Daniel S.','https://cdn.mtrip.test/prod/avatar/1010.png','Hv09qCRtfoym3nlRmaIa65l97WKYF2gEFHnmvhtY2KH42OzCkbnh3w==','d3fde537a0ebc4657cf4da33827085411d5f8084effef1788aa12e56a356bcdb','wxXdPVE8d9n+w11YL/sW5mQyPtml5+6RYNvjrfTZt1FKDI6cC5aJBik/xD/X5qA=','$2y$10$iuyppdQMZIaPni5D1bs5muKT7Z48mP5abB6XPlgjyhyUwf80Tejm6',2,'2026-01-25 05:14:11','2026-08-17 16:08:11','217.224.170.226',1003,'2027-03-15 05:14:11',480.00,5637,0,'3b4imghqLSE0D+lS3L9/iA0iFqgPO6U5IJM1gG2hsBgvjLMlTeaD7A==','Qpunt0d9yX/K3I5a4e0kr4qT7cK0rCgffI7Njq1yT4e4oWylYeI=',1,'["价格敏感"]','测试数据','REF001010','2026-01-25 05:14:11','2026-09-02 01:03:11'),
(1011,3,'Isabelle M.','https://cdn.mtrip.test/prod/avatar/1011.png','nxLudrYvfkUHvfe1SjxKWjDSBlR623JJ2Mn9cqCf9rqTxX2ZvgGJTg==','914bcde63fc906101289e8937c839ca04f0512927664f1db1eaa5134b31ea311','A+Qz4a+EmKOpjlAXTppU/RZIgJNrB7IJtzbZDZ01QuX+frWXKIujeKvgE2Ntz+Y=','$2y$10$svqbngQbhrlDHvREccj5PeyZsPFecPdGD9.R6WpXC.H5E6erFEwgG',4,'2026-08-05 05:14:11','2026-08-16 13:04:11','96.19.100.29',1001,'2027-03-15 05:14:11',120.00,5868,1,'hI4rx1DsP392L74q3xnqiQ1SiyZWnmAdFZMXotVt7Ewtk0pefn7EYA==','0iWPWFAqRzZO6G62Zra5CxL2fxsMmk6AfyUk0CeLIrBjYT3vOTk=',1,'["高频用户", "价格敏感"]','测试数据','REF001011','2026-08-05 05:14:11','2026-09-10 22:20:11'),
(1012,3,'Hugo S.','https://cdn.mtrip.test/prod/avatar/1012.png','hCFgk/oWuuCxxNOozXK4XJVN15JrXJXHM6kXceuf2fJG6Klxt5xiPw==','aa599e5f3f705edce7593ccdd09ac4aecbfcb4713f2a285fa9bde673d4fc5904','hKTHgX5sp6/ivKCaHoZ2y7g2ARAaV8jND2V9AqKnS3pWgHB8yjoqCGUts8P94AU=','$2y$10$/x4WvNH/uP.SxlLZlcHERutufa2Hzemls0w47gZ/.Y4qPKscT/HUK',4,'2026-03-25 05:14:11','2026-08-19 11:03:11','37.171.15.159',1001,'2027-03-15 05:14:11',1500.00,5228,0,'b1G9QXmRy6aPijy6Tuc6GadhEm6ZQDEUy4h42Xbos4URk/AwKM1NQA==','LlpScALaGhx+YeSY1mkWGK0AQFv6PT2X4/7tK21JB8xFcXRi1is=',1,'["高频用户", "价格敏感"]','测试数据','REF001012','2026-03-25 05:14:11','2026-09-01 08:11:11'),
(1013,3,'Chen M.','https://cdn.mtrip.test/prod/avatar/1013.png','hd5fHqTp3O4k1RzPEoTI/tOmGgoo4F50NbmKoBHZzRGmErSbJXGCJw==','81ce866676d58d0595123875bbfedfa2fa43d6853fc72705b223dce2b47c966c','dpRkpw/h4AwmuAoHX5FKMY1qa34znsCu1PguC0tAE67W5rsNfKWsec0ZIWFKW/w=','$2y$10$c/trE0A45Cm0aGyZrZlBWOkzL1I/BCV05joUuXsgD6FwphbDGVsYW',2,'2026-07-20 05:14:11','2026-08-28 14:12:11','95.134.83.210',1002,'2027-03-15 05:14:11',1500.00,1582,1,'4KBLEDEvGYjQD7gEprAh+hqFl0IPxdY0EhtwUWOASKVZQMzlzs8L0Nc=','XlELTrMioALoeVCCqj5I2biY3nDgblTE6wJX194mTb/Bh1HGUOc=',1,'["价格敏感", "家庭出行"]','测试数据','REF001013','2026-07-20 05:14:11','2026-09-06 15:48:11'),
(1014,3,'Grace R.','https://cdn.mtrip.test/prod/avatar/1014.png','r4hsFceG9UULebsnTdTXdUBH+vx1JTHpZZMQpLofh5uVHZrNnebq4A==','5b794496dd5777973751afa9797e51b3cc14fae442b6fc3d61940b42a352a8f7','lur2R3nSi/7UgZZJOhp2cQdOsvdsYEFkmrzLQHEGvcvK094oh0t1HcUy0fF+J4w=','$2y$10$V4c1PpskBBZkSd.oetyEF.tzxjznhhUfew2CXR8qEbMTBh9Isy00G',2,'2025-10-08 05:14:11','2026-08-24 16:50:11','164.111.216.124',1004,'2027-03-15 05:14:11',0.00,7199,1,'37EmRwUtrAp3aUJF3fVD5A6Qfe9rEwffhFFGfhknXsTCLm/+JMwPjIo=','usEfzQ01KY1E0vRxLj5KHd8WWVCAf8y5/lDPGQZdiaJLEACYArE=',1,'["价格敏感"]','测试数据','REF001014','2025-10-08 05:14:11','2026-09-02 13:46:11'),
(1015,1,'Isabelle W.','https://cdn.mtrip.test/prod/avatar/1015.png','cFvRTM6EoUFuDeZ9UJspvKsb2dUbld9vi7w46vDspuguTgEZKLmA/w==','d7d9303bccbabd599492569d11e4c757cd3107fb1c907e9f833ed361079a30b8','6GkPbpwqHEBUwZnyDZKh78q1fw6EfqGJYx+9EQDXNr+IZKudXC4LMLz4IrUEJrg=','$2y$10$c3NkGezQiYqBm/aed0b4LO3eQ2o4ADmK2/tOsnfcSxtRljKCbP2NS',1,'2026-08-12 05:14:11','2026-09-07 09:22:11','157.98.78.188',1002,'2027-03-15 05:14:11',0.00,4873,0,'aYip9ZAnYZZ5chdYtdYdq/PVUkaSmV4d31KdVpNpmZIZDJEN3zlWuDjm','G4GVIJDYTpD6Bw7pJLRyJnBtlGx+Uf9w4wN9icixNZ39dLkx0zg=',1,'["高频用户"]','测试数据','REF001015','2026-08-12 05:14:11','2026-08-30 13:59:11'),
(1016,4,'Julien W.','https://cdn.mtrip.test/prod/avatar/1016.png','PuiWU2SJfAvrIlrI69WnWmgdLwEv4gORUbADsOod05WFo3nzYU0oHA==','9f38186541c38d8690d3ecb273e5a3ee352d59cd870ce8ad09d506966f3364ce','49ooHvI3Dx6JzUxbAauXNG5rr7L0QjZ+FUFiAaBVi4AwKLFbCXPc2W2woV5xwIk=','$2y$10$eGImYUD0J6BIoB6e46RHt.pKnZkzOeBJjIkXIctL93CssT3LaNZW2',4,'2026-07-28 05:14:11','2026-09-06 22:01:11','220.128.138.30',1003,'2027-03-15 05:14:11',1500.00,178,1,'/vM7HiztD4dq+4n7qcVb7ymltA+lS1vO/Q0q2DbWPuslnqfQQjG9fQ==','B7Y8nJ9oNMUIJoQAdxAXs7SdtC2oZyvvhfSaOrHjBFzUZ7nloGQ=',1,'["高频用户", "新客"]','测试数据','REF001016','2026-07-28 05:14:11','2026-08-28 03:39:11'),
(1017,4,'Emma G.','https://cdn.mtrip.test/prod/avatar/1017.png','91xEVXKSWIBoJw5RCmYErhT/i8T1dKjPDUPsXlP87bbCis7682A+Hg==','28186830a1c3a70fe56f5c66c804af29f1b184056b008fc86f4f110ed31b917c','YR6jvhItbVhdgb/RT984ACtmDMQb2bJELni8+IK8k2DNdy9upsLUdXkMq9Gn3Oo=','$2y$10$j38U50xIrRy.pGwNG697ze1Liv5nkM5XoDNpaP1K.AEJGHt0l6sBe',2,'2026-08-19 05:14:11','2026-08-29 14:27:11','195.135.212.215',1003,'2027-03-15 05:14:11',0.00,1603,1,'OA2qjc0v+1m18janVtHNhlnDpMLbfj3JLvcUUIfSEFUPv/ZrL0WsAw==','V+BUOz34y0Tz+i3pxVqNw4Ew0il1CwbcQwrLGM28/ld5QWtyvS0=',1,'["家庭出行"]','测试数据','REF001017','2026-08-19 05:14:11','2026-08-30 23:43:11'),
(1018,3,'Quentin B.','https://cdn.mtrip.test/prod/avatar/1018.png','sqzSyhPBcKWgB8RQ+KWNTW2i/zHLvouuah4HHHz2PasfRipJjZpPYA==','2324790edcc865e3bba0711dc080a53d0abe1833e8f3d7fcdec870954e61f20a','PHR38VqsWpV1FYlkBMhz6nuVYler3NQ/wNjhyP3bIRbDasyj5+aLFEvoC2qT7yc=','$2y$10$mRwHvvzqsC1nbCpskwc/qOKvl7gEe/zinlVYLrQgN7NSUh7QPh3..',3,'2026-07-09 05:14:11','2026-08-25 19:05:11','205.173.72.28',1004,'2027-03-15 05:14:11',480.00,1226,0,'OOYPwAE3U9rraz1/b8bNEvkkYFk4bzOJdehT6SSnRGv6447q3Ew=','9ubNar1Xurbnkka5ozMdxftS5K/KnqH/CZccSDqCVUUw6o90PXM=',1,'["价格敏感", "高频用户"]','测试数据','REF001018','2026-07-09 05:14:11','2026-09-07 16:26:11'),
(1019,4,'Quentin T.','https://cdn.mtrip.test/prod/avatar/1019.png','jCb49sqJiuG3y40KbJMcbCgX182X/D9tLvOobnkehivvQNdD9P7EGw==','28616f972a8d544d8f5490a7fd286f6f6367e01835960b5b7b844cccab7845e8','uXgTkOupK9UbDZdQ1azj81m+wNSyWu/NeiuxAqkTzstH35NV75xrSY8o4OLZcu8=','$2y$10$RXrL.l.NOi0DmlkAQyto5eSdpAry0h2u9mceDoVac7Ut0aIsxqzha',2,'2026-06-19 05:14:11','2026-09-12 13:59:11','140.72.26.168',1003,'2027-03-15 05:14:11',0.00,4848,1,'Lu2+dQEvwjsy68IaJigASPqTuKafw5bzFpLHtr8s9PbAzq3U32c=','+yHs9YlmF2nBqQi4coHEB8j+6PgaftKItL2QJPtPup4654nqcEk=',1,'["价格敏感"]','测试数据','REF001019','2026-06-19 05:14:11','2026-09-12 01:00:11'),
(1020,1,'Quentin M.','https://cdn.mtrip.test/prod/avatar/1020.png','sxS+Cv++DOydW3bMqybQUVphOEeslXAjr9D8uDhPuzxwm5Jt7y958A==','1af19c398ba2163e147209e1b5ec8e884e25f1c1ddba99549fe7425cb76585a6','t9cqVrRTs7Lmtels56Ntuh2vQ9K8q8VMfNTib0rQzsqGcGCBsxUMexhNGiRSPSs=','$2y$10$2hptF3SHF5MOrB22lJMAnuujh3y2DpCduDpBTSmlQYmcFRLdbvFVi',2,'2026-01-09 05:14:11','2026-08-26 22:02:11','74.194.88.248',1001,'2027-03-15 05:14:11',25.00,6933,0,'LHsd4/IToxQh8+AWWMS8vDGe66edTdGe8V/B4ooxeYqLi45Klgdo','FHD/7ZXDZqVMXR25nq2DJJLgqTANFf+n9v5R+lVRXaqgph4/qCk=',1,'["商旅"]','测试数据','REF001020','2026-01-09 05:14:11','2026-09-01 06:52:11'),
(1021,1,'Karim S.','https://cdn.mtrip.test/prod/avatar/1021.png','z6rO7Uefnnty7dpA/LUqIxyLPaaCwRIpfpkBk+hicHSPjW5SJjN//Q==','ffd5a762ddcaca96eae861e3c35ae392ef5ddc9170283dc5390919582c6765cd','MrNnIPsus9ZESiz+gHF4if16YvA2FC6ENmoKyDO3uBFY4efI3Tj9QszEXmg/WHg=','$2y$10$Hr8gsH7pSnHQbCUUAlq/vOG/h0B9lumOQoIU87gWM59Qo7lz4M6CG',2,'2026-06-18 05:14:11','2026-09-05 12:36:11','217.208.132.201',1003,'2027-03-15 05:14:11',0.00,2871,1,'c/1UZA/VbMOoVXa/tVptaWOEHEsNTxc7Zrvlicq5c7ryks3ZOvTgf0Kyew==','Biild3pPjjHcZR+tex47c6KWIY1nPJnFOjNb3ZzvpDPN3OPuu20=',1,'["商旅"]','测试数据','REF001021','2026-06-18 05:14:11','2026-09-02 14:08:11'),
(1022,1,'Isabelle P.','https://cdn.mtrip.test/prod/avatar/1022.png','212o8OECDNyST4gMl30uX/sW6OyTlkHgbrzHmu0yiVMKhA2UuUHTgQ==','909900a5c1b032aceb47d80c9a8ea336671112e863b96c6f00d67368ce6400a6','R0TUF0CBJjO14kF/ll105OjAfRp/LKb3dTQNmW21dD/ETtlggY9j9Eu5uUYs8N0=','$2y$10$RHa3qhpI4/mRJfmgL7v0eei0P8qUDaUydAuWWO3cjjES.b6XbJmOm',2,'2026-03-18 05:14:11','2026-08-17 06:00:11','105.234.32.57',1001,'2027-03-15 05:14:11',120.00,6303,0,'VHdC3ScbW/TGpOddhtwT79K/XZp5pKfdxumq9WypgfosW90ysEHR','fEvyIS2hweVSaT1QbhtqrXZ3xSVNCbwdHk5quDpp3VYutaXwvCc=',1,'["商旅", "价格敏感"]','测试数据','REF001022','2026-03-18 05:14:11','2026-08-27 00:51:11'),
(1023,1,'Nina S.','https://cdn.mtrip.test/prod/avatar/1023.png','BkbIzgnsl46i+P6Xc2vK/UYiRAGNsQWYJEJaeUWd9R6IHpR9JJ/AKg==','3d8e6ddbe090417f3ba0b2d834d2f3c13065038dfe6d28a2717fd235e193b07f','IqWEyiLGBLvtVqvAYNRYuPdleauvq3Dhu6/SMLwBcT5lDI46icZGmFd+1pNxwfM=','$2y$10$Owsadw/tnPpsSx895vFqlu0KnkkujkQfsAT6wb6SnevhbZ9PoBtDq',1,'2026-08-21 05:14:11','2026-09-10 07:18:11','181.229.95.85',1001,'2027-03-15 05:14:11',480.00,2359,1,'twyPoewn0pvZKdKNDDwxUT/aILtJNuqfU9YN8+dAzR/fcvTawnXT9g==','iN/O1NseBE7aiBTCLiR5oLr4Mmy/BMWo+an55RER9qdPYqhv1d8=',1,'["新客", "商旅"]','测试数据','REF001023','2026-08-21 05:14:11','2026-08-29 05:47:11'),
(1024,4,'Emma R.','https://cdn.mtrip.test/prod/avatar/1024.png','CihreajP6Mrab8pPPVR/gdtiawDx+is2h+cFVqeDPdyRlayBXmSznQ==','e6a7468a00c0fb49d7ef426d62a390c0f63f5bca458f084b3938c58b4188c45f','2hadpHIV0Pv1DQRJdPIHU12HzqI22/lmjR6XrEDzuXeP9PlARWv0Y7wqEjxQY60=','$2y$10$KTfy0YlCqYUPqxURG7H4y.Gw6DEsKBoOx74dBLypREgQmQEHBQqJW',2,'2025-11-08 05:14:11','2026-09-12 15:46:11','4.134.112.235',1001,'2027-03-15 05:14:11',480.00,5112,0,'xE44YWW7LXdoZUOJZw1mDKpi0cbzetJf67yuvphDqiFkDHsBQs4W5/yjWA==','7aISS+rZPGNHvIbJOALlMv5jqUAOsPKs/xT4RDYzeBhFe98pEho=',1,'["高频用户", "家庭出行"]','测试数据','REF001024','2025-11-08 05:14:11','2026-08-30 06:11:11'),
(1025,1,'Daniel M.','https://cdn.mtrip.test/prod/avatar/1025.png','UJpxZOjKR+YUtSD9y2uKMkTaNb9pJRF7xs8jirgCc7U8qyx6shKn2Q==','97ed73e939ffa3a2da923553a8f60a35b78f5468593d00da0b49ebca6c0af5b5','sKHOn3q47ulal0qGsZixHmsUDNE+eC8IqQCiGX55kpfhh8RMAEG+86uK7VBntpk=','$2y$10$Sk6o94dMf6K1nAJe.coW6eXVXQzArjeAI.kFrgXndMjiIUN9J.yay',3,'2026-05-01 05:14:11',NULL,'3.52.183.78',1003,'2027-03-15 05:14:11',25.00,7553,0,'+aMGID9l1mALeZRHn5e8LGc+LNwWpGtKQ7DaseupG4GmQSZyJEdDug==','QPLcqXwBty2UD3s++J+QHITXx+/NzTnlGKzm0SnVdd3jXFnJGnU=',2,'["新客"]','测试数据','REF001025','2026-05-01 05:14:11','2026-09-11 17:54:11'),
(1026,1,'Felix B.','https://cdn.mtrip.test/prod/avatar/1026.png','3US+RQahY6KbzRhfq9w75IBB2zsIcSizrlY+HZc5vmHa4aNSMLWr7w==','dfa5eeab181663cc85485defb727862b5eefcbd1bbd7d8c5291f8e36d85e3a3b','8RTBhSVM8+zxkFqlS+s7tj3AwX7nae05ih4yANQtkJ9cHk6u+pmMxgTrbGy7j7k=','$2y$10$lfgWwYkInkBXZx6J/u.K6ucsgeq0q2CFjMpNe4bTphhrkli7q5Oe2',3,'2025-09-29 05:14:11','2026-08-18 00:16:11','158.32.164.26',1004,'2027-03-15 05:14:11',120.00,3728,1,'bz4tyvoLV81ieZm6ssyksfxS57zfekT/bG3ehobWaO6Zi/pWNPQ=','pj3AHs94JiuMRpl3biWx2qgfaxYY3PmgauPpPGPKpg07aa5YgKo=',1,'["家庭出行"]','测试数据','REF001026','2025-09-29 05:14:11','2026-09-01 20:07:11'),
(1027,3,'Tomas S.','https://cdn.mtrip.test/prod/avatar/1027.png','+c+YSdvslEXmLzNVDiSkV5BkCjTN8x9875FpXmIn0piY+hm2H9Dtgw==','b8e3bf1b1e438d520673fce10231bcd17c8201f882a6ceaffa8e4a004c22df00','rA0itc7yjCsWFzW3dt/hBhrWCgS/BVGdxzq3M5PYF/4bXaO+QqKcJm/eEU/T8G8=','$2y$10$.PyBnun5LRMrWNuHy1i5HODCaiYz/8U7S/oR8xQyK5EvhsozarQNm',4,'2026-02-26 05:14:11','2026-08-17 00:56:11','89.114.229.243',1004,'2027-03-15 05:14:11',0.00,3575,1,'YtfKrOAb9EvZ91BuRF8VQM0ExBVXjVplTXAnx4iJ3iHsOqkeNSw=','Prmj0VSEEtQl5Q5wJ1+FP3WLEXrrOPrUYEmpdpQGbngeQI4XQjE=',1,'["商旅", "高频用户"]','测试数据','REF001027','2026-02-26 05:14:11','2026-08-26 13:06:11'),
(1028,4,'Tomas P.','https://cdn.mtrip.test/prod/avatar/1028.png','tob9dJskaIcEMgGFTL73mgCpqQY3vhJLmaL4OQxy4vOo7K1V4NVygg==','74c7b40d0a1761881f17a6bbc31e53e97febc9c3e93f873d3d79982a0f51e233','Xz2YK7ARbSLMZMRE5rtASQ/A7cxg30K5+EKBnHgGKiSqkZvzQopyzm9Hj5Y5yC8=','$2y$10$WbqYMjtUyJlgzJpW6beHC.TWlo3wwv67RIfF9qyAndExtK2Q95b.2',2,'2025-11-29 05:14:11','2026-08-29 04:51:11','130.217.87.22',1002,'2027-03-15 05:14:11',25.00,861,0,'arTJM/L22Btp+FzkejC2YTJ7yR1NOY8TWqYpkDLYcQKOd50N4kHircDhA3E=','oDF7hQItLTJ7i5RENqf8nrogkRJsFSOduL1pkK0jFR6W8ZjtNrE=',1,'["商旅"]','测试数据','REF001028','2025-11-29 05:14:11','2026-09-14 07:18:11'),
(1029,3,'Emma M.','https://cdn.mtrip.test/prod/avatar/1029.png','RH8M5NZ3kxL6UHiLtKZZOo1+mSiALI2v42bBV1arfYw20abFe2IcUg==','79083876ef9a35a74d8954e748f6c6af3cc520308c78b7e6648a5f65c25dea96','acQKKCqV0vjJMySbapqOlVLWD6/+WL8REeCTp2FPskN/vbJKQPXERfrkXFHL+cA=','$2y$10$FeEGlg5BnlCVaYryMYxtwOvWvHNiYkLPPXpxKiTGADwayYeOvcaLG',3,'2026-08-08 05:14:11','2026-09-09 08:34:11','207.0.67.25',1003,'2027-03-15 05:14:11',480.00,3720,0,'eVYo2iFrwBi/z9wqgT36Ra++esQ1GnuujRkBM0mxQXOPYb1u+XFJfXk=','N4TkbaxOw37haegDSBlInp1+waIYsowcQtfwTVuy9MaAHxTRvp0=',1,'["价格敏感"]','测试数据','REF001029','2026-08-08 05:14:11','2026-09-08 15:42:11'),
(1030,1,'Lea L.','https://cdn.mtrip.test/prod/avatar/1030.png','kuULPZI0thtI59lpHhkpYoRHcfOfeWAS1I1YwUG34a4NyKnuy7kMYw==','ae2eae55f7f4a42f4953621e7cdfb0d2baa9263b9a78578b49e0c24a55f6d4cf','1uaSiU2OL3QWocrok4BUftSRGABCpTSILR/TMLRa9nf6bNNuxIlSeZnE6vxMzvw=','$2y$10$pVUKDxl/E8ykbBMWTZVu8uteEAEDb575PSLMxERRzKcZTY.Mf8Ozu',1,'2026-03-05 05:14:11','2026-08-16 22:01:11','197.215.245.158',1003,'2027-03-15 05:14:11',480.00,7597,1,'SET/tsuo0FRaz+lQyh5j3Fzb/g8j75Kt3Y14k3mhUlXm9DnaHLrgk7JO','Wb/bs6219DJb/RkSg80H85K0TNWWUvfF1vtOXWSs0ZS1Wy4NqW8=',1,'["商旅", "新客"]','测试数据','REF001030','2026-03-05 05:14:11','2026-09-11 03:10:11'),
(1031,1,'Pauline B.','https://cdn.mtrip.test/prod/avatar/1031.png','yNMh4U1A3yw4BN6dLF3Xnj5K63VXX2vEveBbS2/aT8i8Md5mAk+yYg==','7e6cb966e5d185a5b3ff4f2caaa2b068aabbb61e51fb4dfa98e1da02d6d7d46c','dBXjVkmxRuuk1f0GqjvXGIgeKIjwr6YOFKICd8axIuW1AyCtI7JJr2aoz+vhxrk=','$2y$10$qztj4/38nMjRoBQHiU9wru4DnU1hQWbyFBv8y9Xqy2rRazpKyueLm',1,'2026-03-05 05:14:11','2026-09-11 00:16:11','211.167.66.120',1004,'2027-03-15 05:14:11',0.00,5871,0,'vlGvmhG3i3BE1DuBszbBxFWv0dC5QnDN7zFnT75YTJ6JDu9Gu/1GUqI=','1Dn/b5dIf6BXccvaj8HErF3TGHLzUm9KiFbBugEqw/o22QuKP/w=',1,'["价格敏感"]','测试数据','REF001031','2026-03-05 05:14:11','2026-08-28 20:42:11'),
(1032,1,'Alice N.','https://cdn.mtrip.test/prod/avatar/1032.png','+qVvGAuodPC/lR+uKRcBlxQ9kNSGUScQ5nbkRfGsBApv6UsvO5dS1g==','b6fffc05ff7db9a312615b046377120fd25f44a7a8668e664b20363c450e143c','MIJ6xeji7WOT8yrCTfmIjMfRTZNkm4PTIGVW9f6EQthpcNRuq1CuF9HQiDQbpmk=','$2y$10$LNwaHnM4.yijV0aNGP7EweTD2dtV5e4gtBJ5KrenSD9oKwZpLiNqe',3,'2026-06-01 05:14:11',NULL,'129.162.241.170',1001,'2027-03-15 05:14:11',25.00,3290,1,'jxMA24fAZTxd8vBmU/f7BFsf5wV4uy77bX2t0dMcbt3E0QwVdzM=','IYP1mIw2YI0OXg32a15T4EyyDzd7USsYhJrgOEJ7xNAmzztv4Vg=',2,'["高频用户"]','测试数据','REF001032','2026-06-01 05:14:11','2026-08-29 04:16:11'),
(1033,3,'Tomas M.','https://cdn.mtrip.test/prod/avatar/1033.png','y2eCiLOHryKLQSoMEBDh/oRm4GDxrxJLkvcHXmOBxCrFS4DmbqjVPw==','26bbb4f5d8e9064ac5bb70892693496c30acab563a71309d1fbfe05c2dc62806','xAQqz/axxo+i2XlKKV2HWw3QE0ar+7f94JKF/7uulfBk44JZXJ40XxbTPFg2r5s=','$2y$10$Nkfjs9drbP0T1Hn/nyjU.u4cbKs0KJ67uCKdq9jPPIvzNSAqUWB8W',2,'2026-01-10 05:14:11','2026-08-17 04:09:11','140.127.59.201',1004,'2027-03-15 05:14:11',120.00,1815,0,'XB5kSYtE+XoCFVraPY6SC9ULE4t/R+HAk1INhIXJEFmsOg/kCUrQ','7JjKeDix+v14H/rQgptm/GQL2isa7due2dHXb7UT6njy/jNcmp8=',1,'["家庭出行", "价格敏感"]','测试数据','REF001033','2026-01-10 05:14:11','2026-09-14 05:11:11'),
(1034,3,'Sophie N.','https://cdn.mtrip.test/prod/avatar/1034.png','LSuEIvwRvnLPyw20MUK2Tm7LACYCF6EDTi3StQpfuyYyekxAaCmMfw==','31c69c3f21b21f915f7345dcc15d5f9c7e8b2faa37b4f36809011eec65555567','I8DWakAl3SlkNA0Q/GM3pWmZKqL7nJ/Q/RhXKqvaTbpAx7BpyT8efkPpxdoeDrs=','$2y$10$u0SKGViVU9RLGaf2WdhTS.DVxFms32IwEXUw.3wChrz9F/9csa2Uy',3,'2025-08-25 05:14:11','2026-09-08 11:05:11','2.133.250.109',1002,'2027-03-15 05:14:11',0.00,7874,1,'ND3xrKwktsZpSf2s0PunjeYu8etZr4VDxkon8v/94uCcqK23z2M=','uEsqfsBHoO0QROWDKjHRBi92xgcifYkpGDDbXQvAtZt5FmSYuz4=',1,'["价格敏感"]','测试数据','REF001034','2025-08-25 05:14:11','2026-09-10 13:22:11'),
(1035,4,'Emma L.','https://cdn.mtrip.test/prod/avatar/1035.png','Pm+jEo1H0GPX+IdfLX9zKKJ4z7kZijBX1wQzL1wEcQjVuVjCjzYoLw==','baef21e278e280bc7e3e81079bfe36164e906206f7ade453467668583a7e969c','oWdVnFBvkOXA0jH1JJeO2W/XiESTI/4KbcG2mJiuR5qePTockz/1RBAAxIOvqFc=','$2y$10$t0B8gGI/aDAOGeSe8Wj.l.BmfZU3vnzy/A06JPvmoVwbCKzGUF5o2',1,'2026-05-10 05:14:11','2026-09-14 08:01:11','176.241.159.184',1002,'2027-03-15 05:14:11',0.00,4710,1,'lYPrisx1J6U/b2mxc4a7fq/OQIo2VuJpG07mJf+FbarQ+ZdbNljF','t18OCPejitaGmmTfM+GNl9J5rAjnF90kvqArp19WPXz/ko3PP78=',1,'["家庭出行", "新客"]','测试数据','REF001035','2026-05-10 05:14:11','2026-08-27 00:54:11'),
(1036,4,'Daniel H.','https://cdn.mtrip.test/prod/avatar/1036.png','X+aHEk+mZJ77ZEwzZulI17hHguBnoJFOpcx+HUfDf+peCaj9IB3uFw==','7e0b47ecf697bf75faadc2485bf7a1304a3e031771a823fbf4cad4b6c788b683','RjdMlljbVto+ekrV62edLTvpUAWqRRsqu6szcnLoXyX/T5XRE4fA6Ox86peYq8M=','$2y$10$gCIY.chr7ve0EJNYdHHMyeCUKSqxgw1tvVnkw0pwkGHSy9SX0yfaK',1,'2025-10-27 05:14:11','2026-09-15 13:05:11','95.170.216.48',1003,'2027-03-15 05:14:11',25.00,5769,0,'rE5hFYrZ70W1pzPeWEErcEoCmcXOWEKBoPlR/G8seJP+RQY0JpXxig==','HfBZs45smj1yWyZaeQi0Ms4l8jOY4kNzQf622MSmf6htJnOM+Uc=',1,'["商旅"]','测试数据','REF001036','2025-10-27 05:14:11','2026-09-10 14:33:11'),
(1037,3,'Rania W.','https://cdn.mtrip.test/prod/avatar/1037.png','/QGnNmSfItFRAiTcxOiwvea8Ykx8YjBdERNDAfek4RkrTgBzFFFOzQ==','d2f927f256a1621bc92751724864da1455e76fc606bf6a0e7159a8aa2aa25b33','PyPWCnPBD1I4bdhq131X90G7qRY7IHesDmsj/Z9RUDdg1jfhTrISd0OIEmLxdH4=','$2y$10$CH6GJpB9VLrT3xE4pXrYq.r67DOYvvNtvkKyjH7PFSS1z9Ux80C/e',1,'2026-05-02 05:14:11','2026-09-13 19:49:11','218.248.156.82',1002,'2027-03-15 05:14:11',120.00,1720,0,'8vAV7clqfXGb5xzGNBFQdODV3LF+LQUidSuvhg7dMX4io4h1wkBk','0PPXVq06PZlGj6lV2DUEePErtOfvppYTiE0TWIrLta7pC4MeDKM=',1,'["家庭出行", "新客"]','测试数据','REF001037','2026-05-02 05:14:11','2026-08-28 13:25:11'),
(1038,1,'Rania D.','https://cdn.mtrip.test/prod/avatar/1038.png','BgJhSiJW6+D2ekaZ/xqNnetcVhMW+CVYny6hSfGCbMtgkYFesI3vSQ==','b6e46514c3c3e781dc066c8b7d5a871505a7305d958af3ee1efbc499cd6866db','IuCfr4NWQ1EDwwP1OVmfMcdEcrakbyY2OlG5YEKQIOqX+kXWENNuELJVQWx2xhA=','$2y$10$Z.a7mhv8c9RUnDCcISch/.KyR1BMfZj5p99I4cYOXwYi772HESTqO',2,'2026-07-23 05:14:11','2026-08-29 11:25:11','192.28.228.22',1003,'2027-03-15 05:14:11',120.00,3695,1,'AZF8WgwiGxiRw793M7qNBnvjwhcprXzEK1VED73KKQ50KuytyZEy2HU=','A4V6J17olSdrgYSowWWsm41YSHBRp+6sddp8mpCsaIo3a0ZrKJM=',1,'["家庭出行"]','测试数据','REF001038','2026-07-23 05:14:11','2026-09-04 23:32:11'),
(1039,3,'Hugo D.','https://cdn.mtrip.test/prod/avatar/1039.png','zqaVAXRaQxoo4yeu+A9wS7A+lZfisqZaNXlMGGwKcT21oNqUesQaJA==','a761f373e352bb0eb8f672c82f78d68a583afe952bf946b962a2fcd2ec290cb2','udvZWXaY5ee+xEi3BRRQRGOJy66mE//ykHnBnO1cvDoSUxtGeqYucbXpP8BYmRM=','$2y$10$2HATbPeInChAGIjGXDIQO.TMOqsiUqIoPTbdkTEQDH73w6AQwgpp6',1,'2026-05-22 05:14:11',NULL,'175.252.146.90',1002,'2027-03-15 05:14:11',1500.00,6237,1,'R+8tl+7XGNLw2/SGZCcjVtMKqmDI5Cgo60fhtjyoGRel8q25xoW8','39NNjm4StPHYuNIfTk+60w1mpfLHaSuQEztKCdPtnwLs6cAXQAM=',3,'["商旅", "高频用户"]','测试数据','REF001039','2026-05-22 05:14:11','2026-09-15 07:29:11'),
(1040,3,'Alice L.','https://cdn.mtrip.test/prod/avatar/1040.png','FJ6K3MIXtoNeH5NuoLV1Uq/CBksVu5BDrYydE5chAjpOAn+6eYYSNw==','4d6196c796ec82c2f01dfcc6aff993634d5daf7ed5911a9fdca5071948f1e2ae','5ZdBoAQ/EZELz4cEr+wnYGOjl5TfaxsCKmC3K3FK9nd5pT2ivZiYpjQK43INMIY=','$2y$10$GOgeChpqj.XfrcX2NEH/uOGG36/cJLfRaFqMVuFOA4jw4ic7gfUzG',4,'2026-06-25 05:14:11','2026-08-16 19:44:11','215.88.2.122',1003,'2027-03-15 05:14:11',0.00,6488,0,'URbmFQF4Pc4nZl+Ch+qkzG9TRcrSW8VU6nPKFIV4eYSMg1qZ3w5z','jUuctPe2h2Sqe45wVN7zAb3J94ZxKbfB5mmHsqwB1C5DDJd+/jo=',1,'["家庭出行", "商旅"]','测试数据','REF001040','2026-06-25 05:14:11','2026-09-15 15:14:11');

-- 常旅客
INSERT INTO `user_traveler` (`id`,`site_id`,`user_id`,`nationality`,`first_name`,`last_name`,`id_type`,`id_no`,`id_expire_date`,`is_default`,`created_at`,`updated_at`) VALUES
(1001,1,1001,'US','Nina','Silva',2,'k4MBWPQwDm2KWDVa44K9o3X/wPOyWlJgJm1uQtsv4O2b23Vh','2027-05-03 00:00:00',1,'2026-01-15 05:14:11','2026-09-06 17:50:11'),
(1002,4,1002,'US','Hugo','Laurent',1,'qeSa/uptPYVfHXArCZfi/O0luJs+3Horj6Dg67V2SBRDBm8A','2030-07-22 00:00:00',0,'2025-10-04 05:14:11','2026-09-02 13:37:11'),
(1003,4,1003,'FR','Karim','Bernard',3,'WFFZTqitG6ZuSoDA3qJCFcdqOrHuyXWAB0jmAEqe0qh7BKWa','2029-06-15 00:00:00',0,'2026-08-12 05:14:11','2026-08-29 18:53:11'),
(1004,4,1004,'CN','Karim','Robert',3,'L6ldHv+kKZ8SChMgVQIf1yH+zd0e8v+IdrpJR0ilVRTFs7p5','2030-12-22 00:00:00',0,'2025-08-13 05:14:11','2026-08-28 01:32:11'),
(1005,4,1005,'US','Daniel','Nguyen',3,'pzaj5cvo5MHQnRTQft/vb986bY5WcIK4RqsEFSl4opY3zifp','2028-09-10 00:00:00',0,'2025-08-27 05:14:11','2026-08-30 12:25:11'),
(1006,3,1006,'CN','Tomas','Thomas',2,'RsQZ4rT5cCRUpvJA+dhzl9Z9SpyjakRbah6Qtg6DYQeHZqWw','2030-07-19 00:00:00',0,'2026-07-20 05:14:11','2026-09-01 05:49:11'),
(1007,4,1007,'DE','Daniel','Laurent',2,'6asn/ICYIyZaXPRf7/OM5vdrb82IaTLHIIjhPZ04KjG+LFHn','2030-07-22 00:00:00',0,'2026-02-06 05:14:11','2026-09-07 07:44:11'),
(1008,4,1008,'DE','Omar','Leroy',3,'VVyyVMFFlQtBEmlZzWyCRml8S6jzCc7qXDgqzElH6yqFqMCC','2029-08-21 00:00:00',0,'2026-03-20 05:14:11','2026-09-15 20:57:11'),
(1009,1,1009,'DE','Isabelle','Dubois',2,'4EmYcWbzX1GkSjuP/I/YdtN0EX16FYhZkofI3lutugdkBPua','2030-06-18 00:00:00',0,'2026-04-19 05:14:11','2026-09-13 20:53:11'),
(1010,3,1010,'US','Julien','Thomas',3,'46t6Opuo89Mr4rl5RUUkUkmxMlqZElVoDdGsrJGot44wdphz','2030-03-25 00:00:00',0,'2026-01-25 05:14:11','2026-09-02 01:03:11'),
(1011,3,1011,'US','Hugo','Thomas',3,'5mDP6EparyjttXV+Ml4cnQhFhk4hajZkVXKk9HTSd9NKHBam','2027-11-18 00:00:00',0,'2026-08-05 05:14:11','2026-09-10 22:20:11'),
(1012,3,1012,'GB','Emma','Silva',3,'buCK3ZNZQh1RKww0hRmmY4lmQriWEwEezceHJQAwjj8OvD+6','2031-09-29 00:00:00',0,'2026-03-25 05:14:11','2026-09-01 08:11:11'),
(1013,3,1013,'GB','Sophie','Garcia',1,'x7/9RB/pAjLJeQesDmwuqqJ9o6ViPW1Iub2KyKQjpxu+9WPc','2030-07-08 00:00:00',0,'2026-07-20 05:14:11','2026-09-06 15:48:11'),
(1014,3,1014,'GB','Sophie','Martin',2,'qw5efYyk0YN0iQfuEonZgCzweuHEY9t7fBi6WnVBpvyj4WVK','2030-03-26 00:00:00',0,'2025-10-08 05:14:11','2026-09-02 13:46:11'),
(1015,1,1015,'GB','Pauline','Simon',3,'NLbKvIdEaL9uucno+q7YsNBxFvfOvpNl1XhRCgCOpSRA5ANw','2031-03-28 00:00:00',0,'2026-08-12 05:14:11','2026-08-30 13:59:11');

-- 余额流水 / 积分流水
INSERT INTO `user_balance_log` (`id`,`site_id`,`user_id`,`change_type`,`amount`,`before_balance`,`after_balance`,`order_id`,`operator_id`,`remark`,`created_at`) VALUES
(1001,1,1001,1,174.00,1429.00,1603.00,0,0,'在线充值','2026-08-06 09:41:11'),
(1002,4,1002,2,-172.00,66.00,-106.00,0,0,'订单消费','2026-08-04 04:12:11'),
(1003,4,1003,2,-406.00,427.00,21.00,0,0,'订单消费','2026-09-08 22:53:11'),
(1004,4,1004,1,396.00,1210.00,1606.00,0,0,'在线充值','2026-09-05 17:53:11'),
(1005,4,1005,3,72.00,1362.00,1434.00,0,0,'订单退款','2026-09-13 23:01:11'),
(1006,3,1006,4,-174.00,887.00,713.00,0,101,'平台调账','2026-08-14 07:23:11'),
(1007,4,1007,4,-484.00,1432.00,948.00,0,101,'平台调账','2026-08-14 22:37:11'),
(1008,4,1008,2,-467.00,1668.00,1201.00,0,0,'订单消费','2026-08-03 21:37:11'),
(1009,1,1009,4,-184.00,191.00,7.00,0,101,'平台调账','2026-07-28 14:51:11'),
(1010,3,1010,1,335.00,789.00,1124.00,0,0,'在线充值','2026-09-02 17:58:11'),
(1011,3,1011,4,-407.00,1163.00,756.00,0,101,'平台调账','2026-09-03 04:05:11'),
(1012,3,1012,2,-452.00,708.00,256.00,0,0,'订单消费','2026-08-21 14:42:11'),
(1013,3,1013,3,44.00,587.00,631.00,0,0,'订单退款','2026-08-07 21:52:11'),
(1014,3,1014,5,-239.00,1911.00,1672.00,0,101,'用户提现','2026-09-14 13:00:11'),
(1015,1,1015,5,-340.00,1137.00,797.00,0,101,'用户提现','2026-08-09 21:31:11'),
(1016,4,1016,1,48.00,1511.00,1559.00,0,0,'在线充值','2026-09-11 01:19:11'),
(1017,4,1017,1,369.00,1066.00,1435.00,0,0,'在线充值','2026-08-18 10:16:11'),
(1018,3,1018,2,-92.00,1127.00,1035.00,0,0,'订单消费','2026-08-19 14:58:11'),
(1019,4,1019,4,-166.00,473.00,307.00,0,101,'平台调账','2026-08-01 05:42:11'),
(1020,1,1020,1,210.00,67.00,277.00,0,0,'在线充值','2026-07-21 07:50:11');
INSERT INTO `user_points_log` (`id`,`site_id`,`user_id`,`change_type`,`points`,`after_points`,`order_id`,`remark`,`created_at`) VALUES
(1001,1,1001,1,942,6021,0,'测试数据','2026-07-17 10:47:11'),
(1002,4,1002,1,915,2998,0,'测试数据','2026-08-25 06:34:11'),
(1003,4,1003,2,-194,529,0,'测试数据','2026-09-02 05:26:11'),
(1004,4,1004,4,475,2243,0,'测试数据','2026-08-13 05:51:11'),
(1005,4,1005,1,-323,4545,0,'测试数据','2026-08-28 01:52:11'),
(1006,3,1006,2,669,7704,0,'测试数据','2026-08-17 21:47:11'),
(1007,4,1007,2,684,5299,0,'测试数据','2026-07-23 12:12:11'),
(1008,4,1008,2,497,3616,0,'测试数据','2026-09-12 07:05:11'),
(1009,1,1009,2,147,5427,0,'测试数据','2026-08-29 07:51:11'),
(1010,3,1010,4,116,5637,0,'测试数据','2026-08-16 17:50:11'),
(1011,3,1011,3,683,5868,0,'测试数据','2026-09-09 03:31:11'),
(1012,3,1012,4,0,5228,0,'测试数据','2026-07-24 00:06:11'),
(1013,3,1013,4,-265,1582,0,'测试数据','2026-08-25 22:27:11'),
(1014,3,1014,2,303,7199,0,'测试数据','2026-08-03 02:05:11'),
(1015,1,1015,1,347,4873,0,'测试数据','2026-09-12 04:51:11'),
(1016,4,1016,3,-241,178,0,'测试数据','2026-07-23 00:59:11'),
(1017,4,1017,3,996,1603,0,'测试数据','2026-08-19 22:07:11'),
(1018,3,1018,5,506,1226,0,'测试数据','2026-08-23 00:34:11'),
(1019,4,1019,5,-294,4848,0,'测试数据','2026-07-30 09:23:11'),
(1020,1,1020,2,-141,6933,0,'测试数据','2026-07-20 07:51:11');

-- 用户反馈与投诉(覆盖 0~3 全部状态)
INSERT INTO `user_feedback` (`id`,`site_id`,`user_id`,`feedback_type`,`content`,`images`,`order_id`,`status`,`reply_content`,`handler_id`,`handled_at`,`created_at`,`updated_at`) VALUES
(1001,1,1001,1,'退款迟迟未到账,请帮忙处理',NULL,0,3,'',0,'2026-08-27 14:03:11','2026-08-08 11:47:11','2026-09-13 00:40:11'),
(1002,4,1002,4,'App 搜索筛选不好用',NULL,0,2,'已收到您的反馈,我们会尽快处理。',104,'2026-09-10 10:01:11','2026-07-20 19:59:11','2026-09-15 18:52:11'),
(1003,4,1003,4,'希望增加更多支付方式',NULL,0,2,'已收到您的反馈,我们会尽快处理。',104,'2026-09-10 04:52:11','2026-09-09 07:46:11','2026-09-06 17:43:11'),
(1004,4,1004,2,'希望增加更多支付方式',NULL,0,1,'已收到您的反馈,我们会尽快处理。',104,NULL,'2026-08-02 12:50:11','2026-09-12 11:23:11'),
(1005,4,1005,3,'退款迟迟未到账,请帮忙处理',NULL,0,2,'已收到您的反馈,我们会尽快处理。',104,'2026-08-27 06:01:11','2026-08-27 20:14:11','2026-09-12 08:05:11'),
(1006,3,1006,1,'希望增加更多支付方式',NULL,0,2,'已收到您的反馈,我们会尽快处理。',104,'2026-09-15 23:55:11','2026-07-19 23:38:11','2026-09-13 14:42:11'),
(1007,4,1007,2,'退款迟迟未到账,请帮忙处理',NULL,0,3,'',0,'2026-09-15 14:06:11','2026-09-01 22:35:11','2026-09-08 18:48:11'),
(1008,4,1008,4,'退款迟迟未到账,请帮忙处理',NULL,0,1,'已收到您的反馈,我们会尽快处理。',104,NULL,'2026-08-18 21:27:11','2026-09-13 10:18:11'),
(1009,1,1009,3,'App 搜索筛选不好用',NULL,0,3,'',0,'2026-08-28 15:46:11','2026-08-08 14:29:11','2026-09-05 12:19:11'),
(1010,3,1010,3,'商户拒绝接待已确认的订单',NULL,0,0,'',0,NULL,'2026-08-05 21:04:11','2026-09-15 14:41:11'),
(1011,3,1011,3,'房间卫生状况不佳,希望改进',NULL,0,1,'已收到您的反馈,我们会尽快处理。',104,NULL,'2026-09-15 16:24:11','2026-09-14 18:52:11'),
(1012,3,1012,2,'退款迟迟未到账,请帮忙处理',NULL,0,1,'已收到您的反馈,我们会尽快处理。',104,NULL,'2026-08-30 11:28:11','2026-09-08 06:27:11');

-- 用户操作日志
INSERT INTO `user_action_log` (`id`,`site_id`,`user_id`,`action_type`,`content`,`client_ip`,`device_info`,`created_at`) VALUES
(1001,1,1001,4,'测试数据','10.1.8.143','iPhone 15','2026-08-19 02:33:11'),
(1002,4,1002,1,'测试数据','10.1.4.21','Pixel 8','2026-08-10 06:48:11'),
(1003,4,1003,5,'测试数据','10.1.6.204','H5','2026-08-12 02:17:11'),
(1004,4,1004,2,'测试数据','10.1.2.118','Pixel 8','2026-08-23 05:49:11'),
(1005,4,1005,1,'测试数据','10.1.4.17','Pixel 8','2026-08-11 13:06:11'),
(1006,3,1006,2,'测试数据','10.1.0.219','H5','2026-09-15 16:15:11'),
(1007,4,1007,5,'测试数据','10.1.1.155','Pixel 8','2026-08-20 16:28:11'),
(1008,4,1008,4,'测试数据','10.1.5.103','H5','2026-08-20 22:24:11'),
(1009,1,1009,5,'测试数据','10.1.3.242','iPhone 15','2026-09-15 18:23:11'),
(1010,3,1010,1,'测试数据','10.1.0.248','Pixel 8','2026-09-13 17:22:11'),
(1011,3,1011,1,'测试数据','10.1.6.221','Pixel 8','2026-08-25 00:10:11'),
(1012,3,1012,2,'测试数据','10.1.9.62','Pixel 8','2026-08-17 20:18:11'),
(1013,3,1013,1,'测试数据','10.1.8.167','Pixel 8','2026-08-23 11:47:11'),
(1014,3,1014,2,'测试数据','10.1.1.53','Pixel 8','2026-09-03 00:00:11'),
(1015,1,1015,3,'测试数据','10.1.2.186','Pixel 8','2026-08-15 09:10:11'),
(1016,4,1016,3,'测试数据','10.1.0.252','H5','2026-09-06 22:02:11'),
(1017,4,1017,1,'测试数据','10.1.2.108','H5','2026-09-02 15:49:11'),
(1018,3,1018,3,'测试数据','10.1.8.136','H5','2026-08-05 07:08:11'),
(1019,4,1019,2,'测试数据','10.1.2.164','Pixel 8','2026-09-07 05:07:11'),
(1020,1,1020,2,'测试数据','10.1.9.65','Pixel 8','2026-08-11 02:19:11'),
(1021,1,1021,3,'测试数据','10.1.3.147','Pixel 8','2026-08-09 09:35:11'),
(1022,1,1022,4,'测试数据','10.1.7.139','Pixel 8','2026-08-06 01:13:11'),
(1023,1,1023,2,'测试数据','10.1.9.250','iPhone 15','2026-08-18 11:58:11'),
(1024,4,1024,2,'测试数据','10.1.3.198','H5','2026-08-28 00:40:11'),
(1025,1,1025,2,'测试数据','10.1.1.92','H5','2026-08-11 03:59:11'),
(1026,1,1026,5,'测试数据','10.1.8.239','Pixel 8','2026-09-05 12:19:11'),
(1027,3,1027,3,'测试数据','10.1.9.175','iPhone 15','2026-08-29 01:28:11'),
(1028,4,1028,2,'测试数据','10.1.7.134','Pixel 8','2026-08-01 22:08:11'),
(1029,3,1029,3,'测试数据','10.1.4.153','H5','2026-09-07 06:14:11'),
(1030,1,1030,1,'测试数据','10.1.1.123','iPhone 15','2026-09-09 01:42:11');

-- 收藏 / 推荐返利 / 站内通知
INSERT INTO `user_favorite` (`id`,`site_id`,`user_id`,`property_id`,`goods_id`,`created_at`) VALUES
(1001,1,1001,0,1001,'2026-08-24 01:06:11'),
(1002,4,1002,0,1002,'2026-08-22 20:17:11'),
(1003,4,1003,0,1003,'2026-09-15 01:51:11'),
(1004,4,1004,0,1004,'2026-08-01 23:54:11'),
(1005,4,1005,0,1005,'2026-08-26 03:06:11'),
(1006,3,1006,0,1006,'2026-07-17 12:51:11'),
(1007,4,1007,0,1007,'2026-09-06 14:26:11'),
(1008,4,1008,0,1008,'2026-08-31 23:00:11'),
(1009,1,1009,0,1009,'2026-09-07 17:16:11'),
(1010,3,1010,0,1010,'2026-08-25 04:11:11'),
(1011,3,1011,2003,0,'2026-08-22 21:06:11'),
(1012,3,1012,2003,0,'2026-08-30 00:26:11'),
(1013,3,1013,2007,0,'2026-09-01 16:57:11'),
(1014,3,1014,2007,0,'2026-09-13 15:49:11'),
(1015,1,1015,2008,0,'2026-08-25 02:34:11'),
(1016,4,1016,2008,0,'2026-09-10 04:43:11');
INSERT INTO `user_referral` (`id`,`site_id`,`inviter_user_id`,`invitee_user_id`,`reward_status`,`reward_amount`,`reward_order_id`,`bind_time`,`reward_time`,`created_at`,`updated_at`) VALUES
(1001,1,1001,1002,0,10.00,0,'2026-09-03 19:49:11','2026-09-12 12:27:11','2026-07-22 23:13:11','2026-08-29 08:52:11'),
(1002,4,1002,1003,0,20.00,0,'2026-07-08 12:21:11','2026-08-31 22:37:11','2026-08-18 02:04:11','2026-09-14 11:00:11'),
(1003,4,1003,1004,1,20.00,0,'2026-06-30 12:08:11',NULL,'2026-07-28 09:08:11','2026-09-14 18:12:11'),
(1004,4,1004,1005,0,10.00,0,'2026-06-21 20:33:11',NULL,'2026-07-15 21:27:11','2026-08-28 21:51:11'),
(1005,4,1005,1006,2,0.00,0,'2026-08-29 10:13:11','2026-09-04 05:48:11','2026-09-09 10:33:11','2026-09-14 17:53:11'),
(1006,3,1006,1007,1,10.00,0,'2026-06-19 06:40:11','2026-08-27 18:02:11','2026-08-31 05:53:11','2026-09-01 10:20:11'),
(1007,4,1007,1008,2,0.00,0,'2026-08-20 07:15:11',NULL,'2026-06-22 19:07:11','2026-09-03 08:46:11'),
(1008,4,1008,1009,1,20.00,0,'2026-08-12 10:54:11',NULL,'2026-09-03 12:48:11','2026-08-24 20:42:11');
INSERT INTO `notify_record` (`id`,`site_id`,`user_id`,`event_key`,`title`,`content`,`biz_type`,`biz_id`,`is_read`,`read_at`,`created_at`) VALUES
(1001,1,1001,'booking_confirmed','订单已取消','测试数据通知内容',2,0,0,NULL,'2026-08-24 21:26:11'),
(1002,4,1002,'booking_cancelled','订单已确认','测试数据通知内容',3,0,1,NULL,'2026-08-25 08:27:11'),
(1003,4,1003,'booking_confirmed','期待您的评价','测试数据通知内容',1,0,1,'2026-09-08 05:44:11','2026-08-24 15:18:11'),
(1004,4,1004,'booking_cancelled','期待您的评价','测试数据通知内容',3,0,1,NULL,'2026-09-10 20:25:11'),
(1005,4,1005,'booking_cancelled','期待您的评价','测试数据通知内容',3,0,1,NULL,'2026-08-21 04:04:11'),
(1006,3,1006,'booking_confirmed','订单已确认','测试数据通知内容',1,0,0,NULL,'2026-08-19 00:31:11'),
(1007,4,1007,'booking_confirmed','期待您的评价','测试数据通知内容',1,0,0,'2026-09-07 06:12:11','2026-09-10 23:52:11'),
(1008,4,1008,'booking_cancelled','期待您的评价','测试数据通知内容',1,0,1,'2026-09-10 14:37:11','2026-09-09 02:26:11'),
(1009,1,1009,'review_request','订单已取消','测试数据通知内容',2,0,1,'2026-09-12 15:50:11','2026-08-28 18:41:11'),
(1010,3,1010,'booking_cancelled','订单已取消','测试数据通知内容',2,0,0,NULL,'2026-09-15 11:08:11'),
(1011,3,1011,'booking_confirmed','订单已取消','测试数据通知内容',2,0,1,'2026-09-13 06:57:11','2026-09-14 17:42:11'),
(1012,3,1012,'booking_cancelled','订单已确认','测试数据通知内容',2,0,0,NULL,'2026-08-26 16:06:11'),
(1013,3,1013,'review_request','订单已取消','测试数据通知内容',3,0,1,'2026-09-14 04:18:11','2026-08-22 12:47:11'),
(1014,3,1014,'booking_confirmed','期待您的评价','测试数据通知内容',1,0,1,'2026-09-11 03:46:11','2026-09-14 12:06:11'),
(1015,1,1015,'booking_cancelled','订单已确认','测试数据通知内容',2,0,1,NULL,'2026-08-21 04:47:11'),
(1016,4,1016,'booking_cancelled','订单已取消','测试数据通知内容',3,0,1,'2026-09-08 20:37:11','2026-08-24 16:25:11'),
(1017,4,1017,'booking_confirmed','期待您的评价','测试数据通知内容',1,0,1,NULL,'2026-08-29 09:30:11'),
(1018,3,1018,'review_request','订单已确认','测试数据通知内容',1,0,1,'2026-09-13 01:47:11','2026-08-20 14:26:11'),
(1019,4,1019,'review_request','订单已取消','测试数据通知内容',1,0,1,NULL,'2026-09-15 06:35:11'),
(1020,1,1020,'booking_cancelled','期待您的评价','测试数据通知内容',2,0,0,'2026-09-13 05:25:11','2026-08-27 23:28:11');

-- 风控态 / 申诉 / 黑名单
INSERT INTO `user_fraud` (`id`,`site_id`,`user_id`,`fraud_score`,`level`,`last_reason`,`last_eval_at`,`created_at`,`updated_at`) VALUES
(1001,1,1001,47,1,'','2026-09-08 22:50:11','2026-01-15 05:14:11','2026-09-09 15:04:11'),
(1002,4,1002,83,2,'异常下单行为','2026-09-15 02:30:11','2025-10-04 05:14:11','2026-09-05 16:44:11'),
(1003,4,1003,28,0,'','2026-09-12 15:08:11','2026-08-12 05:14:11','2026-09-16 03:50:11'),
(1004,4,1004,90,3,'异常下单行为','2026-09-06 21:45:11','2025-08-13 05:14:11','2026-09-12 21:44:11'),
(1005,4,1005,40,1,'','2026-09-08 20:14:11','2025-08-27 05:14:11','2026-09-07 02:57:11'),
(1006,3,1006,12,0,'','2026-09-09 04:20:11','2026-07-20 05:14:11','2026-09-07 13:54:11'),
(1007,4,1007,78,2,'异常下单行为','2026-09-12 04:59:11','2026-02-06 05:14:11','2026-09-13 22:58:11'),
(1008,4,1008,86,3,'异常下单行为','2026-09-03 18:55:11','2026-03-20 05:14:11','2026-09-02 20:13:11'),
(1009,1,1009,70,2,'异常下单行为','2026-09-04 07:05:11','2026-04-19 05:14:11','2026-09-03 02:04:11'),
(1010,3,1010,4,0,'','2026-09-09 05:08:11','2026-01-25 05:14:11','2026-09-06 06:34:11'),
(1011,3,1011,21,0,'','2026-09-01 23:00:11','2026-08-05 05:14:11','2026-09-06 05:26:11'),
(1012,3,1012,84,2,'异常下单行为','2026-09-12 16:12:11','2026-03-25 05:14:11','2026-09-12 04:36:11'),
(1013,3,1013,90,3,'异常下单行为','2026-09-08 01:16:11','2026-07-20 05:14:11','2026-09-08 17:10:11'),
(1014,3,1014,80,2,'异常下单行为','2026-08-31 17:46:11','2025-10-08 05:14:11','2026-09-14 12:43:11'),
(1015,1,1015,44,1,'','2026-09-01 19:49:11','2026-08-12 05:14:11','2026-09-08 09:10:11');
INSERT INTO `user_appeal` (`id`,`site_id`,`user_id`,`content`,`attachments`,`status`,`handler_id`,`handle_remark`,`handled_at`,`created_at`,`updated_at`) VALUES
(1001,1,1001,'我的账号被误判为风险用户,请求复核。',NULL,3,104,'','2026-09-14 22:47:11','2026-09-03 06:51:11','2026-09-12 03:50:11'),
(1002,4,1002,'我的账号被误判为风险用户,请求复核。',NULL,1,104,'复核后解除限制','2026-09-07 23:56:11','2026-08-23 15:40:11','2026-09-10 07:24:11'),
(1003,4,1003,'我的账号被误判为风险用户,请求复核。',NULL,1,104,'复核后解除限制','2026-09-05 11:14:11','2026-08-18 18:28:11','2026-09-13 16:05:11'),
(1004,4,1004,'我的账号被误判为风险用户,请求复核。',NULL,0,0,'',NULL,'2026-09-09 05:19:11','2026-09-10 20:27:11'),
(1005,4,1005,'我的账号被误判为风险用户,请求复核。',NULL,1,104,'复核后解除限制','2026-09-06 18:21:11','2026-08-30 08:03:11','2026-09-12 20:56:11'),
(1006,3,1006,'我的账号被误判为风险用户,请求复核。',NULL,1,104,'复核后解除限制','2026-09-05 21:39:11','2026-09-10 09:36:11','2026-09-12 21:59:11'),
(1007,4,1007,'我的账号被误判为风险用户,请求复核。',NULL,1,104,'复核后解除限制','2026-09-10 19:19:11','2026-08-29 23:19:11','2026-09-10 16:01:11'),
(1008,4,1008,'我的账号被误判为风险用户,请求复核。',NULL,1,104,'复核后解除限制','2026-09-14 22:47:11','2026-08-30 04:23:11','2026-09-15 23:18:11');

-- 客服会话与消息
INSERT INTO `chat_conversation` (`id`,`site_id`,`user_id`,`type`,`target_id`,`title`,`status`,`last_message`,`last_time`,`rating`,`created_at`,`updated_at`) VALUES
(1001,1,1001,1,0,'订单咨询',0,'好的,感谢您的帮助!','2026-09-11 17:17:11',5,'2026-09-07 22:53:11','2026-09-12 07:02:11'),
(1002,4,1002,1,0,'订单咨询',1,'好的,感谢您的帮助!','2026-09-09 00:19:11',4,'2026-09-12 01:50:11','2026-09-09 02:52:11'),
(1003,4,1003,1,0,'订单咨询',0,'好的,感谢您的帮助!','2026-09-15 17:17:11',0,'2026-09-09 14:52:11','2026-09-10 05:15:11'),
(1004,4,1004,1,0,'订单咨询',1,'好的,感谢您的帮助!','2026-09-11 09:52:11',4,'2026-09-09 19:53:11','2026-09-16 02:40:11'),
(1005,4,1005,2,0,'订单咨询',0,'好的,感谢您的帮助!','2026-09-13 10:08:11',0,'2026-09-09 18:15:11','2026-09-15 15:57:11'),
(1006,3,1006,1,0,'订单咨询',0,'好的,感谢您的帮助!','2026-09-10 18:55:11',0,'2026-09-09 01:24:11','2026-09-11 13:45:11'),
(1007,4,1007,1,0,'订单咨询',1,'好的,感谢您的帮助!','2026-09-11 21:58:11',0,'2026-09-12 14:26:11','2026-09-12 06:26:11'),
(1008,4,1008,2,0,'订单咨询',0,'好的,感谢您的帮助!','2026-09-08 06:38:11',4,'2026-09-03 09:14:11','2026-09-16 00:39:11');

-- 会话消息(每会话 2~3 条)
INSERT INTO `chat_message` (`id`,`site_id`,`conversation_id`,`sender_type`,`content`,`msg_type`,`created_at`) VALUES
(1001,1,1001,1,'你好,我想咨询一下订单退款进度。',1,'2026-09-13 05:01:11'),
(1002,1,1001,3,'你好,我想咨询一下订单退款进度。',1,'2026-09-15 00:14:11'),
(1003,1,1001,2,'你好,我想咨询一下订单退款进度。',1,'2026-09-10 06:30:11'),
(1004,4,1002,1,'你好,我想咨询一下订单退款进度。',1,'2026-09-10 03:54:11'),
(1005,4,1002,2,'你好,我想咨询一下订单退款进度。',1,'2026-09-10 11:55:11'),
(1006,4,1003,1,'你好,我想咨询一下订单退款进度。',1,'2026-09-15 04:10:11'),
(1007,4,1003,3,'你好,我想咨询一下订单退款进度。',1,'2026-09-10 11:08:11'),
(1008,4,1003,2,'你好,我想咨询一下订单退款进度。',1,'2026-09-10 17:45:11'),
(1009,4,1004,1,'你好,我想咨询一下订单退款进度。',1,'2026-09-10 01:54:11'),
(1010,4,1004,2,'你好,我想咨询一下订单退款进度。',1,'2026-09-10 13:48:11'),
(1011,4,1005,1,'你好,我想咨询一下订单退款进度。',1,'2026-09-09 00:55:11'),
(1012,4,1005,3,'你好,我想咨询一下订单退款进度。',1,'2026-09-11 22:26:11'),
(1013,4,1005,2,'你好,我想咨询一下订单退款进度。',1,'2026-09-10 20:33:11'),
(1014,3,1006,1,'你好,我想咨询一下订单退款进度。',1,'2026-09-12 10:45:11'),
(1015,3,1006,2,'你好,我想咨询一下订单退款进度。',1,'2026-09-09 17:09:11'),
(1016,4,1007,1,'你好,我想咨询一下订单退款进度。',1,'2026-09-11 14:28:11'),
(1017,4,1007,3,'你好,我想咨询一下订单退款进度。',1,'2026-09-09 22:54:11'),
(1018,4,1007,2,'你好,我想咨询一下订单退款进度。',1,'2026-09-12 15:13:11'),
(1019,4,1008,1,'你好,我想咨询一下订单退款进度。',1,'2026-09-11 09:41:11'),
(1020,4,1008,2,'你好,我想咨询一下订单退款进度。',1,'2026-09-14 07:28:11');

-- 【MMK 仰光站】C 端用户(site_id=7,+959)
INSERT INTO `user_info` (`id`,`site_id`,`nickname`,`avatar`,`mobile`,`mobile_hash`,`email`,`password`,`register_source`,`register_time`,`last_login_at`,`last_login_ip`,`member_level_id`,`member_expire_time`,`balance`,`points`,`real_name_status`,`real_name`,`id_card`,`user_status`,`tags`,`remark`,`referral_code`,`created_at`,`updated_at`) VALUES
(7001,7,'Su S.','https://cdn.mtrip.test/prod/avatar/7001.png','kV0FueV7hEXmBE3I7MYNsSYvqtUELN2WIAuC+6Rm7UhKlRaS1rQ6qB8=','b60294a0a04c68e483cd6f5e6e264c0086cec21ca3b8f83e70d24e76d9ffaa3f','DTb63EMTW8P73r8IFLBnT5ew5kXERrT2zapGaPqkl8nUHtxnxr3aKOeZ129qnRE=','$2y$10$T4h0HcCu0fHYxo9aLek2iezqDosfU9ju/SWaQJpkF53EaGi4HLdNm',1,'2026-03-06 05:14:11','2026-09-14 07:20:11','27.240.184.119',1001,'2027-03-15 05:14:11',80000.00,4759,1,'WBncI2Q8itihKTson0G+OQBX2UJumKkmqPtgCZDsKBHjV/Q2','/I00Cx8qzZj6ORnPek1LBUp10XAjTYJbFmMDN9+xcCqzjnKgW6w=',1,'["新客"]','MMK 测试数据','REF007001','2026-03-06 05:14:11','2026-08-31 00:27:11'),
(7002,7,'Min Z.','https://cdn.mtrip.test/prod/avatar/7002.png','p8MBs3vkv2wObmBfuClct24bmQtjjwj5y76b/TbUqOnryzUigYswIAE=','9266e4c7013c74bcc7053518799302a05d274600842c56dabe96e2a472748006','8xCXFh8o48fmbu3CrumRHQSBwwrvWNcCkYKaMZ+OpyDSXqqzxd5C5muz7ygiY9k=','$2y$10$T4h0HcCu0fHYxo9aLek2iezqDosfU9ju/SWaQJpkF53EaGi4HLdNm',3,'2026-03-19 05:14:11','2026-09-08 17:02:11','17.161.31.122',1001,'2027-03-15 05:14:11',20000.00,3193,0,'EoDrhHSwPLnOnRqAkqECz+zsVdM2CAqZajRfq1/NyXsKat1TgA==','Se7NEQhQhm3CAIWUc19pOp6i4f4Rcp6AEBdwHYAqcrRAmdg8i14=',1,'["新客"]','MMK 测试数据','REF007002','2026-03-19 05:14:11','2026-09-14 19:48:11'),
(7003,7,'Yamin A.','https://cdn.mtrip.test/prod/avatar/7003.png','ZPxyDugc/hdwVBC63YTKtEGMQlx3kqgkJvyRanD6jjdr2IARyoPtiuM=','e7575cc843e447519b805229be2327ab5391a5c0d5d64fec116cc3541c17e092','Va9emkLrOWAkwm/ScQNxm1Xtvv3EV7B5eZSiuLex2lowM8jy4uP+PLkV4xNXlT8=','$2y$10$T4h0HcCu0fHYxo9aLek2iezqDosfU9ju/SWaQJpkF53EaGi4HLdNm',1,'2026-07-26 05:14:11','2026-09-15 09:25:11','51.85.43.5',1001,'2027-03-15 05:14:11',20000.00,111,1,'SA9qqBBlI7Y4SzhTa7W0NRFWnCTJ8lW6LIWeX8XXrVFTh1XEQg==','Pdd3r1VCGRp55CvgnOHe838F9PKPzxGYLhMWzf9yOog6NleIWyc=',1,'["新客"]','MMK 测试数据','REF007003','2026-07-26 05:14:11','2026-09-06 08:44:11'),
(7004,7,'Ei S.','https://cdn.mtrip.test/prod/avatar/7004.png','JFYO97LC0bq2LuMHcFgG/13u6SBM6x/FpcqniH5StNoH8mws4ARHCTA=','d49b45e7ddf820d5fd31369dc04719e974370676a04e2b4f3f20e27640a604f3','Xg7zNfCJ/4mpnRm76LMtJRFmDJWaoVbk9x7Je7AkMMN1xfeeB5iMHEPOtqHJsjE=','$2y$10$T4h0HcCu0fHYxo9aLek2iezqDosfU9ju/SWaQJpkF53EaGi4HLdNm',4,'2026-03-10 05:14:11','2026-09-11 01:15:11','212.174.159.217',1001,'2027-03-15 05:14:11',80000.00,2180,1,'oFIAcuzaEqTA5yInTcqiizOX6j/HnqQsB2jfYQJ2H7dxinL6WyU=','d0pxAO++ytx/hLixs95v2FYusi/0Yx/67xIAoBNopMrshohaufY=',1,'["新客"]','MMK 测试数据','REF007004','2026-03-10 05:14:11','2026-09-12 14:36:11'),
(7005,7,'Nyein K.','https://cdn.mtrip.test/prod/avatar/7005.png','F+FewDGKhkIZcEXJCF7p/kKnKpS3UizHao3VbNiC/1yYvXFzbhjEjpI=','cbc9ad1008131e1cd93534ca09512b9e915bc8e5f6204faaa18e2a0c1fdd6629','TwegoOyYpWuTn7C+ApmRTwhMoLPpKHmvsg2s/Ux52fPudNr9wGSPNhOsNcPlshQ=','$2y$10$T4h0HcCu0fHYxo9aLek2iezqDosfU9ju/SWaQJpkF53EaGi4HLdNm',4,'2025-12-04 05:14:11','2026-09-01 16:23:11','2.222.215.216',1001,'2027-03-15 05:14:11',0.00,4340,0,'BKv5uKtPCXGewbXO/xBlclFmb9ZaXrY7lnz/Jmo3XhrbE3f8','ZEGxxa3gaTeomeSZsG24t1xSl3E9YTCKU48Ld08+Kt8ij4t1fwQ=',1,'["新客"]','MMK 测试数据','REF007005','2025-12-04 05:14:11','2026-09-16 00:20:11'),
(7006,7,'Moe W.','https://cdn.mtrip.test/prod/avatar/7006.png','9kJFohYUTLIBXAQnCeGj8AUFQIWiPyHc0vqx3jv2RSCHqs1l8B+oIGc=','e576a30ce46aec808eaab58665c2d0761720209e5c9bc31ff4e677c1161910e0','N0tJWiiLZZO1DP4z+jSIV7WuvcCi0/hdP590lZyln9u1OXbOZVLtINdu49ytReE=','$2y$10$T4h0HcCu0fHYxo9aLek2iezqDosfU9ju/SWaQJpkF53EaGi4HLdNm',3,'2026-01-06 05:14:11','2026-09-03 07:34:11','207.165.17.197',1001,'2027-03-15 05:14:11',0.00,4717,1,'QwBnGdggmLY3NUOrhSVc4HIG8xTloY9pM20iwLCdxcFESEvXWQ==','dH9+1rbVAaqBxkeADHmOP4CaOX0xnCPSiQiFaT2Ru4wI/DQcIYc=',1,'["新客"]','MMK 测试数据','REF007006','2026-01-06 05:14:11','2026-08-28 22:59:11');
