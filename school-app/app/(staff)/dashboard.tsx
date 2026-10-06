// @ts-nocheck
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import HeaderGradient from '../components/ui/HeaderGradient';
import api from '../../src/api';
import { useTheme } from '../../src/theme-context';

const ROLE_LABELS = { staff: 'Staff' };
const POSITION_LABELS = {
  librarian: 'Librarian',
  property_custodian: 'Property Custodian',
};

const CONDITION_OPTIONS = [
  { value: 'new', label: 'New', bg: '#E0F2FE', color: '#0369A1' },
  { value: 'good', label: 'Good', bg: '#DCFCE7', color: '#15803D' },
  { value: 'needs_repair', label: 'Repair', bg: '#FEF3C7', color: '#92400E' },
  { value: 'damaged', label: 'Damaged', bg: '#FEE2E2', color: '#B91C1C' },
  { value: 'lost', label: 'Lost', bg: '#F3F4F6', color: '#374151' },
];

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available', bg: '#ECFDF5', color: '#047857' },
  { value: 'assigned', label: 'Assigned', bg: '#EEF2FF', color: '#4338CA' },
  { value: 'maintenance', label: 'Maintenance', bg: '#FFF7ED', color: '#C2410C' },
  { value: 'retired', label: 'Retired', bg: '#F1F5F9', color: '#475569' },
];

const emptyAsset = {
  asset_tag: '',
  name: '',
  category: '',
  location: '',
  condition: 'good',
  status: 'available',
  assigned_to: '',
  notes: '',
};

const MARKET_CATEGORIES = [
  { value: 'books', label: 'Books', bg: '#E0F2FE', color: '#0369A1' },
  { value: 'uniforms', label: 'Uniforms', bg: '#EEF2FF', color: '#4338CA' },
  { value: 'electronics', label: 'Electronics', bg: '#F3E8FF', color: '#7C3AED' },
  { value: 'supplies', label: 'Supplies', bg: '#DCFCE7', color: '#15803D' },
  { value: 'other', label: 'Other', bg: '#F1F5F9', color: '#475569' },
];

const MARKET_CONDITIONS = [
  { value: 'new', label: 'New', bg: '#E0F2FE', color: '#0369A1' },
  { value: 'like_new', label: 'Like New', bg: '#ECFDF5', color: '#047857' },
  { value: 'good', label: 'Good', bg: '#DCFCE7', color: '#15803D' },
  { value: 'fair', label: 'Fair', bg: '#FEF3C7', color: '#92400E' },
];

const MARKET_STATUSES = [
  { value: 'available', label: 'Available', bg: '#ECFDF5', color: '#047857' },
  { value: 'reserved', label: 'Reserved', bg: '#FEF3C7', color: '#92400E' },
  { value: 'sold', label: 'Sold', bg: '#FEE2E2', color: '#B91C1C' },
];

const emptyMarketItem = {
  title: '',
  description: '',
  price: '',
  stock: '1',
  size_options: '',
  category: 'supplies',
  condition: 'new',
  status: 'available',
  location: '',
  accepts_cash: true,
  accepts_gcash: false,
  accepts_qrph: false,
  gcash_name: '',
  gcash_number: '',
  qrph_image_url: '',
};

// ── Receipt HTML generator ───────────────────────────────────────────────────
function buildReceiptHtml(order, item) {
  const date = new Date().toLocaleString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  const paymentMethod = String(order.payment_method || 'cash').toUpperCase();
  const total = Number(order.total_amount ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
  const unitPrice = Number(item?.price ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
  const qty = order.quantity ?? 1;
  const sizeLine = order.size ? `<tr><td>Size</td><td>${order.size}</td></tr>` : '';
  const refLine = order.gcash_reference ? `<tr><td>Reference No.</td><td>${order.gcash_reference}</td></tr>` : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; font-size: 13px; color: #1e293b; padding: 32px; max-width: 420px; margin: 0 auto; }
    .school { text-align: center; margin-bottom: 4px; }
    .school-name { font-size: 16px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; }
    .school-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
    .divider { border: none; border-top: 1px dashed #cbd5e1; margin: 14px 0; }
    .divider-solid { border: none; border-top: 2px solid #1e293b; margin: 14px 0; }
    .receipt-title { text-align: center; font-size: 13px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 2px; }
    .receipt-id { text-align: center; font-size: 11px; color: #64748b; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 4px 0; vertical-align: top; }
    td:last-child { text-align: right; font-weight: 700; }
    .section-label { font-size: 10px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px; }
    .item-name { font-weight: 900; font-size: 14px; }
    .total-row td { font-size: 15px; font-weight: 900; padding-top: 8px; }
    .paid-stamp { text-align: center; margin-top: 18px; }
    .paid-stamp span {
      display: inline-block;
      border: 3px solid #15803d;
      color: #15803d;
      font-size: 22px;
      font-weight: 900;
      letter-spacing: 4px;
      padding: 6px 20px;
      border-radius: 6px;
      transform: rotate(-8deg);
    }
    .footer { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 20px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="school">
    <div class="school-name">St. Cecilia's College</div>
    <div class="school-sub">Minglanilla, Cebu · School Marketplace</div>
  </div>

  <hr class="divider-solid"/>

  <div class="receipt-title">Official Receipt</div>
  <div class="receipt-id">Order #${order.id ?? '—'} &nbsp;·&nbsp; ${date}</div>

  <hr class="divider"/>

  <div class="section-label">Buyer</div>
  <table>
    <tr><td>Name</td><td>${order.buyer?.name ?? '—'}</td></tr>
    <tr><td>Email</td><td>${order.buyer?.email ?? '—'}</td></tr>
  </table>

  <hr class="divider"/>

  <div class="section-label">Item</div>
  <div class="item-name">${item?.title ?? '—'}</div>
  <table style="margin-top:8px">
    <tr><td>Unit Price</td><td>PHP ${unitPrice}</td></tr>
    <tr><td>Quantity</td><td>${qty}</td></tr>
    ${sizeLine}
  </table>

  <hr class="divider"/>

  <div class="section-label">Payment</div>
  <table>
    <tr><td>Method</td><td>${paymentMethod}</td></tr>
    ${refLine}
  </table>

  <hr class="divider"/>

  <table>
    <tr class="total-row"><td>TOTAL</td><td>PHP ${total}</td></tr>
  </table>

  <div class="paid-stamp"><span>PAID</span></div>

  <hr class="divider" style="margin-top:20px"/>
  <div class="footer">
    This receipt was issued by the Property Custodian<br/>
    via SchoolBuds · St. Cecilia's College – Cebu, Inc.
  </div>
</body>
</html>`;
}
// ────────────────────────────────────────────────────────────────────────────

export default function StaffDashboard() {
  const { theme } = useTheme();
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyAsset);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('assets');
  const [marketScope, setMarketScope] = useState('mine');
  const [marketItems, setMarketItems] = useState([]);
  const [allMarketItems, setAllMarketItems] = useState([]);
  const [marketOrders, setMarketOrders] = useState([]);
  const [marketModalOpen, setMarketModalOpen] = useState(false);
  const [marketEditing, setMarketEditing] = useState(null);
  const [marketForm, setMarketForm] = useState(emptyMarketItem);
  const [marketImages, setMarketImages] = useState([]);
  const [marketSaving, setMarketSaving] = useState(false);

  // Receipt modal state
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [receiptItem, setReceiptItem] = useState(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [confirmingPaid, setConfirmingPaid] = useState(false);
  const [printingReceipt, setPrintingReceipt] = useState(false);

  const isCustodian = user?.position === 'property_custodian';

  const load = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem('user');
      const parsed = stored ? JSON.parse(stored) : null;
      if (parsed) setUser(parsed);

      if (parsed?.position === 'property_custodian') {
        const [assetRes, marketRes, allMarketRes, salesRes] = await Promise.all([
          api.get('/property-custodian/dashboard'),
          api.get('/marketplace/my-items'),
          api.get('/marketplace', { params: { include_all: 1 } }),
          api.get('/marketplace/sales'),
        ]);
        setData(assetRes.data);
        setMarketItems(marketRes.data || []);
        setAllMarketItems(allMarketRes.data || []);
        setMarketOrders(salesRes.data || []);
      } else {
        const res = await api.get('/notifications');
        setData(res.data);
      }
    } catch (e) {
      console.log('Staff dashboard error:', e.message);
      Alert.alert('Could not load portal', e.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredAssets = useMemo(() => {
    const assets = data?.assets ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return assets;
    return assets.filter(asset => [
      asset.asset_tag, asset.name, asset.category,
      asset.location, asset.assigned_to, asset.status, asset.condition,
    ].some(value => String(value || '').toLowerCase().includes(term)));
  }, [data, search]);

  const filteredMarketItems = useMemo(() => {
    const source = marketScope === 'mine' ? marketItems : allMarketItems;
    const term = search.trim().toLowerCase();
    if (!term) return source;
    return source.filter(item => [
      item.title, item.description, item.category,
      item.location, item.status, item.stock,
    ].some(value => String(value || '').toLowerCase().includes(term)));
  }, [allMarketItems, marketItems, marketScope, search]);

  const marketOrdersByItem = useMemo(() => {
    return marketOrders.reduce((acc, order) => {
      const itemId = order.marketplace_item_id || order.item?.id;
      if (!itemId) return acc;
      acc[itemId] = [...(acc[itemId] || []), order];
      return acc;
    }, {});
  }, [marketOrders]);

  const openCreate = () => { setEditing(null); setForm(emptyAsset); setModalOpen(true); };

  const openEdit = (asset) => {
    setEditing(asset);
    setForm({
      asset_tag: asset.asset_tag || '',
      name: asset.name || '',
      category: asset.category || '',
      location: asset.location || '',
      condition: asset.condition || 'good',
      status: asset.status || 'available',
      assigned_to: asset.assigned_to || '',
      notes: asset.notes || '',
    });
    setModalOpen(true);
  };

  const saveAsset = async () => {
    if (!form.asset_tag.trim() || !form.name.trim()) {
      Alert.alert('Missing details', 'Asset tag and name are required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        asset_tag: form.asset_tag.trim(),
        name: form.name.trim(),
        category: form.category.trim() || null,
        location: form.location.trim() || null,
        assigned_to: form.assigned_to.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (editing) {
        await api.put(`/property-custodian/assets/${editing.id}`, payload);
      } else {
        await api.post('/property-custodian/assets', payload);
      }
      setModalOpen(false);
      setEditing(null);
      setForm(emptyAsset);
      await load();
    } catch (e) {
      const message = e.response?.data?.message || flattenErrors(e.response?.data?.errors) || 'Please check the asset details.';
      Alert.alert('Could not save asset', message);
    } finally {
      setSaving(false);
    }
  };

  const deleteAsset = (asset) => {
    Alert.alert('Delete asset', `Delete ${asset.asset_tag} - ${asset.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/property-custodian/assets/${asset.id}`);
            await load();
          } catch (e) {
            Alert.alert('Could not delete asset', e.response?.data?.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  const openMarketCreate = () => {
    setMarketEditing(null);
    setMarketForm(emptyMarketItem);
    setMarketImages([]);
    setMarketModalOpen(true);
  };

  const openMarketEdit = (item) => {
    setMarketEditing(item);
    setMarketForm({
      title: item.title || '',
      description: item.description || '',
      price: String(item.price ?? ''),
      stock: String(item.stock ?? '1'),
      size_options: Array.isArray(item.size_options) ? item.size_options.filter(Boolean).join(', ') : '',
      category: item.category || 'supplies',
      condition: item.condition || 'new',
      status: item.status || 'available',
      location: item.location || '',
      accepts_cash: !!item.accepts_cash,
      accepts_gcash: !!item.accepts_gcash,
      accepts_qrph: !!item.accepts_qrph,
      gcash_name: item.gcash_name || '',
      gcash_number: item.gcash_number || '',
      qrph_image_url: item.qrph_image_url || '',
    });
    setMarketImages([]);
    setMarketModalOpen(true);
  };

  const pickMarketImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow photo access to upload item photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 3,
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.length) {
      setMarketImages(result.assets.slice(0, 3));
    }
  };

  const saveMarketItem = async () => {
    if (!marketForm.title.trim() || !marketForm.description.trim() || !marketForm.price || !marketForm.stock) {
      Alert.alert('Missing details', 'Title, description, price, and stock are required.');
      return;
    }
    if (!marketForm.accepts_cash && !marketForm.accepts_gcash && !marketForm.accepts_qrph) {
      Alert.alert('Payment required', 'Select at least one payment type.');
      return;
    }
    if (marketForm.accepts_gcash && (!marketForm.gcash_name.trim() || !marketForm.gcash_number.trim())) {
      Alert.alert('GCash details required', 'Enter the GCash account name and number.');
      return;
    }
    if (marketForm.accepts_qrph && !marketForm.qrph_image_url.trim()) {
      Alert.alert('QRPH required', 'Enter the QRPH image URL for QRPH payments.');
      return;
    }
    setMarketSaving(true);
    try {
      const payload = new FormData();
      Object.entries({
        title: marketForm.title.trim(),
        description: marketForm.description.trim(),
        price: String(Number(marketForm.price)),
        stock: String(parseInt(marketForm.stock, 10)),
        size_options: marketForm.category === 'uniforms' ? marketForm.size_options : '',
        category: marketForm.category,
        condition: marketForm.condition,
        status: marketForm.status,
        location: marketForm.location.trim() || '',
        accepts_cash: marketForm.accepts_cash ? '1' : '0',
        accepts_gcash: marketForm.accepts_gcash ? '1' : '0',
        accepts_qrph: marketForm.accepts_qrph ? '1' : '0',
        gcash_name: marketForm.accepts_gcash ? marketForm.gcash_name.trim() : '',
        gcash_number: marketForm.accepts_gcash ? marketForm.gcash_number.trim() : '',
        qrph_image_url: marketForm.accepts_qrph ? marketForm.qrph_image_url.trim() : '',
      }).forEach(([key, value]) => payload.append(key, value));

      marketImages.forEach((img, idx) => {
        payload.append('item_images[]', {
          uri: img.uri,
          name: img.fileName || `market-item-${idx}.jpg`,
          type: img.mimeType || 'image/jpeg',
        });
      });

      if (marketEditing) {
        payload.append('_method', 'PUT');
        await api.post(`/marketplace/${marketEditing.id}`, payload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await api.post('/marketplace', payload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      setMarketModalOpen(false);
      setMarketEditing(null);
      setMarketForm(emptyMarketItem);
      setMarketImages([]);
      await load();
    } catch (e) {
      const message = e.response?.data?.message || flattenErrors(e.response?.data?.errors) || 'Please check the marketplace item details.';
      Alert.alert('Could not save item', message);
    } finally {
      setMarketSaving(false);
    }
  };

  const deleteMarketItem = (item) => {
    Alert.alert('Remove marketplace item', `Remove ${item.title}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/marketplace/${item.id}`);
            await load();
          } catch (e) {
            Alert.alert('Could not remove item', e.response?.data?.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  // Opens the receipt modal instead of a plain Alert
  const openReceiptModal = (order, item) => {
    setReceiptOrder(order);
    setReceiptItem(item);
    setReceiptModalOpen(true);
  };

  const confirmMarkPaid = async () => {
    if (!receiptOrder) return;
    setConfirmingPaid(true);
    try {
      await api.post(`/marketplace/orders/${receiptOrder.id}/mark-paid`);
      setReceiptModalOpen(false);
      await load();
    } catch (e) {
      Alert.alert('Could not confirm payment', e.response?.data?.message || 'Please try again.');
    } finally {
      setConfirmingPaid(false);
    }
  };

  const printReceipt = async () => {
    if (!receiptOrder) return;
    setPrintingReceipt(true);
    try {
      const html = buildReceiptHtml(receiptOrder, receiptItem);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Receipt – Order #${receiptOrder.id}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        await Print.printAsync({ uri });
      }
    } catch (e) {
      Alert.alert('Could not print receipt', e.message || 'Please try again.');
    } finally {
      setPrintingReceipt(false);
    }
  };

  const roleLabel = POSITION_LABELS[user?.position] ?? ROLE_LABELS[user?.role] ?? 'Staff';

  if (!isCustodian) {
    return (
      <StaffNotifications
        data={data}
        loading={loading}
        onRefresh={() => { setRefreshing(true); load(); }}
        refreshing={refreshing}
        roleLabel={roleLabel}
        theme={theme}
        user={user}
      />
    );
  }

  const counts = data?.counts || {};
  const marketCounts = {
    total: marketItems.length,
    available: marketItems.filter(item => item.status === 'available').length,
    lowStock: marketItems.filter(item => (item.stock ?? 0) <= 5 && item.status === 'available').length,
    buyers: marketOrders.length,
  };

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <HeaderGradient
        title="Property Custodian"
        subtitle={user?.name ?? 'Inventory and custody records'}
        initials="PC"
        stats={[
          { label: 'Assets', value: counts.total ?? 0, accent: '#93C5FD' },
          { label: 'Market', value: marketCounts.total, accent: '#A7F3D0' },
          { label: 'Buyers', value: marketCounts.buyers, accent: '#FCA5A5' },
        ]}
      />

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={theme.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          <View style={[s.segment, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {[['assets', 'Assets'], ['market', 'Marketplace']].map(([value, label]) => (
              <TouchableOpacity
                key={value}
                style={[s.segmentBtn, activeTab === value && { backgroundColor: theme.primary }]}
                onPress={() => setActiveTab(value)}
              >
                <Text style={[s.segmentText, { color: activeTab === value ? '#fff' : theme.textSub }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.actionRow}>
            <View style={[s.searchBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Feather name="search" size={17} color={theme.textSub} />
              <TextInput
                style={[s.searchInput, { color: theme.text }]}
                placeholder={activeTab === 'assets' ? 'Search asset, tag, room' : 'Search item, category, stock'}
                placeholderTextColor={theme.textMuted}
                value={search}
                onChangeText={setSearch}
              />
            </View>
            <TouchableOpacity
              style={[s.addBtn, { backgroundColor: theme.primary }]}
              onPress={activeTab === 'assets' ? openCreate : openMarketCreate}
            >
              <Feather name="plus" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {activeTab === 'assets' ? (
            <AssetList assets={filteredAssets} counts={counts} deleteAsset={deleteAsset} openEdit={openEdit} theme={theme} />
          ) : (
            <MarketplaceList
              counts={marketCounts}
              items={filteredMarketItems}
              ordersByItem={marketOrdersByItem}
              currentUserId={user?.id}
              scope={marketScope}
              setScope={setMarketScope}
              deleteItem={deleteMarketItem}
              openReceiptModal={openReceiptModal}
              openEdit={openMarketEdit}
              theme={theme}
            />
          )}
        </ScrollView>
      )}

      <AssetModal
        form={form} setForm={setForm} visible={modalOpen}
        editing={editing} saving={saving}
        onClose={() => setModalOpen(false)} onSave={saveAsset} theme={theme}
      />
      <MarketModal
        form={marketForm} setForm={setMarketForm} visible={marketModalOpen}
        editing={marketEditing} saving={marketSaving}
        images={marketImages} onPickImages={pickMarketImages}
        onClose={() => setMarketModalOpen(false)} onSave={saveMarketItem} theme={theme}
      />

      {/* ── Receipt / Mark as Paid modal ── */}
      <ReceiptModal
        visible={receiptModalOpen}
        order={receiptOrder}
        item={receiptItem}
        confirming={confirmingPaid}
        printing={printingReceipt}
        onConfirm={confirmMarkPaid}
        onPrint={printReceipt}
        onClose={() => setReceiptModalOpen(false)}
        theme={theme}
      />
    </View>
  );
}

// ── Receipt Modal ─────────────────────────────────────────────────────────────
function ReceiptModal({ visible, order, item, confirming, printing, onConfirm, onPrint, onClose, theme }) {
  if (!order) return null;

  const orderStatus = orderStatusMeta(order.status);
  const alreadyPaid = ['paid', 'completed'].includes(order.status);
  const date = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  const paymentMethod = String(order.payment_method || 'cash').toUpperCase();
  const total = Number(order.total_amount ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
  const unitPrice = Number(item?.price ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={s.modalOverlay}>
        <View style={[s.receiptSheet, { backgroundColor: theme.card }]}>

          {/* Header */}
          <View style={[s.receiptHeader, { borderBottomColor: theme.border }]}>
            <View>
              <Text style={[s.receiptTitle, { color: theme.text }]}>Order Receipt</Text>
              <Text style={[s.receiptSub, { color: theme.textSub }]}>Order #{order.id ?? '—'} · {date}</Text>
            </View>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Feather name="x" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.receiptBody}>

            {/* School name */}
            <View style={[s.receiptSchool, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              <Feather name="book-open" size={14} color={theme.textSub} />
              <Text style={[s.receiptSchoolText, { color: theme.textSub }]}>St. Cecilia&apos;s College – Cebu, Inc.</Text>
            </View>

            {/* Status badge */}
            <View style={[s.orderBadge, { backgroundColor: orderStatus.bg, alignSelf: 'flex-start', marginBottom: 16 }]}>
              <Text style={[s.orderBadgeText, { color: orderStatus.color }]}>{orderStatus.label}</Text>
            </View>

            {/* Buyer section */}
            <Text style={[s.receiptSection, { color: theme.textMuted }]}>BUYER</Text>
            <View style={[s.receiptCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              <ReceiptRow label="Name" value={order.buyer?.name ?? '—'} theme={theme} />
              <ReceiptRow label="Email" value={order.buyer?.email ?? '—'} theme={theme} last />
            </View>

            {/* Item section */}
            <Text style={[s.receiptSection, { color: theme.textMuted }]}>ITEM</Text>
            <View style={[s.receiptCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              <ReceiptRow label="Item" value={item?.title ?? '—'} theme={theme} />
              <ReceiptRow label="Unit Price" value={`PHP ${unitPrice}`} theme={theme} />
              <ReceiptRow label="Quantity" value={String(order.quantity ?? 1)} theme={theme} last />
            </View>

            {/* Payment section */}
            <Text style={[s.receiptSection, { color: theme.textMuted }]}>PAYMENT</Text>
            <View style={[s.receiptCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              <ReceiptRow label="Method" value={paymentMethod} theme={theme} />
              {!!order.gcash_reference && (
                <ReceiptRow label="Reference" value={order.gcash_reference} theme={theme} />
              )}
              <ReceiptRow label="Total" value={`PHP ${total}`} theme={theme} highlight last />
            </View>

            {/* Paid stamp if already paid */}
            {alreadyPaid && (
              <View style={s.paidStamp}>
                <View style={s.paidStampInner}>
                  <Feather name="check-circle" size={18} color="#15803D" />
                  <Text style={s.paidStampText}>PAID</Text>
                </View>
              </View>
            )}

            {/* Action buttons */}
            <View style={s.receiptActions}>
              <TouchableOpacity
                style={[s.printBtn, { borderColor: theme.border }, printing && { opacity: 0.6 }]}
                onPress={onPrint}
                disabled={printing}
              >
                {printing
                  ? <ActivityIndicator size="small" color={theme.text} />
                  : <><Feather name="printer" size={15} color={theme.text} /><Text style={[s.printBtnText, { color: theme.text }]}>Print Receipt</Text></>
                }
              </TouchableOpacity>

              {!alreadyPaid && (
                <TouchableOpacity
                  style={[s.confirmPaidBtn, { backgroundColor: theme.primary }, confirming && { opacity: 0.6 }]}
                  onPress={onConfirm}
                  disabled={confirming}
                >
                  {confirming
                    ? <ActivityIndicator color="#fff" />
                    : <><Feather name="check" size={15} color="#fff" /><Text style={s.confirmPaidText}>Confirm Payment</Text></>
                  }
                </TouchableOpacity>
              )}
            </View>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ReceiptRow({ label, value, theme, highlight, last }) {
  return (
    <View style={[s.receiptRow, !last && { borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }]}>
      <Text style={[s.receiptRowLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[s.receiptRowValue, { color: highlight ? theme.primary : theme.text }, highlight && { fontSize: 15 }]}>
        {value}
      </Text>
    </View>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

function AssetList({ assets, counts, deleteAsset, openEdit, theme }) {
  return (
    <>
      <View style={s.statsGrid}>
        <Stat label="Available" value={counts.available ?? 0} bg="#ECFDF5" color="#047857" theme={theme} />
        <Stat label="Maintenance" value={counts.maintenance ?? 0} bg="#FFF7ED" color="#C2410C" theme={theme} />
      </View>
      {assets.length === 0 ? (
        <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[s.title, { color: theme.text }]}>No assets found</Text>
          <Text style={[s.sub, { color: theme.textSub }]}>Add school property records to track location, custody, and condition.</Text>
        </View>
      ) : assets.map(asset => {
        const status = metaFor(STATUS_OPTIONS, asset.status);
        const condition = metaFor(CONDITION_OPTIONS, asset.condition);
        return (
          <View key={asset.id} style={[s.assetCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={s.assetTop}>
              <View style={{ flex: 1 }}>
                <Text style={[s.assetTag, { color: theme.textSub }]}>{asset.asset_tag}</Text>
                <Text style={[s.assetName, { color: theme.text }]}>{asset.name}</Text>
              </View>
              <TouchableOpacity style={s.iconBtn} onPress={() => openEdit(asset)}>
                <Feather name="edit-2" size={16} color={theme.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={s.iconBtn} onPress={() => deleteAsset(asset)}>
                <Feather name="trash-2" size={16} color="#B91C1C" />
              </TouchableOpacity>
            </View>
            <View style={s.badgeRow}>
              <Badge item={status} />
              <Badge item={condition} />
            </View>
            <Text style={[s.assetMeta, { color: theme.textSub }]}>
              {[asset.category, asset.location, asset.assigned_to ? `Assigned to ${asset.assigned_to}` : null].filter(Boolean).join(' | ') || 'No location or assignment yet'}
            </Text>
            {!!asset.notes && <Text style={[s.notes, { color: theme.textMuted }]}>{asset.notes}</Text>}
          </View>
        );
      })}
    </>
  );
}

function MarketplaceList({ counts, currentUserId, items, ordersByItem, scope, setScope, deleteItem, openReceiptModal, openEdit, theme }) {
  const { width } = useWindowDimensions();
  const marketColumns = Platform.OS === 'web' && width >= 1180 ? 4 : Platform.OS === 'web' && width >= 900 ? 3 : Platform.OS === 'web' && width >= 680 ? 2 : 1;
  const marketCardWidth = marketColumns === 1 ? '100%' : 220;

  return (
    <>
      <View style={[s.segment, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {[['mine', 'My Posts'], ['all', 'All Posts']].map(([value, label]) => (
          <TouchableOpacity
            key={value}
            style={[s.segmentBtn, scope === value && { backgroundColor: theme.primary }]}
            onPress={() => setScope(value)}
          >
            <Text style={[s.segmentText, { color: scope === value ? '#fff' : theme.textSub }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.statsGrid}>
        <Stat label="Available" value={counts.available} bg="#ECFDF5" color="#047857" theme={theme} />
        <Stat label="Buyers" value={counts.buyers} bg="#EEF2FF" color="#4338CA" theme={theme} />
      </View>

      {items.length === 0 ? (
        <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[s.title, { color: theme.text }]}>No marketplace items</Text>
          <Text style={[s.sub, { color: theme.textSub }]}>Post uniforms, books, supplies, and school-owned items, then monitor stock here.</Text>
        </View>
      ) : (
        <View style={s.marketGrid}>
          {items.map(item => {
        const status = metaFor(MARKET_STATUSES, item.status);
        const category = metaFor(MARKET_CATEGORIES, item.category);
        const isMine = item.user_id === currentUserId;
        const orders = ordersByItem[item.id] || [];
        return (
          <View key={item.id} style={[s.marketCard, { width: marketCardWidth, backgroundColor: theme.card, borderColor: theme.border }]}>
            {!!item.image_urls?.[0] && (
                  <Image source={{ uri: item.image_urls[0] }} style={s.marketImage} resizeMode="contain" />
            )}
            <View style={s.assetTop}>
              <View style={{ flex: 1 }}>
                <Text style={[s.assetTag, { color: theme.textSub }]}>PHP {Number(item.price ?? 0).toLocaleString()}</Text>
                <Text style={[s.assetName, { color: theme.text }]} numberOfLines={2}>{item.title}</Text>
              </View>
              {isMine && (
                <>
                  <TouchableOpacity style={s.iconBtn} onPress={() => openEdit(item)}>
                    <Feather name="edit-2" size={16} color={theme.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={s.iconBtn} onPress={() => deleteItem(item)}>
                    <Feather name="trash-2" size={16} color="#B91C1C" />
                  </TouchableOpacity>
                </>
              )}
            </View>
            <View style={s.badgeRow}>
              <Badge item={status} />
              <Badge item={category} />
              <Badge item={{ label: `${item.stock ?? 0} in stock`, bg: (item.stock ?? 0) <= 5 ? '#FEF3C7' : '#F1F5F9', color: (item.stock ?? 0) <= 5 ? '#92400E' : '#475569' }} />
            </View>
            {!!item.size_options?.length && (
              <Text style={[s.notes, { color: theme.textMuted }]} numberOfLines={1}>Sizes: {item.size_options.join(', ')}</Text>
            )}
            <Text style={[s.assetMeta, { color: theme.textSub }]} numberOfLines={3}>{item.description}</Text>
            {scope === 'all' && <Text style={[s.notes, { color: theme.textMuted }]} numberOfLines={1}>Posted by {item.seller?.name ?? 'School Marketplace'}</Text>}
            {!!item.location && <Text style={[s.notes, { color: theme.textMuted }]} numberOfLines={1}>Pickup: {item.location}</Text>}
            {isMine && (
              <View style={[s.buyerPanel, { borderColor: theme.border, backgroundColor: theme.bg }]}>
                <Text style={[s.buyerTitle, { color: theme.text }]}>Buyers / Reservations</Text>
                {orders.length === 0 ? (
                  <Text style={[s.buyerEmpty, { color: theme.textMuted }]}>No buyers yet for this item.</Text>
                ) : orders.map(order => {
                  const orderStatus = orderStatusMeta(order.status);
                  const canMarkPaid = ['reserved', 'pending_verification'].includes(order.status);
                  return (
                    <View key={order.id} style={[s.buyerRow, { borderTopColor: theme.border }]}>
                      <Text style={[s.buyerName, { color: theme.text }]}>{order.buyer?.name ?? 'Buyer'}</Text>
                      <Text style={[s.buyerMeta, { color: theme.textSub }]}>{order.buyer?.email ?? 'No email'}</Text>
                      {!!order.size && (
                        <Text style={[s.buyerMeta, { color: theme.textSub }]}>Size: {order.size}</Text>
                      )}
                      <Text style={[s.buyerMeta, { color: theme.textSub }]}>
                        Qty {order.quantity ?? 1} · {String(order.payment_method || 'cash').toUpperCase()} · PHP {Number(order.total_amount ?? 0).toLocaleString()}
                      </Text>
                      {!!order.gcash_reference && (
                        <Text style={[s.buyerMeta, { color: theme.textMuted }]}>Ref: {order.gcash_reference}</Text>
                      )}
                      <View style={s.buyerFooter}>
                        <View style={[s.orderBadge, { backgroundColor: orderStatus.bg }]}>
                          <Text style={[s.orderBadgeText, { color: orderStatus.color }]}>{orderStatus.label}</Text>
                        </View>
                        {canMarkPaid && (
                          <TouchableOpacity
                            style={[s.markPaidBtn, { borderColor: theme.primary }]}
                            onPress={() => openReceiptModal(order, item)}
                          >
                            <Text style={[s.markPaidText, { color: theme.primary }]}>Mark as Paid</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
          })}
        </View>
      )}
    </>
  );
}

function StaffNotifications({ data, loading, onRefresh, refreshing, roleLabel, theme, user }) {
  const notifications = data?.notifications ?? [];
  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <HeaderGradient
        title={`${roleLabel} Portal`}
        subtitle={user?.name ?? 'School updates and account notifications'}
        initials="SP"
        stats={[
          { label: 'Unread', value: data?.unread_count ?? 0, accent: '#FDE68A' },
          { label: 'Updates', value: notifications.length, accent: '#A7F3D0' },
        ]}
      />
      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={theme.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {notifications.length === 0 ? (
            <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[s.title, { color: theme.text }]}>No updates yet</Text>
              <Text style={[s.sub, { color: theme.textSub }]}>School-wide announcements and role notifications will appear here.</Text>
            </View>
          ) : notifications.map(item => (
            <View key={item.id} style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[s.title, { color: theme.text }]}>{item.title}</Text>
              <Text style={[s.sub, { color: theme.textSub }]}>{item.body || item.type}</Text>
              <Text style={[s.date, { color: theme.textMuted }]}>{new Date(item.created_at).toLocaleString()}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function AssetModal({ form, setForm, visible, editing, saving, onClose, onSave, theme }) {
  const setField = (key, value) => setForm(current => ({ ...current, [key]: value }));
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.modalCard, { backgroundColor: theme.card }]}>
          <View style={[s.modalHeader, { borderBottomColor: theme.border }]}>
            <View>
              <Text style={[s.modalTitle, { color: theme.text }]}>{editing ? 'Edit asset' : 'New asset'}</Text>
              <Text style={[s.modalSub, { color: theme.textSub }]}>Track school property custody and condition.</Text>
            </View>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Feather name="x" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.form}>
            <Field label="Asset Tag" value={form.asset_tag} onChangeText={value => setField('asset_tag', value)} theme={theme} placeholder="PC-2026-001" />
            <Field label="Item Name" value={form.name} onChangeText={value => setField('name', value)} theme={theme} placeholder="Projector, desk, laptop" />
            <Field label="Category" value={form.category} onChangeText={value => setField('category', value)} theme={theme} placeholder="ICT, furniture, laboratory" />
            <Field label="Location" value={form.location} onChangeText={value => setField('location', value)} theme={theme} placeholder="Room 204" />
            <Field label="Assigned To" value={form.assigned_to} onChangeText={value => setField('assigned_to', value)} theme={theme} placeholder="Office, faculty, or student" />
            <Text style={[s.label, { color: theme.textSub }]}>Status</Text>
            <ChipPicker items={STATUS_OPTIONS} value={form.status} onChange={value => setField('status', value)} />
            <Text style={[s.label, { color: theme.textSub }]}>Condition</Text>
            <ChipPicker items={CONDITION_OPTIONS} value={form.condition} onChange={value => setField('condition', value)} />
            <Field label="Notes" value={form.notes} onChangeText={value => setField('notes', value)} theme={theme} placeholder="Serial number, issue details, remarks" multiline />
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: theme.primary }, saving && { opacity: 0.7 }]} onPress={onSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>{editing ? 'Save changes' : 'Add asset'}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function MarketModal({ form, setForm, visible, editing, saving, images, onPickImages, onClose, onSave, theme }) {
  const setField = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const togglePayment = (key) => setForm(current => ({ ...current, [key]: !current[key] }));
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.modalCard, { backgroundColor: theme.card }]}>
          <View style={[s.modalHeader, { borderBottomColor: theme.border }]}>
            <View>
              <Text style={[s.modalTitle, { color: theme.text }]}>{editing ? 'Edit marketplace item' : 'Post marketplace item'}</Text>
              <Text style={[s.modalSub, { color: theme.textSub }]}>Publish school supplies and monitor stock status.</Text>
            </View>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Feather name="x" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.form}>
            <Field label="Item Name" value={form.title} onChangeText={value => setField('title', value)} theme={theme} placeholder="School uniform, workbook, ID lace" />
            <Field label="Description" value={form.description} onChangeText={value => setField('description', value)} theme={theme} placeholder="Details buyers should know" multiline />
            <View style={s.twoCol}>
              <View style={s.col}>
                <Field label="Price" value={form.price} onChangeText={value => setField('price', value.replace(/[^0-9.]/g, ''))} theme={theme} placeholder="0" keyboardType="decimal-pad" />
              </View>
              <View style={s.col}>
                <Field label="Stock" value={form.stock} onChangeText={value => setField('stock', value.replace(/[^0-9]/g, ''))} theme={theme} placeholder="1" keyboardType="number-pad" />
              </View>
            </View>
            <Field label="Pickup Location" value={form.location} onChangeText={value => setField('location', value)} theme={theme} placeholder="Supply office, cashier, room" />
            <Text style={[s.label, { color: theme.textSub }]}>Item Photos</Text>
            <TouchableOpacity style={[s.uploadBtn, { borderColor: theme.border, backgroundColor: theme.bg }]} onPress={onPickImages}>
              <Feather name="image" size={18} color={theme.primary} />
              <Text style={[s.uploadText, { color: theme.text }]}>
                {images.length ? `${images.length} selected - tap to replace` : editing?.image_urls?.length ? `${editing.image_urls.length} existing - tap to replace` : 'Add up to 3 photos'}
              </Text>
            </TouchableOpacity>
            {images.length > 0 ? (
              <View style={s.previewRow}>
                {images.map((img, idx) => <Image key={`${img.uri}-${idx}`} source={{ uri: img.uri }} style={s.previewImage} resizeMode="cover" />)}
              </View>
            ) : editing?.image_urls?.length ? (
              <View style={s.previewRow}>
                {editing.image_urls.map((url, idx) => <Image key={`${url}-${idx}`} source={{ uri: url }} style={s.previewImage} resizeMode="cover" />)}
              </View>
            ) : null}
            <Text style={[s.label, { color: theme.textSub }]}>Category</Text>
            <ChipPicker items={MARKET_CATEGORIES} value={form.category} onChange={value => setField('category', value)} />
            {form.category === 'uniforms' && (
              <Field
                label="Uniform Sizes"
                value={form.size_options}
                onChangeText={value => setField('size_options', value)}
                theme={theme}
                placeholder="XS, S, M, L, XL"
              />
            )}
            <Text style={[s.label, { color: theme.textSub }]}>Condition</Text>
            <ChipPicker items={MARKET_CONDITIONS} value={form.condition} onChange={value => setField('condition', value)} />
            <Text style={[s.label, { color: theme.textSub }]}>Payment Types</Text>
            <View style={s.chips}>
              {[['accepts_cash', 'Cash'], ['accepts_gcash', 'GCash'], ['accepts_qrph', 'QRPH']].map(([key, label]) => (
                <TouchableOpacity key={key} style={[s.chip, form[key] && { backgroundColor: '#ECFDF5', borderColor: '#047857' }]} onPress={() => togglePayment(key)}>
                  <Text style={[s.chipText, form[key] && { color: '#047857' }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {form.accepts_gcash && (
              <>
                <Field label="GCash Account Name" value={form.gcash_name} onChangeText={value => setField('gcash_name', value)} theme={theme} placeholder="School Cashier" />
                <Field label="GCash Number" value={form.gcash_number} onChangeText={value => setField('gcash_number', value)} theme={theme} placeholder="09XXXXXXXXX" keyboardType="phone-pad" />
              </>
            )}
            {form.accepts_qrph && (
              <Field label="QRPH Image URL" value={form.qrph_image_url} onChangeText={value => setField('qrph_image_url', value)} theme={theme} placeholder="https://..." />
            )}
            {!!editing && (
              <>
                <Text style={[s.label, { color: theme.textSub }]}>Marketplace Status</Text>
                <ChipPicker items={MARKET_STATUSES} value={form.status} onChange={value => setField('status', value)} />
              </>
            )}
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: theme.primary }, saving && { opacity: 0.7 }]} onPress={onSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>{editing ? 'Save item' : 'Post item'}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, theme, ...props }) {
  return (
    <>
      <Text style={[s.label, { color: theme.textSub }]}>{label}</Text>
      <TextInput
        style={[s.input, props.multiline && s.textarea, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
        placeholderTextColor={theme.textMuted}
        {...props}
      />
    </>
  );
}

function ChipPicker({ items, value, onChange }) {
  return (
    <View style={s.chips}>
      {items.map(item => (
        <TouchableOpacity key={item.value} style={[s.chip, value === item.value && { backgroundColor: item.bg, borderColor: item.color }]} onPress={() => onChange(item.value)}>
          <Text style={[s.chipText, value === item.value && { color: item.color }]}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Stat({ label, value, bg, color, theme }) {
  return (
    <View style={[s.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={[s.statIcon, { backgroundColor: bg }]}>
        <Text style={[s.statIconText, { color }]}>{label.slice(0, 2).toUpperCase()}</Text>
      </View>
      <Text style={[s.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[s.statLabel, { color: theme.textSub }]}>{label}</Text>
    </View>
  );
}

function Badge({ item }) {
  return (
    <View style={[s.badge, { backgroundColor: item.bg }]}>
      <Text style={[s.badgeText, { color: item.color }]}>{item.label}</Text>
    </View>
  );
}

function metaFor(items, value) {
  return items.find(item => item.value === value) || { label: value || 'Unknown', bg: '#F1F5F9', color: '#475569' };
}

function orderStatusMeta(status) {
  const map = {
    reserved: { label: 'Reserved', bg: '#FEF3C7', color: '#92400E' },
    pending_verification: { label: 'Pending', bg: '#E0F2FE', color: '#0369A1' },
    paid: { label: 'Paid', bg: '#DCFCE7', color: '#15803D' },
    completed: { label: 'Done', bg: '#ECFDF5', color: '#047857' },
    cancelled: { label: 'Cancelled', bg: '#FEE2E2', color: '#B91C1C' },
  };
  return map[status] || { label: status || 'Order', bg: '#F1F5F9', color: '#475569' };
}

function flattenErrors(errors) {
  if (!errors) return '';
  return Object.values(errors).flat().join('\n');
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  body: { padding: 16, gap: 12, paddingBottom: 90 },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, padding: 4, gap: 4 },
  segmentBtn: { flex: 1, minHeight: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 12, fontWeight: '900' },
  card: { borderWidth: 1, borderRadius: 12, padding: 16 },
  title: { fontSize: 16, fontWeight: '900' },
  sub: { fontSize: 13, fontWeight: '600', marginTop: 6, lineHeight: 19 },
  date: { fontSize: 11, fontWeight: '700', marginTop: 10 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchBox: { flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13 },
  searchInput: { flex: 1, fontSize: 13, fontWeight: '700' },
  addBtn: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statsGrid: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 14 },
  statIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statIconText: { fontSize: 11, fontWeight: '900' },
  statValue: { fontSize: 22, fontWeight: '900' },
  statLabel: { fontSize: 12, fontWeight: '800', marginTop: 2 },
  assetCard: { borderWidth: 1, borderRadius: 12, padding: 14 },
  marketGrid: { width: '100%', maxWidth: 980, alignSelf: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start', justifyContent: 'center' },
  marketCard: { borderWidth: 1, borderRadius: 10, padding: 12 },
  marketImage: { width: '100%', height: 108, borderRadius: 8, marginBottom: 10, backgroundColor: '#F8FAFC' },
  assetTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  assetTag: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  assetName: { fontSize: 14, fontWeight: '900', marginTop: 2, lineHeight: 19 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { fontSize: 11, fontWeight: '900' },
  assetMeta: { fontSize: 12, fontWeight: '700', lineHeight: 17, marginTop: 9 },
  notes: { fontSize: 12, fontWeight: '600', lineHeight: 18, marginTop: 8 },
  buyerPanel: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 12 },
  buyerTitle: { fontSize: 13, fontWeight: '900' },
  buyerEmpty: { fontSize: 12, fontWeight: '700', marginTop: 8 },
  buyerRow: { borderTopWidth: 1, paddingTop: 10, marginTop: 10, gap: 3 },
  buyerName: { fontSize: 13, fontWeight: '900' },
  buyerMeta: { fontSize: 11, fontWeight: '700', lineHeight: 16, marginTop: 2 },
  buyerFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  orderBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  orderBadgeText: { fontSize: 10, fontWeight: '900' },
  markPaidBtn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1.5, backgroundColor: 'transparent' },
  markPaidText: { fontSize: 12, fontWeight: '900' },

  // ── Receipt modal styles ──────────────────────────────────────────────────
  receiptSheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '92%', marginTop: 'auto' },
  receiptHeader: { padding: 18, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  receiptTitle: { fontSize: 18, fontWeight: '900' },
  receiptSub: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  receiptBody: { padding: 18, paddingBottom: 36, gap: 0 },
  receiptSchool: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 14 },
  receiptSchoolText: { fontSize: 12, fontWeight: '700' },
  receiptSection: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 6, marginTop: 14 },
  receiptCard: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginBottom: 2 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11 },
  receiptRowLabel: { fontSize: 12, fontWeight: '700' },
  receiptRowValue: { fontSize: 13, fontWeight: '900', maxWidth: '60%', textAlign: 'right' },
  paidStamp: { alignItems: 'center', marginTop: 20, marginBottom: 4 },
  paidStampInner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 2, borderColor: '#15803D', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  paidStampText: { fontSize: 18, fontWeight: '900', color: '#15803D', letterSpacing: 3 },
  receiptActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  printBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1.5, borderRadius: 12, minHeight: 48 },
  printBtnText: { fontSize: 13, fontWeight: '900' },
  confirmPaidBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, minHeight: 48 },
  confirmPaidText: { fontSize: 13, fontWeight: '900', color: '#fff' },
  // ─────────────────────────────────────────────────────────────────────────

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '90%' },
  modalHeader: { padding: 18, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '900' },
  modalSub: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  form: { padding: 18, paddingBottom: 30 },
  twoCol: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },
  label: { fontSize: 12, fontWeight: '900', marginTop: 12, marginBottom: 7 },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, fontSize: 14, fontWeight: '700' },
  textarea: { minHeight: 86, paddingTop: 12, textAlignVertical: 'top' },
  uploadBtn: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9 },
  uploadText: { flex: 1, fontSize: 13, fontWeight: '800' },
  previewRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  previewImage: { width: 72, height: 72, borderRadius: 10, backgroundColor: '#E5E7EB' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minWidth: '30%', flexGrow: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 11, paddingHorizontal: 8, alignItems: 'center' },
  chipText: { color: '#475569', fontSize: 12, fontWeight: '900' },
  saveBtn: { marginTop: 22, borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});
