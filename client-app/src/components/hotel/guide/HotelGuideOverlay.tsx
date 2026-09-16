/**
 * 酒店用户指引浮层(Figma section `Hotel Search Coach mark UI` `2150:4865`,七步)
 *
 * 入口是「筛选旁边的问号」:完整版搜索页 `HotelsScreen` 与结果页 `HotelResultsScreen` 顶栏各一枚,
 * 关怀版 `HotelsLiteScreen` 复用顶栏那枚「how do I book ?」药片(此前是 comingSoon 死链)。
 * **不自动弹**,只有点问号才出;左上角 Skip Tutorial 是快速关闭。
 *
 * 设计稿实测(取自 Coach Mark 2 `2154:7076` 的 design context,不是目测):
 *   遮罩   纯黑 opacity .95(底层页面几乎不可见 —— 这也是 4~7 步画示例卡不穿帮的原因)
 *   文案块 宽 320 居中、gap 8;标题 Inter Bold 24 白;说明 Inter 400 16 `--secondary` #D9E1FB
 *   箭头   白色单路径 svg,viewBox 64.1463×45.3947,外框 66.93×72.17,整体旋转 -53.55°
 *   Skip   Inter 400 12 白,左 17 / 上 9
 *   底栏   宽 370 居中两端对齐:Previous / 7 点指示器 / Next;
 *          两枚按钮 1px #D9E1FB 描边、圆角 32、px20 py12,文字 Inter 600 16 #D9E1FB
 *   第 1 步没有 Previous;第 7 步主按钮是 Done
 *
 * 每一步画什么见 `guideSteps.tsx`(那里也写了「为什么是插图而不是真实挖洞高亮」)。
 *
 * 插图 + 箭头 + 文案放在 ScrollView 里:第 5、6 步的示例卡本身就有 400+ 高,
 * 小屏上叠完文案会顶出屏幕,给一条滚动比裁掉卡片下半截体面。底栏与 Skip 固定不滚。
 */

import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { GUIDE_STEPS } from '@/components/hotel/guide/guideSteps';
import { PAGE_PADDING, colors } from '@/config/theme';
import { fonts } from '@/config/typography';

/** 设计稿 `--secondary`:浮层上的描边、说明文字与未选中的指示点都用它 */
const LINE = colors.softBlue;

interface Props {
  visible: boolean;
  onClose: () => void;
  /** 关怀模式:文案与控件各放大一档,示例卡换 Lite 版 */
  lite?: boolean;
}

export default function HotelGuideOverlay({ visible, onClose, lite = false }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);

  /* 每次重新打开都从第 1 步起 —— 关掉时停在第几步不该被记住 */
  useEffect(() => {
    if (visible) setStep(0);
  }, [visible]);

  const total = GUIDE_STEPS.length;
  const current = GUIDE_STEPS[step];
  const last = step === total - 1;
  const { Illustration } = current;

  const next = () => {
    if (last) {
      onClose();
      return;
    }
    setStep((s) => Math.min(s + 1, total - 1));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.cover} />

        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <Pressable
            style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
            onPress={onClose}
            hitSlop={8}
          >
            <Text style={[styles.skipText, lite && styles.skipTextLite]}>
              {t('hotels.guide.skip')}
            </Text>
          </Pressable>

          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            {/* 插图只是示例,里面的按钮一概不可点 */}
            <View style={styles.stage} pointerEvents="none">
              <Illustration lite={lite} />
            </View>

            <View style={styles.copy}>
              <View style={styles.arrowBox}>
                <Svg width={62.191} height={37.274} viewBox="0 0 64.1463 45.3947">
                  {/* 路径逐字符取自设计稿导出的 SVG,未重绘 */}
                  <Path
                    d="M24.5239 16.971L23.9539 16.1494V16.1494L24.5239 16.971ZM63.6635 9.55801C64.1362 9.27229 64.2877 8.65753 64.002 8.18489L59.346 0.482818C59.0603 0.01018 58.4455 -0.141352 57.9729 0.144362C57.5002 0.430076 57.3487 1.04484 57.6344 1.51748L61.7731 8.36377L54.9268 12.5024C54.4541 12.7881 54.3026 13.4029 54.5883 13.8755C54.874 14.3482 55.4888 14.4997 55.9614 14.214L63.6635 9.55801ZM0.954841 45.0975C1.90999 45.3936 1.90988 45.394 1.90979 45.3943C1.90978 45.3943 1.9097 45.3946 1.90968 45.3946C1.90965 45.3947 1.90969 45.3946 1.9098 45.3943C1.91001 45.3936 1.91052 45.392 1.91131 45.3895C1.91289 45.3845 1.91564 45.3759 1.91958 45.3638C1.92746 45.3396 1.94012 45.3014 1.95786 45.2495C1.99333 45.1458 2.04909 44.9879 2.12747 44.7797C2.28423 44.3634 2.53141 43.7466 2.88765 42.9619C3.60016 41.3925 4.74857 39.1526 6.48173 36.5039C9.94711 31.2078 15.7523 24.2738 25.094 17.7926L24.5239 16.971L23.9539 16.1494C14.377 22.7938 8.3977 29.923 4.80816 35.4088C3.01387 38.151 1.81722 40.4817 1.06655 42.1351C0.691187 42.9619 0.427245 43.6196 0.255775 44.0749C0.170037 44.3026 0.107407 44.4797 0.0655174 44.6022C0.0445725 44.6634 0.0288116 44.711 0.0179392 44.7443C0.012503 44.761 0.00828868 44.7742 0.00525939 44.7837C0.00374472 44.7885 0.00252634 44.7923 0.00159955 44.7953C0.00113618 44.7968 0.000745654 44.798 0.000427485 44.799C0.000268519 44.7995 8.36849e-05 44.8001 4.41074e-06 44.8004C-0.000162125 44.8009 -0.0003106 44.8014 0.954841 45.0975ZM24.5239 16.971L25.094 17.7926C34.3665 11.3594 43.8319 9.33146 50.9879 8.91284C54.5658 8.70353 57.5608 8.89704 59.6559 9.14169C60.703 9.26398 61.5242 9.3989 62.0796 9.50228C62.3572 9.55396 62.5683 9.59774 62.7079 9.62807C62.7777 9.64324 62.8296 9.65504 62.863 9.66279C62.8796 9.66666 62.8917 9.66952 62.899 9.67128C62.9027 9.67215 62.9052 9.67276 62.9065 9.67308C62.9072 9.67324 62.9075 9.67332 62.9076 9.67334C62.9076 9.67334 62.9074 9.6733 62.9074 9.6733C62.9072 9.67324 62.9069 9.67316 63.1462 8.70222C63.3855 7.73128 63.385 7.73116 63.3845 7.73103C63.3842 7.73096 63.3836 7.7308 63.383 7.73066C63.3819 7.73038 63.3804 7.73003 63.3787 7.72961C63.3752 7.72876 63.3705 7.72763 63.3646 7.72623C63.3529 7.72342 63.3364 7.71951 63.3152 7.71459C63.2729 7.70476 63.2118 7.69089 63.1327 7.67369C62.9744 7.63929 62.7437 7.59154 62.4456 7.53606C61.8495 7.4251 60.9835 7.28314 59.8879 7.15519C57.6972 6.89938 54.584 6.69905 50.8711 6.91625C43.4455 7.35065 33.5998 9.45711 23.9539 16.1494L24.5239 16.971Z"
                    fill="#FFFFFF"
                  />
                </Svg>
              </View>

              <Text style={[styles.title, lite && styles.titleLite]}>
                {t(`hotels.guide.steps.${current.id}.title`)}
              </Text>
              <Text style={[styles.desc, lite && styles.descLite]}>
                {t(`hotels.guide.steps.${current.id}.desc`)}
              </Text>
            </View>
          </ScrollView>

          <View style={styles.bar}>
            {/* 第 1 步没有上一步:留一个等宽占位,免得指示点跟着左右跳 */}
            {step > 0 ? (
              <Pressable
                style={({ pressed }) => [
                  styles.btn,
                  lite && styles.btnLite,
                  pressed && styles.pressed,
                ]}
                onPress={() => setStep((s) => Math.max(s - 1, 0))}
              >
                <Text style={[styles.btnText, lite && styles.btnTextLite]}>
                  {t('hotels.guide.previous')}
                </Text>
              </Pressable>
            ) : (
              <View style={styles.btnPlaceholder} />
            )}

            <View style={styles.dots}>
              {GUIDE_STEPS.map((s, i) => (
                <View key={s.id} style={[styles.dot, i === step && styles.dotActive]} />
              ))}
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.btn,
                styles.btnNext,
                lite && styles.btnLite,
                pressed && styles.pressed,
              ]}
              onPress={next}
            >
              <Text style={[styles.btnText, lite && styles.btnTextLite]}>
                {t(last ? 'hotels.guide.done' : 'hotels.guide.next')}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  /** 设计稿是纯黑 95%:底层页面只剩极淡的轮廓 */
  cover: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000000', opacity: 0.95 },
  safe: { flex: 1 },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },

  skip: { alignSelf: 'flex-start', paddingHorizontal: 17, paddingVertical: 9 },
  skipText: { fontFamily: fonts.inter, fontSize: 12, lineHeight: 16, color: '#FFFFFF' },
  skipTextLite: { fontSize: 16, lineHeight: 22 },

  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: PAGE_PADDING,
    paddingVertical: 16,
    gap: 8,
  },
  stage: { width: '100%', alignItems: 'center' },

  /** 设计稿文案块宽 320、左对齐 */
  copy: { width: '100%', maxWidth: 320, alignSelf: 'center', gap: 8 },
  /** 箭头在设计稿里整体旋转 -53.55°,指向上方的插图 */
  arrowBox: { width: 66.933, height: 72.17, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-53.55deg' }] },
  title: { fontFamily: fonts.interBold, fontSize: 24, lineHeight: 32, color: '#FFFFFF' },
  titleLite: { fontSize: 32, lineHeight: 40 },
  desc: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: LINE },
  descLite: { fontSize: 20, lineHeight: 28 },

  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: LINE,
  },
  btnLite: { paddingHorizontal: 24, paddingVertical: 16 },
  /** 设计稿 Next 比 Previous 略宽(110) */
  btnNext: { minWidth: 110 },
  btnPlaceholder: { width: 100 },
  btnText: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 20, color: LINE },
  btnTextLite: { fontSize: 20, lineHeight: 26 },

  dots: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 999, backgroundColor: 'rgba(217, 225, 251, 0.4)' },
  dotActive: { width: 10, height: 10, backgroundColor: '#FFFFFF' },
});
