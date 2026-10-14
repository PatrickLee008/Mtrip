/**
 * 教程视频播放页(使用指南 → 视频教程 → 点某一张卡)
 *
 * 设计稿没有画播放二级页,沿用「更多」子页的壳(MorePageLayout)+ 一块 16:9 的原生控件播放器,
 * 下面是标题 / 分类 / 简介。进入即自动播放;视频地址来自后台上传到存储的文件(相对路径经 resolveMediaUri 补全)或外部链接。
 * 地址不可用或播放出错时给一行提示,不留黑块。
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ResizeMode, Video } from 'expo-av';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import MorePageLayout from '@/components/more/MorePageLayout';
import { moreShared } from '@/components/more/moreShared';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { resolveMediaUri } from '@/utils/media';

export default function TutorialVideoScreen() {
  const { t } = useTranslation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'TutorialVideo'>>();
  const uri = resolveMediaUri(params.videoUrl);
  const poster = resolveMediaUri(params.coverUrl);
  const [failed, setFailed] = useState(false);

  return (
    <MorePageLayout title={t('more.guides.title')}>
      <View style={styles.player}>
        {uri && !failed ? (
          <Video
            style={styles.video}
            // web 端 <video> 按视频原始分辨率撑开(绝对定位 + 四边为 0 对替换元素不拉伸),控制条会跑出被裁剪的容器外,暂停/全屏点不到
            videoStyle={styles.videoInner}
            source={{ uri }}
            posterSource={poster ? { uri: poster } : undefined}
            usePoster={Boolean(poster)}
            useNativeControls
            shouldPlay
            resizeMode={ResizeMode.CONTAIN}
            onError={() => setFailed(true)}
          />
        ) : (
          <View style={styles.error}>
            <Text style={styles.errorText}>{t('more.guides.playFailed')}</Text>
          </View>
        )}
      </View>

      <View style={[moreShared.panel, styles.info]}>
        <Text style={styles.category}>{t(`more.guides.categories.${params.category}`)}</Text>
        <Text style={styles.title}>{params.title}</Text>
        {params.description ? <Text style={styles.desc}>{params.description}</Text> : null}
      </View>
    </MorePageLayout>
  );
}

const styles = StyleSheet.create({
  player: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  video: { width: '100%', height: '100%' },
  videoInner: { width: '100%', height: '100%' },
  error: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 22, color: '#FFFFFF', textAlign: 'center' },

  info: { gap: 6 },
  category: { fontFamily: fonts.interSemi, fontSize: 12, lineHeight: 18, color: colors.primary },
  title: { fontFamily: fonts.outfitSemi, fontSize: 20, lineHeight: 28, color: '#111C2D' },
  desc: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 26, color: colors.textSoft },
});
