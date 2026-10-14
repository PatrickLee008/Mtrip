/**
 * 订单评价页(Figma「Hotel Review」`797:1600`,成功浮层 `800:2286`,出行类型下拉 `800:2209`)
 *
 * 从预订详情的「Write a Review」进入,一单一评:
 *   头图 300 高轮播(酒店图库,左上返回钮悬浮、底部 60% 黑渐变)→ 酒店卡(酒店名 / 房型 + 入离日期)
 *   → 「How was your stay?」奖励说明卡 → 五行表情评分(Overall / Cleanliness / Location / Service / Amenities)
 *   → 出行类型下拉(Solo / Couple / Family / Friends / Business)→ Share your experience 文本框 + 照片 / 视频
 *   → 吸底栏(Earn points + Submit Review)→ 提交成功浮层「Review Submitted」。
 *
 * 数据:`fetchReviewContext` 给订单摘要与「能不能评 / 已评内容」,`submitReview` 提交。
 * 图片(≤20 张)与视频(≤3 个)选好即上传到我们自己的存储,提交只带返回的地址。
 * 已评价过的订单打开本页是只读回看(分数、文字、图片视频都能看,不能再改)。
 *
 * 设计稿右上角的「提醒」「分享」两枚圆钮不对应任何功能,不画(避免死按钮)。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  type ImageSourcePropType,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import {
  TRAVELER_TYPES,
  fetchReviewContext,
  submitReview,
  uploadReviewMedia,
  type LocalMedia,
  type ReviewContext,
  type TravelerType,
} from '@/api/review';
import { TEMP_HOTEL_GALLERY } from '@/assets/tempImages';
import { formatDayMonth } from '@/components/hotel/booking/bookingFormat';
import HomeIcon from '@/components/home/HomeIcon';
import ReviewEmojiRating from '@/components/review/ReviewEmojiRating';
import ReviewGlyph from '@/components/review/ReviewGlyph';
import ReviewMediaGrid, { type ReviewMediaItem } from '@/components/review/ReviewMediaGrid';
import { LIKE } from '@/components/review/reviewAssets';
import { PAGE_PADDING, colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { useCommonStore } from '@/store/commonStore';
import { pickReviewMedia } from '@/utils/mediaPicker';
import { resolveMediaUri } from '@/utils/media';

const HERO_HEIGHT = 300;
/**
 * 上传并发数 = 1:后端 SubmitLockMiddleware 对「同一用户 + 同一接口」同时只放行一个在途请求,
 * 并发上传会被拦成 429(重复提交),所以逐个传。
 */
const UPLOAD_CONCURRENCY = 1;
/** 设计稿 `#eff4ff`:出行类型下拉底色 */
const DROPDOWN_BG = '#EFF4FF';

let mediaSeq = 0;
const nextId = () => `m${Date.now()}-${(mediaSeq += 1)}`;

/** 头图单张:图片加载失败(酒店图库文件丢失 / 地址失效)就落到本地兜底图,不留空白块 */
function HeroSlide({ source, width }: { source: ImageSourcePropType; width: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <Image
      source={failed ? TEMP_HOTEL_GALLERY[0] : source}
      style={{ width, height: HERO_HEIGHT }}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

export default function WriteReviewScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'WriteReview'>>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const showToast = useCommonStore((s) => s.showToast);

  const [ctx, setCtx] = useState<ReviewContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [rating, setRating] = useState(0);
  const [cleanliness, setCleanliness] = useState(0);
  const [location, setLocation] = useState(0);
  const [service, setService] = useState(0);
  const [amenities, setAmenities] = useState(0);
  const [traveler, setTraveler] = useState<TravelerType>('solo');
  const [travelerOpen, setTravelerOpen] = useState(false);
  const [content, setContent] = useState('');
  const [media, setMedia] = useState<ReviewMediaItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  /** 滚过头图后悬浮返回钮会压在正文上,隐藏(系统返回手势 / 物理返回键仍可用) */
  const [pastHero, setPastHero] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchReviewContext(params.orderId);
      setCtx(data);
      const review = data.review;
      if (review) {
        setRating(review.rating);
        setCleanliness(review.rating_cleanliness);
        setLocation(review.rating_location);
        setService(review.rating_service);
        setAmenities(review.rating_amenities);
        setTraveler((TRAVELER_TYPES as readonly string[]).includes(review.traveler_type) ? (review.traveler_type as TravelerType) : 'solo');
        setContent(review.content);
        const toItem = (kind: 'image' | 'video') => (url: string): ReviewMediaItem => ({
          id: nextId(),
          kind,
          uri: resolveMediaUri(url) ?? url,
          status: 'done',
          url,
        });
        setMedia([...review.images.map(toItem('image')), ...review.videos.map(toItem('video'))]);
      }
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [params.orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const readOnly = ctx ? !ctx.canReview : true;
  const maxImages = ctx?.maxImages ?? 20;
  const maxVideos = ctx?.maxVideos ?? 3;
  const points = ctx?.points ?? 0;

  const slides = useMemo(() => {
    const uris = (ctx?.images ?? []).map((u) => resolveMediaUri(u)).filter((u): u is string => !!u);
    return uris.length > 0 ? uris.map((uri) => ({ uri })) : [TEMP_HOTEL_GALLERY[0]];
  }, [ctx]);

  /** 选好的媒体逐个上传,各自回写状态;组件卸载后不再更新 */
  const uploadAll = useCallback(async (entries: { id: string; media: LocalMedia }[]) => {
    const queue = [...entries];
    const patch = (id: string, next: Partial<ReviewMediaItem>) => {
      if (!mounted.current) return;
      setMedia((cur) => cur.map((it) => (it.id === id ? { ...it, ...next } : it)));
    };
    const worker = async () => {
      for (let entry = queue.shift(); entry; entry = queue.shift()) {
        try {
          const res = await uploadReviewMedia(entry.media);
          patch(entry.id, { status: 'done', url: res.url });
        } catch {
          patch(entry.id, { status: 'error' });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, entries.length) }, worker));
  }, []);

  const addMedia = async (kind: 'image' | 'video') => {
    const used = media.filter((m) => m.kind === kind).length;
    const remaining = (kind === 'image' ? maxImages : maxVideos) - used;
    const picked = await pickReviewMedia(kind, remaining);
    if (picked === 'denied') {
      showToast(t('order.review.permissionDenied'));
      return;
    }
    if (picked.rejected > 0) {
      showToast(t(kind === 'image' ? 'order.review.imageTooLarge' : 'order.review.videoTooLarge'));
    }
    if (picked.items.length === 0) return;
    const entries = picked.items.map((m) => ({ id: nextId(), media: m }));
    setMedia((cur) => [
      ...cur,
      ...entries.map((e): ReviewMediaItem => ({ id: e.id, kind, uri: e.media.uri, status: 'uploading', local: e.media })),
    ]);
    void uploadAll(entries);
  };

  const removeMedia = (id: string) => setMedia((cur) => cur.filter((m) => m.id !== id));

  /** 失败的缩略图点一下重传 */
  const retryMedia = (id: string) => {
    const item = media.find((m) => m.id === id);
    if (!item?.local) return;
    setMedia((cur) => cur.map((m) => (m.id === id ? { ...m, status: 'uploading' } : m)));
    void uploadAll([{ id, media: item.local }]);
  };

  const submit = async () => {
    if (!ctx || submitting) return;
    /* PRD:总体 + 清洁度/位置/服务/设施五项都要评 1-5 分(酒店总分 = 五项之和 ÷ 25 × 10) */
    if (rating < 1 || cleanliness < 1 || location < 1 || service < 1 || amenities < 1) {
      showToast(t('order.review.needAll'));
      return;
    }
    if (media.some((m) => m.status === 'uploading')) {
      showToast(t('order.review.uploading'));
      return;
    }
    if (media.some((m) => m.status === 'error')) {
      showToast(t('order.review.uploadFailed'));
      return;
    }
    setSubmitting(true);
    try {
      await submitReview({
        orderId: ctx.orderId,
        rating,
        ratingCleanliness: cleanliness,
        ratingLocation: location,
        ratingService: service,
        ratingAmenities: amenities,
        travelerType: traveler,
        content: content.trim(),
        images: media.filter((m) => m.kind === 'image' && m.url).map((m) => m.url as string),
        videos: media.filter((m) => m.kind === 'video' && m.url).map((m) => m.url as string),
      });
      setDone(true);
    } catch (e) {
      /* 业务错误(已评价 / 状态不符)请求层已弹 Toast;这里只兜底非业务异常 */
      if (!(e instanceof Error) || !e.message) showToast(t('order.review.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const closeDone = () => {
    setDone(false);
    navigation.goBack();
  };

  const dateRange = ctx
    ? `${formatDayMonth(ctx.checkIn, i18n.language)} - ${formatDayMonth(ctx.checkOut, i18n.language)}`
    : '';

  if (loading || error || !ctx) {
    return (
      <View style={[styles.page, styles.center]}>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Pressable onPress={() => void load()}>
            <Text style={styles.stateText}>{error || t('order.review.loadFailed')}</Text>
          </Pressable>
        )}
        <Pressable style={[styles.backBtn, { top: insets.top + 16 }]} onPress={() => navigation.goBack()} hitSlop={8}>
          <HomeIcon name="arrowLeft" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 124 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        scrollEventThrottle={32}
        onScroll={(e) => setPastHero(e.nativeEvent.contentOffset.y > HERO_HEIGHT - 80)}
      >
        {/* 头图轮播 + 底部渐变 */}
        <View style={[styles.hero, { width }]}>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ height: HERO_HEIGHT }}>
            {slides.map((src, i) => (
              <HeroSlide key={i} source={src} width={width} />
            ))}
          </ScrollView>
          <Svg width={width} height={HERO_HEIGHT} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <LinearGradient id="heroFade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0.5" stopColor="#000000" stopOpacity="0" />
                <Stop offset="1" stopColor="#000000" stopOpacity="0.6" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={width} height={HERO_HEIGHT} fill="url(#heroFade)" />
          </Svg>
        </View>

        <View style={styles.main}>
          {/* 酒店卡 */}
          <View style={styles.card}>
            <Text style={styles.hotelName}>{ctx.hotelName}</Text>
            <Text style={styles.hotelMeta}>{ctx.roomName}</Text>
            <Text style={styles.hotelMeta}>{dateRange}</Text>
          </View>

          {/* 奖励说明 */}
          <View style={[styles.card, styles.promoCard]}>
            <Text style={styles.promoTitle}>{t('order.review.promoTitle')}</Text>
            <Text style={styles.promoBody}>{t('order.review.promoBody', { points })}</Text>
          </View>

          {/* 表情评分 */}
          <View style={[styles.card, styles.ratingCard]}>
            <ReviewEmojiRating label={t('order.review.overall')} value={rating} onChange={setRating} readOnly={readOnly} />
            <ReviewEmojiRating label={t('order.review.cleanliness')} value={cleanliness} onChange={setCleanliness} readOnly={readOnly} />
            <ReviewEmojiRating label={t('order.review.location')} value={location} onChange={setLocation} readOnly={readOnly} />
            <ReviewEmojiRating label={t('order.review.service')} value={service} onChange={setService} readOnly={readOnly} />
            <ReviewEmojiRating label={t('order.review.amenities')} value={amenities} onChange={setAmenities} readOnly={readOnly} />
          </View>

          {/* 出行类型 */}
          <View style={[styles.card, styles.travelerCard]}>
            <Text style={styles.travelerTitle}>{t('order.review.travelerTitle')}</Text>
            {travelerOpen && !readOnly ? (
              <View style={styles.dropdown}>
                {TRAVELER_TYPES.map((type) => (
                  <Pressable
                    key={type}
                    style={styles.dropdownRow}
                    onPress={() => {
                      setTraveler(type);
                      setTravelerOpen(false);
                    }}
                  >
                    <Text style={styles.dropdownText}>{t(`order.review.traveler.${type}`)}</Text>
                    {type === traveler ? (
                      <View style={styles.chevronUp}>
                        <HomeIcon name="chevronStroke" size={24} color={colors.textSoft} />
                      </View>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : (
              <Pressable
                style={styles.select}
                disabled={readOnly}
                onPress={() => setTravelerOpen(true)}
                accessibilityRole="button"
              >
                <Text style={styles.dropdownText}>{t(`order.review.traveler.${traveler}`)}</Text>
                {!readOnly ? <HomeIcon name="chevronStroke" size={24} color={colors.textSoft} /> : null}
              </Pressable>
            )}
          </View>

          {/* 文字 + 图片 / 视频 */}
          <Text style={styles.shareTitle}>{t('order.review.shareTitle')}</Text>
          <View style={styles.textarea}>
            <TextInput
              style={styles.input}
              value={content}
              onChangeText={setContent}
              editable={!readOnly}
              multiline
              maxLength={2000}
              textAlignVertical="top"
              placeholder={readOnly ? '' : t('order.review.placeholder')}
              placeholderTextColor="#6B7280"
            />
            <ReviewMediaGrid
              items={media}
              maxImages={maxImages}
              maxVideos={maxVideos}
              onAdd={(kind) => void addMedia(kind)}
              onRemove={removeMedia}
              onRetry={retryMedia}
              readOnly={readOnly}
            />
          </View>
        </View>
      </ScrollView>

      {/* 悬浮返回钮(声明在滚动容器之后,否则被头图盖住点不动) */}
      {pastHero ? null : (
        <Pressable
          style={[styles.backBtn, { top: insets.top + 16 }]}
          onPress={() => navigation.goBack()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('order.review.back')}
        >
          <HomeIcon name="arrowLeft" size={20} color="#FFFFFF" />
        </Pressable>
      )}

      {/* 吸底栏 */}
      <View style={[styles.bottomBar, { paddingBottom: 16 + insets.bottom }]}>
        <View>
          <Text style={styles.earnLabel}>{t('order.review.earnPoints')}</Text>
          <View style={styles.earnRow}>
            <HomeIcon name="diamond" size={16} color={colors.primary} />
            <Text style={styles.earnValue}>{`${points} / ${points}`}</Text>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.submitBtn,
            (readOnly || submitting) && styles.submitOff,
            pressed && styles.pressed,
          ]}
          disabled={readOnly || submitting}
          onPress={() => void submit()}
        >
          <Text style={styles.submitText}>
            {readOnly
              ? ctx.reviewed
                ? t('order.review.reviewed')
                : t('order.review.notAvailable')
              : submitting
                ? t('common.loading')
                : t('order.review.submit')}
          </Text>
        </Pressable>
      </View>

      {/* 提交成功浮层 800:2286 */}
      <Modal visible={done} transparent animationType="fade" onRequestClose={closeDone}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <ReviewGlyph glyph={LIKE} size={60} color={colors.primary} />
            <Text style={styles.dialogTitle}>{t('order.review.submittedTitle')}</Text>
            <Text style={styles.dialogBody}>{t('order.review.submittedBody')}</Text>
            <Pressable style={({ pressed }) => [styles.dialogBtn, pressed && styles.pressed]} onPress={closeDone}>
              <Text style={styles.dialogBtnText}>{t('order.review.close')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.pageBg },
  center: { alignItems: 'center', justifyContent: 'center' },
  stateText: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 22, color: colors.textSoft },
  pressed: { opacity: 0.8 },

  hero: { height: HERO_HEIGHT, backgroundColor: '#D0DAF2' },
  backBtn: {
    position: 'absolute',
    left: PAGE_PADDING + 4,
    width: 36,
    height: 36,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },

  main: { gap: 24, paddingHorizontal: 16, paddingTop: 24 },
  /* 设计稿通用卡:--tab 底、1px --secondary 描边、圆角 24、内边距 24、投影 0/1 blur2 5% */
  card: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 1,
    shadowOffset: { width: 0, height: 1 },
  },
  hotelName: { fontFamily: fonts.interSemi, fontSize: 24, lineHeight: 32, color: '#0B1C30' },
  hotelMeta: { fontFamily: fonts.interMedium, fontSize: 14, lineHeight: 20, letterSpacing: 0.14, color: '#434655' },

  promoCard: { padding: 25, gap: 16 },
  promoTitle: { fontFamily: fonts.interSemi, fontSize: 20, lineHeight: 20, letterSpacing: 0.14, color: colors.primary },
  promoBody: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.textSoft },

  ratingCard: { gap: 24 },
  travelerCard: { gap: 14 },
  travelerTitle: { fontFamily: fonts.outfitSemi, fontSize: 20, lineHeight: 24, color: colors.heading },
  select: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: DROPDOWN_BG,
  },
  dropdown: { gap: 16, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: DROPDOWN_BG },
  dropdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownText: { flex: 1, fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.heading },
  /* 设计稿选中行的箭头是旋转 180° 的下拉箭头 */
  chevronUp: { transform: [{ rotate: '180deg' }] },

  shareTitle: { marginTop: 8, fontFamily: fonts.interSemi, fontSize: 20, lineHeight: 20, letterSpacing: 0.14, color: '#0B1C30' },
  textarea: {
    minHeight: 300,
    gap: 16,
    padding: 25,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#C4C5D7',
    backgroundColor: '#FFFFFF',
    shadowColor: '#4E73FF',
    shadowOpacity: 0.05,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 20 },
  },
  input: {
    minHeight: 120,
    padding: 0,
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    color: colors.heading,
  },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 17,
    borderTopWidth: 1,
    borderTopColor: 'rgba(196, 197, 215, 0.3)',
    backgroundColor: '#FFFFFF',
  },
  earnLabel: { fontFamily: fonts.interSemi, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, color: colors.heading },
  earnRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  earnValue: { fontFamily: fonts.interBold, fontSize: 14, lineHeight: 20, letterSpacing: 0.14, color: colors.primary },
  submitBtn: {
    minWidth: 181,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  submitOff: { opacity: 0.5 },
  submitText: { fontFamily: fonts.interBold, fontSize: 16, lineHeight: 24, color: '#FFFFFF' },

  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  dialog: {
    width: '100%',
    maxWidth: 370,
    alignItems: 'center',
    gap: 16,
    padding: 24,
    borderRadius: 24,
    backgroundColor: colors.surface,
  },
  dialogTitle: { fontFamily: fonts.interSemi, fontSize: 20, lineHeight: 20, letterSpacing: 0.14, color: colors.primary, textAlign: 'center' },
  dialogBody: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.textSoft, textAlign: 'center' },
  dialogBtn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  dialogBtnText: { fontFamily: fonts.interMedium, fontSize: 14, lineHeight: 20, letterSpacing: 0.14, color: '#FFFFFF' },
});
