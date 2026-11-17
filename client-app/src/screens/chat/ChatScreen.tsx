import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, FlatList, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useIsFocused, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';
import { chatFile, chatReceipt, connectChat, finishChat, getChat, getChatMessages, listChats, rateChat, sendChat, setSupportBooking, startChat, supportHandoff, uploadChat, type ChatAttachment, type ChatConversation, type ChatMessage, type ChatReceipt } from '@/api/chat';
import { BookingPicker, SupportIntro, SupportRating } from '@/components/chat/SupportChatParts';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import HomeIcon from '@/components/home/HomeIcon';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { useUserStore } from '@/store/userStore';
import { useCommonStore } from '@/store/commonStore';
import { getRecentHotels, type RecentHotel } from '@/utils/recentHotels';

/** 预设问题(入住时间 / 早餐 / 接送机),文案在 chat.quick.* */
const QUICK_QUESTIONS = ['checkIn', 'breakfast', 'transfer'] as const;

function ChatImage({ file, onPreview }: { file: ChatAttachment; onPreview: (file: ChatAttachment) => void }) {
  const [uri, setUri] = useState('');
  useEffect(() => { let active = true; void chatFile(file.id).then((url) => { if (active) setUri(url); }).catch(() => {}); return () => { active = false; }; }, [file.id]);
  return uri ? <Pressable onPress={() => onPreview(file)} accessibilityLabel={file.filename}><Image source={{ uri }} style={{ width: 180, height: 135, borderRadius: 8 }} resizeMode="cover" /></Pressable> : null;
}

interface Props { navigation: NativeStackNavigationProp<RootStackParamList, 'Chat'>; route: RouteProp<RootStackParamList, 'Chat'> }
export default function ChatScreen({ navigation, route }: Props) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isLogin = useUserStore((s) => s.isLogin);
  const showToast = useCommonStore((s) => s.showToast);
  const focused = useIsFocused();
  const [id, setId] = useState(0);
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [list, setList] = useState<ChatConversation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [receipts, setReceipts] = useState<ChatReceipt[]>([]);
  const [draft, setDraft] = useState('');
  const [files, setFiles] = useState<ChatAttachment[]>([]);
  const [online, setOnline] = useState(false);
  const [preview, setPreview] = useState('');
  async function previewImage(file: ChatAttachment) { setPreview(await chatFile(file.id)); }
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [newBelow, setNewBelow] = useState(false);
  const [pending, setPending] = useState<{ content: string; attachmentIds: number[]; clientMessageId: string; files: ChatAttachment[]; faqKey?: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  /* 平台客服(type 2,PRD 模块 13):选预订弹层 / 结束确认 / 最近浏览的酒店 */
  const [pickerOpen, setPickerOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [recent, setRecent] = useState<RecentHotel[]>([]);
  const scroll = useRef<ScrollView>(null);
  const items = useRef<ChatMessage[]>([]);
  const bottom = useRef(true);
  const active = useRef(AppState.currentState === 'active');
  const focusedRef = useRef(focused);
  const read = useRef(0);
  const delivered = useRef(0);
  const generation = useRef(0);
  const follow = useRef(true);
  const loadingHistory = useRef(false);
  focusedRef.current = focused;
  const isThread = !!(route.params?.conversationId || route.params?.propertyId || route.params?.orderId || route.params?.type);
  const isSupport = conversation?.type === 2;
  const supportActive = isSupport && conversation?.status === 0;
  const handedOff = !!conversation?.handoff_at;
  const titleOf = (c: ChatConversation) => c.type === 2 ? t('chat.supportChat.title') : c.title;
  const time = (value: string) => new Date(value.replace(' ', 'T') + 'Z').toLocaleString(i18n.language, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const markRead = useCallback(async (chatId: number) => {
    const max = items.current[items.current.length - 1]?.id || 0;
    if (!max) return;
    if (delivered.current < max) { delivered.current = max; try { await chatReceipt(chatId, max, false); } catch { delivered.current = 0; } }
    const visible = Platform.OS !== 'web' || (typeof document !== 'undefined' && document.visibilityState === 'visible' && document.hasFocus());
    if (focusedRef.current && active.current && visible && bottom.current && read.current < max) {
      read.current = max; setNewBelow(false);
      try { await chatReceipt(chatId, max, true); } catch { read.current = 0; }
    }
  }, []);

  const refresh = useCallback(async (chatId: number, initial = false) => {
    const g = generation.current;
    const after = initial ? 0 : items.current[items.current.length - 1]?.id || 0;
    try {
      const [c, result] = await Promise.all([getChat(chatId), getChatMessages(chatId, 0, after)]);
      if (g !== generation.current) return;
      setConversation(c); setReceipts(result.receipts);
      const seen = new Set(items.current.map((m) => m.id));
      const added = result.list.filter((m) => !seen.has(m.id));
      items.current = initial ? result.list : [...items.current, ...added];
      follow.current = initial || bottom.current;
      setMessages([...items.current]);
      if (initial) setHasOlder(result.list.length === 50);
      if (!initial && added.length && !bottom.current) setNewBelow(true);
      setFailed(false);
      if (!initial && added.length === 50) { await refresh(chatId); return; }
      if (initial || bottom.current) setTimeout(() => { if (g === generation.current) { scroll.current?.scrollToEnd({ animated: false }); void markRead(chatId); } }, 80);
      else void markRead(chatId);
    } catch { if (g === generation.current) setFailed(true); }
  }, [markRead]);

  const loadList = useCallback(async (next = 1) => {
    const g = generation.current;
    try { const r = await listChats(next); if (g === generation.current) { setList((old) => next === 1 ? r.list : [...old, ...r.list]); setPage(next); setTotal(r.total); setFailed(false); } }
    catch { if (g === generation.current) setFailed(true); }
  }, []);

  useEffect(() => {
    const g = ++generation.current;
    setId(0); setConversation(null); items.current = []; setMessages([]); setFiles([]); setPending(null); setDraft(''); read.current = 0; delivered.current = 0;
    bottom.current = true; follow.current = true; setNewBelow(false); setSendFailed(false); setFailed(false);
    if (!isLogin) { if (focused) navigation.navigate('Login'); return; }
    if (!focused) return;
    setLoading(true);
    void (async () => {
      try {
        if (!isThread) { await loadList(); return; }
        const chatId = route.params?.conversationId || (await startChat(route.params || {})).conversationId;
        if (g !== generation.current) return;
        setId(chatId); await refresh(chatId, true);
      } catch { if (g === generation.current) setFailed(true); }
      finally { if (g === generation.current) setLoading(false); }
    })();
    return () => { ++generation.current; };
  }, [isLogin, focused, route.params?.conversationId, route.params?.propertyId, route.params?.orderId, route.params?.type, isThread, loadList, navigation, refresh]);

  useEffect(() => {
    if (!isLogin || !focused) return;
    let stop = () => {};
    const start = () => {
      stop(); stop = connectChat((event) => {
        if (!isThread) { if (event.kind !== 'receipt') void loadList(); }
        else if (id && (event.kind === 'ready' || event.conversationId === id)) void refresh(id);
      }, setOnline);
    };
    start();
    const sub = AppState.addEventListener('change', (state) => { active.current = state === 'active'; if (active.current) { start(); if (id) void refresh(id); } else { stop(); setOnline(false); } });
    return () => { sub.remove(); stop(); setOnline(false); };
  }, [isLogin, focused, id, isThread, loadList, refresh]);

  useEffect(() => {
    if (!isSupport || !focused) return;
    let alive = true;
    void getRecentHotels().then((list) => { if (alive) setRecent(list); });
    return () => { alive = false; };
  }, [isSupport, focused]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !id) return;
    const listener = () => { void markRead(id); };
    document.addEventListener('visibilitychange', listener); window.addEventListener('focus', listener);
    return () => { document.removeEventListener('visibilitychange', listener); window.removeEventListener('focus', listener); };
  }, [id, markRead]);

  async function older() {
    if (loadingHistory.current || !messages.length) return;
    loadingHistory.current = true; const g = generation.current;
    try { const result = await getChatMessages(id, messages[0].id); if (g !== generation.current) return; items.current = [...result.list, ...items.current]; follow.current = false; setMessages(items.current); setHasOlder(result.list.length === 50); }
    finally { loadingHistory.current = false; }
  }
  /** preset:点推荐问题直接发出(带 faqKey 让机器人精确命中) */
  async function send(retry = false, preset?: { content: string; faqKey: string }) {
    if (!id || sending || uploading) return;
    const payload = retry ? pending : { content: preset ? preset.content : draft.trim(), attachmentIds: preset ? [] : files.map((f) => f.id), files: preset ? [] : [...files], clientMessageId: 'msg-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 14), faqKey: preset?.faqKey };
    if (!payload || (!payload.content && !payload.attachmentIds.length) || (!retry && pending)) return;
    const g = generation.current; setPending(payload); setSendFailed(false); setSending(true);
    if (!retry && !preset) { setDraft(''); setFiles([]); }
    try { await sendChat({ conversationId: id, ...payload }); if (g !== generation.current) return; setPending(null); bottom.current = true; await refresh(id); }
    catch { if (g === generation.current) setSendFailed(true); }
    finally { setSending(false); }
  }
  async function attach() {
    if (!id || uploading || pending) return;
    const result = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], multiple: true, copyToCacheDirectory: true });
    if (result.canceled) return;
    if (files.length + result.assets.length > 5) { showToast(t('chat.fileLimit')); return; }
    const g = generation.current; setUploading(true);
    try {
      for (const asset of result.assets) {
        const max = asset.mimeType === 'application/pdf' ? 20 : 10;
        if (!asset.size || asset.size > max * 1024 * 1024) { showToast(t('chat.fileTypes')); continue; }
        const form = new FormData(); form.append('conversationId', String(id));
        if (Platform.OS === 'web' && asset.file) form.append('file', asset.file);
        else form.append('file', { uri: asset.uri, name: asset.name, type: asset.mimeType || 'application/octet-stream' } as unknown as Blob);
        const uploaded = await uploadChat(form);
        if (g !== generation.current) return;
        setFiles((old) => [...old, uploaded]);
      }
    } finally { setUploading(false); }
  }
  async function openFile(file: ChatAttachment) {
    const url = await chatFile(file.id);
    if (Platform.OS === 'web') { const a = document.createElement('a'); a.href = url; a.click(); }
    else await Linking.openURL(url);
  }
  async function pickBooking(orderId: number) {
    setPickerOpen(false);
    if (!id || orderId === (conversation?.order_id || 0)) return;
    try { await setSupportBooking(id, orderId); await refresh(id); } catch { /* 请求层已 Toast */ }
  }
  async function contactAgent() {
    if (!id) return;
    try { await supportHandoff(id); bottom.current = true; await refresh(id); } catch { /* 请求层已 Toast */ }
  }
  async function endSupport() {
    setEndOpen(false);
    if (!id) return;
    try { await finishChat(id); await refresh(id); } catch { /* 请求层已 Toast */ }
  }
  async function rateSupport(rating: number, comment: string) {
    await rateChat(id, rating, comment);
    showToast(t('chat.supportChat.rateThanks'));
    await refresh(id);
  }
  const senderLabel = (item: ChatMessage) => item.sender_role === 'bot' || item.sender_type === 3 ? t('chat.supportChat.assistant')
    : item.sender_type === 2 && (item.sender_role === 'admin' || isSupport) ? (isSupport ? t('chat.supportChat.agent') : t('chat.platform')) : '';
  const state = (messageId: number) => receipts.some((r) => r.actor_role !== 'user' && r.read_id >= messageId) ? t('chat.read') : receipts.some((r) => r.actor_role !== 'user' && r.delivered_id >= messageId) ? t('chat.delivered') : t('chat.sent');

  return <><Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview('')}><View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', padding: 24, paddingTop: insets.top + 24 }}><Pressable onPress={() => setPreview('')} accessibilityLabel={t('chat.cancel')}><Text style={{ color: 'white', fontSize: 24, textAlign: 'right' }}>×</Text></Pressable><Image source={{ uri: preview }} style={{ flex: 1, width: '100%' }} resizeMode="contain" accessibilityLabel={t('chat.preview')} /></View></Modal><KeyboardAvoidingView style={[styles.screen, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.header}><Pressable onPress={() => navigation.goBack()} accessibilityLabel={t('chat.back')}><HomeIcon name="arrowLeft" size={24} color={colors.primary} /></Pressable><View style={styles.heading}><Text style={styles.title} numberOfLines={1}>{conversation ? titleOf(conversation) : isThread && route.params?.type === 2 ? t('chat.supportChat.title') : t('chat.messages')}</Text>{isThread && <Text style={styles.connection}>{online ? t('chat.connected') : t('chat.reconnecting')}</Text>}</View>{supportActive && <Pressable onPress={() => setEndOpen(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('chat.supportChat.end')} testID="support-end"><Text style={styles.endText}>{t('chat.supportChat.end')}</Text></Pressable>}</View>
    {!isLogin ? <Pressable style={styles.empty} onPress={() => navigation.navigate('Login')}><Text>{t('chat.login')}</Text></Pressable> : !isThread ? <FlatList data={list} keyExtractor={(item) => String(item.id)} contentContainerStyle={styles.list} renderItem={({ item }) => <Pressable style={styles.conversation} onPress={() => navigation.push('Chat', { conversationId: item.id })}><View style={styles.listHeading}><Text style={styles.listTitle}>{titleOf(item)}</Text>{item.unread > 0 && <Text style={styles.badge}>{item.unread}</Text>}</View><Text style={styles.secondary}>{item.last_message || t('chat.noMessages')}</Text><Text style={styles.time}>{item.last_time ? time(item.last_time) : ''}</Text></Pressable>} ListEmptyComponent={<Text style={styles.empty}>{loading ? t('chat.loading') : failed ? t('chat.error') : t('chat.noChats')}</Text>} ListFooterComponent={list.length < total ? <Pressable onPress={() => void loadList(page + 1)}><Text style={styles.link}>{t('chat.loadMore')}</Text></Pressable> : null} /> : <>
      {conversation?.status === 1 && !isSupport && <Text style={styles.resolved}>{t('chat.resolved')} · {t('chat.messageHint')}</Text>}
      {isSupport && handedOff && supportActive && <Text style={styles.resolved}>{t('chat.supportChat.agentConnected')}</Text>}
      {failed && <Pressable onPress={() => id ? void refresh(id) : navigation.replace('Chat', route.params)}><Text style={styles.error}>{t('chat.error')} · {t('chat.retry')}</Text></Pressable>}
      <ScrollView ref={scroll} style={styles.history} contentContainerStyle={styles.historyContent} maintainVisibleContentPosition={{ minIndexForVisible: 0 }} onContentSizeChange={() => { if (follow.current) scroll.current?.scrollToEnd({ animated: false }); }} onScroll={(event) => { const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent; bottom.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 80; if (bottom.current) void markRead(id); }} scrollEventThrottle={100}>
        {hasOlder && <Pressable onPress={() => void older()}><Text style={styles.link}>{t('chat.older')}</Text></Pressable>}
        {isSupport && conversation && <SupportIntro conversation={conversation} recent={recent} onPickBooking={() => setPickerOpen(true)} onRecent={(hotel) => setDraft((old) => (old ? old + ' ' : '') + t('chat.supportChat.aboutHotel', { name: hotel.name }))} />}
        {!messages.length && !isSupport && <Text style={styles.empty}>{loading ? t('chat.loading') : t('chat.noMessages')}</Text>}
        {messages.map((item) => <View key={item.id} style={[styles.message, item.sender_type === 1 ? styles.outgoing : styles.incoming]}><View style={[styles.bubble, item.sender_type === 1 ? styles.blueBubble : styles.grayBubble]}>{!!senderLabel(item) && <Text style={styles.sender}>{senderLabel(item)}</Text>}{!!item.content && <Text style={[styles.body, item.sender_type === 1 && styles.white]}>{item.content}</Text>}{item.attachments?.filter((file) => file.mime.startsWith('image/')).map((file) => <ChatImage key={'image-' + file.id} file={file} onPreview={(f) => void previewImage(f)} />)}{item.attachments?.map((file) => <Pressable key={file.id} onPress={() => void openFile(file)}><Text style={[styles.file, item.sender_type === 1 && styles.white]}>↗ {file.filename} · {(file.size / 1048576).toFixed(1)} MB</Text></Pressable>)}</View><Text style={styles.time}>{time(item.created_at)}{item.sender_type === 1 ? ' · ' + state(item.id) : ''}</Text>{item.action === 'suggest_agent' && supportActive && !handedOff && <Pressable style={styles.agentBtn} onPress={() => void contactAgent()} testID={'support-suggest-agent-' + item.id}><Text style={styles.quickText}>{t('chat.supportChat.contactAgent')}</Text></Pressable>}</View>)}
        {pending && <View style={[styles.message, styles.outgoing]}><View style={[styles.bubble, styles.blueBubble]}><Text style={[styles.body, styles.white]}>{pending.content}</Text>{pending.files.map((file) => <Text key={file.id} style={styles.white}>{file.filename}</Text>)}</View>{sendFailed ? <Pressable onPress={() => void send(true)}><Text style={styles.error}>{t('chat.sendFailed')} · {t('chat.retry')}</Text></Pressable> : <Text style={styles.time}>{t('chat.sending')}</Text>}</View>}
      </ScrollView>
      {newBelow && <Pressable onPress={() => { bottom.current = true; follow.current = true; scroll.current?.scrollToEnd({ animated: true }); void markRead(id); }}><Text style={styles.link}>{t('chat.newMessages')} ↓</Text></Pressable>}
      {isSupport && conversation?.status === 1 ? <View style={[styles.composer, { paddingBottom: Math.max(12, insets.bottom) }]}><SupportRating conversation={conversation} onSubmit={rateSupport} onNewChat={() => navigation.replace('Chat', { type: 2 })} /></View> : <View style={[styles.composer, { paddingBottom: Math.max(12, insets.bottom) }]}>{/* 平台客服:推荐问题(按所选预订场景)点一下直接发出;未转人工时常驻「联系客户支持」 */}{supportActive && !draft && !pending && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>{!handedOff && <Pressable style={[styles.quick, styles.agentChip]} onPress={() => void contactAgent()} testID="support-contact-agent"><Text style={[styles.quickText, styles.white]}>{t('chat.supportChat.contactAgent')}</Text></Pressable>}{!handedOff && (conversation?.support?.suggestions || []).map((q) => <Pressable key={q.key} style={styles.quick} onPress={() => void send(false, { content: q.question, faqKey: q.key })} testID={'support-faq-' + q.key}><Text style={styles.quickText}>{q.question}</Text></Pressable>)}</ScrollView>}{/* 与酒店的会话:输入框为空时给三条预设问题(QA CH_TC_002),点一下填进输入框,可改后再发 */}{conversation?.type === 1 && !draft && !pending && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>{QUICK_QUESTIONS.map((key) => <Pressable key={key} style={styles.quick} onPress={() => setDraft(t(`chat.quick.${key}`))}><Text style={styles.quickText}>{t(`chat.quick.${key}`)}</Text></Pressable>)}</ScrollView>}{files.map((file) => <Pressable key={file.id} onPress={() => setFiles((old) => old.filter((f) => f.id !== file.id))}><Text style={styles.file}>{file.filename} ×</Text></Pressable>)}<View style={styles.inputRow}>{conversation?.type === 1 && <Pressable onPress={() => void attach()} disabled={uploading || !!pending} accessibilityLabel={t('chat.attach')}><Text style={styles.attach}>＋</Text></Pressable>}<TextInput style={styles.input} multiline maxLength={2000} value={draft} onChangeText={setDraft} placeholder={t('chat.placeholder')} accessibilityLabel={t('chat.placeholder')} /><Pressable style={[styles.send, (sending || uploading || !!pending || (!draft.trim() && !files.length)) && styles.disabled]} disabled={!id || sending || uploading || !!pending || (!draft.trim() && !files.length)} onPress={() => void send()} accessibilityLabel={t('chat.send')}><Text style={styles.white}>➤</Text></Pressable></View>{uploading && <Text style={styles.time}>{t('chat.uploading')}</Text>}</View>}
      <BookingPicker visible={pickerOpen} selected={conversation?.order_id || 0} onClose={() => setPickerOpen(false)} onSelect={(orderId) => void pickBooking(orderId)} />
      <ConfirmDialog visible={endOpen} title={t('chat.supportChat.endTitle')} message={t('chat.supportChat.endMessage')} cancelLabel={t('chat.cancel')} confirmLabel={t('chat.supportChat.end')} onCancel={() => setEndOpen(false)} onConfirm={() => void endSupport()} />
    </>}
  </KeyboardAvoidingView></>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' }, header: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16, borderBottomWidth: 1, borderBottomColor: '#edf0f5' }, heading: { flex: 1 }, title: { fontFamily: fonts.outfitSemi, fontSize: 21, color: colors.primary }, connection: { fontFamily: fonts.inter, fontSize: 10, color: '#929db0', marginTop: 4 },
  list: { padding: 20, gap: 12 }, conversation: { padding: 20, borderWidth: 1, borderColor: '#e8edf7', borderRadius: 20, gap: 10, backgroundColor: '#fafbfe' }, listHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, listTitle: { fontFamily: fonts.outfitSemi, fontSize: 17, color: colors.heading, flex: 1 }, badge: { backgroundColor: colors.primary, color: '#fff', borderRadius: 12, paddingHorizontal: 7, paddingVertical: 2, fontSize: 11 }, secondary: { fontFamily: fonts.inter, fontSize: 13, color: '#8791a5' },
  history: { flex: 1 }, historyContent: { padding: 20, gap: 16 }, message: { maxWidth: '86%', gap: 6 }, outgoing: { alignSelf: 'flex-end', alignItems: 'flex-end' }, incoming: { alignSelf: 'flex-start', alignItems: 'flex-start' }, bubble: { borderRadius: 16, padding: 14, gap: 8 }, blueBubble: { backgroundColor: colors.primary, borderBottomRightRadius: 4 }, grayBubble: { backgroundColor: '#f2f4f8', borderBottomLeftRadius: 4 }, body: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 22, color: '#323e54' }, white: { color: '#fff' }, sender: { color: '#8993a5', fontSize: 10 }, time: { fontFamily: fonts.inter, fontSize: 10, color: '#a0a9b8' }, file: { fontFamily: fonts.inter, fontSize: 12, color: colors.primary, textDecorationLine: 'underline', paddingVertical: 4 },
  quickRow: { gap: 8 }, agentChip: { backgroundColor: colors.primary, borderColor: colors.primary }, agentBtn: { borderWidth: 1, borderColor: colors.softBlue, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#f4f7ff' }, endText: { fontFamily: fonts.interSemi, fontSize: 13, color: '#bc5c4c' }, quick: { borderWidth: 1, borderColor: colors.softBlue, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#f4f7ff' }, quickText: { fontFamily: fonts.inter, fontSize: 12, color: colors.primary },
  composer: { borderTopWidth: 1, borderTopColor: '#edf0f5', padding: 14, gap: 8 }, inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#e4e9f1', borderRadius: 16, padding: 8 }, input: { flex: 1, fontFamily: fonts.inter, fontSize: 14, maxHeight: 120, minHeight: 40, color: '#323e54', padding: 8 }, attach: { color: '#8e9bb2', fontSize: 28, paddingHorizontal: 4 }, send: { backgroundColor: colors.primary, borderRadius: 12, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: 0.35 }, empty: { textAlign: 'center', padding: 45, color: '#9ba6b8', fontFamily: fonts.inter, fontSize: 13 }, link: { textAlign: 'center', padding: 12, color: colors.primary, fontFamily: fonts.interSemi, fontSize: 12 }, error: { padding: 10, color: '#bc5c4c', fontSize: 12 }, resolved: { padding: 12, color: '#318b6d', backgroundColor: '#eef8f2', fontFamily: fonts.inter, fontSize: 11 },
});
