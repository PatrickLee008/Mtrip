/**
 * 常见问题(按 Figma M-Trip / More `1699:7636` FAQ 实现)
 *
 * 自上而下:搜索卡(「How can we help?」+ 搜索框)→ 分类手风琴(General / Booking / Cars / Food)。
 * 分类卡有两态(组件 1793:3969 Default 展开 / 1793:3971 Variant2 收起):展开后列出该类问题卡;
 * 问题卡也有两态(1793:4029 展开带分隔线 + 答案 / 1793:4031 收起只有问题)。
 * 输入关键词时按问题 + 答案全文过滤,命中的分类自动展开、命中的问题自动展开答案。
 *
 * 设计稿实测:
 *   搜索卡   --tab 底 / 1px --secondary / 圆角 24 / padding 24 / gap 24 / DS_AG;
 *            标题 Inter 400/16 #141D23;输入框 --secondary 底、高 52、padding 16、圆角 12,
 *            放大镜 20 主色 + 占位 Inter 400/16 --text-2
 *   分类卡   --tab 底、圆角 24、padding 24、gap 4,无描边无投影;
 *            标题行 py8:Inter 600/16 --text + 12×7.4 箭头(收起朝下、展开朝上)
 *   问题卡   1px --secondary 描边、圆角 20、padding 24、gap 12;
 *            问题 Inter 400/16 主色;展开后 --secondary 分隔线 + pt8 答案 Inter 400/16 #434655 行高 24
 *   卡间距   分类卡之间 16,问题卡之间 4
 *
 * 内容来源见 moreDemo.ts 的 FAQ_CATEGORIES(**后端没有 FAQ 内容接口**,chat/faqs 只是客服快捷提问)。
 */

import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import MorePageLayout from '@/components/more/MorePageLayout';
import { moreShared } from '@/components/more/moreShared';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import { FAQ_CATEGORIES } from '@/screens/more/moreDemo';

/** 设计稿答案正文色(与条款页同一个,只在「更多」法律/帮助类页面出现) */
const ANSWER_COLOR = '#434655';
/** 设计稿箭头色(导出资产 #8B8C91,即压平后的 --text-2) */
const CHEVRON_COLOR = '#8B8C91';

export default function FaqScreen() {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState('');
  /** 手动展开的分类 / 问题(搜索时由命中结果覆盖) */
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const query = keyword.trim().toLowerCase();

  /** 搜索时只保留命中的问题;没关键词时原样返回 */
  const visible = useMemo(() => {
    return FAQ_CATEGORIES.map((cat) => {
      const items = cat.items.filter((item) => {
        if (!query) return true;
        const q = t(`more.faq.items.${item}.q`).toLowerCase();
        const a = t(`more.faq.items.${item}.a`).toLowerCase();
        return q.includes(query) || a.includes(query);
      });
      return { key: cat.key, items };
    }).filter((cat) => !query || cat.items.length > 0);
  }, [query, t]);

  const toggleCat = (key: string) => setOpenCats((cur) => ({ ...cur, [key]: !cur[key] }));
  const toggleItem = (key: string) => setOpenItems((cur) => ({ ...cur, [key]: !cur[key] }));

  return (
    <MorePageLayout title={t('more.faq.title')}>
      {/* 搜索卡 */}
      <View style={[moreShared.panel, styles.searchPanel]}>
        <Text style={styles.help}>{t('more.faq.help')}</Text>
        <View style={styles.searchBox}>
          <HomeIcon name="search" size={20} color={colors.primary} />
          <TextInput
            style={styles.searchInput}
            value={keyword}
            onChangeText={setKeyword}
            placeholder={t('more.faq.searchPlaceholder')}
            placeholderTextColor={colors.textSoft}
            returnKeyType="search"
            autoCorrect={false}
          />
        </View>
      </View>

      <View style={styles.catList}>
        {visible.length === 0 ? <Text style={styles.empty}>{t('more.faq.empty')}</Text> : null}

        {visible.map((cat) => {
          const catOpen = query ? true : !!openCats[cat.key];
          return (
            <View key={cat.key} style={styles.catCard}>
              <Pressable
                style={({ pressed }) => [styles.catHead, pressed && moreShared.pressed]}
                accessibilityRole="button"
                accessibilityState={{ expanded: catOpen }}
                onPress={() => toggleCat(cat.key)}
              >
                <Text style={styles.catTitle}>{t(`more.faq.categories.${cat.key}`)}</Text>
                <Chevron up={catOpen} />
              </Pressable>

              {catOpen ? (
                <View style={styles.itemList}>
                  {cat.items.map((item) => {
                    const itemOpen = query ? true : !!openItems[item];
                    return (
                      <Pressable
                        key={item}
                        style={({ pressed }) => [styles.itemCard, pressed && moreShared.pressed]}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: itemOpen }}
                        onPress={() => toggleItem(item)}
                      >
                        <View style={styles.itemHead}>
                          <Text style={styles.question}>{t(`more.faq.items.${item}.q`)}</Text>
                          <Chevron up={itemOpen} />
                        </View>
                        {itemOpen ? (
                          <>
                            <View style={moreShared.divider} />
                            <Text style={styles.answer}>{t(`more.faq.items.${item}.a`)}</Text>
                          </>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </MorePageLayout>
  );
}

/** 12×7.4 实心箭头(chevronDown 字形);展开态设计稿是同一枚竖向翻转 */
function Chevron({ up }: { up: boolean }) {
  return (
    <View style={up ? styles.flip : undefined}>
      <HomeIcon name="chevronDown" width={12} height={12} color={CHEVRON_COLOR} />
    </View>
  );
}

const styles = StyleSheet.create({
  searchPanel: { borderRadius: 24, gap: 24 },
  /* 设计稿 #141D23,比 --text 略深(与「更多」资料卡姓名同色) */
  help: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: '#141D23' },
  searchBox: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.softBlue,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    padding: 0,
    fontFamily: fonts.inter,
    fontSize: 16,
    color: colors.heading,
  },

  catList: { gap: 16 },
  empty: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 22, color: colors.textSoft, textAlign: 'center' },
  catCard: { gap: 4, padding: 24, borderRadius: 24, backgroundColor: colors.surface },
  catHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  catTitle: { flex: 1, minWidth: 0, fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 24, color: colors.heading },

  itemList: { gap: 4 },
  itemCard: {
    gap: 12,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.softBlue,
  },
  itemHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  question: { flex: 1, minWidth: 0, fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.primary },
  answer: { paddingTop: 8, fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: ANSWER_COLOR },

  flip: { transform: [{ scaleY: -1 }] },
});
