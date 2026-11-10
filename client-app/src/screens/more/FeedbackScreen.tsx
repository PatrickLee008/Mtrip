/**
 * 问题反馈 / 建议(按 Figma M-Trip / More「Report Issue / Feedback」实现)
 *
 * 同 section 三张稿是同一页的不同状态:
 *   3313:10952  选中「Report an Issue」:多一段必填的 Issue Type 下拉,描述框随内容增高
 *   3313:11060  选中「Suggestion / Feedback」:没有下拉,描述框固定高 280、附件区沉底
 *   3313:11169  Issue Type 下拉的展开态(白底圆角 12 的十项列表,原地替换下拉按钮)
 *
 * 提交走既有接口 `POST /api/v1/app/user/feedback/add`(content / feedbackType / images),需登录
 * (入口处已拦截)。后端 feedback_type 只有四档,细分问题类型的映射与拼进 content 的做法见
 * moreDemo.ts 的 FEEDBACK_ISSUE_TYPES。附件复用评价页的选择器与 `/user/review-media` 上传接口
 * (图片 ≤10MB / 视频 ≤50MB,后端同口径校验),上传完把相对地址放进 images。
 *
 * 设计稿实测:
 *   卡       白底、圆角 16、padding 20、gap 18、Effect/DS
 *   卡头     28 方块 #EFF4FF 圆角 8 + 15×13.5 客服头像(#1F4ED3)→ 标题 Inter 700/22 字距 -0.22;
 *            说明 Inter 400/13 行高 21.13 --text-2
 *   分段标签 Inter 600/16 行高 22 --text(必填项尾随红色 *,#EC1317)
 *   模式选项 padding 14 圆角 12 gap 12;选中 --secondary 底 + 主色 indeterminate 勾选框 + 主色标题,
 *            未选白底 1px --secondary 描边 + 主色空心框 + --text 标题;标题 Inter 600/14,说明 Inter 400/12 --text-2
 *   下拉     白底、1px #E2E8F0、圆角 12、最小高 50、px16 py14;文字 Inter 400/14;11×6.8 箭头 #8A94A6
 *   计数     Inter 600/11 字距 0.44 --text-2(上限 1000,设计稿值)
 *   描述框   白底、1px --secondary、圆角 24、padding 24、gap 32,0/20 blur40 rgba(78,115,255,0.05)
 *   附件     1px 虚线 --secondary 圆角 12 padding 20 gap 10;「Photos/Videos (0/5)」Inter 500/14 --text-2 + image-add 20
 *   提交     主色整宽、py16 圆角 12、Outfit 400/16 白字
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { uploadReviewMedia, type LocalMedia } from '@/api/review';
import { addFeedback } from '@/api/user';
import HomeIcon from '@/components/home/HomeIcon';
import MorePageLayout from '@/components/more/MorePageLayout';
import { moreShared } from '@/components/more/moreShared';
import { colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import {
  FEEDBACK_ISSUE_TYPES,
  FEEDBACK_TYPE_SUGGESTION,
  type FeedbackIssueKey,
} from '@/screens/more/moreDemo';
import { useCommonStore } from '@/store/commonStore';
import { pickReviewMedia } from '@/utils/mediaPicker';

type Mode = 'report' | 'suggestion';
const MODES: Mode[] = ['report', 'suggestion'];

/** 设计稿计数上限(后端 content 上限 2000,这里按稿收紧到 1000) */
const MAX_CONTENT = 1000;
/** 设计稿「Photos/Videos (0/5)」 */
const MAX_MEDIA = 5;

/** 设计稿里只在本页出现的几种灰/蓝 */
const FIELD_BORDER = '#E2E8F0';
const CHEVRON_COLOR = '#8A94A6';
const HEADER_ICON_BG = '#EFF4FF';

interface MediaItem {
  id: string;
  kind: 'image' | 'video';
  uri: string;
  status: 'uploading' | 'done' | 'error';
  url?: string;
  local: LocalMedia;
}

let seq = 0;
const nextId = () => `fb-${Date.now()}-${(seq += 1)}`;

export default function FeedbackScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const showToast = useCommonStore((s) => s.showToast);

  const [mode, setMode] = useState<Mode>('report');
  const [issue, setIssue] = useState<FeedbackIssueKey | null>(null);
  const [issueOpen, setIssueOpen] = useState(false);
  const [content, setContent] = useState('');
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  /** 卸载后上传回调不再写状态 */
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const upload = useCallback(async (entries: MediaItem[]) => {
    for (const entry of entries) {
      try {
        const res = await uploadReviewMedia(entry.local);
        if (mounted.current) {
          setMedia((cur) => cur.map((m) => (m.id === entry.id ? { ...m, status: 'done', url: res.url } : m)));
        }
      } catch {
        if (mounted.current) {
          setMedia((cur) => cur.map((m) => (m.id === entry.id ? { ...m, status: 'error' } : m)));
        }
      }
    }
  }, []);

  const addMedia = async () => {
    const picked = await pickReviewMedia('mixed', MAX_MEDIA - media.length);
    if (picked === 'denied') {
      showToast(t('more.feedback.permissionDenied'));
      return;
    }
    if (picked.rejected > 0) showToast(t('more.feedback.tooLarge'));
    if (picked.items.length === 0) return;
    const entries: MediaItem[] = picked.items.map((m) => ({
      id: nextId(),
      kind: m.kind,
      uri: m.uri,
      status: 'uploading',
      local: m,
    }));
    setMedia((cur) => [...cur, ...entries]);
    void upload(entries);
  };

  /** 失败的缩略图点一下重传 */
  const retry = (item: MediaItem) => {
    if (item.status !== 'error') return;
    setMedia((cur) => cur.map((m) => (m.id === item.id ? { ...m, status: 'uploading' } : m)));
    void upload([item]);
  };

  const remove = (id: string) => setMedia((cur) => cur.filter((m) => m.id !== id));

  const submit = async () => {
    if (submitting) return;
    if (mode === 'report' && !issue) {
      showToast(t('more.feedback.needIssueType'));
      return;
    }
    const text = content.trim();
    if (!text) {
      showToast(t('more.feedback.needContent'));
      return;
    }
    if (media.some((m) => m.status === 'uploading')) {
      showToast(t('more.feedback.uploading'));
      return;
    }
    if (media.some((m) => m.status === 'error')) {
      showToast(t('more.feedback.uploadFailed'));
      return;
    }

    const issueDef = mode === 'report' ? FEEDBACK_ISSUE_TYPES.find((it) => it.key === issue) : undefined;
    // 细分类型拼进正文开头,固定用英文名,后台不随用户语言变化(见 moreDemo.ts)
    const prefix = issueDef ? `[${t(`more.feedback.issues.${issueDef.key}`, { lng: 'en-US' })}] ` : '';
    setSubmitting(true);
    try {
      await addFeedback({
        content: prefix + text,
        feedbackType: issueDef ? issueDef.feedbackType : FEEDBACK_TYPE_SUGGESTION,
        images: media.map((m) => m.url).filter((u): u is string => !!u),
      });
      showToast(t('more.feedback.submitted'));
      navigation.goBack();
    } catch {
      // 请求层已 Toast
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  };

  const isReport = mode === 'report';

  return (
    <MorePageLayout title={t('more.feedback.title')}>
      <View style={styles.card}>
        {/* 卡头 */}
        <View style={styles.cardHead}>
          <View style={styles.headRow}>
            <View style={styles.headIcon}>
              <HomeIcon name="headset" width={15} height={13.5} color={colors.badgeBg} />
            </View>
            <Text style={styles.heading}>{t('more.feedback.heading')}</Text>
          </View>
          <Text style={styles.intro}>{t('more.feedback.intro')}</Text>
        </View>

        {/* 1. 反馈类型 */}
        <View style={styles.segment}>
          <Text style={styles.label}>{t('more.feedback.shareLabel')}</Text>
          {MODES.map((m) => {
            const on = m === mode;
            return (
              <Pressable
                key={m}
                style={({ pressed }) => [styles.mode, on ? styles.modeOn : styles.modeOff, pressed && moreShared.pressed]}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => setMode(m)}
              >
                <HomeIcon name={on ? 'checkboxIndeterminate' : 'checkbox'} size={20} color={colors.primary} />
                <View style={styles.modeText}>
                  <Text style={[styles.modeTitle, on && styles.modeTitleOn]}>{t(`more.feedback.modes.${m}.title`)}</Text>
                  <Text style={styles.modeDesc}>{t(`more.feedback.modes.${m}.desc`)}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* 2. 问题类型(仅 Report 模式) */}
        {isReport ? (
          <View style={styles.field}>
            <Text style={styles.label}>
              {`${t('more.feedback.issueType')} `}
              <Text style={styles.required}>*</Text>
            </Text>
            {issueOpen ? (
              <View style={[styles.select, styles.selectList]}>
                {FEEDBACK_ISSUE_TYPES.map((it) => (
                  <Pressable
                    key={it.key}
                    style={({ pressed }) => pressed && moreShared.pressed}
                    onPress={() => {
                      setIssue(it.key);
                      setIssueOpen(false);
                    }}
                  >
                    <Text style={[styles.selectText, it.key === issue && styles.selectTextOn]}>
                      {t(`more.feedback.issues.${it.key}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.select, styles.selectBtn, pressed && moreShared.pressed]}
                accessibilityRole="button"
                onPress={() => setIssueOpen(true)}
              >
                <Text style={[styles.selectText, issue && styles.selectTextOn]} numberOfLines={1}>
                  {issue ? t(`more.feedback.issues.${issue}`) : t('more.feedback.issuePlaceholder')}
                </Text>
                <HomeIcon name="chevronDown" width={11} height={11} color={CHEVRON_COLOR} />
              </Pressable>
            )}
          </View>
        ) : null}

        {/* 3. 描述 + 附件 */}
        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>
              {`${t(isReport ? 'more.feedback.describeIssue' : 'more.feedback.describeFeedback')} `}
              <Text style={styles.required}>*</Text>
            </Text>
            <Text style={styles.counter}>{`${content.length} / ${MAX_CONTENT}`}</Text>
          </View>

          <View style={[styles.textarea, !isReport && styles.textareaTall]}>
            <TextInput
              style={[styles.input, !isReport && styles.inputTall]}
              value={content}
              onChangeText={setContent}
              placeholder={t('more.feedback.placeholder')}
              placeholderTextColor={colors.textSoft}
              multiline
              maxLength={MAX_CONTENT}
              textAlignVertical="top"
            />

            <View style={styles.mediaRow}>
              {media.map((item) => (
                <Pressable key={item.id} style={styles.thumb} onPress={() => retry(item)}>
                  {item.kind === 'image' ? (
                    <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, styles.videoThumb]}>
                      <HomeIcon name="play" size={20} color="#FFFFFF" />
                    </View>
                  )}
                  {item.status !== 'done' ? (
                    <View style={[StyleSheet.absoluteFill, styles.thumbMask]}>
                      {item.status === 'uploading' ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <HomeIcon name="arrowSyncCircle" size={20} color="#FFFFFF" />
                      )}
                    </View>
                  ) : null}
                  <Pressable
                    style={styles.thumbRemove}
                    hitSlop={6}
                    accessibilityLabel={t('more.feedback.removeMedia')}
                    onPress={() => remove(item.id)}
                  >
                    <HomeIcon name="close" size={8} color="#FFFFFF" />
                  </Pressable>
                </Pressable>
              ))}

              {media.length < MAX_MEDIA ? (
                <Pressable
                  style={({ pressed }) => [styles.addMedia, pressed && moreShared.pressed]}
                  accessibilityRole="button"
                  onPress={() => void addMedia()}
                >
                  <Text style={styles.addMediaText}>
                    {t('more.feedback.media', { count: media.length, max: MAX_MEDIA })}
                  </Text>
                  <HomeIcon name="imageAdd" size={20} color="#8B8C91" />
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [moreShared.cta, (pressed || submitting) && moreShared.pressed]}
          disabled={submitting}
          onPress={() => void submit()}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={moreShared.ctaText}>{t('more.feedback.submit')}</Text>
          )}
        </Pressable>
      </View>
    </MorePageLayout>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 18,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    ...shadows.subtle,
  },

  cardHead: { gap: 3 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HEADER_ICON_BG,
  },
  heading: {
    flexShrink: 1,
    fontFamily: fonts.interBold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.22,
    color: colors.heading,
  },
  intro: { fontFamily: fonts.inter, fontSize: 13, lineHeight: 21.13, color: colors.textSoft },

  segment: { gap: 10 },
  field: { gap: 6 },
  label: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 22, color: colors.heading },
  required: { color: colors.hot },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  counter: {
    fontFamily: fonts.interSemi,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.44,
    color: colors.textSoft,
  },

  mode: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: radius.btn,
    borderWidth: 1,
  },
  modeOn: { backgroundColor: colors.softBlue, borderColor: colors.softBlue },
  modeOff: { backgroundColor: '#FFFFFF', borderColor: colors.softBlue },
  modeText: { flex: 1, minWidth: 0, gap: 2 },
  modeTitle: {
    fontFamily: fonts.interSemi,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.heading,
  },
  modeTitleOn: { color: colors.primary },
  modeDesc: { fontFamily: fonts.inter, fontSize: 12, lineHeight: 18, color: colors.textSoft },

  select: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: FIELD_BORDER,
    backgroundColor: '#FFFFFF',
  },
  selectBtn: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  selectList: { gap: 16 },
  selectText: { flexShrink: 1, fontFamily: fonts.inter, fontSize: 14, lineHeight: 20, color: colors.textSoft },
  selectTextOn: { color: colors.heading },

  textarea: {
    gap: 32,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: '#FFFFFF',
    shadowColor: '#4E73FF',
    shadowOpacity: 0.05,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 20 },
    elevation: 2,
  },
  /* Suggestion 稿描述框固定高 280,附件区沉底 */
  textareaTall: { minHeight: 280, justifyContent: 'space-between' },
  input: {
    minHeight: 40,
    padding: 0,
    fontFamily: fonts.inter,
    fontSize: 14,
    lineHeight: 20,
    color: colors.heading,
  },
  inputTall: { flex: 1, minHeight: 120 },

  mediaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  thumb: { width: 72, height: 72, borderRadius: radius.btn, overflow: 'hidden', backgroundColor: colors.softBlue },
  videoThumb: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.heading },
  thumbMask: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  thumbRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  addMedia: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 20,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.softBlue,
  },
  addMediaText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    textAlign: 'center',
    color: colors.textSoft,
  },
});
