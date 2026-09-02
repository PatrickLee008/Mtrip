# temp —— 设计稿临时图片

这里的图片**不是最终素材**,是从 Figma 设计稿导出的示例图,仅用于「接口无数据 / 未登录」时把页面渲染成设计稿的样子。
接口能返回真实图片后,对应文件应当删除。

来源:Figma M-Trip `k6yJOiDvU0fqkmrHUGBfyT`(原始缓存与节点对照见仓库根 `.figma-cache/`)

引用统一走 `src/assets/tempImages.ts`,不要在业务组件里直接 `require` 这里的路径,方便将来一次性摘除。

## mypick/ —— 我的精选(设计稿节点 `289:1112`)

| 文件 | 素材像素 | 展示框 | 用在哪 | 将来由谁替代 |
| --- | --- | --- | --- | --- |
| `booking-cover.jpg` | 330×330 | 402×176 | 未登录时的示例预订卡封面 | `/order/list` 的 `goods_image` |
| `hotel-heritage-bagan.png` | 512×512 | 298×176 | 收藏酒店兜底卡 1;酒店搜索结果演示卡 1(`1695:6325`) | `/user/favorite/list` 的 `cover_image` |
| `hotel-strand-suites.png` | 512×512 | 298×176 | 收藏酒店兜底卡 2;酒店搜索结果演示卡 2(顶替设计稿的 Aureum Palace 图,未导出) | 同上 |
| `restaurant-golden-mandalay.jpg` | 512×279 | 322×128 | 收藏餐厅卡 1 | 后端暂无餐饮品类 |
| `restaurant-shwe-flower.jpg` | 512×279 | 322×128 | 收藏餐厅卡 2 | 同上 |

## hotel/ —— 酒店详情六个页签(设计稿节点 `759:9776` Hotel Details)

| 文件 | 设计稿节点 | 素材像素 | 展示框 | 用在哪 | 将来由谁替代 |
| --- | --- | --- | --- | --- | --- |
| `detail-resort-view.png` | `94:900` | 512×512 | 402×300 | Overview 图库第 1 张 | `/goods/detail` 的图集字段 |
| `detail-room-interior.png` | `94:902` | 512×512 | 402×300 | Overview 图库第 2 张 | 同上 |
| `detail-dining-view.png` | `94:904` | 512×512 | 402×300 | Overview 图库第 3 张 | 同上 |
| `room-standard.png` | `222:1600` | 512×512 | 370×192 | Rooms 房型卡 1(Standard Room) | 房型接口的房型图 |
| `room-deluxe.png` | `222:1625` | 512×512 | 370×192 | Rooms 房型卡 2(Deluxe Room) | 同上 |
| `room-family.png` | `222:1650` | 512×512 | 370×192 | Rooms 房型卡 3(Family Suite) | 同上 |
| `nearby-map.png` | `222:2920` | 512×512 | 370×256 | Nearby 地图占位 | 接入地图 SDK 后按坐标实时渲染 |
| `attraction-ananda.jpg` | `222:2943` | 128×128 | 64×64 | Nearby 景点卡 1 | 周边景点接口 |
| `attraction-dhammayangyi.jpg` | `222:2951` | 128×128 | 64×64 | Nearby 景点卡 2 | 同上 |
| `attraction-market.jpg` | `222:2959` | 128×128 | 64×64 | Nearby 景点卡 3 | 同上 |
| `policies-header.png` | `222:3505` | 512×512 | 370×192 | Policies 页头大图 | `/goods/detail` 的图集字段 |

设计稿的图库计数写的是 `2/12`(共 12 张),但只导出了 3 张;Overview 图库按实际张数显示计数,不硬写 12。
房型卡的计数设计稿同样是 `2/12`,但每个房型只导出了封面一张,那里沿用设计稿文案。
三张景点缩略图实为 JPEG(见下方「已知问题」),已按真实格式存成 `.jpg`。

## hotel/booking/ —— 订房流程(设计稿 section `1675:5776` Multi Booking Hotel Booking Flow)

| 文件 | 设计稿节点 | 素材像素 | 展示框 | 用在哪 | 将来由谁替代 |
| --- | --- | --- | --- | --- | --- |
| `addon-breakfast.jpg` | `1675:6220` | 512×512 | 368×182 | Step 1 加购卡「Daily Breakfast」封面 | 加购商品接口的图 |
| `addon-transfer.jpg` | `1675:6237` | 512×512 | 368×182 | Step 1 加购卡「Airport Transfer」封面 | 同上 |
| `voucher-qr.png` | `1675:6728` | 296×296 | 174×174 | 预订成功页的数字凭证二维码 | 下单接口返回的凭证串(届时改为运行时生成) |
| `pay-mmqr.png` | `1675:6600` | 104×160 | 22×34 | 支付页 MMQR Pay 图标 | 支付渠道接口的 icon |
| `pay-kbzpay.png` | `1675:6610` | 160×160 | 40×40 | 支付页 KBZPay 图标 | 同上 |
| `pay-wavepay.png` | `1675:6619` | 160×160 | 40×40 | 支付页 Wave Pay 图标 | 同上 |
| `pay-wallet.png` | `1675:6634` | 160×160 | 40×40 | 支付页「Pay with mTrip Wallet」图标 | 同上 |
| `pay-hotel.png` | `1675:6655` | 160×107 | 40×40 | 支付页「Pay at Hotel」图标 | 同上 |
| `pay-mobile-banking.png` | `I1675:6663;582:1444` | 160×160 | 40×40 | 支付页「Mobile Banking」底图 | 同上 |
| `pay-mobile-banking-logo.png` | 同上(上层 contain) | 160×160 | 40×40 | 同上,压在底图上的标 | 同上 |
| `pay-card.png` | `581:1438` | 160×160 | 40×40 | 支付页「Credit/debit Cards」图标 | 同上 |
| `pay-coupon.png` | `582:1447` | 160×107 | 40×40 | 支付页「Coupons」图标 | 优惠券接口 |
| `brand-mpu.png` | `522:1303` | 176×64 | 44×16 | 卡组织标 MPU | 支付渠道接口 |
| `brand-visa.png` | `522:1305` | 196×64 | 49×16 | 卡组织标 VISA | 同上 |
| `brand-mastercard.png` | `522:1307` | 108×65 | 27×16 | 卡组织标 Mastercard | 同上 |

Step 3 复核页与 Stay 明细页的房型封面(`1675:6419` / `1675:9692`)**与 Rooms 页签的 `room-deluxe.png` 是同一张图**
(逐像素比对 RMS=0),不重复入包,直接复用 `TEMP_ROOM_COVERS.deluxe`。
两张加购照片按上面「已知问题」的教训直接存成 JPEG(各约 60KB,PNG 编码要 400KB+);其余都是小图标,PNG 保留透明通道。
二维码是设计稿导出的静态图 —— 静态页阶段不为一张图引 `react-native-qrcode-svg`,接口给出凭证串后再换成运行时生成。

## home/ —— 首页(设计稿节点 `81:2464`)

| 文件 | 设计稿节点 | 素材像素 | 展示框 | 用在哪 |
| --- | --- | --- | --- | --- |
| `dest-bagan.png` | `81:2541` | 512×512 | 280×192 | 热门目的地兜底卡 1 |
| `dest-inle-lake.png` | `81:2551` | 512×512 | 280×192 | 热门目的地兜底卡 2 |
| `dest-ngapali.png` | `81:2561` | 512×512 | 280×192 | 热门目的地兜底卡 3 |
| `special-deal.png` | `196:827` | 512×512 | 370×170 | 限时特惠横幅底图 |
| `dining-rangoon-tea-house.jpg` | `196:761` | 160×160 | 80×80 | 餐饮优惠卡 1 |
| `dining-seeds.jpg` | `196:773` | 160×160 | 80×80 | 餐饮优惠卡 2 |
| `experience-balloon.png` | `81:2602` | 512×512 | 370×256 | 本地体验卡 1 |
| `experience-sunset-boat.png` | `81:2612` | 512×512 | 370×256 | 本地体验卡 2 |
| `magazine-pagoda-tips.png` | `81:2700` | 512×512 | 370×192 | 杂志流封面 |

「酒店特惠」区块不需要临时图:该区块只在 `/goods/home` 的 `recommend` 有数据时才渲染,封面一定来自接口。
杂志流第二篇(Mohinga,节点 `81:2718`)在设计稿里是 `visible:false` 的隐藏稿,已不实现,素材也不入包。

## promotion/ —— 优惠中心(设计稿节点 `1633:3300` Promotion)

| 文件 | 设计稿节点 | 素材像素 | 展示框 | 用在哪 | 将来由谁替代 |
| --- | --- | --- | --- | --- | --- |
| `campaign-banner.jpg` | `1389:2772` | 512×279 | 370×274 | 优惠页顶部活动横幅底图 | 活动接口的 banner 字段 |

优惠券卡、活动概览卡、条款卡都是纯样式,不需要素材;券票两侧的圆形缺口在设计稿里是 `Ellipse 24`
(纯色圆,填充 `#EBF0FF` = 页面底色),代码里直接用 `View` + `borderRadius` 画,没有导出成资产。

## more/ —— 「更多」及其子页(设计稿 section `1695:5951` More)

| 文件 | 设计稿节点 | 素材像素 | 展示框 | 用在哪 | 将来由谁替代 |
| --- | --- | --- | --- | --- | --- |
| `guide-thumbnail.jpg` | `2206:7835` | 512×279 | 322×160 | 教程视频封面(设计稿三张卡同一张图) | 教程内容接口的封面 |

Refer & Earn 页头图(`1687:4208`)**与优惠页的活动横幅是同一张图**(md5 一致),不重复入包,
`tempImages.ts` 里的 `TEMP_REFERRAL_BANNER` 直接指向 `TEMP_CAMPAIGN_BANNER`。
注:该节点用 `get_design_context` 拿到的导出件是一张 709 字节的空白 PNG(Figma 导出异常),
真图是用 `download_assets` 取 `rawImages` 拿到的 —— 遇到空白导出件时可以走这条路。

## 已知问题

- **Figma 资源接口返回上传时的原始格式,不按 URL 后缀走。** 有 5 个文件实为 JPEG,已按真实格式改成 `.jpg`
  (沿用 `.png` 会让打包/解码链路里依赖扩展名的环节出问题)。新增素材时务必用 magic bytes 复核。
- **体积偏大:home/ 约 3.4MB、mypick/ 约 1MB。** 大图都是 512×512 的 PNG 编码照片,转成 JPEG 可缩到约 1/10;
  本机没有 sharp / ImageMagick,暂未转换。这批图本来就是待删的临时素材,如果要进正式包务必先压。
- `mypick/booking-cover.jpg` 只有 330px 宽,铺到 402pt 的框里会偏糊 —— 设计稿自带素材的分辨率就这样,不是裁切问题。

## 裁切方式

统一 `resizeMode="cover"`(等比缩放 + 居中裁切),与设计稿图片框的裁切方式一致。已知两处设计稿自身带轻微拉伸,
按不失真处理:餐厅卡约 6% 纵向拉伸;预订卡把 1:1 素材横拉到 1.71:1(判断是 Figma 图片填充的裁切残留,非设计意图)。
