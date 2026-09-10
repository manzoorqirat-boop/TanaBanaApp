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
import { ListRow } from '../ui/ListRow';
import { TextField } from '../ui/TextField';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { ErrorBanner } from '../ui/ErrorBanner';
import { FieldForm } from './FieldForm';
import type { FieldConfig } from './types';
import { colors, spacing, fontSize } from '../../theme/tokens';

interface BaseItem {
  id: string;
  is_active?: boolean;
}

interface MasterCrudScreenProps<TItem extends BaseItem, TInput> {
  title: string;
  emptyLabel: string;
  fields: FieldConfig<TInput>[];
  searchable?: boolean;
  listFn: (params?: { q?: string; limit?: number }) => Promise<TItem[]>;
  createFn?: (input: TInput) => Promise<unknown>;
  updateFn?: (id: string, patch: Partial<TInput> & { is_active?: boolean }) => Promise<unknown>;
  /** Shown as a danger button in the edit modal when provided (soft-deactivate or hard delete, worded via deleteLabel). */
  deactivateFn?: (id: string) => Promise<unknown>;
  deleteLabel?: string;
  getTitle: (item: TItem) => string;
  getSubtitle?: (item: TItem) => string | undefined;
  getBadge?: (item: TItem) => { label: string; tone: 'success' | 'warning' | 'error' | 'neutral' } | undefined;
  /** Convert an existing item into the string-keyed form state for editing. */
  toFormValues?: (item: TItem) => Record<string, string>;
  /** Convert form state (all strings) into the typed TInput before calling create/update. */
  fromFormValues: (values: Record<string, string>) => TInput;
  /**
   * When true, renders as a plain read-only list — no create button, no
   * row tap, no edit/delete — regardless of which of createFn/updateFn/
   * deactivateFn were passed in. For screens where only some roles can
   * write (e.g. Equipment Master: superadmin edits, everyone else just
   * views the shared catalog) rather than a screen that's read-only for
   * every role.
   */
  readOnly?: boolean;
}

/**
 * Drives 8 of Phase 1's 10 pages (Units, Machines, Operators,
 * Suppliers, Customers, Equipment Master, Overheads, Tenants — Job
 * Workers reuses it too for its master list). Each screen is just this
 * component configured with field definitions and the matching
 * `api.*` functions — see e.g. UnitsScreen.tsx for the ~40-line usage.
 *
 * StockAlerts doesn't use this — it's a read-only report with no
 * create/edit, not a CRUD master.
 */
export function MasterCrudScreen<TItem extends BaseItem, TInput>({
  title,
  emptyLabel,
  fields,
  searchable = true,
  listFn,
  createFn,
  updateFn,
  deactivateFn,
  deleteLabel = 'Deactivate',
  getTitle,
  getSubtitle,
  getBadge,
  toFormValues,
  fromFormValues,
  readOnly = false,
}: MasterCrudScreenProps<TItem, TInput>) {
  // Collapse the three write callbacks to undefined when readOnly —
  // every render path below already keys off "is this fn provided",
  // so this alone removes the create button, row-tap-to-edit, and the
  // delete/deactivate button without touching any of that logic.
  createFn = readOnly ? undefined : createFn;
  updateFn = readOnly ? undefined : updateFn;
  deactivateFn = readOnly ? undefined : deactivateFn;
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const [items, setItems] = useState<TItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TItem | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [formIsActive, setFormIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(
    async (q?: string) => {
      setError('');
      try {
        const data = await listFn(q ? { q, limit: 200 } : { limit: 200 });
        setItems(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Load failed');
      }
    },
    [listFn],
  );

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load(query || undefined);
    setRefreshing(false);
  }

  function onSearchSubmit() {
    setLoading(true);
    load(query || undefined).finally(() => setLoading(false));
  }

  function openCreate() {
    setEditingItem(null);
    setFormValues({});
    setFormIsActive(true);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(item: TItem) {
    setEditingItem(item);
    setFormValues(toFormValues ? toFormValues(item) : {});
    setFormIsActive(item.is_active ?? true);
    setFormError('');
    setModalOpen(true);
  }

  async function onSave() {
    setSaving(true);
    setFormError('');
    try {
      const input = fromFormValues(formValues);
      if (editingItem) {
        if (!updateFn) throw new Error('Update not supported');
        await updateFn(editingItem.id, { ...input, is_active: formIsActive });
      } else {
        if (!createFn) throw new Error('Create not supported');
        await createFn(input);
      }
      setModalOpen(false);
      await load(query || undefined);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!editingItem || !deactivateFn) return;
    setDeleting(true);
    setFormError('');
    try {
      await deactivateFn(editingItem.id);
      setModalOpen(false);
      await load(query || undefined);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.openDrawer()} hitSlop={12}>
          <Menu size={22} color={colors.textStrong} />
        </Pressable>
        <Text style={styles.topBarTitle}>{title}</Text>
        {createFn ? (
          <Pressable onPress={openCreate} hitSlop={12}>
            <Plus size={22} color={colors.accent} />
          </Pressable>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </View>

      {searchable ? (
        <View style={styles.searchBar}>
          <TextField
            label=""
            value={query}
            onChangeText={setQuery}
            placeholder="Search…"
            onSubmitEditing={onSearchSubmit}
            returnKeyType="search"
            style={styles.searchInput}
          />
        </View>
      ) : null}

      {error ? (
        <View style={{ paddingHorizontal: spacing[4] }}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : items.length === 0 ? (
        <EmptyState title={emptyLabel} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <ListRow
              title={getTitle(item)}
              subtitle={getSubtitle?.(item)}
              badge={
                getBadge?.(item) ??
                (item.is_active === false ? { label: 'Inactive', tone: 'neutral' } : undefined)
              }
              onPress={updateFn ? () => openEdit(item) : undefined}
            />
          )}
        />
      )}

      <Modal visible={modalOpen} animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView
          style={styles.modalScreen}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingItem ? `Edit ${title}` : `New ${title}`}</Text>
            <Pressable onPress={() => setModalOpen(false)} hitSlop={12}>
              <X size={22} color={colors.textStrong} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {formError ? <ErrorBanner message={formError} /> : null}
            <FieldForm
              fields={fields}
              values={formValues}
              onChange={(key, value) => setFormValues((prev) => ({ ...prev, [key]: value }))}
              mode={editingItem ? 'edit' : 'create'}
              isActive={formIsActive}
              onIsActiveChange={setFormIsActive}
              showIsActiveToggle={!!editingItem && editingItem.is_active !== undefined}
            />
            <Button
              label={saving ? 'Saving…' : 'Save'}
              onPress={onSave}
              loading={saving}
              fullWidth
            />
            {editingItem && deactivateFn ? (
              <>
                <View style={{ height: spacing[2] }} />
                <Button
                  label={deleting ? 'Please wait…' : deleteLabel}
                  onPress={onDelete}
                  loading={deleting}
                  variant="danger"
                  fullWidth
                />
              </>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4],
  },
  topBarTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textStrong },
  searchBar: { paddingHorizontal: spacing[4] },
  searchInput: { marginBottom: spacing[2] },
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
});