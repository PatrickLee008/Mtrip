/**
 * 评价页的图片 / 视频区(Figma「Hotel Review」`800:2247` 虚线添加块「0/20 Photos」)
 *
 * 设计稿只画了照片的添加块;按产品要求补一个同款的视频块(最多 3 个),照片最多 20 张。
 * 已选的缩略图排在添加块前面,右上角 × 可移除;选好即上传,上传中盖一层转圈、失败显示红点并可移除重选。
 * 视频缩略图用 expo-av 不播放只出首帧,上面叠一枚播放标。只读模式(已评价)没有添加块和 ×。
 */

import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ResizeMode, Video } from 'expo-av';
import { useTranslation } from 'react-i18next';

import type { LocalMedia } from '@/api/review';
import HomeIcon from '@/components/home/HomeIcon';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';

export interface ReviewMediaItem {
  id: string;
  kind: 'image' | 'video';
  /** 用来展示的地址:本地选中的 uri,或已提交评价里的服务器地址 */
  uri: string;
  status: 'uploading' | 'done' | 'error';
  /** 上传成功后的服务器相对地址 */
  url?: string;
  /** 本地选中的原文件,上传失败时用来重传(只读回看的条目没有) */
  local?: LocalMedia;
}

interface Props {
  items: ReviewMediaItem[];
  maxImages: number;
  maxVideos: number;
  onAdd?: (kind: 'image' | 'video') => void;
  onRemove?: (id: string) => void;
  /** 上传失败的缩略图点一下重传 */
  onRetry?: (id: string) => void;
  readOnly?: boolean;
}

const THUMB = 76;

export default function ReviewMediaGrid({ items, maxImages, maxVideos, onAdd, onRemove, onRetry, readOnly }: Props) {
  const { t } = useTranslation();
  const images = items.filter((i) => i.kind === 'image');
  const videos = items.filter((i) => i.kind === 'video');

  const renderThumb = (item: ReviewMediaItem) => (
    <View key={item.id} style={styles.thumb}>
      {item.kind === 'image' ? (
        <Image source={{ uri: item.uri }} style={styles.thumbMedia} resizeMode="cover" />
      ) : (
        <>
          <Video
            style={styles.thumbMedia}
            source={{ uri: item.uri }}
            resizeMode={ResizeMode.COVER}
            shouldPlay={false}
            isMuted
          />
          <View style={styles.playBadge} pointerEvents="none">
            <HomeIcon name="play" width={10} height={12} color="#FFFFFF" />
          </View>
        </>
      )}
      {item.status === 'uploading' ? (
        <View style={styles.thumbMask}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      ) : null}
      {item.status === 'error' ? (
        <Pressable
          style={styles.thumbMask}
          accessibilityRole="button"
          accessibilityLabel={t('order.review.retry')}
          onPress={() => onRetry?.(item.id)}
        >
          <Text style={styles.retryText}>{t('order.review.retry')}</Text>
        </Pressable>
      ) : null}
      {item.status === 'error' ? <View style={styles.errorDot} /> : null}
      {!readOnly && onRemove ? (
        <Pressable
          style={styles.remove}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('order.review.remove')}
          onPress={() => onRemove(item.id)}
        >
          <HomeIcon name="close" size={10} color="#FFFFFF" />
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <View style={styles.wrap}>
      {items.length > 0 ? <View style={styles.thumbs}>{items.map(renderThumb)}</View> : null}
      {!readOnly && onAdd ? (
        <View style={styles.tiles}>
          <Pressable
            style={({ pressed }) => [styles.tile, images.length >= maxImages && styles.tileOff, pressed && styles.pressed]}
            disabled={images.length >= maxImages}
            onPress={() => onAdd('image')}
          >
            <Text style={styles.tileText}>{t('order.review.photosCount', { count: images.length, max: maxImages })}</Text>
            <HomeIcon name="imageAdd" size={20} color={colors.textSoft} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.tile, videos.length >= maxVideos && styles.tileOff, pressed && styles.pressed]}
            disabled={videos.length >= maxVideos}
            onPress={() => onAdd('video')}
          >
            <Text style={styles.tileText}>{t('order.review.videosCount', { count: videos.length, max: maxVideos })}</Text>
            <HomeIcon name="play" width={14} height={18} color={colors.textSoft} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: THUMB, height: THUMB, borderRadius: 12, backgroundColor: '#E6ECFB' },
  thumbMedia: { width: THUMB, height: THUMB, borderRadius: 12, overflow: 'hidden' },
  thumbMask: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  retryText: { fontFamily: fonts.interSemi, fontSize: 12, lineHeight: 16, color: '#FFFFFF' },
  playBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  errorDot: {
    position: 'absolute',
    left: 6,
    top: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  remove: {
    position: 'absolute',
    right: -6,
    top: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(25, 26, 37, 0.8)',
  },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  /* 设计稿:虚线 1px --secondary、圆角 12、内边距 20、文字与图标上下 gap 10 */
  tile: {
    minWidth: 124,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.softBlue,
  },
  tileOff: { opacity: 0.45 },
  tileText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.textSoft,
    textAlign: 'center',
  },
  pressed: { opacity: 0.7 },
});
