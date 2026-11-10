/**
 * 切换语言(按 Figma M-Trip / More `3256:18986` Change language 实现)
 *
 * 「更多」页的 Languages 行(1690:4642 里的 3256:18971)进来。原先是一个居中弹层(LanguageDialog),
 * 设计稿给了独立页面后改成本页,切换逻辑不变:写 commonStore(持久化 STORAGE_KEYS.LANG)+ i18n 立即生效,
 * 点哪行就切哪种语言,不需要确认按钮,停留在本页让用户直接看到新语言的效果。
 *
 * 设计稿实测:
 *   卡壳   --tab 底 / 1px --secondary / 圆角 24 / padding 24 / DS_AG 投影;行间距 16
 *   语言行 1px --secondary 描边,圆角 12,padding 16,行内 gap 12;国旗 40 圆形裁切(与开屏语言卡同一套)
 *   文案   Inter 400/16,选中 --text、未选 --text-2;右侧 20 勾选框(选中 indeterminate 主色)
 *   顺序   မြန်မာ → English → 中文(与开屏卡的顺序不同,按本稿)
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import MorePageLayout from '@/components/more/MorePageLayout';
import { moreShared } from '@/components/more/moreShared';
import LangFlag from '@/components/splash/LangFlag';
import type { Lang } from '@/config/global';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import { changeLanguage } from '@/i18n';
import { useCommonStore } from '@/store/commonStore';

/** 未选勾选框色(本稿导出资产 #8B8C91,比开屏卡的 #191A25 浅) */
const UNCHECKED = '#8B8C91';

/** 设计稿顺序 */
const ORDER: Lang[] = ['my-MM', 'en-US', 'zh-CN'];

/** 每种语言用它自己的文字标注,不走 i18n —— 不管当前是什么语言,列表都要同时可读 */
const LANG_LABELS: Record<Lang, string> = {
  'en-US': 'English',
  'my-MM': 'မြန်မာ',
  'zh-CN': '中文',
};

export default function ChangeLanguageScreen() {
  const { t } = useTranslation();
  const lang = useCommonStore((s) => s.lang);
  const setLang = useCommonStore((s) => s.setLang);

  const pick = (next: Lang) => {
    if (next === lang) return;
    void (async () => {
      await setLang(next);
      changeLanguage(next);
    })();
  };

  return (
    <MorePageLayout title={t('more.language.title')}>
      <View style={[moreShared.panel, styles.panel]}>
        {ORDER.map((l) => {
          const on = l === lang;
          return (
            <Pressable
              key={l}
              style={({ pressed }) => [styles.option, pressed && moreShared.pressed]}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => pick(l)}
            >
              <LangFlag lang={l} />
              <View style={styles.optionMain}>
                <Text style={[styles.label, on && styles.labelOn]}>{LANG_LABELS[l]}</Text>
                <HomeIcon
                  name={on ? 'checkboxIndeterminate' : 'checkbox'}
                  size={20}
                  color={on ? colors.primary : UNCHECKED}
                />
              </View>
            </Pressable>
          );
        })}
      </View>
    </MorePageLayout>
  );
}

const styles = StyleSheet.create({
  /* 本稿卡片圆角 24(比 moreShared.panel 的 32 小一档) */
  panel: { borderRadius: 24, gap: 16 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.softBlue,
  },
  optionMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: { flexShrink: 1, fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.textSoft },
  labelOn: { color: colors.heading },
});
