import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Plus, X, Menu } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import {
  api,
  getActiveCompanyId,
  setActiveCompanyId,
  clearActiveCompanyId,
  type CompanyListItem,
  type Company,
} from '../../lib/api';
import { ListRow } from '../../components/ui/ListRow';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { colors, spacing, fontSize } from '../../theme/tokens';

/**
 * Ports pages/Tenants.tsx. Only superadmins see this (role-gated in
 * navConfig.ts). Editing a tenant uses the same "impersonate via
 * x-company-id header, hit /companies/me, then restore" trick as the
 * web version — see EditTenantModal below.
 */
export default function TenantsScreen() {
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const [rows, setRows] = useState<CompanyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const { companies } = await api.listCompanies();
      setRows(companies);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.openDrawer()} hitSlop={12}>
          <Menu size={22} color={colors.textStrong} />
        </Pressable>
        <Text style={styles.topBarTitle}>Tenants</Text>
        <Pressable onPress={() => setCreating(true)} hitSlop={12}>
          <Plus size={22} color={colors.accent} />
        </Pressable>
      </View>
      <Text style={styles.subtitle}>
        Each tenant is one factory / customer of TanaBana. Only superadmins see this page.
      </Text>

      {error ? (
        <View style={{ paddingHorizontal: spacing[4] }}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : rows.length === 0 ? (
        <EmptyState title="No tenants yet" description="Create the first one." />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <ListRow
              title={item.name}
              subtitle={[item.trade_name, item.gstin].filter(Boolean).join(' · ') || item.plan}
              badge={{
                label: item.is_active ? 'Active' : 'Inactive',
                tone: item.is_active ? 'success' : 'neutral',
              }}
              onPress={() => setEditingId(item.id)}
            />
          )}
        />
      )}

      <Modal visible={creating} animationType="slide" onRequestClose={() => setCreating(false)}>
        <CreateTenantModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            load();
          }}
        />
      </Modal>

      <Modal visible={!!editingId} animationType="slide" onRequestClose={() => setEditingId(null)}>
        {editingId ? (
          <EditTenantModal
            companyId={editingId}
            onClose={() => setEditingId(null)}
            onSaved={() => {
              setEditingId(null);
              load();
            }}
          />
        ) : null}
      </Modal>
    </View>
  );
}

function CreateTenantModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [gstin, setGstin] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');

  async function onSubmit() {
    setError('');
    if (!companyName || !ownerName || !ownerEmail) {
      setError('Company name and owner details are required.');
      return;
    }
    setBusy(true);
    try {
      await api.createCompany({
        company: {
          name: companyName,
          trade_name: tradeName || undefined,
          gstin: gstin || undefined,
          state_code: stateCode || undefined,
        },
        owner: {
          name: ownerName,
          email: ownerEmail,
        },
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.modalScreen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Create tenant</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <X size={22} color={colors.textStrong} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.modalContent}>
        {error ? <ErrorBanner message={error} /> : null}

        <Text style={styles.sectionLabel}>Company</Text>
        <TextField label="Company name *" value={companyName} onChangeText={setCompanyName} />
        <TextField label="Trade name" value={tradeName} onChangeText={setTradeName} />
        <TextField label="GSTIN" value={gstin} onChangeText={setGstin} />
        <TextField label="State code" value={stateCode} onChangeText={setStateCode} />

        <Text style={styles.sectionLabel}>Owner account</Text>
        <TextField label="Owner name *" value={ownerName} onChangeText={setOwnerName} />
        <TextField label="Owner email *" value={ownerEmail} onChangeText={setOwnerEmail} autoCapitalize="none" keyboardType="email-address" />
        <Text style={styles.hintText}>
          No password to set here — the owner gets a 6-digit activation code by email and chooses their own
          password on first login.
        </Text>

        <Button label={busy ? 'Creating…' : 'Create tenant'} onPress={onSubmit} loading={busy} fullWidth />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * Edits a tenant by briefly "acting as" it: sets the active-company-id
 * header, calls the normal /companies/me GET/PATCH, then restores
 * whatever company (if any) was active before — so the superadmin
 * isn't left silently scoped into a tenant after closing this modal.
 */
function EditTenantModal({
  companyId,
  onClose,
  onSaved,
}: {
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<Partial<Company>>({});
  const [prevActive, setPrevActive] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPrevActive(await getActiveCompanyId());
      await setActiveCompanyId(companyId);
      try {
        const { company } = await api.myCompany();
        if (!cancelled) setForm(company);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  async function restoreActive() {
    if (prevActive) await setActiveCompanyId(prevActive);
    else await clearActiveCompanyId();
  }

  function set<K extends keyof Company>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v as Company[K] }));
  }

  async function onSubmit() {
    setError('');
    setBusy(true);
    try {
      await api.updateMyCompany({
        name: form.name,
        trade_name: form.trade_name,
        gstin: form.gstin,
        pan: form.pan,
        address: form.address,
        city: form.city,
        state: form.state,
        state_code: form.state_code,
        pincode: form.pincode,
        phone: form.phone,
        email: form.email,
      });
      await restoreActive();
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
      setBusy(false);
    }
  }

  async function handleClose() {
    await restoreActive();
    onClose();
  }

  const textFields: { key: keyof Company; label: string }[] = [
    { key: 'name', label: 'Company name' },
    { key: 'trade_name', label: 'Trade name' },
    { key: 'gstin', label: 'GSTIN' },
    { key: 'pan', label: 'PAN' },
    { key: 'address', label: 'Address' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'state_code', label: 'State code' },
    { key: 'pincode', label: 'Pincode' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
  ];

  return (
    <KeyboardAvoidingView style={styles.modalScreen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Edit tenant</Text>
        <Pressable onPress={handleClose} hitSlop={12}>
          <X size={22} color={colors.textStrong} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.modalContent}>
        {error ? <ErrorBanner message={error} /> : null}
        {loading ? (
          <ActivityIndicator size="large" color={colors.accent} />
        ) : (
          <>
            {textFields.map((f) => (
              <TextField
                key={f.key}
                label={f.label}
                value={(form[f.key] as string) || ''}
                onChangeText={(v) => set(f.key, v)}
              />
            ))}
            <Button label={busy ? 'Saving…' : 'Save'} onPress={onSubmit} loading={busy} fullWidth />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing[4], paddingBottom: spacing[1] },
  topBarTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textStrong },
  subtitle: { fontSize: fontSize.sm, color: colors.textMuted, paddingHorizontal: spacing[4], marginBottom: spacing[3] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  modalScreen: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textStrong },
  modalContent: { padding: spacing[4] },
  sectionLabel: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginBottom: spacing[2], marginTop: spacing[2] },
  hintText: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing[3], lineHeight: 16 },
});
