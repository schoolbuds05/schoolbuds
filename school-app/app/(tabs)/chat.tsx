// @ts-nocheck
// app/(tabs)/chat.tsx â€” Student chat with assigned teachers

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, FlatList, Image, KeyboardAvoidingView, Modal, StatusBar,
  Platform, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import api, { resolveApiAssetUrl } from '../../src/api';
import { useTheme } from '../../src/theme-context';

const C = {
  blue: '#378ADD',
  blueLight: '#E6F1FB',
  bg: '#F4F6F9',
  card: '#FFFFFF',
  border: '#EFEFEF',
  text: '#1A1A2E',
  sub: '#6B7280',
  muted: '#B0B7C3',
};

const AVATAR_PALETTES = [
  { bg: '#FBE5EB', text: '#B5233D' },
  { bg: '#DDF0E3', text: '#1E6B3A' },
  { bg: '#FFF1BF', text: '#8A6700' },
  { bg: '#E6EDF9', text: '#3F6FB7' },
];

const paletteFor = (id) => AVATAR_PALETTES[Number(id || 0) % AVATAR_PALETTES.length];
const avatarBackground = (id) => paletteFor(id).bg;
const avatarColor = (id) => paletteFor(id).text;
const initialsFor = (name) => String(name || 'Teacher').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();

function relativeMessageTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const diffDays = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(date.getFullYear(), date.getMonth(), date.getDate())) / 86400000);
  if (diffDays === 0) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function Chat() {
  const router = useRouter();
  const { theme } = useTheme();
  const { contactId, contactName } = useLocalSearchParams();
  const [myId, setMyId] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [authToken, setAuthToken] = useState(null);
  const [attachmentOptions, setAttachmentOptions] = useState(null);
  const [attachment, setAttachment] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const listRef = useRef(null);
  const attachmentSheetY = useRef(new Animated.Value(0)).current;
  const attachmentSheetStartY = useRef(null);

  const startAttachmentSheetDrag = event => { attachmentSheetStartY.current = event.nativeEvent.pageY; };
  const moveAttachmentSheetDrag = event => {
    if (attachmentSheetStartY.current != null) attachmentSheetY.setValue(Math.max(0, event.nativeEvent.pageY - attachmentSheetStartY.current));
  };
  const endAttachmentSheetDrag = event => {
    if (attachmentSheetStartY.current == null) return;
    const endY = event.nativeEvent.changedTouches?.[0]?.pageY ?? event.nativeEvent.pageY;
    const distance = Math.max(0, endY - attachmentSheetStartY.current);
    attachmentSheetStartY.current = null;
    if (distance > 90) {
      Animated.timing(attachmentSheetY, { toValue: 500, duration: 150, useNativeDriver: true }).start(() => {
        setAttachmentOptions(null);
        attachmentSheetY.setValue(0);
      });
    } else {
      Animated.spring(attachmentSheetY, { toValue: 0, useNativeDriver: true, tension: 90, friction: 12 }).start();
    }
  };

  const isThread = !!contactId;
  const filteredContacts = useMemo(() => contacts.filter(contact =>
    String(contact.name || '').toLowerCase().includes(search.trim().toLowerCase())
  ), [contacts, search]);
  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    return messages.filter(message => !query
      || `${message.is_deleted ? 'message deleted' : message.message || ''} ${message.attachment_name || ''} ${message.sender?.name || ''}`.toLowerCase().includes(query)
    ).slice().reverse();
  }, [messages, historySearch]);

  const loadCurrentUser = useCallback(async () => {
    const token = await AsyncStorage.getItem('token');
    setAuthToken(token);
    try {
      const res = await api.get('/me');
      if (res.data?.user?.id) {
        setMyId(res.data.user.id);
        await AsyncStorage.setItem('user', JSON.stringify(res.data.user));
        return;
      }
    } catch (e) {
      console.log('Current user error:', e.message);
    }

    const raw = await AsyncStorage.getItem('user');
    setMyId(raw ? JSON.parse(raw).id : null);
  }, []);

  const loadContacts = useCallback(async () => {
    try {
      setMessages([]);
      const res = await api.get('/teacher-chat/contacts');
      setContacts(res.data ?? []);
    } catch (e) {
      console.log('Teacher contacts error:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async () => {
    if (!contactId) return;
    try {
      const res = await api.get(`/teacher-chat/${contactId}/messages`);
      setMessages(res.data ?? []);
    } catch (e) {
      console.log('Teacher messages error:', e.message);
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    setMessages([]);
    setLoading(true);
  }, [contactId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadCurrentUser();
      if (isThread) {
        loadMessages();
        const timer = setInterval(() => {
          loadMessages();
        }, 8000);
        return () => clearInterval(timer);
      } else {
        loadContacts();
      }
    }, [isThread, loadContacts, loadCurrentUser, loadMessages])
  );

  const send = async () => {
    const text = input.trim();
    if ((!text && !attachment) || !contactId || sending) return;
    setSending(true);
    try {
      if (attachment) {
        const payload = new FormData();
        if (text) payload.append('message', text);
        payload.append('attachment', {
          uri: attachment.uri,
          name: attachment.name || 'attachment',
          type: attachment.mimeType || 'application/octet-stream',
        });
        await api.post(`/teacher-chat/${contactId}/messages`, payload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await api.post(`/teacher-chat/${contactId}/messages`, { message: text });
      }
      setInput('');
      setAttachment(null);
      await loadMessages();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  const pickAttachment = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (!result.canceled && result.assets?.[0]) setAttachment(result.assets[0]);
    } catch (e) {
      Alert.alert('Could not choose file', e.message || 'Please try again.');
    }
  };

  const openAttachment = async message => {
    if (!message.attachment_download_url) return;
    try {
      const token = authToken || await AsyncStorage.getItem('token');
      const url = resolveApiAssetUrl(message.attachment_download_url);
      const safeName = String(message.attachment_name || 'chat-attachment').replace(/[^a-zA-Z0-9._-]/g, '_');
      const file = await File.downloadFileAsync(url, new File(Paths.cache, `student-chat-${message.id}-${safeName}`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        idempotent: true,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: message.attachment_mime || 'application/octet-stream',
          dialogTitle: message.attachment_name || 'Open attachment',
        });
      } else {
        Alert.alert('File saved', `The attachment was downloaded to ${file.uri}`);
      }
    } catch (e) {
      Alert.alert('Could not open attachment', e?.response?.data?.message || e.message || 'Please try again.');
    }
  };

  if (!isThread) {
    return (
      <View style={[s.container, { backgroundColor: theme.bg }]}> 
        <View style={s.listHeader}>
          <View style={s.headerRow}>
            <View>
              <Text style={[s.headerEyebrow, { color: theme.textSub }]}>One-on-one with teachers</Text>
              <Text style={[s.listTitle, { color: theme.text }]}>Chat</Text>
            </View>
            <View style={[s.headerBadge, { backgroundColor: theme.card }]}>
              <Image source={require('../../assets/images/schoolbuds-favicon.png')} style={s.brandLogo} resizeMode="contain" />
            </View>
          </View>
          <View style={[s.searchBox, { backgroundColor: theme.card }]}>
            <Ionicons name="search-outline" size={17} color={theme.textSub} />
            <TextInput
              style={[s.searchInput, { color: theme.text }]}
              placeholder="Search teachers"
              placeholderTextColor={theme.textSub}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
          </View>
        </View>

        {loading ? (
          <View style={s.center}><ActivityIndicator color={C.blue} /></View>
        ) : contacts.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>ðŸ’¬</Text>
            <Text style={s.emptyTitle}>No teachers available</Text>
            <Text style={s.emptySub}>You need to be assigned to a section with teachers first.</Text>
          </View>
        ) : (
          <FlatList
            data={filteredContacts}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={s.contactList}
            ListEmptyComponent={<View style={s.noResults}><Text style={[s.noResultsText, { color: theme.textSub }]}>No teachers found.</Text></View>}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[s.contactCard, { backgroundColor: theme.card, borderBottomColor: theme.border }]}
                onPress={() => router.push({
                  pathname: '/(tabs)/chat',
                  params: { contactId: String(item.id), contactName: item.name },
                })}
              >
                <View style={[s.avatar, { backgroundColor: avatarBackground(item.id) }]}>
                  {item.profile_photo_url ? (
                    <Image source={{ uri: item.profile_photo_url }} style={s.avatarImage} />
                  ) : (
                    <Text style={[s.avatarText, { color: avatarColor(item.id) }]}>{initialsFor(item.name)}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.contactName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[s.lastMessage, { color: theme.textSub }]} numberOfLines={1}>{item.last_message || 'Start a conversation with your teacher.'}</Text>
                </View>
                <View style={s.contactEnd}>
                  <Text style={[s.messageTime, { color: theme.textSub }]}>{relativeMessageTime(item.last_message_at)}</Text>
                {item.unread > 0 && (
                  <View style={[s.unreadBadge, { backgroundColor: theme.primary }]}> 
                    <Text style={[s.unreadText, { color: theme.card }]}>{item.unread}</Text>
                  </View>
                )}
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[s.container, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar hidden />
      <View style={s.threadHeader}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/chat')} style={s.backButton} accessibilityRole="button" accessibilityLabel="Back to chats">
          <Ionicons name="chevron-back" size={24} color="#2A151B" />
        </TouchableOpacity>
        <View style={s.threadAvatar}><Text style={s.threadAvatarText}>{initialsFor(contactName)}</Text></View>
        <View style={s.threadTitleWrap}>
          <Text style={s.threadTitle} numberOfLines={1}>{contactName ?? 'Teacher'}</Text>
          <View style={s.statusLine}><View style={s.statusDot} /><Text style={s.threadSubtitle}>Open{"\u00B7"} Teacher</Text></View>
        </View>
        <TouchableOpacity style={s.moreButton} onPress={() => { setHistorySearch(''); setHistoryOpen(true); }} accessibilityRole="button" accessibilityLabel="Search message history">
          <Ionicons name="ellipsis-vertical" size={20} color="#2A151B" />
        </TouchableOpacity>
      </View>

      <Modal visible={historyOpen} animationType="slide" onRequestClose={() => setHistoryOpen(false)}>
        <View style={s.historyScreen}>
          <View style={s.historyHeader}>
            <View style={{ flex: 1 }}><Text style={s.historyEyebrow}>Conversation</Text><Text style={s.historyTitle}>Message history</Text></View>
            <TouchableOpacity style={s.historyClose} onPress={() => setHistoryOpen(false)} accessibilityLabel="Close message history"><Ionicons name="close" size={22} color="#2A151B" /></TouchableOpacity>
          </View>
          <View style={s.historySearchBox}>
            <Ionicons name="search-outline" size={18} color="#826D72" />
            <TextInput style={s.historySearchInput} placeholder="Search messages" placeholderTextColor="#9A858A" value={historySearch} onChangeText={setHistorySearch} autoFocus returnKeyType="search" />
            {!!historySearch && <TouchableOpacity onPress={() => setHistorySearch('')} accessibilityLabel="Clear search"><Ionicons name="close-circle" size={18} color="#9A858A" /></TouchableOpacity>}
          </View>
          <FlatList
            data={filteredHistory}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={s.historyList}
            ListEmptyComponent={<Text style={s.historyEmpty}>{historySearch ? 'No matching messages.' : 'No past messages yet.'}</Text>}
            renderItem={({ item }) => {
              const index = messages.findIndex(message => message.id === item.id);
              const senderName = item.sender_id === myId ? 'You' : item.sender?.name || contactName || 'Teacher';
              const snippet = item.is_deleted
                ? (item.deleted_by === myId ? 'You deleted this message' : 'This message was deleted')
                : item.message || item.attachment_name || 'Attachment';
              return <TouchableOpacity style={s.historyResult} onPress={() => {
                setHistoryOpen(false);
                setTimeout(() => listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 }), 250);
              }}>
                <View style={s.historyResultTop}><Text style={s.historySender} numberOfLines={1}>{senderName}</Text><Text style={s.historyTime}>{relativeMessageTime(item.created_at)}</Text></View>
                <Text style={s.historySnippet} numberOfLines={2}>{snippet}</Text>
              </TouchableOpacity>;
            }}
          />
        </View>
      </Modal>

      <Modal visible={!!attachmentOptions} transparent animationType="fade" onRequestClose={() => setAttachmentOptions(null)}>
        <View style={s.attachmentMenuOverlay}>
          <TouchableOpacity style={s.attachmentMenuScrim} onPress={() => setAttachmentOptions(null)} activeOpacity={1} />
          <Animated.View style={[s.attachmentMenuSheet, { transform: [{ translateY: attachmentSheetY }] }]} onTouchStart={startAttachmentSheetDrag} onTouchMove={moveAttachmentSheetDrag} onTouchEnd={endAttachmentSheetDrag} onTouchCancel={endAttachmentSheetDrag}>
            <View style={s.sheetHandle} />
            <Text style={s.attachmentMenuTitle}>Attachment</Text>
            <Text style={s.attachmentMenuName} numberOfLines={2}>{attachmentOptions?.attachment_name}</Text>
            <TouchableOpacity style={s.attachmentMenuAction} onPress={() => {
              const selected = attachmentOptions;
              setAttachmentOptions(null);
              if (selected) openAttachment(selected);
            }}>
              <View style={s.attachmentMenuIcon}><Ionicons name="download-outline" size={20} color="#B5233D" /></View>
              <View style={{ flex: 1 }}><Text style={s.attachmentMenuActionTitle}>Download or share</Text><Text style={s.attachmentMenuActionSub}>Save or open this attachment</Text></View>
              <Ionicons name="chevron-forward" size={18} color="#9A858A" />
            </TouchableOpacity>
            <TouchableOpacity style={s.attachmentMenuCancel} onPress={() => setAttachmentOptions(null)}><Text style={s.attachmentMenuCancelText}>Cancel</Text></TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {loading ? (
        <View style={[s.center, { backgroundColor: theme.bg }]}><ActivityIndicator color={theme.primary} /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item, i) => String(item.id ?? i)}
          contentContainerStyle={s.messageList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          onScrollToIndexFailed={({ index, averageItemLength }) => listRef.current?.scrollToOffset({ offset: averageItemLength * index, animated: true })}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIcon}><Ionicons name="chatbubble-ellipses-outline" size={29} color="#B5233D" /></View>
              <Text style={s.emptyTitle}>No messages yet</Text>
              <Text style={s.emptySub}>Start the conversation with your teacher. Write a message below.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const mine = item.sender_id === myId;
            const deleted = !!item.is_deleted;
            return (
              <View style={[s.messageRow, mine ? s.messageRowMine : s.messageRowTheirs]}>
                <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleTheirs, deleted && s.deletedBubble]}>
                  {deleted ? <Text style={s.deletedMessage}>{mine ? 'You deleted this message' : 'This message was deleted'}</Text> : <>
                    {!mine && <Text style={s.sender}>{item.sender?.name?.split(' ')[0]}</Text>}
                    {!!item.message && <Text style={[s.bubbleText, mine ? s.bubbleTextMine : s.bubbleTextTheirs]}>{item.message}</Text>}
                    {item.attachment_name && String(item.attachment_mime || '').startsWith('image/') && <View style={s.attachmentGroup}>
                      <StudentImageAttachment message={item} token={authToken} />
                      <TouchableOpacity style={s.attachmentOptionsButton} onPress={() => setAttachmentOptions(item)} accessibilityRole="button" accessibilityLabel="Image options"><Ionicons name="ellipsis-horizontal" size={18} color={mine ? '#fff' : '#9A858A'} /></TouchableOpacity>
                    </View>}
                    {item.attachment_name && !String(item.attachment_mime || '').startsWith('image/') && <View style={s.attachmentGroup}>
                      <TouchableOpacity style={[s.attachmentMessage, { flex: 1 }]} onPress={() => openAttachment(item)} activeOpacity={0.85}>
                        <Ionicons name="document-attach-outline" size={19} color={mine ? '#fff' : '#B5233D'} />
                        <View style={{ flex: 1 }}><Text style={[s.attachmentName, mine && { color: '#fff' }]} numberOfLines={2}>{item.attachment_name}</Text><Text style={[s.attachmentHint, mine && { color: '#F9DDE3' }]}>Tap to open or share</Text></View>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.attachmentOptionsButton} onPress={() => setAttachmentOptions(item)} accessibilityRole="button" accessibilityLabel="File options"><Ionicons name="ellipsis-horizontal" size={18} color={mine ? '#fff' : '#9A858A'} /></TouchableOpacity>
                    </View>}
                  </>}
                </View>
                <Text style={[s.time, mine ? s.timeMine : s.timeTheirs]}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
            );
          }}
        />
      )}

      {attachment && <View style={s.attachmentDraft}>
        <Ionicons name="document-outline" size={18} color="#B5233D" />
        <Text style={s.attachmentDraftName} numberOfLines={1}>{attachment.name}</Text>
        <TouchableOpacity onPress={() => setAttachment(null)} accessibilityLabel="Remove attachment"><Ionicons name="close-circle" size={20} color="#826D72" /></TouchableOpacity>
      </View>}

      <View style={s.inputRow}>
        <TouchableOpacity style={s.attachButton} onPress={pickAttachment} accessibilityRole="button" accessibilityLabel="Attach a photo or file">
          <Ionicons name="attach-outline" size={21} color="#7A666B" />
        </TouchableOpacity>
        <TextInput
          style={[s.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
          placeholder="Type your question..."
          placeholderTextColor={theme.textMuted}
          value={input}
          onChangeText={setInput}
          onFocus={() => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150)}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[s.sendBtn, (!input.trim() && !attachment || sending) && s.sendBtnDisabled]}
          onPress={send}
          disabled={(!input.trim() && !attachment) || sending}
        >
          {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={17} color="#fff" />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function StudentImageAttachment({ message, token }) {
  const [uri, setUri] = useState(null);
  const [failed, setFailed] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [viewerSize, setViewerSize] = useState({ width: 0, height: 0 });
  const gestureStart = useRef({ distance: 0, zoom: 1, x: 0, y: 0, panX: 0, panY: 0 });

  const clampOffset = (offset, scale, size) => Math.max(-(size * (scale - 1)) / 2, Math.min((size * (scale - 1)) / 2, offset));
  const touchDistance = touches => {
    if (!touches || touches.length < 2) return 0;
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };
  const startImageGesture = event => {
    const touches = event.nativeEvent.touches || [];
    const point = touches[0];
    gestureStart.current = {
      distance: touchDistance(touches), zoom, x: point?.pageX ?? 0, y: point?.pageY ?? 0,
      panX: pan.x, panY: pan.y,
    };
  };
  const moveImageGesture = event => {
    const touches = event.nativeEvent.touches || [];
    if (touches.length >= 2) {
      const distance = touchDistance(touches);
      if (!distance || !gestureStart.current.distance) return;
      const nextZoom = Math.max(1, Math.min(4, gestureStart.current.zoom * distance / gestureStart.current.distance));
      setZoom(nextZoom);
      setPan(current => ({
        x: clampOffset(current.x, nextZoom, viewerSize.width),
        y: clampOffset(current.y, nextZoom, viewerSize.height),
      }));
      return;
    }
    const point = touches[0];
    if (!point || zoom <= 1) return;
    setPan({
      x: clampOffset(gestureStart.current.panX + point.pageX - gestureStart.current.x, zoom, viewerSize.width),
      y: clampOffset(gestureStart.current.panY + point.pageY - gestureStart.current.y, zoom, viewerSize.height),
    });
  };
  const adjustZoom = amount => {
    const nextZoom = Math.max(1, Math.min(4, zoom + amount));
    setZoom(nextZoom);
    setPan(current => nextZoom === 1 ? { x: 0, y: 0 } : ({
      x: clampOffset(current.x, nextZoom, viewerSize.width),
      y: clampOffset(current.y, nextZoom, viewerSize.height),
    }));
  };

  useEffect(() => {
    let active = true;
    if (!token || !message.attachment_download_url) return () => { active = false; };
    const safeName = String(message.attachment_name || 'image.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
    File.downloadFileAsync(
      resolveApiAssetUrl(message.attachment_download_url),
      new File(Paths.cache, `student-chat-preview-${message.id}-${safeName}`),
      { headers: { Authorization: `Bearer ${token}` }, idempotent: true }
    ).then(file => {
      if (active) setUri(file.uri);
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, [message.id, message.attachment_download_url, message.attachment_name, token]);

  if (!uri) return <View style={s.imageLoading}>
    {failed ? <Text style={s.attachmentHint}>Image preview unavailable</Text> : <ActivityIndicator size="small" color="#B5233D" />}
  </View>;

  return <>
    <TouchableOpacity style={s.imageAttachment} onPress={() => { setZoom(1); setPan({ x: 0, y: 0 }); setViewerOpen(true); }} activeOpacity={0.9} accessibilityLabel="View image">
      <Image source={{ uri }} style={s.messageImage} resizeMode="cover" accessibilityLabel={message.attachment_name} />
    </TouchableOpacity>
    <Modal visible={viewerOpen} transparent animationType="fade" onRequestClose={() => setViewerOpen(false)}>
      <View style={s.imageViewer}>
        <TouchableOpacity style={s.imageViewerClose} onPress={() => setViewerOpen(false)} accessibilityLabel="Close image viewer">
          <Ionicons name="close" size={25} color="#fff" />
        </TouchableOpacity>
        <View
          style={s.imageGestureArea}
          onLayout={event => setViewerSize(event.nativeEvent.layout)}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={startImageGesture}
          onResponderMove={moveImageGesture}
          onTouchStart={startImageGesture}
          onTouchMove={moveImageGesture}
          onTouchEnd={event => {
            const touches = event.nativeEvent.touches || [];
            const point = touches[0];
            gestureStart.current = {
              distance: touchDistance(touches), zoom, x: point?.pageX ?? 0, y: point?.pageY ?? 0,
              panX: pan.x, panY: pan.y,
            };
          }}
        >
          <Image source={{ uri }} style={[s.imageViewerPhoto, { transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale: zoom }] }]} resizeMode="contain" accessibilityLabel={message.attachment_name} />
        </View>
        <View style={s.zoomControls}>
          <TouchableOpacity style={s.zoomButton} onPress={() => adjustZoom(-0.5)} accessibilityLabel="Zoom out"><Ionicons name="remove" size={23} color="#fff" /></TouchableOpacity>
          <TouchableOpacity style={s.zoomReset} onPress={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}><Text style={s.zoomResetText}>{Math.round(zoom * 100)}%</Text></TouchableOpacity>
          <TouchableOpacity style={s.zoomButton} onPress={() => adjustZoom(0.5)} accessibilityLabel="Zoom in"><Ionicons name="add" size={23} color="#fff" /></TouchableOpacity>
        </View>
        <Text style={s.imageViewerName} numberOfLines={1}>{message.attachment_name}</Text>
      </View>
    </Modal>
  </>;
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listHeader: { paddingTop: 42, paddingHorizontal: 16, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  headerEyebrow: { fontSize: 11, fontWeight: '600', marginBottom: 1 },
  listTitle: { fontSize: 22, fontWeight: '800' },
  headerBadge: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  brandLogo: { width: 31, height: 31, borderRadius: 8 },
  searchBox: { height: 38, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1, fontSize: 12, marginLeft: 8, paddingVertical: 0 },
  contactList: { marginHorizontal: 16, borderRadius: 14, overflow: 'hidden' },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  sub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 4 },
  backBtn: { marginBottom: 6 },
  backText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  contactCard: {
    height: 63, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.blueLight, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: C.blue, fontSize: 12, fontWeight: '800' },
  contactName: { color: C.text, fontSize: 13, fontWeight: '800', marginLeft: 11 },
  lastMessage: { color: C.muted, fontSize: 11, marginTop: 3, marginLeft: 11 },
  contactEnd: { alignItems: 'flex-end', justifyContent: 'center', minWidth: 42, alignSelf: 'stretch', paddingVertical: 10 },
  messageTime: { fontSize: 9, fontWeight: '700', minHeight: 14 },
  unreadBadge: {
    minWidth: 22, height: 22, borderRadius: 11,
    backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  noResults: { height: 80, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card },
  noResultsText: { fontSize: 12, fontWeight: '600' },
  threadHeader: { minHeight: 76, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EEDDE0', paddingHorizontal: 17, gap: 11 },
  backButton: { width: 27, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  threadAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FBE3E8', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  threadAvatarText: { color: '#B5233D', fontSize: 12, fontWeight: '900' },
  threadTitleWrap: { flex: 1, minWidth: 0 },
  threadTitle: { color: '#2A151B', fontSize: 15, fontWeight: '800' },
  threadSubtitle: { color: '#7A666B', fontSize: 11, marginLeft: 5 },
  moreButton: { width: 30, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
  statusLine: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#24A766' },
  messageList: { flexGrow: 1, paddingHorizontal: 14, paddingVertical: 16, gap: 2, backgroundColor: '#FFF5F5' },
  messageRow: { maxWidth: '88%', marginBottom: 7 },
  messageRowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  messageRowTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { maxWidth: '100%', borderRadius: 19, paddingHorizontal: 13, paddingVertical: 9 },
  bubbleMine: { backgroundColor: '#B5233D', borderBottomRightRadius: 5 },
  bubbleTheirs: { backgroundColor: '#fff', borderBottomLeftRadius: 5, borderWidth: 1, borderColor: '#F0DADD' },
  deletedBubble: { backgroundColor: '#F3E9EB', borderWidth: 0 },
  deletedMessage: { color: '#8E7B80', fontSize: 12, fontStyle: 'italic' },
  sender: { color: '#B5233D', fontSize: 10, fontWeight: '800', marginBottom: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextMine: { color: '#fff' },
  bubbleTextTheirs: { color: C.text },
  time: { fontSize: 10, marginTop: 3, marginHorizontal: 5 },
  timeMine: { color: '#9A858A', alignSelf: 'flex-end' },
  timeTheirs: { color: '#9A858A', alignSelf: 'flex-start' },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0DADD',
    paddingHorizontal: 15, paddingVertical: 9,
  },
  attachButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFF5F5', alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1, backgroundColor: '#FFF5F5', borderRadius: 24, borderWidth: 0,
    paddingHorizontal: 16, paddingVertical: 11,
    color: '#2A151B', fontSize: 13, maxHeight: 100, minHeight: 44,
  },
  sendBtn: { backgroundColor: '#B5233D', borderRadius: 22, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.45 },
  sendText: { color: '#fff', fontWeight: '800' },
  attachmentDraft: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 18, paddingVertical: 7, backgroundColor: '#fff' },
  attachmentDraftName: { flex: 1, color: '#2A151B', fontSize: 12, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  emptyIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: '#4B1822', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  emptyTitle: { color: '#2A151B', fontSize: 17, fontWeight: '800' },
  emptySub: { color: '#826D72', fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 5 },
  attachmentMessage: { minWidth: 210, maxWidth: '100%', marginTop: 5, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.14)', flexDirection: 'row', alignItems: 'center', gap: 9 },
  attachmentGroup: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  attachmentOptionsButton: { width: 32, height: 38, alignItems: 'center', justifyContent: 'center' },
  attachmentName: { color: '#2A151B', fontSize: 12, fontWeight: '700' },
  attachmentHint: { color: '#826D72', fontSize: 10, marginTop: 2 },
  imageAttachment: { marginTop: 5, borderRadius: 14, overflow: 'hidden' },
  messageImage: { width: 230, height: 190, backgroundColor: '#FBE3E8' },
  imageLoading: { width: 230, height: 120, marginTop: 5, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FBE3E8' },
  imageViewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', alignItems: 'center', justifyContent: 'center' },
  imageViewerClose: { position: 'absolute', top: 44, right: 18, zIndex: 2, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  imageGestureArea: { width: '100%', height: '82%', alignItems: 'center', justifyContent: 'center' },
  imageViewerPhoto: { width: '100%', height: '100%' },
  zoomControls: { position: 'absolute', bottom: 54, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 6, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.16)' },
  zoomButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  zoomReset: { minWidth: 48, alignItems: 'center' },
  zoomResetText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  imageViewerName: { position: 'absolute', bottom: 8, color: '#fff', fontSize: 12, opacity: 0.8 },
  attachmentMenuOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(28,12,17,0.35)' },
  attachmentMenuScrim: { ...StyleSheet.absoluteFillObject },
  attachmentMenuSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 28 },
  sheetHandle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: '#E7DADD', marginBottom: 16 },
  attachmentMenuTitle: { color: '#2A151B', fontSize: 18, fontWeight: '900' },
  attachmentMenuName: { color: '#826D72', fontSize: 12, marginTop: 4, marginBottom: 12, lineHeight: 17 },
  attachmentMenuAction: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F0DADD' },
  attachmentMenuIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#FBE8EC', alignItems: 'center', justifyContent: 'center' },
  attachmentMenuActionTitle: { color: '#2A151B', fontSize: 13, fontWeight: '800' },
  attachmentMenuActionSub: { color: '#9A858A', fontSize: 11, marginTop: 2 },
  attachmentMenuCancel: { height: 44, marginTop: 10, borderRadius: 14, backgroundColor: '#FFF5F5', alignItems: 'center', justifyContent: 'center' },
  attachmentMenuCancelText: { color: '#6F5B60', fontSize: 13, fontWeight: '800' },
  historyScreen: { flex: 1, backgroundColor: '#FFF8F8', paddingTop: Platform.OS === 'android' ? 18 : 48 },
  historyHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16 },
  historyEyebrow: { color: '#826D72', fontSize: 11, fontWeight: '700' },
  historyTitle: { color: '#2A151B', fontSize: 22, fontWeight: '900', marginTop: 2 },
  historyClose: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  historySearchBox: { height: 46, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#fff', borderRadius: 15, marginHorizontal: 16, paddingHorizontal: 13, borderWidth: 1, borderColor: '#F0DADD' },
  historySearchInput: { flex: 1, color: '#2A151B', fontSize: 13, paddingVertical: 0 },
  historyList: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24 },
  historyResult: { backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8 },
  historyResultTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  historySender: { flex: 1, color: '#B5233D', fontSize: 11, fontWeight: '800' },
  historyTime: { color: '#9A858A', fontSize: 10 },
  historySnippet: { color: '#2A151B', fontSize: 13, marginTop: 5, lineHeight: 18 },
  historyEmpty: { color: '#826D72', textAlign: 'center', paddingTop: 40, fontSize: 13 },
});
